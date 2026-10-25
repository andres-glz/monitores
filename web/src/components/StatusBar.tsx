import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from '../lib/status'
import type { MonitorStatus } from '../lib/types'

export type StatusCounts = Record<MonitorStatus, number>

export function countStatuses(items: { status: MonitorStatus }[]): StatusCounts {
  const counts: StatusCounts = { complete: 0, functional_incomplete: 0, non_functional: 0 }
  for (const item of items) counts[item.status]++
  return counts
}

/** Barra apilada con la proporción de cada dictamen */
export function StatusBar({ counts, className = 'h-2' }: { counts: StatusCounts; className?: string }) {
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0)

  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
      {total > 0 &&
        STATUS_ORDER.map(
          (status) =>
            counts[status] > 0 && (
              <div
                key={status}
                className={STATUS_STYLES[status].dot}
                style={{ width: `${(counts[status] / total) * 100}%` }}
                title={`${STATUS_LABELS[status]}: ${counts[status]}`}
              />
            ),
        )}
    </div>
  )
}
