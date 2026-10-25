import { CircleCheck, MessageSquareText, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { CatalogView } from '../hooks/useCatalog'
import { groupConsumables } from '../lib/consumables'
import { consumableCondition, type ConsumableCondition } from '../lib/status'
import type { ConsumableState } from '../lib/types'
import { Select } from './ui/Field'
import { Switch } from './ui/Switch'

// Frases rápidas para no escribir lo mismo una y otra vez
const QUICK_NOTES: Record<Exclude<ConsumableCondition, 'working'>, string[]> = {
  faulty: ['Falso contacto', 'Cable dañado', 'Conector roto', 'No da lectura', 'Desgastado'],
  missing: ['Extraviado', 'En reparación', 'Prestado a otro servicio'],
}

const ROW_TONES: Record<ConsumableCondition, string> = {
  working: 'bg-white ring-slate-200',
  faulty: 'bg-amber-50 ring-amber-300',
  missing: 'bg-rose-50 ring-rose-300',
}

interface ConsumableChecklistProps {
  catalog: CatalogView
  items: ConsumableState[]
  // Consumibles que vienen de la configuración del modelo (los demás son extras y se pueden quitar)
  modelConsumableIds: Set<number>
  onChange: (items: ConsumableState[]) => void
}

export function ConsumableChecklist({ catalog, items, modelConsumableIds, onChange }: ConsumableChecklistProps) {
  const byId = new Map(items.map((item) => [item.consumable_id, item]))
  const sections = groupConsumables(catalog, byId.keys())
  const available = catalog.consumables.filter((consumable) => !byId.has(consumable.id))

  const update = (id: number, patch: Partial<ConsumableState>) => {
    onChange(items.map((item) => (item.consumable_id === id ? { ...item, ...patch } : item)))
  }

  const setGroup = (ids: number[], isPresent: boolean) => {
    const targets = new Set(ids)
    onChange(items.map((item) => (targets.has(item.consumable_id) ? { ...item, is_present: isPresent, is_working: isPresent } : item)))
  }

  const addExtra = (id: number) => {
    onChange([...items, { consumable_id: id, is_present: true, is_working: true, notes: null }])
  }

  const removeExtra = (id: number) => {
    onChange(items.filter((item) => item.consumable_id !== id))
  }

  if (items.length === 0 && available.length === 0) {
    return <p className="text-sm text-slate-500">Este modelo no tiene consumibles configurados.</p>
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const ids = section.items.map((item) => item.id)
        return (
          <section key={section.groupId ?? 'general'}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{section.groupName}</h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setGroup(ids, false)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                >
                  Falta todo
                </button>
                <button
                  type="button"
                  onClick={() => setGroup(ids, true)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
                >
                  Todo OK
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {section.items.map((consumable) => (
                <ConsumableRow
                  key={consumable.id}
                  name={consumable.name}
                  state={byId.get(consumable.id)!}
                  isExtra={!modelConsumableIds.has(consumable.id)}
                  onChange={(patch) => update(consumable.id, patch)}
                  onRemove={() => removeExtra(consumable.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="size-4 shrink-0 text-slate-400" />
          <Select
            value=""
            onChange={(event) => event.target.value && addExtra(Number(event.target.value))}
            className="text-slate-600"
            aria-label="Agregar consumible extra"
          >
            <option value="">Agregar otro consumible…</option>
            {groupConsumables(catalog, available.map((item) => item.id)).map((section) => (
              <optgroup key={section.groupId ?? 'general'} label={section.groupName}>
                {section.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
      )}
    </div>
  )
}

interface ConsumableRowProps {
  name: string
  state: ConsumableState
  isExtra: boolean
  onChange: (patch: Partial<ConsumableState>) => void
  onRemove: () => void
}

function ConsumableRow({ name, state, isExtra, onChange, onRemove }: ConsumableRowProps) {
  const condition = consumableCondition(state)
  const [notesOpen, setNotesOpen] = useState(false)
  const showNotes = notesOpen || condition !== 'working' || Boolean(state.notes)

  const appendNote = (text: string) => {
    const current = state.notes?.trim()
    if (current?.toLowerCase().includes(text.toLowerCase())) return
    onChange({ notes: current ? `${current}, ${text}` : text })
  }

  return (
    <div className={`rounded-xl p-3 ring-1 transition-colors ${ROW_TONES[condition]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-900">
          {condition === 'working' && <CircleCheck className="size-4 shrink-0 text-emerald-600" />}
          <span>{name}</span>
          {isExtra && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 uppercase">Extra</span>}
        </div>
        <div className="-my-1 -mr-1 flex shrink-0">
          {!showNotes && (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="rounded p-1.5 text-slate-400 hover:text-teal-700"
              aria-label="Agregar observación"
              title="Agregar observación"
            >
              <MessageSquareText className="size-4" />
            </button>
          )}
          {isExtra && (
            <button type="button" onClick={onRemove} className="rounded p-1.5 text-slate-400 hover:text-slate-600" aria-label="Quitar consumible">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-5">
        <Switch
          label="Lo tiene"
          checked={state.is_present}
          // Al volver a marcarlo como presente se asume que funciona (caso más común)
          onChange={(present) => onChange({ is_present: present, is_working: present })}
        />
        <Switch
          label="Funciona"
          tone="emerald"
          checked={state.is_working}
          disabled={!state.is_present}
          onChange={(working) => onChange({ is_working: working })}
        />
      </div>

      {showNotes && (
        <div className="mt-2 space-y-2">
          <input
            value={state.notes ?? ''}
            onChange={(event) => onChange({ notes: event.target.value || null })}
            placeholder="Observaciones (p. ej. falso contacto)"
            maxLength={255}
            className="block h-10 w-full rounded-lg border-0 bg-white px-3 text-sm text-slate-900 ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600"
          />
          {condition !== 'working' && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTES[condition].map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => appendNote(text)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 active:bg-slate-100"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
