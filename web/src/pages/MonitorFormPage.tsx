import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, CircleCheck, MonitorX, Plus, Power, Save, ScanBarcode, Trash2, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthContext'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { ConsumableChecklist } from '../components/ConsumableChecklist'
import { PhotoPicker, type PhotoItem } from '../components/PhotoPicker'
import { SyncIndicator } from '../components/layout/SyncIndicator'
import { Button, IconButton } from '../components/ui/Button'
import { useConfirm } from '../components/ui/ConfirmProvider'
import { EmptyState, LoadingState } from '../components/ui/EmptyState'
import { Field, Select, TextArea, TextInput } from '../components/ui/Field'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Switch } from '../components/ui/Switch'
import { useCatalog, type CatalogView } from '../hooks/useCatalog'
import { useCatalogMutation } from '../hooks/useCatalogMutation'
import { useHospitalMonitors, useMonitor } from '../hooks/useMonitors'
import { api } from '../lib/api'
import { loadCapturePrefs, loadRecentModels, pushRecentModel, saveCapturePrefs } from '../lib/capturePrefs'
import { defaultConsumableState, groupConsumables } from '../lib/consumables'
import { compressImage } from '../lib/image'
import { countConditions } from '../lib/monitorView'
import { emptyToNull, normalizeCode } from '../lib/format'
import { MOUNT_TYPE_LABELS, evaluateStatus } from '../lib/status'
import type { ConsumableState, LocalMonitor, MonitorInput, PhotoRef, Service } from '../lib/types'
import { db } from '../offline/db'
import { deleteMonitor, newUuid, saveMonitor } from '../offline/monitors'

interface FormState {
  serviceId: string
  modelId: string
  serialNumber: string
  inventoryNumber: string
  location: string
  isOperational: boolean
  notes: string
  consumables: ConsumableState[]
}

interface AddedPhoto {
  uuid: string
  blob: Blob
  url: string
}

type ScanTarget = 'serialNumber' | 'inventoryNumber'

/** Consumibles por defecto del modelo: todos presentes y funcionando (solo se marcan las excepciones) */
function defaultConsumables(catalog: CatalogView, modelId: string, previous: ConsumableState[] = []): ConsumableState[] {
  const model = catalog.modelById.get(Number(modelId))
  if (!model) return []
  const previousById = new Map(previous.map((item) => [item.consumable_id, item]))
  return groupConsumables(catalog, model.consumable_ids)
    .flatMap((section) => section.items)
    .map((item) => previousById.get(item.id) ?? defaultConsumableState(item.id))
}

function blankForm(catalog: CatalogView, hospitalId: number): FormState {
  const prefs = loadCapturePrefs(hospitalId)
  const serviceId = prefs.serviceId && catalog.serviceById.has(prefs.serviceId) ? String(prefs.serviceId) : ''
  const modelId = prefs.modelId && catalog.modelById.has(prefs.modelId) ? String(prefs.modelId) : ''
  return {
    serviceId,
    modelId,
    serialNumber: '',
    inventoryNumber: '',
    location: '',
    isOperational: true,
    notes: '',
    consumables: defaultConsumables(catalog, modelId),
  }
}

function formFromMonitor(monitor: LocalMonitor): FormState {
  return {
    serviceId: String(monitor.service_id),
    modelId: String(monitor.monitor_model_id),
    serialNumber: monitor.serial_number ?? '',
    inventoryNumber: monitor.inventory_number ?? '',
    location: monitor.location ?? '',
    isOperational: monitor.is_operational,
    notes: monitor.notes ?? '',
    consumables: monitor.consumables,
  }
}

export function MonitorFormPage() {
  const params = useParams()
  const hospitalId = Number(params.hospitalId)
  const editUuid = params.monitorUuid
  const catalog = useCatalog()
  const existing = useMonitor(editUuid)

  if (!catalog) return null

  const hospital = catalog.hospitalById.get(hospitalId)
  if (!hospital) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <EmptyState icon={MonitorX} title="Hospital no encontrado" action={<Link to="/" className="text-sm font-medium text-teal-700 dark:text-teal-400">Ir al inicio</Link>} />
      </div>
    )
  }

  if (editUuid) {
    if (existing === undefined) return <LoadingState />
    if (existing === null) {
      return (
        <div className="mx-auto max-w-md px-4 py-10">
          <EmptyState
            icon={MonitorX}
            title="Monitor no encontrado"
            description="Pudo haber sido eliminado."
            action={<Link to={`/hospitals/${hospitalId}`} className="text-sm font-medium text-teal-700 dark:text-teal-400">Volver al hospital</Link>}
          />
        </div>
      )
    }
  }

  // La key reinicia el formulario si se navega a otro monitor
  return <MonitorForm key={editUuid ?? 'new'} catalog={catalog} hospitalId={hospitalId} hospitalName={hospital.name} existing={existing ?? null} />
}

