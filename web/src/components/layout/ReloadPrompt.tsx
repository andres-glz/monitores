import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'

/**
 * Aviso de nueva versión de la app. No se recarga sola para no interrumpir una captura.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Revisa si hay versión nueva cada hora
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-xl bg-slate-900 p-4 text-white shadow-xl lg:bottom-6 dark:ring-1 dark:ring-slate-700">
      <p className="text-sm">Hay una nueva versión de la aplicación.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800" onClick={() => setNeedRefresh(false)}>
          Después
        </Button>
        <Button size="sm" icon={RefreshCw} onClick={() => updateServiceWorker(true)}>
          Actualizar
        </Button>
      </div>
    </div>
  )
}
