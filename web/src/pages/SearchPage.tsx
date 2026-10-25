import { Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { MonitorCard } from '../components/MonitorCard'
import { EmptyState, LoadingState } from '../components/ui/EmptyState'
import { TextInput } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { useCatalog } from '../hooks/useCatalog'
import { useAllMonitors } from '../hooks/useMonitors'
import { plural } from '../lib/format'
import { describeMonitor, matchesQuery } from '../lib/monitorView'

const MAX_RESULTS = 100

/**
 * Búsqueda por coincidencia en todos los hospitales (funciona sin conexión).
 */
export function SearchPage() {
  const catalog = useCatalog()
  const monitors = useAllMonitors()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const rows = useMemo(
    () => (catalog && monitors ? monitors.map((monitor) => describeMonitor(monitor, catalog)) : []),
    [catalog, monitors],
  )
  const results = useMemo(
    () => (deferredQuery.trim() ? rows.filter((row) => matchesQuery(row, deferredQuery)) : []),
    [rows, deferredQuery],
  )

  if (!catalog) return null

  return (
    <>
      <PageHeader title="Buscar monitores" subtitle="Por número de serie, número nacional de inventario, servicio, modelo o ubicación." />

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <TextInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej. CM123, 5310200, urgencias…"
          className="h-12 pl-10 text-base"
          autoFocus
        />
      </div>

      {!monitors ? (
        <LoadingState />
      ) : !deferredQuery.trim() ? (
        <EmptyState icon={Search} title="Escribe para buscar" description={`Hay ${plural(monitors.length, 'monitor', 'monitores')} en este dispositivo.`} />
      ) : results.length === 0 ? (
        <EmptyState icon={Search} title="Sin coincidencias" description="Revisa el número o intenta con menos caracteres." />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {plural(results.length, 'resultado', 'resultados')}
            {results.length > MAX_RESULTS && ` (se muestran los primeros ${MAX_RESULTS})`}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {results.slice(0, MAX_RESULTS).map((row) => (
              <MonitorCard key={row.monitor.uuid} row={row} showHospital />
            ))}
          </div>
        </>
      )}
    </>
  )
}
