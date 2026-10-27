import { NOT_FOUND_LABEL, NOT_FOUND_STYLES, STATUS_LABELS, STATUS_ORDER, STATUS_STYLES, isFound } from '../lib/status'
import type { Monitor } from '../lib/types'

export type StatusCounts = Record<Monitor['status'], number>

/** Dictámenes de los monitores encontrados (el de un monitor no encontrado no se toma en cuenta) */
export function countStatuses(items: Pick<Monitor, 'status' | 'is_found'>[]): StatusCounts {
  const counts: StatusCounts = { complete: 0, functional_incomplete: 0, non_functional: 0 }
  for (const item of items) if (isFound(item)) counts[item.status]++
  return counts
}

/** Barra apilada con la proporción de cada dictamen y, si se indica, de los no encontrados */
export function StatusBar({ counts, notFound = 0, className = 'h-2' }: { counts: StatusCounts; notFound?: number; className?: string }) {
  const segments = [
    ...STATUS_ORDER.map((status) => ({ key: status, value: counts[status], color: STATUS_STYLES[status].dot, label: STATUS_LABELS[status] })),
    { key: 'not_found', value: notFound, color: NOT_FOUND_STYLES.dot, label: NOT_FOUND_LABEL },
  ]
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
      {total > 0 &&
        segments.map(
          (segment) =>
            segment.value > 0 && (
              <div
                key={segment.key}
                className={segment.color}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ),
        )}
    </div>
  )
}
