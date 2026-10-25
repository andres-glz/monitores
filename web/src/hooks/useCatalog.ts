import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { Brand, Catalog, Consumable, ConsumableGroup, Hospital, MonitorModel, Service } from '../lib/types'
import { getCatalog } from '../offline/db'

export interface CatalogView extends Catalog {
  hospitalById: Map<number, Hospital>
  serviceById: Map<number, Service>
  brandById: Map<number, Brand>
  groupById: Map<number, ConsumableGroup>
  consumableById: Map<number, Consumable>
  modelById: Map<number, MonitorModel>
  /** "Marca Modelo" para mostrar */
  modelLabel: (modelId: number) => string
  groupName: (groupId: number | null) => string
}

export const UNGROUPED_NAME = 'General'

function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]))
}

export function buildCatalogView(catalog: Catalog): CatalogView {
  const brandById = byId(catalog.brands)
  const modelById = byId(catalog.monitor_models)
  const groupById = byId(catalog.consumable_groups)

  return {
    ...catalog,
    hospitalById: byId(catalog.hospitals),
    serviceById: byId(catalog.services),
    brandById,
    groupById,
    consumableById: byId(catalog.consumables),
    modelById,
    modelLabel: (modelId) => {
      const model = modelById.get(modelId)
      if (!model) return 'Modelo eliminado'
      const brand = brandById.get(model.brand_id)
      return brand ? `${brand.name} ${model.name}` : model.name
    },
    groupName: (groupId) => (groupId === null ? UNGROUPED_NAME : (groupById.get(groupId)?.name ?? UNGROUPED_NAME)),
  }
}

/**
 * Catálogos guardados en el dispositivo (se actualizan solos al sincronizar).
 * undefined = cargando, null = aún no hay datos descargados.
 */
export function useCatalog(): CatalogView | null | undefined {
  const catalog = useLiveQuery(getCatalog)
  return useMemo(() => (catalog ? buildCatalogView(catalog) : catalog), [catalog])
}