interface MonitorFormProps {
  catalog: CatalogView
  hospitalId: number
  hospitalName: string
  existing: LocalMonitor | null
}

function MonitorForm({ catalog, hospitalId, hospitalName, existing }: MonitorFormProps) {
  const isEdit = existing !== null
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const hospitalMonitors = useHospitalMonitors(hospitalId)
  // La lista del hospital manda su URL con filtros para regresar a ella tal como estaba
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? `/hospitals/${hospitalId}`

  const [uuid, setUuid] = useState(() => existing?.uuid ?? newUuid())
  const [form, setForm] = useState<FormState>(() => (existing ? formFromMonitor(existing) : blankForm(catalog, hospitalId)))
  const [keptPhotos, setKeptPhotos] = useState<PhotoRef[]>(() => existing?.photos ?? [])
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([])
  const [addedPhotos, setAddedPhotos] = useState<AddedPhoto[]>([])
  const [errors, setErrors] = useState<{ service?: string; model?: string }>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null)
  const [lastSaved, setLastSaved] = useState<{ uuid: string; label: string } | null>(null)
  const [recentModels, setRecentModels] = useState(loadRecentModels)

  const serialRef = useRef<HTMLInputElement>(null)
  const inventoryRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }))
    setDirty(true)
  }, [])

  // Libera las URLs temporales de las fotos al salir
  const addedRef = useRef(addedPhotos)
  addedRef.current = addedPhotos
  useEffect(() => () => addedRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), [])

  const status = evaluateStatus(form.isOperational, form.consumables)
  const { missing, faulty } = countConditions(form)
  const model = catalog.modelById.get(Number(form.modelId))
  const modelConsumableIds = useMemo(() => new Set(model?.consumable_ids ?? []), [model])

  // ------------------------------------------------------------ Avisos de duplicados

  const serialKey = normalizeCode(form.serialNumber)
  const inventoryKey = normalizeCode(form.inventoryNumber)
  const serialDuplicates = useLiveQuery(
    () => (serialKey ? db.monitors.where('serial_number').equals(serialKey).filter((m) => m.uuid !== uuid).toArray() : []),
    [serialKey, uuid],
    [],
  )
  const inventoryDuplicates = useLiveQuery(
    () => (inventoryKey ? db.monitors.where('inventory_number').equals(inventoryKey).filter((m) => m.uuid !== uuid).toArray() : []),
    [inventoryKey, uuid],
    [],
  )

  // Ubicaciones ya usadas en el mismo servicio, como sugerencias
  const locationSuggestions = useMemo(() => {
    const values = (hospitalMonitors ?? [])
      .filter((monitor) => String(monitor.service_id) === form.serviceId && monitor.location)
      .map((monitor) => monitor.location!)
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  }, [hospitalMonitors, form.serviceId])

  // ------------------------------------------------------------ Acciones

  const changeModel = (modelId: string) => {
    update({ modelId, consumables: defaultConsumables(catalog, modelId, form.consumables) })
    setErrors((current) => ({ ...current, model: undefined }))
  }

  const addPhotos = async (files: File[]) => {
    const processed = await Promise.all(
      files.map(async (file) => {
        const blob = await compressImage(file)
        return { uuid: newUuid(), blob, url: URL.createObjectURL(blob) }
      }),
    )
    setAddedPhotos((current) => [...current, ...processed])
    setDirty(true)
  }

  const removePhoto = (photoUuid: string) => {
    const added = addedPhotos.find((photo) => photo.uuid === photoUuid)
    if (added) {
      URL.revokeObjectURL(added.url)
      setAddedPhotos((current) => current.filter((photo) => photo.uuid !== photoUuid))
    } else {
      setKeptPhotos((current) => current.filter((photo) => photo.uuid !== photoUuid))
      setRemovedPhotos((current) => [...current, photoUuid])
    }
    setDirty(true)
  }

  const resetForNext = () => {
    addedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url))
    setUuid(newUuid())
    setForm((current) => ({
      ...current,
      serialNumber: '',
      inventoryNumber: '',
      location: '',
      isOperational: true,
      notes: '',
      consumables: defaultConsumables(catalog, current.modelId),
    }))
    setKeptPhotos([])
    setRemovedPhotos([])
    setAddedPhotos([])
    setDirty(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // En escritorio el cursor queda listo en el número de serie; en celular no se abre el teclado solo
    if (window.matchMedia('(pointer: fine)').matches) {
      setTimeout(() => serialRef.current?.focus(), 50)
    }
  }

  const save = async (mode: 'next' | 'exit') => {
    const nextErrors = {
      service: form.serviceId ? undefined : 'Selecciona el servicio.',
      model: form.modelId ? undefined : 'Selecciona el modelo.',
    }
    setErrors(nextErrors)
    if (nextErrors.service || nextErrors.model) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const input: MonitorInput = {
      hospital_id: hospitalId,
      service_id: Number(form.serviceId),
      monitor_model_id: Number(form.modelId),
      serial_number: normalizeCode(form.serialNumber),
      inventory_number: normalizeCode(form.inventoryNumber),
      location: emptyToNull(form.location),
      is_operational: form.isOperational,
      notes: emptyToNull(form.notes),
      consumables: form.consumables.map((item) => {
        const isWorking = item.is_present && item.is_working
        // El desgaste se conserva en el formulario al apagar los interruptores, pero solo se guarda si funciona
        return { ...item, is_working: isWorking, wear: isWorking ? item.wear : null, notes: emptyToNull(item.notes) }
      }),
    }

    setSaving(true)
    try {
      await saveMonitor(uuid, input, user?.name ?? '', {
        added: addedPhotos.map(({ uuid: photoUuid, blob }) => ({ uuid: photoUuid, blob })),
        removed: removedPhotos,
      })
    } catch {
      toast.error('No se pudo guardar en el dispositivo. Revisa el espacio disponible.')
      setSaving(false)
      return
    }
    setSaving(false)

    navigator.vibrate?.(30)
    saveCapturePrefs(hospitalId, { serviceId: input.service_id, modelId: input.monitor_model_id })
    pushRecentModel(input.monitor_model_id)
    setRecentModels(loadRecentModels())

    const label = [catalog.modelLabel(input.monitor_model_id), input.serial_number ?? input.inventory_number].filter(Boolean).join(' · ')
    if (mode === 'exit' || isEdit) {
      toast.success(isEdit ? 'Cambios guardados' : 'Monitor guardado', { description: label })
      navigate(backTo)
      return
    }
    toast.success('Monitor guardado', { description: label })
    setLastSaved({ uuid, label })
    resetForNext()
  }

  const remove = async () => {
    const accepted = await confirm({
      title: 'Eliminar monitor',
      message: 'Se eliminará el registro, su diagnóstico y sus fotos. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!accepted) return
    await deleteMonitor(uuid)
    toast.success('Monitor eliminado')
    navigate(backTo, { replace: true })
  }

  const leave = async () => {
    if (dirty) {
      const accepted = await confirm({
        title: 'Salir sin guardar',
        message: 'Tienes datos capturados que no se han guardado.',
        confirmLabel: 'Salir sin guardar',
        danger: true,
      })
      if (!accepted) return
    }
    navigate(backTo)
  }

  // Ctrl/Cmd + Enter guarda (y en captura nueva pasa al siguiente)
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        void saveRef.current(isEdit ? 'exit' : 'next')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEdit])

  // Enter pasa al siguiente campo en lugar de enviar
  const focusOnEnter = (next: () => HTMLElement | null) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      next()?.focus()
    }
  }

  const registeredCount = hospitalMonitors?.length ?? 0
  const quickModels = recentModels.filter((id) => catalog.modelById.has(id))
  const photoItems: PhotoItem[] = [
    ...keptPhotos.map((photo) => ({ uuid: photo.uuid, url: null, local: photo.local })),
    ...addedPhotos.map((photo) => ({ uuid: photo.uuid, url: photo.url })),
  ]

  return (
    <div className="pb-40">
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <IconButton icon={ArrowLeft} label="Regresar" onClick={leave} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{isEdit ? 'Editar monitor' : 'Capturar monitor'}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {hospitalName} · {registeredCount} registrados
            </div>
          </div>
          <SyncIndicator compact />
          {isEdit && <IconButton icon={Trash2} label="Eliminar monitor" onClick={remove} />}
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-3 pt-4 sm:px-4">
        {lastSaved && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
            <CircleCheck className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Guardado: {lastSaved.label}</span>
            <Link to={`/hospitals/${hospitalId}/monitors/${lastSaved.uuid}`} state={{ backTo }} className="shrink-0 font-semibold underline underline-offset-2">
              Editar
            </Link>
          </div>
        )}

        <Card title="Equipo">
          <div className="grid gap-4 sm:grid-cols-2">
            <ServiceField
              catalog={catalog}
              value={form.serviceId}
              error={errors.service}
              onChange={(serviceId) => {
                update({ serviceId })
                setErrors((current) => ({ ...current, service: undefined }))
              }}
            />

            <Field label="Modelo" htmlFor="model" required error={errors.model}>
              <Select id="model" value={form.modelId} onChange={(event) => changeModel(event.target.value)}>
                <option value="">Selecciona un modelo…</option>
                {catalog.brands.map((brand) => {
                  const models = catalog.monitor_models.filter((item) => item.brand_id === brand.id)
                  if (models.length === 0) return null
                  return (
                    <optgroup key={brand.id} label={brand.name}>
                      {models.map((item) => (
                        <option key={item.id} value={item.id}>
                          {brand.name} {item.name} · {MOUNT_TYPE_LABELS[item.mount_type]}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </Select>
            </Field>
          </div>

          {quickModels.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {quickModels.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeModel(String(id))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
                    form.modelId === String(id) ? 'bg-teal-700 text-white ring-teal-700 dark:ring-teal-500' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {catalog.modelLabel(id)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Número de serie"
              htmlFor="serial"
              hint={<DuplicateHint label="número de serie" duplicates={serialDuplicates} catalog={catalog} />}
            >
              <div className="flex gap-2">
                <TextInput
                  id="serial"
                  ref={serialRef}
                  value={form.serialNumber}
                  onChange={(event) => update({ serialNumber: event.target.value })}
                  onKeyDown={focusOnEnter(() => inventoryRef.current)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="uppercase placeholder:normal-case"
                  placeholder="Ej. CM12345"
                />
                <IconButton icon={ScanBarcode} label="Escanear número de serie" variant="secondary" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => setScanTarget('serialNumber')} />
              </div>
            </Field>

            <Field
              label="No. nacional de inventario"
              htmlFor="inventory"
              hint={<DuplicateHint label="número de inventario" duplicates={inventoryDuplicates} catalog={catalog} />}
            >
              <div className="flex gap-2">
                <TextInput
                  id="inventory"
                  ref={inventoryRef}
                  value={form.inventoryNumber}
                  onChange={(event) => update({ inventoryNumber: event.target.value })}
                  onKeyDown={focusOnEnter(() => locationRef.current)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="uppercase placeholder:normal-case"
                  placeholder="NNI"
                />
                <IconButton icon={ScanBarcode} label="Escanear número de inventario" variant="secondary" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => setScanTarget('inventoryNumber')} />
              </div>
            </Field>
          </div>

          <Field label="Ubicación" htmlFor="location" className="mt-4" hint="Cama, cubículo o piso dentro del servicio.">
            <TextInput
              id="location"
              ref={locationRef}
              list="location-suggestions"
              value={form.location}
              onChange={(event) => update({ location: event.target.value })}
              onKeyDown={focusOnEnter(() => null)}
              autoComplete="off"
              placeholder="Ej. Cama 4"
            />
            <datalist id="location-suggestions">
              {locationSuggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
        </Card>

        <Card title="Diagnóstico">
          {/* Toda la tarjeta es clicable; el switch interno es el control accesible */}
          <div
            onClick={() => update({ isOperational: !form.isOperational })}
            className={`mb-5 flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left ring-1 transition-colors select-none ${
              form.isOperational ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30' : 'bg-rose-50 ring-rose-300 dark:bg-rose-500/10 dark:ring-rose-500/40'
            }`}
          >
            <Power className={`size-6 shrink-0 ${form.isOperational ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{form.isOperational ? 'El equipo funciona' : 'El equipo NO funciona'}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Enciende y opera correctamente (independiente de sus consumibles).</div>
            </div>
            <span onClick={(event) => event.stopPropagation()}>
              <Switch checked={form.isOperational} onChange={(isOperational) => update({ isOperational })} label="El equipo funciona" size="lg" tone="emerald" showLabel={false} />
            </span>
          </div>

          {model ? (
            <ConsumableChecklist
              catalog={catalog}
              items={form.consumables}
              modelConsumableIds={modelConsumableIds}
              onChange={(consumables) => update({ consumables })}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">Selecciona el modelo para ver sus consumibles.</p>
          )}
        </Card>

        <Card title="Observaciones y fotos">
          <Field label="Observaciones generales" htmlFor="notes">
            <TextArea
              id="notes"
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="Estado físico, carcasa, pantalla, accesorios adicionales…"
              maxLength={2000}
            />
          </Field>
          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Fotos</div>
            <PhotoPicker photos={photoItems} onAdd={addPhotos} onRemove={removePhoto} />
          </div>
        </Card>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <StatusBadge status={status} size="md" />
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
              {missing > 0 && `${missing} falta${missing === 1 ? '' : 'n'}`}
              {missing > 0 && faulty > 0 && ' · '}
              {faulty > 0 && `${faulty} no funciona${faulty === 1 ? '' : 'n'}`}
            </span>
          </div>
          {isEdit ? (
            <Button size="lg" icon={Save} loading={saving} onClick={() => save('exit')}>
              Guardar cambios
            </Button>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex">
              <Button size="lg" variant="secondary" icon={Check} disabled={saving} onClick={() => save('exit')}>
                Guardar
              </Button>
              <Button size="lg" icon={Plus} loading={saving} onClick={() => save('next')}>
                Guardar y siguiente
              </Button>
            </div>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scanTarget !== null}
        title={scanTarget === 'inventoryNumber' ? 'Escanear No. de inventario' : 'Escanear número de serie'}
        onClose={() => setScanTarget(null)}
        onDetected={(value) => {
          if (scanTarget) update({ [scanTarget]: value })
          setScanTarget(null)
          toast.success('Código leído', { description: value })
        }}
      />
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 dark:bg-slate-900 dark:ring-slate-800">
      <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {children}
    </section>
  )
}

function DuplicateHint({ label, duplicates, catalog }: { label: string; duplicates: LocalMonitor[]; catalog: CatalogView }) {
  if (duplicates.length === 0) return null
  const first = duplicates[0]
  return (
    <span className="flex items-start gap-1 text-amber-700 dark:text-amber-400">
      <TriangleAlert className="mt-px size-3.5 shrink-0" />
      <span>
        Ya existe un monitor con este {label} en {catalog.hospitalById.get(first.hospital_id)?.name ?? 'otro hospital'}.{' '}
        <Link to={`/hospitals/${first.hospital_id}/monitors/${first.uuid}`} className="font-semibold underline">
          Ver
        </Link>
      </span>
    </span>
  )
}

/** Selector de servicio con alta rápida (requiere conexión) */
function ServiceField({
  catalog,
  value,
  error,
  onChange,
}: {
  catalog: CatalogView
  value: string
  error?: string
  onChange: (serviceId: string) => void
}) {
  const [newName, setNewName] = useState<string | null>(null)
  const { run, saving, fieldErrors } = useCatalogMutation()

  const create = async () => {
    if (!newName?.trim()) return
    const service = await run(() => api.post<Service>('/services', { name: newName }), 'Servicio agregado')
    if (service) {
      onChange(String(service.id))
      setNewName(null)
    }
  }

  return (
    <Field label="Servicio" htmlFor="service" required error={fieldErrors.name ?? error}>
      {newName === null ? (
        <div className="flex gap-2">
          <Select id="service" value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">Selecciona un servicio…</option>
            {catalog.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
          <IconButton icon={Plus} label="Nuevo servicio" variant="secondary" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => setNewName('')} />
        </div>
      ) : (
        <div className="flex gap-2">
          <TextInput
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void create()
              }
            }}
            placeholder="Nombre del servicio"
            autoFocus
          />
          <IconButton icon={Check} label="Agregar servicio" variant="primary" className="h-11 w-11 sm:h-10 sm:w-10" disabled={saving} onClick={create} />
          <IconButton icon={X} label="Cancelar" variant="secondary" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => setNewName(null)} />
        </div>
      )}
    </Field>
  )
}
