import { STATUS_LABELS, STATUS_STYLES } from '../../lib/status'
import type { MonitorStatus } from '../../lib/types'

export function StatusBadge({ status, size = 'sm' }: { status: MonitorStatus; size?: 'sm' | 'md' }) {
  const style = STATUS_STYLES[status]
  const sizing = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset ${style.badge} ${sizing}`}>
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  )
}
