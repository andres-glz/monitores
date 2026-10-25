import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, onUnauthorized } from '../lib/api'
import type { User } from '../lib/types'
import { clearLocalData, db, requestPersistentStorage } from '../offline/db'
import { requestSync, startSyncLoop } from '../offline/sync'

/**
 * Sesión del usuario. Se guarda una copia del usuario en el dispositivo para poder
 * seguir capturando sin conexión; si la sesión expira se pide iniciar sesión de nuevo
 * sin perder los cambios pendientes.
 */

const USER_STORAGE_KEY = 'monitores:user'

interface AuthContextValue {
  user: User | null
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateCachedUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_STORAGE_KEY)
  } catch {
    // Sin almacenamiento local la sesión dura solo mientras la pestaña esté abierta
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readCachedUser)
  const [sessionExpired, setSessionExpired] = useState(false)

  const updateCachedUser = useCallback((next: User) => {
    writeCachedUser(next)
    setUser(next)
  }, [])

  // Al expirar la sesión: si no hay cambios pendientes se regresa al login; si los hay, se avisa
  const handleUnauthorized = useCallback(async () => {
    const pending = await db.outbox.count()
    if (pending === 0) {
      writeCachedUser(null)
      setUser(null)
    } else {
      setSessionExpired(true)
    }
  }, [])

  useEffect(() => onUnauthorized(() => void handleUnauthorized()), [handleUnauthorized])

  // Valida la sesión guardada al abrir la app (si no hay red se conserva la copia local)
  useEffect(() => {
    if (!readCachedUser()) return
    api
      .get<User>('/auth/me')
      .then(updateCachedUser)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) void handleUnauthorized()
      })
  }, [updateCachedUser, handleUnauthorized])

  // La sincronización automática corre mientras haya un usuario con sesión
  useEffect(() => {
    if (!user || sessionExpired) return
    void requestPersistentStorage()
    return startSyncLoop()
  }, [user, sessionExpired])

  const login = useCallback(
    async (email: string, password: string) => {
      const loggedUser = await api.post<User>('/auth/login', { email, password })
      updateCachedUser(loggedUser)
      setSessionExpired(false)
      void requestSync()
    },
    [updateCachedUser],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Aunque falle la red, se cierra la sesión en el dispositivo
    }
    await clearLocalData()
    writeCachedUser(null)
    setSessionExpired(false)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, sessionExpired, login, logout, updateCachedUser }),
    [user, sessionExpired, login, logout, updateCachedUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
