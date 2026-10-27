import { ArrowDown, ArrowUp, ArrowUpDown, CloudUpload } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { formatDate } from '../lib/format'
import { compareByLocation, monitorPath, type MonitorRow } from '../lib/monitorView'
import { NOT_FOUND_LABEL, STATUS_ORDER, isFound } from '../lib/status'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { MonitorBadge } from './ui/StatusBadge'
import { Switch } from './ui/Switch'

type SortValue = string | number | null

export interface MonitorColumn {
  id: string
  label: string
  defaultVisible: boolean
  sortValue: (row: MonitorRow) => SortValue
  render: (row: MonitorRow) => ReactNode
  className?: string
  /** Cantidades: alineadas a la derecha */
  numeric?: boolean
}

export interface SortState {
  column: string
  direction: 'asc' | 'desc'
}

function countCell(count: number, tone: string): ReactNode {
  return count > 0 ? <span className={`font-medium ${tone}`}>{count}</span> : <span className="text-slate-400 dark:text-slate-500">—</span>
}

/** Columnas disponibles, en el orden en que se muestran */
export const MONITOR_COLUMNS: MonitorColumn[] = [
  {
    id: 'serial',
    label: 'Serie',
    defaultVisible: true,
    sortValue: (row) => row.monitor.serial_number,
    render: (row) => row.monitor.serial_number ?? '—',
    className: 'font-medium text-slate-900 dark:text-slate-100',
  },
  {
    id: 'inventory',
    label: 'NNI',
    defaultVisible: true,
    sortValue: (row) => row.monitor.inventory_number,
    render: (row) => row.monitor.inventory_number ?? '—',
    className: 'font-medium text-slate-900 dark:text-slate-100',
  },
  { id: 'brand', label: 'Marca', defaultVisible: true, sortValue: (row) => row.brandName, render: (row) => row.brandName || '—' },
  { id: 'model', label: 'Modelo', defaultVisible: true, sortValue: (row) => row.modelName, render: (row) => row.modelName },
  { id: 'service', label: 'Servicio', defaultVisible: true, sortValue: (row) => row.serviceName, render: (row) => row.serviceName },
  {
    id: 'location',
    label: 'Ubicación',
    defaultVisible: true,
    sortValue: (row) => row.monitor.location,
    render: (row) => row.monitor.location ?? '—',
  },
  {
    id: 'status',
    label: 'Dictamen',
    defaultVisible: true,
    // Los no encontrados van después de los dictámenes
    sortValue: (row) => (isFound(row.monitor) ? STATUS_ORDER.indexOf(row.monitor.status) : STATUS_ORDER.length),
    render: (row) => <MonitorBadge monitor={row.monitor} />,
  },
  {
    id: 'found',
    label: 'Localización',
    defaultVisible: false,
    sortValue: (row) => (isFound(row.monitor) ? 0 : 1),
    render: (row) => (isFound(row.monitor) ? 'Encontrado' : NOT_FOUND_LABEL),
  },
  {
    id: 'missing',
    label: 'Faltan',
    defaultVisible: true,
    sortValue: (row) => row.missingCount,
    render: (row) => countCell(row.missingCount, 'text-rose-700 dark:text-rose-400'),
    numeric: true,
  },
  {
    id: 'faulty',
    label: 'No funcionan',
    defaultVisible: true,
    sortValue: (row) => row.faultyCount,
    render: (row) => countCell(row.faultyCount, 'text-amber-700 dark:text-amber-400'),
    numeric: true,
  },
  { id: 'mount', label: 'Tipo', defaultVisible: false, sortValue: (row) => row.mountTypeLabel, render: (row) => row.mountTypeLabel || '—' },
  {
    id: 'photos',
    label: 'Fotos',
    defaultVisible: false,
    sortValue: (row) => row.monitor.photos.length,
    render: (row) => row.monitor.photos.length || <span className="text-slate-400 dark:text-slate-500">—</span>,
    numeric: true,
  },
  {
    id: 'updated',
    label: 'Actualizado',
    defaultVisible: false,
    sortValue: (row) => row.monitor.updated_at,
    render: (row) => formatDate(row.monitor.updated_at),
  },
  {
    id: 'updatedBy',
    label: 'Actualizó',
    defaultVisible: false,
    sortValue: (row) => row.monitor.updated_by_name,
    render: (row) => row.monitor.updated_by_name ?? '—',
  },
  {
    id: 'notes',
    label: 'Observaciones',
    defaultVisible: false,
    sortValue: (row) => row.monitor.notes,
    render: (row) => (
      <span className="block max-w-64 truncate" title={row.monitor.notes ?? undefined}>
        {row.monitor.notes ?? '—'}
      </span>
    ),
  },
]

export const DEFAULT_COLUMN_IDS = MONITOR_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.id)

