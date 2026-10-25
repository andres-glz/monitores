import type { CatalogView } from '../hooks/useCatalog'
import { MOUNT_TYPE_LABELS, consumableCondition } from './status'
import { searchable } from './format'
import type { LocalMonitor, Monitor } from './types'

/** Datos de un monitor con los nombres de catálogo resueltos, para listas y búsquedas */
export interface MonitorRow {
  monitor: LocalMonitor
  hospitalName: string
  serviceName: string
  brandName: string
  modelName: string
  modelLabel: string
  mountTypeLabel: string
  missingCount: number
  faultyCount: number
  searchText: string
}

export function describeMonitor(monitor: LocalMonitor, catalog: CatalogView): MonitorRow {
  const model = catalog.modelById.get(monitor.monitor_model_id)
  const brandName = model ? (catalog.brandById.get(model.brand_id)?.name ?? '') : ''
  const serviceName = catalog.serviceById.get(monitor.service_id)?.name ?? 'Servicio eliminado'
  const hospitalName = catalog.hospitalById.get(monitor.hospital_id)?.name ?? ''
  const modelLabel = catalog.modelLabel(monitor.monitor_model_id)
  const { missing, faulty } = countConditions(monitor)

  return {
    monitor,
    hospitalName,
    serviceName,
    brandName,
    modelName: model?.name ?? 'Modelo eliminado',
    modelLabel,
    mountTypeLabel: model ? MOUNT_TYPE_LABELS[model.mount_type] : '',
    missingCount: missing,
    faultyCount: faulty,
    searchText: searchable(
      [monitor.serial_number, monitor.inventory_number, serviceName, modelLabel, monitor.location, hospitalName, monitor.notes].join(' '),
    ),
  }
}

export function countConditions(monitor: Pick<Monitor, 'consumables'>): { missing: number; faulty: number } {
  let missing = 0
  let faulty = 0
  for (const item of monitor.consumables) {
    const condition = consumableCondition(item)
    if (condition === 'missing') missing++
    else if (condition === 'faulty') faulty++
  }
  return { missing, faulty }
}

export function monitorPath(monitor: Pick<Monitor, 'hospital_id' | 'uuid'>): string {
  return `/hospitals/${monitor.hospital_id}/monitors/${monitor.uuid}`
}

/** Orden dentro de un servicio: por ubicación (cama 2 antes que cama 10) y luego por número de serie */
export function compareByLocation(a: MonitorRow, b: MonitorRow): number {
  return (
    (a.monitor.location ?? '').localeCompare(b.monitor.location ?? '', 'es', { numeric: true }) ||
    (a.monitor.serial_number ?? '').localeCompare(b.monitor.serial_number ?? '')
  )
}

/** Búsqueda por coincidencia: todas las palabras deben aparecer (sin importar acentos ni mayúsculas) */
export function matchesQuery(row: MonitorRow, query: string): boolean {
  const terms = searchable(query).split(/\s+/).filter(Boolean)
  return terms.every((term) => row.searchText.includes(term))
}
