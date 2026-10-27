import type { LucideIcon } from 'lucide-react'
import { Columns3, FileSpreadsheet, FileText, LayoutGrid, MonitorSmartphone, Pencil, Plus, ScanBarcode, Search, SearchX, Table2, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { HospitalFormModal } from '../components/HospitalFormModal'
import { MonitorCard } from '../components/MonitorCard'
import { ColumnPicker, DEFAULT_COLUMN_IDS, MONITOR_COLUMNS, MonitorTable, formatSort, parseSort, sortRows } from '../components/MonitorTable'
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
import { loadTableColumns, loadViewMode, saveTableColumns, saveViewMode, type MonitorViewMode } from '../lib/listPrefs'
import { compareByLocation, describeMonitor, matchesQuery, type MonitorRow } from '../lib/monitorView'
import { NOT_FOUND_STYLES, STATUS_LABELS, STATUS_ORDER, STATUS_STYLES, isFound } from '../lib/status'
import type { LocalMonitor } from '../lib/types'

const VIEW_OPTIONS: { mode: MonitorViewMode; label: string; icon: LucideIcon }[] = [
  { mode: 'cards', label: 'Tarjetas', icon: LayoutGrid },
  { mode: 'table', label: 'Tabla', icon: Table2 },
]

// Parámetros de la URL con los filtros; así se conservan al abrir un monitor y regresar
const FILTER_PARAMS = ['found', 'q', 'status', 'brand', 'model', 'service'] as const

// Localización: sin el parámetro "found" se ven solo los encontrados
type FoundFilter = 'found' | 'not_found' | 'all'

const FOUND_OPTIONS: { value: FoundFilter; param: string | null; label: string }[] = [
  { value: 'found', param: null, label: 'Encontrados' },
  { value: 'not_found', param: 'no', label: 'No encontrados' },
  { value: 'all', param: 'all', label: 'Todos' },
]

function matchesFound(monitor: LocalMonitor, filter: FoundFilter): boolean {
  return filter === 'all' || isFound(monitor) === (filter === 'found')
}

type ExportKind = 'pdf' | 'excel' | 'not_found_pdf' | 'not_found_excel'

export function HospitalPage() {
  const params = useParams()
  const hospitalId = Number(params.hospitalId)
  const catalog = useCatalog()
  const monitors = useHospitalMonitors(hospitalId)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const { run } = useCatalogMutation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState(loadViewMode)
  const [columnIds, setColumnIds] = useState(() => loadTableColumns() ?? DEFAULT_COLUMN_IDS)
  const [pickingColumns, setPickingColumns] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState<ExportKind | null>(null)

  const query = searchParams.get('q') ?? ''
  const foundFilter = FOUND_OPTIONS.find((option) => option.param !== null && option.param === searchParams.get('found'))?.value ?? 'found'
  // Los no encontrados no se filtran por dictamen
  const statusFilter = foundFilter === 'not_found' ? null : (STATUS_ORDER.find((status) => status === searchParams.get('status')) ?? null)
  const brandFilter = searchParams.get('brand') ?? ''
  const modelFilter = searchParams.get('model') ?? ''
  const serviceFilter = searchParams.get('service') ?? ''
  const sort = parseSort(searchParams.get('sort'))
  const backTo = location.pathname + location.search

  const updateParams = (changes: Partial<Record<(typeof FILTER_PARAMS)[number] | 'sort', string | null>>) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )

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

  // Universo según la localización elegida: de ahí salen las estadísticas, las opciones de los filtros y la lista
  const notFoundCount = monitors.filter((monitor) => !isFound(monitor)).length
  const foundCount = monitors.length - notFoundCount
  const scopedRows = rows.filter((row) => matchesFound(row.monitor, foundFilter))
  const scopedMonitors = scopedRows.map((row) => row.monitor)
  const counts = countStatuses(scopedMonitors)
  const brandOf = (modelId: number) => catalog.modelById.get(modelId)?.brand_id
  const filtered = scopedRows.filter(
    (row) =>
      (!statusFilter || (isFound(row.monitor) && row.monitor.status === statusFilter)) &&
      (!brandFilter || String(brandOf(row.monitor.monitor_model_id)) === brandFilter) &&
      (!modelFilter || String(row.monitor.monitor_model_id) === modelFilter) &&
      (!serviceFilter || String(row.monitor.service_id) === serviceFilter) &&
      (!query.trim() || matchesQuery(row, query)),
  )
  const hasFilters = FILTER_PARAMS.some((key) => searchParams.has(key))

  // Las opciones de los filtros solo incluyen lo que hay en este hospital
  const servicesInUse = catalog.services.filter((service) => scopedRows.some((row) => row.monitor.service_id === service.id))
  const modelsInUse = catalog.monitor_models.filter((model) => scopedRows.some((row) => row.monitor.monitor_model_id === model.id))
  const brandsInUse = catalog.brands.filter((brand) => modelsInUse.some((model) => model.brand_id === brand.id))
  const modelOptions = modelsInUse
    .filter((model) => !brandFilter || String(model.brand_id) === brandFilter)
    .map((model) => ({ id: model.id, label: brandFilter ? model.name : catalog.modelLabel(model.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }))

  // Cascada: al cambiar la marca se descarta un modelo de otra marca, y elegir un modelo fija su marca
  const changeBrand = (brandId: string) =>
    updateParams({ brand: brandId || null, model: modelFilter && String(brandOf(Number(modelFilter))) === brandId ? modelFilter : null })
  const changeModel = (modelId: string) =>
    updateParams({ model: modelId || null, brand: modelId ? String(brandOf(Number(modelId)) ?? '') : brandFilter || null })

  const visibleColumns = MONITOR_COLUMNS.filter((column) => columnIds.includes(column.id))

  const changeViewMode = (mode: MonitorViewMode) => {
    setViewMode(mode)
    saveViewMode(mode)
  }

  const changeColumns = (update: (ids: string[]) => string[]) =>
    setColumnIds((current) => {
      const next = update(current)
      saveTableColumns(next)
      return next
    })

  // Los reportes de diagnóstico dejan fuera a los no encontrados; ellos tienen su propio listado
  const exportReport = async (kind: ExportKind) => {
    const forNotFound = kind === 'not_found_pdf' || kind === 'not_found_excel'
    if (forNotFound ? notFoundCount === 0 : foundCount === 0) {
      toast.info(forNotFound ? 'No hay monitores marcados como no encontrados.' : 'Aún no hay monitores encontrados en este hospital.')
      return
    }
    setExporting(kind)
    try {
      const options = { hospital, monitors, catalog, generatedBy: user?.name ?? '' }
      if (kind === 'pdf') {
        const { exportHospitalPdf } = await import('../reports/pdf/exportHospitalPdf')
        await exportHospitalPdf(options)
      } else if (kind === 'excel') {
        const { exportHospitalExcel } = await import('../reports/excel/exportHospitalExcel')
        await exportHospitalExcel(options)
      } else if (kind === 'not_found_pdf') {
        const { exportNotFoundPdf } = await import('../reports/pdf/exportNotFoundPdf')
        await exportNotFoundPdf(options)
      } else {
        const { exportNotFoundExcel } = await import('../reports/excel/exportNotFoundExcel')
        await exportNotFoundExcel(options)
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
            <Link to={`/hospitals/${hospital.id}/capture`} state={{ backTo }} className="max-sm:hidden">
              <Button icon={Plus}>Capturar monitor</Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div role="group" aria-label="Localización" className="mb-4 grid grid-cols-3 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {FOUND_OPTIONS.map((option) => {
            const active = foundFilter === option.value
            const count = option.value === 'found' ? foundCount : option.value === 'not_found' ? notFoundCount : monitors.length
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => updateParams({ found: option.param, ...(option.value === 'not_found' ? { status: null } : {}) })}
                className={`inline-flex min-h-9 flex-wrap items-center justify-center gap-x-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                {option.label}
                <span className="text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400">{count}</span>
              </button>
            )
          })}
        </div>

        {foundFilter === 'not_found' ? (
          <NotFoundStats monitors={scopedMonitors} universe={monitors.length} brandOf={brandOf} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => updateParams({ status: null })}
                className={`rounded-xl p-3 text-left transition ${statusFilter === null ? 'bg-slate-100 ring-2 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total de equipos</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">{scopedMonitors.length}</div>
              </button>
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateParams({ status: statusFilter === status ? null : status })}
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
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatPercent(counts[status], scopedMonitors.length)}</span>
                  </div>
                </button>
              ))}
            </div>
            <StatusBar counts={counts} notFound={foundFilter === 'all' ? notFoundCount : 0} className="mt-4 h-2" />
            {foundFilter === 'all' && notFoundCount > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className={`size-2 rounded-full ${NOT_FOUND_STYLES.dot}`} />
                No encontrados <strong className="tabular-nums">{notFoundCount}</strong>
                <span>{formatPercent(notFoundCount, monitors.length)}</span>
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {/* Los reportes de diagnóstico no incluyen a los no encontrados */}
          <Button variant="secondary" icon={FileText} loading={exporting === 'pdf'} disabled={foundFilter === 'not_found'} onClick={() => exportReport('pdf')}>
            Reporte PDF
          </Button>
          <Button
            variant="secondary"
            icon={FileSpreadsheet}
            loading={exporting === 'excel'}
            disabled={foundFilter === 'not_found'}
            onClick={() => exportReport('excel')}
          >
            Exportar Excel
          </Button>
          {foundFilter === 'not_found' && (
            <>
              <Button variant="subtle" icon={FileText} loading={exporting === 'not_found_pdf'} onClick={() => exportReport('not_found_pdf')}>
                PDF no encontrados
              </Button>
              <Button variant="subtle" icon={FileSpreadsheet} loading={exporting === 'not_found_excel'} onClick={() => exportReport('not_found_excel')}>
                Excel no encontrados
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <TextInput
              type="search"
              value={query}
              onChange={(event) => updateParams({ q: event.target.value })}
              placeholder="Buscar por serie, NNI, servicio, modelo o ubicación…"
              className="pl-9"
            />
          </div>
          <IconButton icon={ScanBarcode} label="Escanear serie o NNI" variant="secondary" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => setScanning(true)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Select value={brandFilter} onChange={(event) => changeBrand(event.target.value)} aria-label="Marca">
            <option value="">Todas las marcas</option>
            {brandsInUse.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
          <Select value={modelFilter} onChange={(event) => changeModel(event.target.value)} aria-label="Modelo">
            <option value="">Todos los modelos</option>
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </Select>
          <Select value={serviceFilter} onChange={(event) => updateParams({ service: event.target.value })} aria-label="Servicio" className="max-sm:col-span-2">
            <option value="">Todos los servicios</option>
            {servicesInUse.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {monitors.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span>{hasFilters ? plural(filtered.length, 'resultado', 'resultados') : plural(monitors.length, 'monitor', 'monitores')}</span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => updateParams(Object.fromEntries(FILTER_PARAMS.map((key) => [key, null])))}
                className="inline-flex items-center gap-1 font-medium text-teal-700 dark:text-teal-400"
              >
                <X className="size-4" />
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {viewMode === 'table' && <IconButton icon={Columns3} label="Elegir columnas" variant="secondary" onClick={() => setPickingColumns(true)} />}
            <div role="group" aria-label="Vista" className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  title={label}
                  onClick={() => changeViewMode(mode)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="max-sm:sr-only">{label}</span>
                </button>
              ))}
            </div>
          </div>
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
      ) : scopedRows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={foundFilter === 'not_found' ? 'Sin monitores no encontrados' : 'Sin monitores encontrados'}
          description={
            foundFilter === 'not_found'
              ? 'Ningún monitor de este hospital está marcado como no encontrado.'
              : 'Todos los monitores registrados están marcados como no encontrados.'
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin coincidencias" description="Prueba con otro número de serie, NNI, marca, modelo o servicio." />
      ) : viewMode === 'table' ? (
        <MonitorTable
          rows={sortRows(filtered, sort)}
          columns={visibleColumns.length > 0 ? visibleColumns : MONITOR_COLUMNS.filter((column) => column.defaultVisible)}
          sort={sort}
          onSortChange={(next) => updateParams({ sort: formatSort(next) })}
          backTo={backTo}
        />
      ) : (
        <div className="space-y-6">
          {groupByService(filtered).map(({ serviceName, rows: serviceRows }) => (
            <section key={serviceName}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {serviceName}
                <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{serviceRows.length}</span>
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {serviceRows.map((row) => (
                  <MonitorCard key={row.monitor.uuid} row={row} backTo={backTo} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Botón flotante de captura en celular */}
      <Link
        to={`/hospitals/${hospital.id}/capture`}
        state={{ backTo }}
        className="fixed right-4 bottom-20 z-20 inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-3.5 font-medium text-white shadow-lg shadow-teal-900/20 active:bg-teal-800 sm:hidden"
      >
        <Plus className="size-5" />
        Capturar
      </Link>

      <HospitalFormModal open={editing} hospital={hospital} onClose={() => setEditing(false)} />
      <ColumnPicker open={pickingColumns} onClose={() => setPickingColumns(false)} columnIds={columnIds} onChange={changeColumns} />
      <BarcodeScanner
        open={scanning}
        title="Escanear serie o NNI"
        onClose={() => setScanning(false)}
        onDetected={(value) => {
          setScanning(false)
          updateParams({ q: value })
        }}
      />
    </>
  )
}

/** Estadísticas breves de los no encontrados (no tienen dictamen) */
function NotFoundStats({ monitors, universe, brandOf }: { monitors: LocalMonitor[]; universe: number; brandOf: (modelId: number) => number | undefined }) {
  const brands = new Set(monitors.map((monitor) => brandOf(monitor.monitor_model_id)))
  const models = new Set(monitors.map((monitor) => monitor.monitor_model_id))
  const stats = [
    { label: 'Total no encontrados', value: String(monitors.length) },
    { label: 'Marcas', value: String(brands.size) },
    { label: 'Modelos', value: String(models.size) },
    { label: 'Del total registrado', value: formatPercent(monitors.length, universe), detail: `de ${universe}` },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, index) => (
        <div key={stat.label} className={`rounded-xl p-3 ${index === 0 ? 'bg-slate-100 ring-2 ring-slate-300 dark:bg-slate-800 dark:ring-slate-700' : ''}`}>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">{stat.value}</span>
            {stat.detail && <span className="text-xs text-slate-500 dark:text-slate-400">{stat.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function groupByService(rows: MonitorRow[]): { serviceName: string; rows: MonitorRow[] }[] {
  const groups = new Map<string, MonitorRow[]>()
  for (const row of rows) groups.set(row.serviceName, [...(groups.get(row.serviceName) ?? []), row])

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([serviceName, serviceRows]) => ({ serviceName, rows: serviceRows.sort(compareByLocation) }))
}
