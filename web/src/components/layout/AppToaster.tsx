import { Toaster } from 'sonner'
import { useTheme } from '../../lib/theme'

/**
 * Notificaciones con el mismo tema que la aplicación.
 */
export function AppToaster() {
  const { theme } = useTheme()
  return <Toaster position="top-center" richColors closeButton duration={2500} theme={theme} />
}
