import { useLiveQuery } from 'dexie-react-hooks'
import { CircleAlert, CircleCheck, CloudUpload, LoaderCircle, LockKeyhole, WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { db } from '../../offline/db'
import { useSyncState } from '../../offline/sync'

/**
 * Estado de la sincronización: pendientes, sin conexión, errores.
 */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { phase } = useSyncState()
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)

  let Icon = CircleCheck
  let text = 'Sincronizado'
  let tone = 'text-emerald-700 bg-emerald-50'

  if (phase === 'syncing') {
    Icon = LoaderCircle
    text = 'Sincronizando…'
    tone = 'text-teal-700 bg-teal-50'
  } else if (phase === 'unauthorized') {
    Icon = LockKeyhole
    text = 'Sesión expirada'
    tone = 'text-rose-700 bg-rose-50'
  } else if (phase === 'offline') {
    Icon = WifiOff
    text = pending > 0 ? `Sin conexión · ${pending} pendiente${pending === 1 ? '' : 's'}` : 'Sin conexión'
    tone = 'text-slate-700 bg-slate-100'
  } else if (phase === 'error') {
    Icon = CircleAlert
    text = 'Error al sincronizar'
    tone = 'text-rose-700 bg-rose-50'
  } else if (pending > 0) {
    Icon = CloudUpload
    text = `${pending} pendiente${pending === 1 ? '' : 's'}`
    tone = 'text-amber-800 bg-amber-50'
  }

  return (
    <Link
      to="/settings#sync"
      title={text}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      <Icon className={`size-3.5 ${phase === 'syncing' ? 'animate-spin' : ''}`} />
      {compact ? <span className="max-[380px]:hidden">{text}</span> : text}
    </Link>
  )
}
