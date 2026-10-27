import { MOUNT_TYPE_LABELS, isFound } from '../lib/status'
import type { Hospital } from '../lib/types'
import type { ReportOptions } from './buildReport'

/**
 * Listado breve de los monitores registrados que no se encontraron físicamente (lo usan el PDF y el Excel).
 * No hay dictamen: solo cuántos son y de qué marca y modelo.
 */

export const NOT_FOUND_REPORT_TITLE = 'Monitores no encontrados'

export interface NotFoundMonitor {
  uuid: string
  brandName: string
  modelName: string
  mountTypeLabel: string
  serialNumber: string | null
  inventoryNumber: string | null
  serviceName: string
  location: string | null
  notes: string | null
  registeredAt: string | null
}

export interface CountLine {
  name: string
  detail?: string
  count: number
}

export interface NotFoundReport {
  hospital: Hospital
  title: string
  generatedAt: Date
  generatedBy: string
  total: number
  // Todos los registrados del hospital, para el porcentaje
  registered: number
  byBrand: CountLine[]
  byModel: CountLine[]
  monitors: NotFoundMonitor[]
}

function countBy(lines: Map<string, CountLine>, name: string, detail?: string): void {
  const line = lines.get(name) ?? lines.set(name, { name, detail, count: 0 }).get(name)!
  line.count++
}

function sortCounts(lines: Map<string, CountLine>): CountLine[] {
  return [...lines.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
}

export function buildNotFoundReport({ hospital, monitors, catalog, generatedBy }: ReportOptions): NotFoundReport {
  const byBrand = new Map<string, CountLine>()
  const byModel = new Map<string, CountLine>()

  const rows: NotFoundMonitor[] = monitors
    .filter((monitor) => !isFound(monitor))
    .map((monitor) => {
      const model = catalog.modelById.get(monitor.monitor_model_id)
      const brandName = model ? (catalog.brandById.get(model.brand_id)?.name ?? '') : ''
      const mountTypeLabel = model ? MOUNT_TYPE_LABELS[model.mount_type] : ''

      countBy(byBrand, brandName || 'Sin marca')
      countBy(byModel, catalog.modelLabel(monitor.monitor_model_id), mountTypeLabel)

      return {
        uuid: monitor.uuid,
        brandName,
        modelName: model?.name ?? 'Modelo eliminado',
        mountTypeLabel,
        serialNumber: monitor.serial_number,
        inventoryNumber: monitor.inventory_number,
        serviceName: catalog.serviceById.get(monitor.service_id)?.name ?? 'Sin servicio',
        location: monitor.location,
        notes: monitor.notes,
        registeredAt: monitor.created_at,
      }
    })

  rows.sort(
    (a, b) =>
      a.brandName.localeCompare(b.brandName, 'es') ||
      a.modelName.localeCompare(b.modelName, 'es', { numeric: true }) ||
      (a.serialNumber ?? '').localeCompare(b.serialNumber ?? '', 'es', { numeric: true }),
  )

  return {
    hospital,
    title: `${NOT_FOUND_REPORT_TITLE}. ${hospital.name}`,
    generatedAt: new Date(),
    generatedBy,
    total: rows.length,
    registered: monitors.length,
    byBrand: sortCounts(byBrand),
    byModel: sortCounts(byModel),
    monitors: rows,
  }
}
