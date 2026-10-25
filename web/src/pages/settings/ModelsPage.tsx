import { Check, MonitorCheck, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select, TextArea, TextInput } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { useCatalog, type CatalogView } from '../../hooks/useCatalog'
import { useCatalogMutation } from '../../hooks/useCatalogMutation'
import { useAllMonitors } from '../../hooks/useMonitors'
import { api } from '../../lib/api'
import { groupConsumables } from '../../lib/consumables'
import { emptyToNull, plural } from '../../lib/format'
import { MOUNT_TYPE_LABELS } from '../../lib/status'
import type { Brand, MonitorModel, MountType } from '../../lib/types'

export function ModelsPage() {
  const catalog = useCatalog()
  const monitors = useAllMonitors()
  const confirm = useConfirm()
  const { run } = useCatalogMutation()
  const [editingModel, setEditingModel] = useState<MonitorModel | 'new' | null>(null)
  const [editingBrand, setEditingBrand] = useState<Brand | 'new' | null>(null)

  const usage = useMemo(() => {
    const counts = new Map<number, number>()
    for (const monitor of monitors ?? []) counts.set(monitor.monitor_model_id, (counts.get(monitor.monitor_model_id) ?? 0) + 1)
    return counts
  }, [monitors])

  if (!catalog) return null

  const removeModel = async (model: MonitorModel) => {
    const accepted = await confirm({
      title: 'Eliminar modelo',
      message: `¿Eliminar "${catalog.modelLabel(model.id)}"? Solo es posible si no hay monitores registrados con este modelo.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (accepted) await run(() => api.delete(`/monitor-models/${model.id}`), 'Modelo eliminado')
  }

  const removeBrand = async (brand: Brand) => {
    const accepted = await confirm({
      title: 'Eliminar marca',
      message: `¿Eliminar la marca "${brand.name}"? Solo es posible si no tiene modelos.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (accepted) await run(() => api.delete(`/brands/${brand.id}`), 'Marca eliminada')
  }

  const brandsWithModels = catalog.brands
    .map((brand) => ({ brand, models: catalog.monitor_models.filter((model) => model.brand_id === brand.id) }))
    .filter(({ models }) => models.length > 0)

  return (
    <>
      <PageHeader
        title="Modelos y marcas"
        backTo="/settings"
        subtitle="Cada modelo define los consumibles que se revisan al capturarlo."
        actions={
          <Button icon={Plus} onClick={() => setEditingModel('new')} disabled={catalog.brands.length === 0}>
            Nuevo modelo
          </Button>
        }
      />

      <section className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Marcas</h2>
          <Button size="sm" variant="subtle" icon={Plus} onClick={() => setEditingBrand('new')}>
            Nueva marca
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {catalog.brands.map((brand) => (
            <span key={brand.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm text-slate-700">
              <Tag className="size-3.5 text-slate-400" />
              {brand.name}
              <button type="button" onClick={() => setEditingBrand(brand)} className="rounded-full p-1 hover:bg-slate-200" aria-label={`Editar ${brand.name}`}>
                <Pencil className="size-3.5" />
              </button>
              <button type="button" onClick={() => removeBrand(brand)} className="rounded-full p-1 hover:bg-slate-200" aria-label={`Eliminar ${brand.name}`}>
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
          {catalog.brands.length === 0 && <p className="text-sm text-slate-500">Agrega al menos una marca para registrar modelos.</p>}
        </div>
      </section>

      {brandsWithModels.length === 0 ? (
        <EmptyState icon={MonitorCheck} title="Sin modelos" description="Registra los modelos de monitores más comunes con sus consumibles." />
      ) : (
        <div className="space-y-6">
          {brandsWithModels.map(({ brand, models }) => (
            <section key={brand.id}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{brand.name}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {models.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    catalog={catalog}
                    monitorCount={usage.get(model.id) ?? 0}
                    onEdit={() => setEditingModel(model)}
                    onDelete={() => removeModel(model)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ModelFormModal
        open={editingModel !== null}
        model={editingModel === 'new' ? null : editingModel}
        catalog={catalog}
        onClose={() => setEditingModel(null)}
      />
      <BrandFormModal open={editingBrand !== null} brand={editingBrand === 'new' ? null : editingBrand} onClose={() => setEditingBrand(null)} />
    </>
  )
}

function ModelCard({
  model,
  catalog,
  monitorCount,
  onEdit,
  onDelete,
}: {
  model: MonitorModel
  catalog: CatalogView
  monitorCount: number
  onEdit: () => void
  onDelete: () => void
}) {
  const sections = groupConsumables(catalog, model.consumable_ids)

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{model.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">{MOUNT_TYPE_LABELS[model.mount_type]}</span>
            <span className="text-slate-500">{plural(monitorCount, 'monitor registrado', 'monitores registrados')}</span>
          </div>
        </div>
        <IconButton icon={Pencil} label="Editar" onClick={onEdit} />
        <IconButton icon={Trash2} label="Eliminar" onClick={onDelete} />
      </div>
      {model.description && <p className="mt-2 text-sm text-slate-500">{model.description}</p>}
      <dl className="mt-3 space-y-1.5 text-sm">
        {sections.map((section) => (
          <div key={section.groupId ?? 'general'} className="flex gap-2">
            <dt className="w-24 shrink-0 font-medium text-slate-700">{section.groupName}</dt>
            <dd className="text-slate-600">{section.items.map((item) => item.name).join(' · ')}</dd>
          </div>
        ))}
        {sections.length === 0 && <p className="text-slate-500">Sin consumibles configurados.</p>}
      </dl>
    </article>
  )
}

function ModelFormModal({
  open,
  model,
  catalog,
  onClose,
}: {
  open: boolean
  model: MonitorModel | null
  catalog: CatalogView
  onClose: () => void
}) {
  const [brandId, setBrandId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mountType, setMountType] = useState<MountType>('portable')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [newBrandName, setNewBrandName] = useState<string | null>(null)
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()
  const brandMutation = useCatalogMutation()
  const firstBrandId = catalog.brands[0]?.id

  // Se reinicia solo al abrir; los cambios de catálogo (p. ej. una marca nueva) no borran lo capturado
  useEffect(() => {
    if (!open) return
    setBrandId(model ? String(model.brand_id) : String(firstBrandId ?? ''))
    setName(model?.name ?? '')
    setDescription(model?.description ?? '')
    setMountType(model?.mount_type ?? 'portable')
    setSelected(new Set(model?.consumable_ids ?? []))
    setNewBrandName(null)
    clearErrors()
  }, [open, model, clearErrors])

  const createBrand = async () => {
    if (!newBrandName?.trim()) return
    const brand = await brandMutation.run(() => api.post<Brand>('/brands', { name: newBrandName }), 'Marca agregada')
    if (brand) {
      setBrandId(String(brand.id))
      setNewBrandName(null)
    }
  }

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyFrom = (modelId: string) => {
    const source = catalog.modelById.get(Number(modelId))
    if (source) setSelected(new Set(source.consumable_ids))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const body = {
      brand_id: Number(brandId),
      name,
      description: emptyToNull(description),
      mount_type: mountType,
      consumable_ids: [...selected],
    }
    const saved = await run(
      () => (model ? api.put(`/monitor-models/${model.id}`, body) : api.post('/monitor-models', body)),
      model ? 'Modelo actualizado' : 'Modelo registrado',
    )
    if (saved) onClose()
  }

  const sections = groupConsumables(catalog)
  const otherModels = catalog.monitor_models.filter((item) => item.id !== model?.id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={model ? 'Editar modelo' : 'Nuevo modelo'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="model-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="model-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca" htmlFor="model-brand" required error={brandMutation.fieldErrors.name ?? fieldErrors.brand_id}>
            {newBrandName === null ? (
              <div className="flex gap-2">
                <Select id="model-brand" value={brandId} onChange={(event) => setBrandId(event.target.value)} required>
                  {catalog.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </Select>
                <IconButton icon={Plus} label="Nueva marca" variant="secondary" onClick={() => setNewBrandName('')} />
              </div>
            ) : (
              <div className="flex gap-2">
                <TextInput
                  value={newBrandName}
                  onChange={(event) => setNewBrandName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void createBrand()
                    }
                  }}
                  placeholder="Nombre de la marca"
                  autoFocus
                />
                <IconButton icon={Check} label="Agregar marca" variant="primary" onClick={createBrand} disabled={brandMutation.saving} />
                <IconButton icon={X} label="Cancelar" variant="secondary" onClick={() => setNewBrandName(null)} />
              </div>
            )}
          </Field>
          <Field label="Modelo" htmlFor="model-name" required error={fieldErrors.name}>
            <TextInput id="model-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="iMEC 10" required />
          </Field>
        </div>

        <Field label="Tipo" error={fieldErrors.mount_type}>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MOUNT_TYPE_LABELS) as MountType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMountType(type)}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium ring-1 ring-inset ${
                  mountType === type ? 'bg-teal-700 text-white ring-teal-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {mountType === type && <Check className="size-4" />}
                {MOUNT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Descripción" htmlFor="model-description" error={fieldErrors.description}>
          <TextArea id="model-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </Field>

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-slate-700">Consumibles del modelo</div>
              <div className="text-xs text-slate-500">{plural(selected.size, 'seleccionado', 'seleccionados')}</div>
            </div>
            {otherModels.length > 0 && (
              <Select className="max-w-60 text-sm" value="" onChange={(event) => copyFrom(event.target.value)} aria-label="Copiar consumibles de otro modelo">
                <option value="">Copiar de otro modelo…</option>
                {otherModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {catalog.modelLabel(item.id)}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {fieldErrors.consumable_ids && <p className="mb-2 text-sm text-rose-600">{fieldErrors.consumable_ids}</p>}
          <div className="space-y-3">
            {sections.map((section) => (
              <fieldset key={section.groupId ?? 'general'} className="rounded-xl ring-1 ring-slate-200">
                <legend className="ml-3 px-1 text-xs font-semibold text-slate-600">{section.groupName}</legend>
                <div className="grid gap-x-4 px-3 pb-2 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <label key={item.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="size-5 rounded border-slate-300 text-teal-700 accent-teal-700"
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

function BrandFormModal({ open, brand, onClose }: { open: boolean; brand: Brand | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()

  useEffect(() => {
    if (open) {
      setName(brand?.name ?? '')
      clearErrors()
    }
  }, [open, brand, clearErrors])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const saved = await run(
      () => (brand ? api.put(`/brands/${brand.id}`, { name }) : api.post('/brands', { name })),
      brand ? 'Marca actualizada' : 'Marca agregada',
    )
    if (saved) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={brand ? 'Editar marca' : 'Nueva marca'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="brand-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="brand-form" onSubmit={submit}>
        <Field label="Nombre" htmlFor="brand-name" required error={fieldErrors.name}>
          <TextInput id="brand-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </Field>
      </form>
    </Modal>
  )
}
