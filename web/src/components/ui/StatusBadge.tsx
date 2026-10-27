import { NOT_FOUND_LABEL, NOT_FOUND_STYLES, STATUS_LABELS, STATUS_STYLES, isFound } from '../../lib/status'
import type { Monitor, MonitorStatus } from '../../lib/types'

type BadgeSize = 'sm' | 'md'

export function StatusBadge({ status, size = 'sm' }: { status: MonitorStatus; size?: BadgeSize }) {
  const style = STATUS_STYLES[status]
  return <Badge label={STATUS_LABELS[status]} badge={style.badge} dot={style.dot} size={size} />
}

export function NotFoundBadge({ size = 'sm' }: { size?: BadgeSize }) {
  return <Badge label={NOT_FOUND_LABEL} badge={NOT_FOUND_STYLES.badge} dot={NOT_FOUND_STYLES.dot} size={size} />
}

/** Dictamen del monitor, o "No encontrado" si no se localizó (su dictamen no se toma en cuenta) */
export function MonitorBadge({ monitor, size = 'sm' }: { monitor: Pick<Monitor, 'is_found' | 'status'>; size?: BadgeSize }) {
  return isFound(monitor) ? <StatusBadge status={monitor.status} size={size} /> : <NotFoundBadge size={size} />
}

function Badge({ label, badge, dot, size }: { label: string; badge: string; dot: string; size: BadgeSize }) {
  const sizing = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${badge} ${sizing}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
