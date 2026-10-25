import { useSyncExternalStore } from 'react'

// Tema de la interfaz: el del sistema operativo o uno fijo elegido en este dispositivo

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  // Tema efectivo ('system' ya resuelto con la configuración del dispositivo)
  theme: 'light' | 'dark'
}

// index.html lee la misma clave para aplicar el tema antes de pintar y evitar el destello claro
const THEME_KEY = 'monitores:theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function resolve(preference: ThemePreference): ThemeState {
  return { preference, theme: preference === 'system' ? (darkQuery.matches ? 'dark' : 'light') : preference }
}

let state = resolve(readPreference())
document.documentElement.classList.toggle('dark', state.theme === 'dark')

function apply(next: ThemeState) {
  state = next
  document.documentElement.classList.toggle('dark', next.theme === 'dark')
  listeners.forEach((listener) => listener())
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Sin almacenamiento disponible el tema solo dura mientras la app esté abierta
  }
  apply(resolve(preference))
}

// Sigue al dispositivo cuando cambia (p. ej. modo oscuro automático al anochecer)
darkQuery.addEventListener('change', () => {
  if (state.preference === 'system') apply(resolve('system'))
})

// Mantiene igual el tema en otras pestañas abiertas
window.addEventListener('storage', (event) => {
  if (event.key === THEME_KEY) apply(resolve(readPreference()))
})

export function useTheme(): ThemeState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
