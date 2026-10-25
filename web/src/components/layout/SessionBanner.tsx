import { LockKeyhole } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'

/**
 * Aviso cuando la sesión expiró pero hay cambios locales sin sincronizar.
 */
export function SessionBanner() {
  const { sessionExpired } = useAuth()
  if (!sessionExpired) return null

  return (
    <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 text-sm text-rose-800 dark:text-rose-300">
        <span className="flex items-center gap-2">
          <LockKeyhole className="size-4 shrink-0" />
          Tu sesión expiró. Tus capturas siguen guardadas en este dispositivo.
        </span>
        <Link to="/login" className="shrink-0 font-semibold underline underline-offset-2">
          Iniciar sesión
        </Link>
      </div>
    </div>
  )
}
