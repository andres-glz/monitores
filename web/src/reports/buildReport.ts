import type { CatalogView } from '../hooks/useCatalog'
import { groupConsumables } from '../lib/consumables'
import { MOUNT_TYPE_LABELS, WEAR_LEVELS, consumableCondition, needsAttention, type ConsumableCondition } from '../lib/status'
import type { ConsumableWear, Hospital, LocalMonitor, MonitorStatus } from '../lib/types'

/**
 * Datos y estadísticas del reporte de un hospital (los usan el PDF y el Excel).
 */

export interface ReportOptions {
  hospital: Hospital
  monitors: LocalMonitor[]
  catalog: CatalogView
  generatedBy: string
}

export interface ReportConsumableLine {
  name: string
  groupName: string
  condition: ConsumableCondition
  // Solo en los que funcionan; null = sin evaluar
  wear: ConsumableWear | null
  notes: string | null
}

// Desgaste de los consumibles que funcionan ('unrated': capturas sin desgaste)
export type WearKey = ConsumableWear | 'unrated'

export const WEAR_KEYS: WearKey[] = [...WEAR_LEVELS, 'unrated']

export type WearCounts = Record<WearKey, number> & { total: number }

export interface WearTally extends WearCounts {
  name: string
  groupName: string
}

/** Consumible con desgaste moderado o avanzado, para la lista de reemplazo prioritario */
export interface WearAttentionLine {
  monitorUuid: string
  serviceName: string
  location: string | null
  modelLabel: string
  serialNumber: string | null
  inventoryNumber: string | null
  consumable: string
  groupName: string
  wear: ConsumableWear
  notes: string | null
}

export interface ReportConsumableSection {
  groupName: string
  items: ReportConsumableLine[]
}

export interface ReportMonitor {
  uuid: string
  serviceName: string
  brandName: string
  modelName: string
  modelLabel: string
  mountTypeLabel: string
  serialNumber: string | null
  inventoryNumber: string | null
  location: string | null
  isOperational: boolean
  status: MonitorStatus
  notes: string | null
  sections: ReportConsumableSection[]
  workingCount: number
  faultyCount: number
  missingCount: number
  photoCount: number
  capturedBy: string | null
  updatedAt: string | null
}

export interface StatusBreakdown {
  total: number
  complete: number
  functional_incomplete: number
  non_functional: number
}

export interface NamedBreakdown extends StatusBreakdown {
  name: string
  detail?: string
}

export interface ConditionTally {
  name: string
  groupName: string
  working: number
  faulty: number
  missing: number
  total: number
}

export interface HospitalReport {
  hospital: Hospital
  title: string
  generatedAt: Date
  generatedBy: string
  totals: StatusBreakdown
  byService: NamedBreakdown[]
  byModel: NamedBreakdown[]
  byMountType: NamedBreakdown[]
  consumableTotals: { total: number; working: number; faulty: number; missing: number }
  byConsumable: ConditionTally[]
  byGroup: ConditionTally[]
  missingByConsumable: ConditionTally[]
  faultyByConsumable: ConditionTally[]
  replacementNeeds: ConditionTally[]
  topNotes: { note: string; count: number }[]
  wearTotals: WearCounts
  wearByConsumable: WearTally[]
  wearAttention: WearAttentionLine[]
  monitorsWithIssues: number
  nonFunctionalMonitors: ReportMonitor[]
  monitors: ReportMonitor[]
}

export const REPORT_TITLE = 'Diagnóstico de monitores de signos vitales'

function emptyBreakdown(name: string, detail?: string): NamedBreakdown {
  return { name, detail, total: 0, complete: 0, functional_incomplete: 0, non_functional: 0 }
}

function tally<T extends StatusBreakdown>(target: T, status: MonitorStatus): void {
  target.total++
  target[status]++
}

function emptyWearCounts(): WearCounts {
  return { optimal: 0, light: 0, moderate: 0, advanced: 0, unrated: 0, total: 0 }
}

