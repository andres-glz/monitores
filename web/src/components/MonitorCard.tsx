import { CloudUpload, Image, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { monitorPath, type MonitorRow } from '../lib/monitorView'
import { MonitorBadge } from './ui/StatusBadge'

interface MonitorCardProps {
  row: MonitorRow
  showHospital?: boolean
  /** Adónde regresa el detalle del monitor (por defecto, al hospital) */
  backTo?: string
}

/**
 * Tarjeta de un monitor en listas y resultados de búsqueda.
 */
export function MonitorCard({ row, showHospital = false, backTo }: MonitorCardProps) {
  const { monitor } = row

  return (
    <Link
      to={monitorPath(monitor)}
      state={backTo ? { backTo } : undefined}
      className="block rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-teal-300 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-teal-500/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900 dark:text-slate-100">{row.modelLabel}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Serie: <strong className="font-medium text-slate-700 dark:text-slate-300">{monitor.serial_number ?? '—'}</strong>
            </span>
            <span>
              NNI: <strong className="font-medium text-slate-700 dark:text-slate-300">{monitor.inventory_number ?? '—'}</strong>
            </span>
          </div>
        </div>
        <MonitorBadge monitor={monitor} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {showHospital && <span className="font-medium text-slate-700 dark:text-slate-300">{row.hospitalName}</span>}
        <span>{row.serviceName}</span>
        {monitor.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-3" />
            {monitor.location}
          </span>
        )}
        {row.missingCount > 0 && <span className="text-rose-700 dark:text-rose-400">{row.missingCount} falta{row.missingCount === 1 ? '' : 'n'}</span>}
        {row.faultyCount > 0 && <span className="text-amber-700 dark:text-amber-400">{row.faultyCount} no funciona{row.faultyCount === 1 ? '' : 'n'}</span>}
        {monitor.photos.length > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Image className="size-3" />
            {monitor.photos.length}
          </span>
        )}
        {monitor.pending && (
          <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400" title="Pendiente de sincronizar">
            <CloudUpload className="size-3" />
            Pendiente
          </span>
        )}
      </div>
    </Link>
  )
}
