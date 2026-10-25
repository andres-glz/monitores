import { Pencil, Plus, Search, Stethoscope, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, TextArea, TextInput } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useCatalog } from '../../hooks/useCatalog'
import { useCatalogMutation } from '../../hooks/useCatalogMutation'
import { useAllMonitors } from '../../hooks/useMonitors'
import { api } from '../../lib/api'
import { emptyToNull, plural, searchable } from '../../lib/format'
import type { Service } from '../../lib/types'

export function ServicesPage() {
  const catalog = useCatalog()
  const monitors = useAllMonitors()
  const confirm = useConfirm()
  const { run } = useCatalogMutation()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const usage = useMemo(() => {
    const counts = new Map<number, number>()
    for (const monitor of monitors ?? []) counts.set(monitor.service_id, (counts.get(monitor.service_id) ?? 0) + 1)
    return counts
  }, [monitors])

  if (!catalog) return null

  const services = catalog.services.filter((service) => searchable(service.name).includes(searchable(query)))

  const remove = async (service: Service) => {
    const accepted = await confirm({
      title: 'Eliminar servicio',
      message: `¿Eliminar "${service.name}"? Solo es posible si ningún monitor lo usa.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (accepted) await run(() => api.delete(`/services/${service.id}`), 'Servicio eliminado')
  }

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle="Catálogo compartido por todos los hospitales."
        backTo="/settings"
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nuevo servicio
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar servicio…" className="pl-9" />
      </div>

      {services.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Sin servicios" description="Agrega servicios como Urgencias, Pediatría o Terapia intensiva." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {services.map((service) => (
            <li key={service.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">{service.name}</div>
                <div className="text-sm text-slate-500">
                  {service.description ? `${service.description} · ` : ''}
                  {plural(usage.get(service.id) ?? 0, 'monitor', 'monitores')}
                </div>
              </div>
              <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(service)} />
              <IconButton icon={Trash2} label="Eliminar" onClick={() => remove(service)} />
            </li>
          ))}
        </ul>
      )}

      <ServiceFormModal service={editing === 'new' ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </>
  )
}

function ServiceFormModal({ open, service, onClose }: { open: boolean; service: Service | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()

  useEffect(() => {
    if (open) {
      setName(service?.name ?? '')
      setDescription(service?.description ?? '')
      clearErrors()
    }
  }, [open, service, clearErrors])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const body = { name, description: emptyToNull(description) }
    const saved = await run(
      () => (service ? api.put(`/services/${service.id}`, body) : api.post('/services', body)),
      service ? 'Servicio actualizado' : 'Servicio agregado',
    )
    if (saved) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Editar servicio' : 'Nuevo servicio'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" htmlFor="service-name" required error={fieldErrors.name}>
          <TextInput id="service-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </Field>
        <Field label="Descripción" htmlFor="service-description" error={fieldErrors.description}>
          <TextArea id="service-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
