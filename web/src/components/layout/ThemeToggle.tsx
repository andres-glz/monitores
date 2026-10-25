import { Moon, Sun } from 'lucide-react'
import { setThemePreference, useTheme } from '../../lib/theme'
import { IconButton } from '../ui/Button'

/**
 * Cambio rápido entre tema claro y oscuro. La opción de seguir al dispositivo está en Configuración.
 */
export function ThemeToggle() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <IconButton
      icon={isDark ? Sun : Moon}
      label={isDark ? 'Usar tema claro' : 'Usar tema oscuro'}
      onClick={() => setThemePreference(isDark ? 'light' : 'dark')}
    />
  )
}
