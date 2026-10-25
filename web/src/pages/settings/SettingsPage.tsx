import { useLiveQuery } from 'dexie-react-hooks'
import {
  Boxes,
  ChevronRight,
  CircleAlert,
  Cloud,
  DownloadCloud,
  LogOut,
  MonitorCheck,
  RefreshCw,
  Stethoscope,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { PageHeader } from '../../components/ui/PageHeader'
import { useCatalog } from '../../hooks/useCatalog'
import { useLogout } from '../../hooks/useLogout'
import { formatDateTime, plural } from '../../lib/format'
import { db, type OutboxItem } from '../../offline/db'
import { discardOutboxItem, requestSync, retryOutboxItem, useSyncState } from '../../offline/sync'

const OUTBOX_LABELS: Record<OutboxItem['type'], string> = {
  upsert_monitor: 'Guardar monitor',
  delete_monitor: 'Eliminar monitor',
  upload_photo: 'Subir foto',
  delete_photo: 'Eliminar foto',
}

const PHASE_LABELS = {
  idle: 'Al día',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión',
  error: 'Error',
  unauthorized: 'Sesión expirada',
}

export function SettingsPage() {
  const catalog = useCatalog()
  const { user } = useAuth()
  const logout = useLogout()
  const confirm = useConfirm()
  const sync = useSyncState()
  const location = useLocation()
  const outbox = useLiveQuery(() => db.outbox.orderBy('id').toArray(), [], [])
  const monitorsByUuid = useLiveQuery(async () => new Map((await db.monitors.toArray()).map((m) => [m.uuid, m])), [], new Map())

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash])

  if (!catalog) return null

  const failed = outbox.filter((item) => item.error)

  const links: { to: string; icon: LucideIcon; title: string; detail: string }[] = [
    { to: '/settings/services', icon: Stethoscope, title: 'Servicios', detail: plural(catalog.services.length, 'servicio', 'servicios') },
    {
      to: '/settings/models',
      icon: MonitorCheck,
      title: 'Modelos y marcas',
      detail: `${plural(catalog.monitor_models.length, 'modelo', 'modelos')} · ${plural(catalog.brands.length, 'marca', 'marcas')}`,
    },
    {
      to: '/settings/consumables',
      icon: Boxes,
      title: 'Consumibles',
      detail: `${plural(catalog.consumables.length, 'consumible', 'consumibles')} en ${plural(catalog.consumable_groups.length, 'grupo', 'grupos')}`,
    },
    { to: '/settings/users', icon: Users, title: 'Usuarios', detail: 'Accesos a la aplicación' },
  ]

  const discard = async (item: OutboxItem) => {
    const accepted = await confirm({
      title: 'Descartar cambio',
      message: 'El cambio rechazado se eliminará de este dispositivo y se descargará la versión del servidor.',
      confirmLabel: 'Descartar',
      danger: true,
    })
    if (accepted) await discardOutboxItem(item.id!)
  }

  return (
    <>
      <PageHeader title="Configuración" subtitle="Catálogos, sincronización y cuenta." />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Catálogos</h2>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50">
              <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                <link.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{link.title}</div>
                <div className="text-sm text-slate-500">{link.detail}</div>
              </div>
              <ChevronRight className="size-5 text-slate-300" />
            </Link>
          ))}
        </div>
      </section>

      <section id="sync" className="mb-8 scroll-mt-20">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Sincronización</h2>
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd className="font-medium text-slate-900">{PHASE_LABELS[sync.phase]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cambios pendientes</dt>
              <dd className="font-medium text-slate-900 tabular-nums">{outbox.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Última sincronización</dt>
              <dd className="font-medium text-slate-900">{formatDateTime(sync.lastSyncAt)}</dd>
            </div>
          </dl>

          {sync.message && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{sync.message}</p>}

          {failed.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-800">
                <CircleAlert className="size-4" />
                El servidor rechazó {plural(failed.length, 'cambio', 'cambios')}
              </div>
              <ul className="space-y-2">
                {failed.map((item) => {
                  const monitor = monitorsByUuid.get(item.monitor_uuid)
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm ring-1 ring-rose-100">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {OUTBOX_LABELS[item.type]}
                          {monitor && ` · ${monitor.serial_number ?? monitor.inventory_number ?? 'sin serie'}`}
                        </div>
                        <div className="text-rose-700">{item.error}</div>
                      </div>
                      <div className="flex gap-2">
                        {monitor && (
                          <Link to={`/hospitals/${monitor.hospital_id}/monitors/${monitor.uuid}`}>
                            <Button size="sm" variant="secondary">
                              Corregir
                            </Button>
                          </Link>
                        )}
                        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => retryOutboxItem(item.id!)}>
                          Reintentar
                        </Button>
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => discard(item)}>
                          Descartar
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button icon={Cloud} loading={sync.phase === 'syncing'} onClick={() => requestSync()}>
              Sincronizar ahora
            </Button>
            <Button variant="secondary" icon={DownloadCloud} onClick={() => requestSync({ full: true })}>
              Descargar todo de nuevo
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Las capturas se guardan primero en este dispositivo y se envían solas cuando hay conexión. La configuración de
            catálogos y usuarios requiere conexión.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Cuenta</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div>
            <div className="font-medium text-slate-900">{user?.name}</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
          </div>
          <Button variant="secondary" icon={LogOut} onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </section>
    </>
  )
}
