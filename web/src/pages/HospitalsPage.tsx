import { ChevronRight, CloudUpload, Hospital as HospitalIcon, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { HospitalFormModal } from '../components/HospitalFormModal'
import { StatusBar, countStatuses } from '../components/StatusBar'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { TextInput } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { useCatalog } from '../hooks/useCatalog'
import { useAllMonitors } from '../hooks/useMonitors'
import { plural, searchable } from '../lib/format'
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES } from '../lib/status'
import type { LocalMonitor } from '../lib/types'

export function HospitalsPage() {
  const catalog = useCatalog()
  const monitors = useAllMonitors()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const monitorsByHospital = useMemo(() => {
    const groups = new Map<number, LocalMonitor[]>()
    for (const monitor of monitors ?? []) {
      groups.set(monitor.hospital_id, [...(groups.get(monitor.hospital_id) ?? []), monitor])
    }
    return groups
  }, [monitors])

  if (!catalog) return null

  const hospitals = catalog.hospitals.filter((hospital) => searchable(hospital.name).includes(searchable(query)))

  return (
    <>
      <PageHeader
        title="Hospitales"
        subtitle="Selecciona un hospital para registrar y diagnosticar sus monitores."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Nuevo hospital
          </Button>
        }
      />

      {catalog.hospitals.length > 5 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar hospital…" className="pl-9" />
        </div>
      )}

      {catalog.hospitals.length === 0 ? (
        <EmptyState
          icon={HospitalIcon}
          title="Aún no hay hospitales"
          description="Registra el primer hospital para empezar a capturar sus monitores."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Nuevo hospital
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hospitals.map((hospital) => {
            const hospitalMonitors = monitorsByHospital.get(hospital.id) ?? []
            const counts = countStatuses(hospitalMonitors)
            const pending = hospitalMonitors.filter((monitor) => monitor.pending).length

            return (
              <Link
                key={hospital.id}
                to={`/hospitals/${hospital.id}`}
                className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-teal-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-900">{hospital.name}</h2>
                    {hospital.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{hospital.description}</p>}
                  </div>
                  <ChevronRight className="mt-0.5 size-5 shrink-0 text-slate-300 group-hover:text-teal-600" />
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-slate-900 tabular-nums">{hospitalMonitors.length}</div>
                    <div className="text-xs text-slate-500">monitores registrados</div>
                  </div>
                  {pending > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <CloudUpload className="size-3" />
                      {plural(pending, 'pendiente', 'pendientes')}
                    </span>
                  )}
                </div>

                {hospitalMonitors.length > 0 && (
                  <>
                    <StatusBar counts={counts} className="mt-3 h-1.5" />
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {STATUS_ORDER.map((status) => (
                        <span key={status} className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <span className={`size-2 rounded-full ${STATUS_STYLES[status].dot}`} />
                          {STATUS_LABELS[status]} <strong className="tabular-nums">{counts[status]}</strong>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <HospitalFormModal open={creating} onClose={() => setCreating(false)} onSaved={(hospital) => navigate(`/hospitals/${hospital.id}`)} />
    </>
  )
}
