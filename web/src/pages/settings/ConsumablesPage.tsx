import { Boxes, Info, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select, TextArea, TextInput } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { UNGROUPED_NAME, useCatalog } from '../../hooks/useCatalog'
import { useCatalogMutation } from '../../hooks/useCatalogMutation'
import { api } from '../../lib/api'
import { emptyToNull, plural } from '../../lib/format'
import type { Consumable, ConsumableGroup } from '../../lib/types'

type GroupEditing = ConsumableGroup | 'new' | null
type ConsumableEditing = Consumable | { group_id: number | null } | null

export function ConsumablesPage() {
  const catalog = useCatalog()
  const confirm = useConfirm()
  const { run } = useCatalogMutation()
  const [editingGroup, setEditingGroup] = useState<GroupEditing>(null)
  const [editingConsumable, setEditingConsumable] = useState<ConsumableEditing>(null)

  // Cuántos modelos usan cada consumible
  const modelUsage = useMemo(() => {
    const counts = new Map<number, number>()
    for (const model of catalog?.monitor_models ?? []) {
      for (const id of model.consumable_ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [catalog])

  if (!catalog) return null

  const sections: { group: ConsumableGroup | null; items: Consumable[] }[] = [
    ...catalog.consumable_groups.map((group) => ({
      group,
      items: catalog.consumables.filter((item) => item.consumable_group_id === group.id),
    })),
  ]
  const ungrouped = catalog.consumables.filter((item) => item.consumable_group_id === null)
  if (ungrouped.length > 0) sections.push({ group: null, items: ungrouped })

  const removeGroup = async (group: ConsumableGroup) => {
    const accepted = await confirm({
      title: 'Eliminar grupo',
      message: `¿Eliminar el grupo "${group.name}"? Sus consumibles no se borran: pasan al grupo "${UNGROUPED_NAME}".`,
      confirmLabel: 'Eliminar grupo',
      danger: true,
    })
    if (accepted) await run(() => api.delete(`/consumable-groups/${group.id}`), 'Grupo eliminado')
  }

  const removeConsumable = async (consumable: Consumable) => {
    const accepted = await confirm({
      title: 'Eliminar consumible',
      message: `¿Eliminar "${consumable.name}"? Se quitará de la configuración de los modelos. No es posible si ya está registrado en algún monitor.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (accepted) await run(() => api.delete(`/consumables/${consumable.id}`), 'Consumible eliminado')
  }

  return (
    <>
      <PageHeader
        title="Consumibles"
        backTo="/settings"
        subtitle="Cables, sensores y accesorios agrupados por parámetro."
        actions={
          <>
            <Button variant="secondary" icon={Plus} onClick={() => setEditingGroup('new')}>
              Nuevo grupo
            </Button>
            <Button icon={Plus} onClick={() => setEditingConsumable({ group_id: catalog.consumable_groups[0]?.id ?? null })}>
              Nuevo consumible
            </Button>
          </>
        }
      />

      <div className="mb-5 flex gap-3 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Agrupa los consumibles del mismo parámetro. Por ejemplo, en <strong>PANI</strong> puedes tener “Manguera” y
          “Brazalete” por separado, y también “Manguera y brazalete (1 pieza)”. Después, en cada modelo eliges cuáles lleva.
        </p>
      </div>

      {sections.length === 0 ? (
        <EmptyState icon={Boxes} title="Sin consumibles" description="Crea un grupo (p. ej. SpO2) y agrega sus consumibles." />
      ) : (
        <div className="space-y-4">
          {sections.map(({ group, items }) => (
            <section key={group?.id ?? 'ungrouped'} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900">{group?.name ?? UNGROUPED_NAME}</h2>
                  <p className="text-xs text-slate-500">
                    {group?.description ? `${group.description} · ` : ''}
                    {plural(items.length, 'consumible', 'consumibles')}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon={Plus} onClick={() => setEditingConsumable({ group_id: group?.id ?? null })}>
                  <span className="max-sm:hidden">Agregar</span>
                </Button>
                {group && (
                  <>
                    <IconButton icon={Pencil} label="Editar grupo" onClick={() => setEditingGroup(group)} />
                    <IconButton icon={Trash2} label="Eliminar grupo" onClick={() => removeGroup(group)} />
                  </>
                )}
              </header>
              {items.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">Aún no hay consumibles en este grupo.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          {item.description ? `${item.description} · ` : ''}
                          {plural(modelUsage.get(item.id) ?? 0, 'modelo', 'modelos')}
                        </div>
                      </div>
                      <IconButton icon={Pencil} label="Editar" onClick={() => setEditingConsumable(item)} />
                      <IconButton icon={Trash2} label="Eliminar" onClick={() => removeConsumable(item)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <GroupFormModal
        open={editingGroup !== null}
        group={editingGroup === 'new' ? null : editingGroup}
        onClose={() => setEditingGroup(null)}
      />
      <ConsumableFormModal
        open={editingConsumable !== null}
        editing={editingConsumable}
        groups={catalog.consumable_groups}
        onClose={() => setEditingConsumable(null)}
      />
    </>
  )
}

function GroupFormModal({ open, group, onClose }: { open: boolean; group: ConsumableGroup | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setDescription(group?.description ?? '')
      setSortOrder(group ? String(group.sort_order) : '')
      clearErrors()
    }
  }, [open, group, clearErrors])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const body = { name, description: emptyToNull(description), sort_order: sortOrder === '' ? null : Number(sortOrder) }
    const saved = await run(
      () => (group ? api.put(`/consumable-groups/${group.id}`, body) : api.post('/consumable-groups', body)),
      group ? 'Grupo actualizado' : 'Grupo creado',
    )
    if (saved) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? 'Editar grupo' : 'Nuevo grupo de consumibles'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="group-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre" htmlFor="group-name" required error={fieldErrors.name} hint="Parámetro o tipo, p. ej. SpO2, PANI, ECG.">
          <TextInput id="group-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </Field>
        <Field label="Descripción" htmlFor="group-description" error={fieldErrors.description}>
          <TextArea id="group-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </Field>
        <Field label="Orden" htmlFor="group-order" error={fieldErrors.sort_order} hint="Los grupos se muestran de menor a mayor. Vacío = al final.">
          <TextInput
            id="group-order"
            type="number"
            min={0}
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}

function ConsumableFormModal({
  open,
  editing,
  groups,
  onClose,
}: {
  open: boolean
  editing: ConsumableEditing
  groups: ConsumableGroup[]
  onClose: () => void
}) {
  const consumable = editing && 'id' in editing ? editing : null
  const [groupId, setGroupId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('')
  const { run, saving, fieldErrors, clearErrors } = useCatalogMutation()

  useEffect(() => {
    if (!open || !editing) return
    const initialGroup = 'id' in editing ? editing.consumable_group_id : editing.group_id
    setGroupId(initialGroup === null ? '' : String(initialGroup))
    setName('id' in editing ? editing.name : '')
    setDescription('id' in editing ? (editing.description ?? '') : '')
    setSortOrder('id' in editing ? String(editing.sort_order) : '')
    clearErrors()
  }, [open, editing, clearErrors])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const body = {
      consumable_group_id: groupId === '' ? null : Number(groupId),
      name,
      description: emptyToNull(description),
      sort_order: sortOrder === '' ? null : Number(sortOrder),
    }
    const saved = await run(
      () => (consumable ? api.put(`/consumables/${consumable.id}`, body) : api.post('/consumables', body)),
      consumable ? 'Consumible actualizado' : 'Consumible agregado',
    )
    if (saved) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={consumable ? 'Editar consumible' : 'Nuevo consumible'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="consumable-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="consumable-form" onSubmit={submit} className="space-y-4">
        <Field label="Grupo" htmlFor="consumable-group" error={fieldErrors.consumable_group_id}>
          <Select id="consumable-group" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
            <option value="">Sin grupo ({UNGROUPED_NAME})</option>
          </Select>
        </Field>
        <Field label="Nombre" htmlFor="consumable-name" required error={fieldErrors.name}>
          <TextInput
            id="consumable-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sensor SpO2 adulto"
            required
            autoFocus
          />
        </Field>
        <Field label="Descripción" htmlFor="consumable-description" error={fieldErrors.description}>
          <TextArea id="consumable-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </Field>
        <Field label="Orden dentro del grupo" htmlFor="consumable-order" error={fieldErrors.sort_order} hint="Vacío = al final.">
          <TextInput
            id="consumable-order"
            type="number"
            min={0}
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