/** Orden en la URL: "serial" ascendente, "-serial" descendente */
export function parseSort(value: string | null): SortState | null {
  if (!value) return null
  const direction = value.startsWith('-') ? 'desc' : 'asc'
  const column = value.replace(/^-/, '')
  return MONITOR_COLUMNS.some((item) => item.id === column) ? { column, direction } : null
}

export function formatSort(sort: SortState | null): string | null {
  return sort ? `${sort.direction === 'desc' ? '-' : ''}${sort.column}` : null
}

// Los vacíos siempre van al final, sin importar la dirección
function compareValues(a: SortValue, b: SortValue, direction: SortState['direction']): number {
  const aEmpty = a === null || a === ''
  const bEmpty = b === null || b === ''
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1
  const result =
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
  return direction === 'asc' ? result : -result
}

/** Sin orden elegido, igual que las tarjetas: por servicio y luego por ubicación */
export function sortRows(rows: MonitorRow[], sort: SortState | null): MonitorRow[] {
  const column = sort ? MONITOR_COLUMNS.find((item) => item.id === sort.column) : undefined
  return [...rows].sort(
    (a, b) =>
      (column && sort ? compareValues(column.sortValue(a), column.sortValue(b), sort.direction) : 0) ||
      a.serviceName.localeCompare(b.serviceName, 'es') ||
      compareByLocation(a, b),
  )
}

interface MonitorTableProps {
  rows: MonitorRow[]
  columns: MonitorColumn[]
  sort: SortState | null
  onSortChange: (sort: SortState | null) => void
  /** Adónde regresa el detalle del monitor (la lista con sus filtros) */
  backTo: string
}

/**
 * Tabla compacta de monitores: cada renglón abre el detalle y los encabezados ordenan
 * (ascendente, descendente y de nuevo el orden normal).
 */
export function MonitorTable({ rows, columns, sort, onSortChange, backTo }: MonitorTableProps) {
  const navigate = useNavigate()
  const open = (row: MonitorRow) => navigate(monitorPath(row.monitor), { state: { backTo } })

  const toggleSort = (columnId: string) => {
    if (sort?.column !== columnId) onSortChange({ column: columnId, direction: 'asc' })
    else if (sort.direction === 'asc') onSortChange({ column: columnId, direction: 'desc' })
    else onSortChange(null)
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            {columns.map((column) => {
              const active = sort?.column === column.id
              const SortIcon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap first:pl-4 last:pr-4 ${column.numeric ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.id)}
                    className={`inline-flex items-center gap-1 rounded py-1 hover:text-slate-900 dark:hover:text-slate-100 ${
                      active ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {column.label}
                    <SortIcon className={`size-3.5 ${active ? '' : 'opacity-40'}`} />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => (
            <tr
              key={row.monitor.uuid}
              tabIndex={0}
              role="link"
              aria-label={`${row.modelLabel}, serie ${row.monitor.serial_number ?? 'sin número'}`}
              onClick={() => open(row)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') open(row)
              }}
              className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-600 dark:hover:bg-slate-800/50 dark:focus-visible:bg-slate-800/50 dark:focus-visible:outline-teal-500"
            >
              {columns.map((column, index) => (
                <td key={column.id} className={`px-3 py-2.5 whitespace-nowrap text-slate-700 first:pl-4 last:pr-4 dark:text-slate-300 ${column.numeric ? 'text-right tabular-nums' : ''} ${column.className ?? ''}`}>
                  {index === 0 && row.monitor.pending ? (
                    <span className="inline-flex items-center gap-1.5">
                      {column.render(row)}
                      <span title="Pendiente de sincronizar" className="text-amber-700 dark:text-amber-400">
                        <CloudUpload className="size-3.5" />
                      </span>
                    </span>
                  ) : (
                    column.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ColumnPickerProps {
  open: boolean
  onClose: () => void
  columnIds: string[]
  // Recibe una función para no perder cambios si se tocan varios interruptores muy rápido
  onChange: (update: (columnIds: string[]) => string[]) => void
}

/**
 * Elige qué columnas muestra la tabla; siempre debe quedar al menos una.
 */
export function ColumnPicker({ open, onClose, columnIds, onChange }: ColumnPickerProps) {
  const toggle = (columnId: string, visible: boolean) =>
    onChange((current) => {
      const next = MONITOR_COLUMNS.filter((column) => (column.id === columnId ? visible : current.includes(column.id))).map((column) => column.id)
      return next.length > 0 ? next : current
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Columnas de la tabla"
      footer={
        <>
          <Button variant="secondary" onClick={() => onChange(() => DEFAULT_COLUMN_IDS)}>
            Restablecer
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Si eliges muchas, desliza la tabla hacia los lados para verlas.</p>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {MONITOR_COLUMNS.map((column) => {
          const visible = columnIds.includes(column.id)
          return (
            <Switch
              key={column.id}
              label={column.label}
              checked={visible}
              disabled={visible && columnIds.length === 1}
              onChange={(checked) => toggle(column.id, checked)}
            />
          )
        })}
      </div>
    </Modal>
  )
}
