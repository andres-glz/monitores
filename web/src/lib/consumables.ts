import { UNGROUPED_NAME, type CatalogView } from '../hooks/useCatalog'
import { DEFAULT_WEAR } from './status'
import type { Consumable, ConsumableState } from './types'

/** Estado de un consumible recién agregado: lo tiene, funciona y sin desgaste (solo se marcan las excepciones) */
export function defaultConsumableState(consumableId: number): ConsumableState {
  return { consumable_id: consumableId, is_present: true, is_working: true, wear: DEFAULT_WEAR, notes: null }
}

export interface ConsumableSection {
  groupId: number | null
  groupName: string
  items: Consumable[]
}

// Los consumibles sin grupo van al final
const UNGROUPED_ORDER = Number.MAX_SAFE_INTEGER

/**
 * Agrupa y ordena consumibles por grupo (orden del grupo y luego del consumible).
 * Si se pasan ids, solo incluye esos consumibles.
 */
export function groupConsumables(catalog: CatalogView, ids?: Iterable<number>): ConsumableSection[] {
  const items = ids
    ? [...new Set(ids)].map((id) => catalog.consumableById.get(id)).filter((item): item is Consumable => item !== undefined)
    : catalog.consumables

  const sections = new Map<number | null, ConsumableSection>()
  for (const item of items) {
    const groupId = item.consumable_group_id !== null && catalog.groupById.has(item.consumable_group_id) ? item.consumable_group_id : null
    if (!sections.has(groupId)) {
      sections.set(groupId, { groupId, groupName: groupId === null ? UNGROUPED_NAME : catalog.groupName(groupId), items: [] })
    }
    sections.get(groupId)!.items.push(item)
  }

  const groupOrder = (groupId: number | null) => (groupId === null ? UNGROUPED_ORDER : (catalog.groupById.get(groupId)?.sort_order ?? 0))

  return [...sections.values()]
    .sort((a, b) => groupOrder(a.groupId) - groupOrder(b.groupId) || a.groupName.localeCompare(b.groupName, 'es'))
    .map((section) => ({
      ...section,
      items: section.items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es')),
    }))
}
