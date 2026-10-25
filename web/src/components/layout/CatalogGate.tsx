import { CloudOff, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCatalog } from '../../hooks/useCatalog'
import { requestSync, useSyncState } from '../../offline/sync'
import { Button } from '../ui/Button'
import { EmptyState, LoadingState } from '../ui/EmptyState'

/**
 * Muestra el contenido solo cuando los catálogos ya están en el dispositivo
 * (la primera vez requiere conexión).
 */
export function CatalogGate({ children }: { children: ReactNode }) {
  const catalog = useCatalog()
  const { phase, message } = useSyncState()

  if (catalog === undefined) return <LoadingState />

  if (catalog === null) {
    if (phase === 'syncing' || phase === 'idle') {
      return <LoadingState message="Descargando información por primera vez…" />
    }
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <EmptyState
          icon={CloudOff}
          title="Aún no hay datos en este dispositivo"
          description={
            message ?? 'Conéctate a internet para descargar los catálogos la primera vez. Después podrás trabajar sin conexión.'
          }
          action={
            <Button icon={RefreshCw} onClick={() => requestSync()}>
              Reintentar
            </Button>
          }
        />
      </div>
    )
  }

  return children
}
