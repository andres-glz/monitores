import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { db } from '../offline/db'

/**
 * Cierra sesión pidiendo confirmación, con advertencia si hay cambios sin sincronizar.
 */
export function useLogout(): () => Promise<void> {
  const { logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  return async () => {
    const pending = await db.outbox.count()
    const accepted = await confirm({
      title: 'Cerrar sesión',
      message:
        pending > 0
          ? `Tienes ${pending} cambio(s) sin sincronizar. Si cierras sesión ahora se perderán. Conéctate a internet y espera a que se sincronicen antes de salir.`
          : 'Se borrarán los datos guardados en este dispositivo. Podrás volver a descargarlos al iniciar sesión.',
      confirmLabel: pending > 0 ? 'Cerrar sesión y perder cambios' : 'Cerrar sesión',
      danger: pending > 0,
    })
    if (!accepted) return
    await logout()
    navigate('/login', { replace: true })
  }
}
