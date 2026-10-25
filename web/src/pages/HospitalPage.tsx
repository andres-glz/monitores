import { FileSpreadsheet, FileText, MonitorSmartphone, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { HospitalFormModal } from '../components/HospitalFormModal'
import { MonitorCard } from '../components/MonitorCard'
import { StatusBar, countStatuses } from '../components/StatusBar'
import { Button, IconButton } from '../components/ui/Button'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { EmptyState, LoadingState } from '../components/ui/EmptyState'
import { Select, TextInput } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { useCatalog } from '../hooks/useCatalog'
import { useCatalogMutation } from '../hooks/useCatalogMutation'
import { useHospitalMonitors } from '../hooks/useMonitors'
import { api } from '../lib/api'
import { formatPercent, plural } from '../lib/format'
import { describeMonitor, matchesQuery, type MonitorRow } from '../lib/monitorView'
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from '../lib/status'
import type { MonitorStatus } from '../lib/types'

export function HospitalPage() {
  const params = useParams()
  const hospitalId = Number(params.hospitalId)
  const catalog = useCatalog()
  const monitors = useHospitalMonitors(hospitalId)
  const { user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { run } = useCatalogMutation()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MonitorStatus | null>(null)
  const [serviceFilter, setServiceFilter] = useState('')
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  const rows = useMemo(
    () => (catalog && monitors ? monitors.map((monitor) => describeMonitor(monitor, catalog)) : []),
    [catalog, monitors],
  )

  if (!catalog) return null
  const hospital = catalog.hospitalById.get(hospitalId)
  if (!hospital) {
    return <EmptyState icon={MonitorSmartphone} title="Hospital no encontrado" action={<Link to="/" className="text-sm font-medium text-teal-700 dark:text-teal-400">Ir al inicio</Link>} />
  }
  if (!monitors) return <LoadingState />

  const counts = countStatuses(monitors)
  const filtered = rows.filter(
    (row) =>
      (!statusFilter || row.monitor.status === statusFilter) &&
      (!serviceFilter || String(row.monitor.service_id) === serviceFilter) &&
      (!query.trim() || matchesQuery(row, query)),
  )
  const groups = groupByService(filtered)
  const servicesInUse = catalog.services.filter((service) => rows.some((row) => row.monitor.service_id === service.id))
  const hasFilters = Boolean(query || statusFilter || serviceFilter)

  const exportReport = async (kind: 'pdf' | 'excel') => {
    if (monitors.length === 0) {
      toast.info('Aún no hay monitores registrados en este hospital.')
      return
    }
    setExporting(kind)
    try {
      const options = { hospital, monitors, catalog, generatedBy: user?.name ?? '' }
      if (kind === 'pdf') {
        const { exportHospitalPdf } = await import('../reports/pdf/exportHospitalPdf')
        await exportHospitalPdf(options)
      } else {
        const { exportHospitalExcel } = await import('../reports/excel/exportHospitalExcel')
        await exportHospitalExcel(options)
      }
    } catch (error) {
      console.error(error)
      toast.error('No se pudo generar el archivo.')
    } finally {
      setExporting(null)
    }
  }

  const removeHospital = async () => {
    const accepted = await confirm({
      title: 'Eliminar hospital',
      message: (
        <>
          Se eliminará <strong>{hospital.name}</strong> junto con sus {plural(monitors.length, 'monitor', 'monitores')} registrados y sus
          fotos. Esta acción no se puede deshacer.
        </>
      ),
      confirmLabel: 'Eliminar hospital',
      danger: true,
    })
    if (!accepted) return
    const deleted = await run(async () => {
      await api.delete(`/hospitals/${hospital.id}`)
      return true
    }, 'Hospital eliminado')
    if (deleted) navigate('/', { replace: true })
  }

  return (
    <>
      <PageHeader
        title={hospital.name}
        subtitle={hospital.description}
        backTo="/"
        actions={
          <>
            <IconButton icon={Pencil} label="Editar hospital" onClick={() => setEditing(true)} />
            <IconButton icon={Trash2} label="Eliminar hospital" onClick={removeHospital} />
            <Link to={`/hospitals/${hospital.id}/capture`} className="max-sm:hidden">
              <Button icon={Plus}>Capturar monitor</Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`rounded-xl p-3 text-left transition ${statusFilter === null ? 'bg-slate-100 ring-2 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total de equipos</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">{monitors.length}</div>
          </button>
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={`rounded-xl p-3 text-left transition ${
                statusFilter === status ? `${STATUS_STYLES[status].soft} ring-2 ring-current ${STATUS_STYLES[status].text}` : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className={`size-2 rounded-full ${STATUS_STYLES[status].dot}`} />
                {STATUS_LABELS[status]}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">{counts[status]}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatPercent(counts[status], monitors.length)}</span>
              </div>
            </button>
          ))}
        </div>
        <StatusBar counts={counts} className="mt-4 h-2" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" icon={FileText} loading={exporting === 'pdf'} onClick={() => exportReport('pdf')}>
            Reporte PDF
          </Button>
          <Button variant="secondary" icon={FileSpreadsheet} loading={exporting === 'excel'} onClick={() => exportReport('excel')}>
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por serie, NNI, servicio, modelo o ubicación…"
            className="pl-9"
          />
        </div>
        <Select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className="sm:max-w-56">
          <option value="">Todos los servicios</option>
          {servicesInUse.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>
      </div>

      {hasFilters && (
        <div className="mb-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{plural(filtered.length, 'resultado', 'resultados')}</span>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setStatusFilter(null)
              setServiceFilter('')
            }}
            className="inline-flex items-center gap-1 font-medium text-teal-700 dark:text-teal-400"
          >
            <X className="size-4" />
            Limpiar filtros
          </button>
        </div>
      )}

      {monitors.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="Sin monitores registrados"
          description="Comienza a capturar los monitores de este hospital."
          action={
            <Link to={`/hospitals/${hospital.id}/capture`}>
              <Button icon={Plus}>Capturar monitor</Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin coincidencias" description="Prueba con otro número de serie, NNI o servicio." />
      ) : (
        <div className="space-y-6">
          {groups.map(({ serviceName, rows: serviceRows }) => (
            <section key={serviceName}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {serviceName}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{serviceRows.length}</span>
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {serviceRows.map((row) => (
                  <MonitorCard key={row.monitor.uuid} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Botón flotante de captura en celular */}
      <Link
        to={`/hospitals/${hospital.id}/capture`}
        className="fixed right-4 bottom-20 z-20 inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-3.5 font-medium text-white shadow-lg shadow-teal-900/20 active:bg-teal-800 sm:hidden"
      >
        <Plus className="size-5" />
        Capturar
      </Link>

      <HospitalFormModal open={editing} hospital={hospital} onClose={() => setEditing(false)} />
    </>
  )
}

function groupByService(rows: MonitorRow[]): { serviceName: string; rows: MonitorRow[] }[] {
  const groups = new Map<string, MonitorRow[]>()
  for (const row of rows) groups.set(row.serviceName, [...(groups.get(row.serviceName) ?? []), row])

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([serviceName, serviceRows]) => ({
      serviceName,
      rows: serviceRows.sort(
        (a, b) =>
          (a.monitor.location ?? '').localeCompare(b.monitor.location ?? '', 'es', { numeric: true }) ||
          (a.monitor.serial_number ?? '').localeCompare(b.monitor.serial_number ?? ''),
      ),
    }))
}