function sortBreakdown(items: NamedBreakdown[]): NamedBreakdown[] {
  return items.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'))
}

export function buildHospitalReport({ hospital, monitors, catalog, generatedBy }: ReportOptions): HospitalReport {
  const totals: StatusBreakdown = { total: 0, complete: 0, functional_incomplete: 0, non_functional: 0 }
  const byService = new Map<string, NamedBreakdown>()
  const byModel = new Map<string, NamedBreakdown>()
  const byMountType = new Map<string, NamedBreakdown>()
  const byConsumable = new Map<number, ConditionTally>()
  const byGroup = new Map<string, ConditionTally>()
  const notes = new Map<string, { note: string; count: number }>()
  const consumableTotals = { total: 0, working: 0, faulty: 0, missing: 0 }
  const wearTotals = emptyWearCounts()
  const wearByConsumable = new Map<number, WearTally>()
  const wearAttention: WearAttentionLine[] = []

  const reportMonitors: ReportMonitor[] = monitors.map((monitor) => {
    const model = catalog.modelById.get(monitor.monitor_model_id)
    const brandName = model ? (catalog.brandById.get(model.brand_id)?.name ?? '') : ''
    const serviceName = catalog.serviceById.get(monitor.service_id)?.name ?? 'Sin servicio'
    const modelLabel = catalog.modelLabel(monitor.monitor_model_id)
    const mountTypeLabel = model ? MOUNT_TYPE_LABELS[model.mount_type] : ''

    tally(totals, monitor.status)
    tally(byService.get(serviceName) ?? byService.set(serviceName, emptyBreakdown(serviceName)).get(serviceName)!, monitor.status)
    tally(byModel.get(modelLabel) ?? byModel.set(modelLabel, emptyBreakdown(modelLabel, mountTypeLabel)).get(modelLabel)!, monitor.status)
    if (mountTypeLabel) {
      tally(byMountType.get(mountTypeLabel) ?? byMountType.set(mountTypeLabel, emptyBreakdown(mountTypeLabel)).get(mountTypeLabel)!, monitor.status)
    }

    const stateById = new Map(monitor.consumables.map((item) => [item.consumable_id, item]))
    let workingCount = 0
    let faultyCount = 0
    let missingCount = 0

    const sections = groupConsumables(catalog, stateById.keys()).map((section) => ({
      groupName: section.groupName,
      items: section.items.map((consumable) => {
        const state = stateById.get(consumable.id)!
        const condition = consumableCondition(state)

        consumableTotals.total++
        consumableTotals[condition]++
        if (condition === 'working') workingCount++
        else if (condition === 'faulty') faultyCount++
        else missingCount++

        const consumableTally =
          byConsumable.get(consumable.id) ??
          byConsumable
            .set(consumable.id, { name: consumable.name, groupName: section.groupName, working: 0, faulty: 0, missing: 0, total: 0 })
            .get(consumable.id)!
        consumableTally[condition]++
        consumableTally.total++

        const groupTally =
          byGroup.get(section.groupName) ??
          byGroup.set(section.groupName, { name: section.groupName, groupName: section.groupName, working: 0, faulty: 0, missing: 0, total: 0 }).get(section.groupName)!
        groupTally[condition]++
        groupTally.total++

        // Frecuencia de observaciones (separadas por coma) en consumibles con problema
        if (condition !== 'working' && state.notes) {
          for (const part of state.notes.split(',')) {
            const note = part.trim()
            if (!note) continue
            const key = note.toLowerCase()
            const entry = notes.get(key) ?? notes.set(key, { note: note.charAt(0).toUpperCase() + note.slice(1), count: 0 }).get(key)!
            entry.count++
          }
        }

        // El desgaste solo se registra en los que funcionan (datos anteriores pueden no traerlo)
        const wear = condition === 'working' ? (state.wear ?? null) : null
        if (condition === 'working') {
          const wearTally =
            wearByConsumable.get(consumable.id) ??
            wearByConsumable.set(consumable.id, { name: consumable.name, groupName: section.groupName, ...emptyWearCounts() }).get(consumable.id)!
          for (const target of [wearTotals, wearTally]) {
            target[wear ?? 'unrated']++
            target.total++
          }
          if (wear && needsAttention(wear)) {
            wearAttention.push({
              monitorUuid: monitor.uuid,
              serviceName,
              location: monitor.location,
              modelLabel,
              serialNumber: monitor.serial_number,
              inventoryNumber: monitor.inventory_number,
              consumable: consumable.name,
              groupName: section.groupName,
              wear,
              notes: state.notes,
            })
          }
        }

        return { name: consumable.name, groupName: section.groupName, condition, wear, notes: state.notes }
      }),
    }))

    return {
      uuid: monitor.uuid,
      serviceName,
      brandName,
      modelName: model?.name ?? 'Modelo eliminado',
      modelLabel,
      mountTypeLabel,
      serialNumber: monitor.serial_number,
      inventoryNumber: monitor.inventory_number,
      location: monitor.location,
      isOperational: monitor.is_operational,
      status: monitor.status,
      notes: monitor.notes,
      sections,
      workingCount,
      faultyCount,
      missingCount,
      photoCount: monitor.photos.length,
      capturedBy: monitor.updated_by_name ?? monitor.created_by_name,
      updatedAt: monitor.updated_at,
    }
  })

  reportMonitors.sort(
    (a, b) =>
      a.serviceName.localeCompare(b.serviceName, 'es') ||
      (a.location ?? '').localeCompare(b.location ?? '', 'es', { numeric: true }) ||
      (a.serialNumber ?? '').localeCompare(b.serialNumber ?? ''),
  )

  const consumableList = [...byConsumable.values()]
  const groupOrder = groupConsumables(catalog).map((section) => section.groupName)

  return {
    hospital,
    title: `${REPORT_TITLE}. ${hospital.name}`,
    generatedAt: new Date(),
    generatedBy,
    totals,
    byService: [...byService.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    byModel: sortBreakdown([...byModel.values()]),
    byMountType: sortBreakdown([...byMountType.values()]),
    consumableTotals,
    byConsumable: consumableList,
    byGroup: [...byGroup.values()].sort((a, b) => groupOrder.indexOf(a.name) - groupOrder.indexOf(b.name)),
    missingByConsumable: consumableList.filter((item) => item.missing > 0).sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name, 'es')),
    faultyByConsumable: consumableList.filter((item) => item.faulty > 0).sort((a, b) => b.faulty - a.faulty || a.name.localeCompare(b.name, 'es')),
    replacementNeeds: consumableList
      .filter((item) => item.missing + item.faulty > 0)
      .sort((a, b) => b.missing + b.faulty - (a.missing + a.faulty) || a.name.localeCompare(b.name, 'es')),
    topNotes: [...notes.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    wearTotals,
    // Primero los que tienen más desgaste avanzado y moderado
    wearByConsumable: [...wearByConsumable.values()].sort(
      (a, b) => b.advanced - a.advanced || b.moderate - a.moderate || b.light - a.light || a.name.localeCompare(b.name, 'es'),
    ),
    // Primero el desgaste avanzado (reemplazo prioritario), luego por servicio y ubicación
    wearAttention: wearAttention.sort(
      (a, b) =>
        WEAR_LEVELS.indexOf(b.wear) - WEAR_LEVELS.indexOf(a.wear) ||
        a.serviceName.localeCompare(b.serviceName, 'es') ||
        (a.location ?? '').localeCompare(b.location ?? '', 'es', { numeric: true }) ||
        a.consumable.localeCompare(b.consumable, 'es'),
    ),
    monitorsWithIssues: reportMonitors.filter((monitor) => monitor.missingCount + monitor.faultyCount > 0).length,
    nonFunctionalMonitors: reportMonitors.filter((monitor) => monitor.status === 'non_functional'),
    monitors: reportMonitors,
  }
}
