import ExcelJS from 'exceljs'
import { downloadBlob, reportFileName } from '../../lib/download'
import { formatDateTime, formatLongDate } from '../../lib/format'
import { CONDITION_LABELS, STATUS_LABELS, STATUS_ORDER, UNRATED_WEAR_LABEL, WEAR_LABELS, WEAR_SHORT_LABELS, needsAttention } from '../../lib/status'
import type { MonitorStatus } from '../../lib/types'
import { WEAR_KEYS, buildHospitalReport, notFoundNote, type HospitalReport, type NamedBreakdown, type ReportOptions, type WearKey } from '../buildReport'

// Colores ARGB (Excel)
export const BRAND = 'FF0F766E'
const HEADER_TEXT = 'FFFFFFFF'
const BORDER = 'FFE2E8F0'
const STATUS_FILL: Record<MonitorStatus, string> = {
  complete: 'FFD1FAE5',
  functional_incomplete: 'FFFEF3C7',
  non_functional: 'FFFFE4E6',
}
const CONDITION_FILL = {
  working: STATUS_FILL.complete,
  faulty: STATUS_FILL.functional_incomplete,
  missing: STATUS_FILL.non_functional,
}
const WEAR_FILL: Record<WearKey, string> = {
  optimal: 'FFD1FAE5',
  light: 'FFECFCCB',
  moderate: 'FFFEF3C7',
  advanced: 'FFFFEDD5',
  unrated: 'FFF1F5F9',
}

function wearLabel(key: WearKey, short = false): string {
  if (key === 'unrated') return UNRATED_WEAR_LABEL
  return short ? WEAR_SHORT_LABELS[key] : WEAR_LABELS[key]
}

/**
 * Genera y descarga el Excel con el inventario y diagnóstico del hospital (se carga bajo demanda).
 */
export async function exportHospitalExcel(options: ReportOptions): Promise<void> {
  const report = buildHospitalReport(options)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = report.generatedBy || 'Monitores'
  workbook.created = report.generatedAt
  workbook.title = report.title

  addSummarySheet(workbook, report)
  addMonitorsSheet(workbook, report)
  addConsumablesSheet(workbook, report)
  addReplacementSheet(workbook, report)
  addWearSheet(workbook, report)
  addWearAttentionSheet(workbook, report)
  addModelsSheet(workbook, report)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, reportFileName(options.hospital.name, 'xlsx'))
}

// ------------------------------------------------------------ Utilidades de formato

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

export function styleHeader(row: ExcelJS.Row): void {
  row.height = 22
  row.eachCell((cell) => {
    cell.fill = fill(BRAND)
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

export function styleBody(sheet: ExcelJS.Worksheet, fromRow: number): void {
  for (let index = fromRow; index <= sheet.rowCount; index++) {
    sheet.getRow(index).eachCell((cell) => {
      cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } }
      cell.alignment = { vertical: 'top', wrapText: true, ...cell.alignment }
    })
  }
}

/** Hoja con tabla: encabezado con estilo, filtros y fila fija */
export function tableSheet(workbook: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[]): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns
  styleHeader(sheet.getRow(1))
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return sheet
}

function yesNo(value: boolean): string {
  return value ? 'Sí' : 'No'
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : part / total
}

// ------------------------------------------------------------ Hojas

function addSummarySheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const sheet = workbook.addWorksheet('Resumen')
  sheet.columns = [{ width: 34 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 14 }]

  sheet.mergeCells('A1:E1')
  sheet.getCell('A1').value = report.title
  sheet.getCell('A1').font = { bold: true, size: 15, color: { argb: BRAND } }
  sheet.getRow(1).height = 26
  sheet.getCell('A2').value = `Generado el ${formatLongDate(report.generatedAt)} por ${report.generatedBy || '—'}`
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } }
  if (report.notFoundCount > 0) {
    sheet.getCell('A3').value = notFoundNote(report.notFoundCount)
    sheet.getCell('A3').font = { italic: true, color: { argb: 'FF64748B' } }
  }

  // Dictámenes
  let row = 5
  const statusHeader = sheet.getRow(row)
  statusHeader.values = ['Dictamen', 'Equipos', '% del total']
  styleHeader(statusHeader)
  for (const status of STATUS_ORDER) {
    row++
    const current = sheet.getRow(row)
    current.values = [STATUS_LABELS[status], report.totals[status], percent(report.totals[status], report.totals.total)]
    current.getCell(1).fill = fill(STATUS_FILL[status])
    current.getCell(3).numFmt = '0%'
  }
  row++
  sheet.getRow(row).values = ['Total de equipos', report.totals.total, 1]
  sheet.getRow(row).font = { bold: true }
  sheet.getRow(row).getCell(3).numFmt = '0%'

  // Consumibles
  row += 2
  const consumableHeader = sheet.getRow(row)
  consumableHeader.values = ['Consumibles', 'Cantidad', '% del total']
  styleHeader(consumableHeader)
  const totals = report.consumableTotals
  const consumableRows: [string, number, keyof typeof CONDITION_FILL | null][] = [
    ['Funcionan', totals.working, 'working'],
    ['No funcionan', totals.faulty, 'faulty'],
    ['Faltantes', totals.missing, 'missing'],
    ['Total revisados', totals.total, null],
  ]
  for (const [label, value, condition] of consumableRows) {
    row++
    const current = sheet.getRow(row)
    current.values = [label, value, percent(value, totals.total)]
    current.getCell(3).numFmt = '0%'
    if (condition) current.getCell(1).fill = fill(CONDITION_FILL[condition])
    else current.font = { bold: true }
  }

  // Desgaste (solo de los consumibles que funcionan)
  row += 2
  const wearHeader = sheet.getRow(row)
  wearHeader.values = ['Desgaste (consumibles que funcionan)', 'Cantidad', '% de los que funcionan']
  styleHeader(wearHeader)
  const wear = report.wearTotals
  for (const key of WEAR_KEYS) {
    if (key === 'unrated' && wear.unrated === 0) continue
    row++
    const current = sheet.getRow(row)
    current.values = [wearLabel(key), wear[key], percent(wear[key], wear.total)]
    current.getCell(1).fill = fill(WEAR_FILL[key])
    current.getCell(3).numFmt = '0%'
  }

  // Por servicio
  row += 2
  writeBreakdown(sheet, row, 'Servicio', report.byService)
}

function writeBreakdown(sheet: ExcelJS.Worksheet, startRow: number, label: string, items: NamedBreakdown[]): void {
  const header = sheet.getRow(startRow)
  header.values = [label, 'Equipos', STATUS_LABELS.complete, STATUS_LABELS.functional_incomplete, STATUS_LABELS.non_functional]
  styleHeader(header)
  items.forEach((item, index) => {
    sheet.getRow(startRow + index + 1).values = [item.name, item.total, item.complete, item.functional_incomplete, item.non_functional]
  })
}

function addMonitorsSheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const sheet = tableSheet(workbook, 'Monitores', [
    { header: '#', key: 'index', width: 6 },
    { header: 'Servicio', key: 'service', width: 24 },
    { header: 'Ubicación', key: 'location', width: 14 },
    { header: 'Marca', key: 'brand', width: 16 },
    { header: 'Modelo', key: 'model', width: 20 },
    { header: 'Tipo', key: 'mountType', width: 12 },
    { header: 'No. de serie', key: 'serial', width: 18 },
    { header: 'No. nacional de inventario', key: 'inventory', width: 22 },
    { header: 'Equipo funciona', key: 'operational', width: 12 },
    { header: 'Dictamen', key: 'status', width: 20 },
    { header: 'Consumibles OK', key: 'working', width: 12 },
    { header: 'Faltantes', key: 'missing', width: 11 },
    { header: 'No funcionan', key: 'faulty', width: 12 },
    { header: 'Detalle de faltantes', key: 'missingDetail', width: 40 },
    { header: 'Detalle de fallas', key: 'faultyDetail', width: 40 },
    { header: 'Desgaste moderado o avanzado', key: 'wearDetail', width: 40 },
    { header: 'Observaciones', key: 'notes', width: 40 },
    { header: 'Fotos', key: 'photos', width: 8 },
    { header: 'Capturado por', key: 'capturedBy', width: 20 },
    { header: 'Última actualización', key: 'updatedAt', width: 20 },
  ])

  report.monitors.forEach((monitor, index) => {
    const items = monitor.sections.flatMap((section) => section.items)
    const describe = (condition: 'missing' | 'faulty') =>
      items
        .filter((item) => item.condition === condition)
        .map((item) => (item.notes ? `${item.name} (${item.notes})` : item.name))
        .join('; ')

    const row = sheet.addRow({
      index: index + 1,
      service: monitor.serviceName,
      location: monitor.location ?? '',
      brand: monitor.brandName,
      model: monitor.modelName,
      mountType: monitor.mountTypeLabel,
      serial: monitor.serialNumber ?? 'S/N',
      inventory: monitor.inventoryNumber ?? '',
      operational: yesNo(monitor.isOperational),
      status: STATUS_LABELS[monitor.status],
      working: monitor.workingCount,
      missing: monitor.missingCount,
      faulty: monitor.faultyCount,
      missingDetail: describe('missing'),
      faultyDetail: describe('faulty'),
      wearDetail: items
        .filter((item) => needsAttention(item.wear))
        .map((item) => `${item.name} (${wearLabel(item.wear!, true).toLowerCase()}${item.notes ? `: ${item.notes}` : ''})`)
        .join('; '),
      notes: monitor.notes ?? '',
      photos: monitor.photoCount,
      capturedBy: monitor.capturedBy ?? '',
      updatedAt: formatDateTime(monitor.updatedAt),
    })
    row.getCell('status').fill = fill(STATUS_FILL[monitor.status])
    // Los números de serie se guardan como texto para no perder ceros a la izquierda
    row.getCell('serial').numFmt = '@'
    row.getCell('inventory').numFmt = '@'
  })
  styleBody(sheet, 2)
}

function addConsumablesSheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const sheet = tableSheet(workbook, 'Consumibles', [
    { header: 'Servicio', key: 'service', width: 24 },
    { header: 'Ubicación', key: 'location', width: 14 },
    { header: 'Modelo', key: 'model', width: 26 },
    { header: 'No. de serie', key: 'serial', width: 18 },
    { header: 'No. nacional de inventario', key: 'inventory', width: 22 },
    { header: 'Grupo', key: 'group', width: 16 },
    { header: 'Consumible', key: 'consumable', width: 34 },
    { header: 'Lo tiene', key: 'present', width: 10 },
    { header: 'Funciona', key: 'working', width: 10 },
    { header: 'Estado', key: 'condition', width: 14 },
    { header: 'Desgaste', key: 'wear', width: 26 },
    { header: 'Observaciones', key: 'notes', width: 36 },
  ])

  for (const monitor of report.monitors) {
    for (const section of monitor.sections) {
      for (const item of section.items) {
        const row = sheet.addRow({
          service: monitor.serviceName,
          location: monitor.location ?? '',
          model: monitor.modelLabel,
          serial: monitor.serialNumber ?? 'S/N',
          inventory: monitor.inventoryNumber ?? '',
          group: section.groupName,
          consumable: item.name,
          present: yesNo(item.condition !== 'missing'),
          working: yesNo(item.condition === 'working'),
          condition: item.condition === 'missing' ? 'Falta' : CONDITION_LABELS[item.condition],
          // El desgaste solo aplica a los que funcionan
          wear: item.condition === 'working' ? wearLabel(item.wear ?? 'unrated') : '',
          notes: item.notes ?? '',
        })
        row.getCell('condition').fill = fill(CONDITION_FILL[item.condition])
        if (item.condition === 'working') row.getCell('wear').fill = fill(WEAR_FILL[item.wear ?? 'unrated'])
        row.getCell('serial').numFmt = '@'
        row.getCell('inventory').numFmt = '@'
      }
    }
  }
  styleBody(sheet, 2)
}

function addReplacementSheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const sheet = tableSheet(workbook, 'Reposición', [
    { header: 'Consumible', key: 'name', width: 38 },
    { header: 'Grupo', key: 'group', width: 18 },
    { header: 'Faltan', key: 'missing', width: 10 },
    { header: 'No funcionan', key: 'faulty', width: 13 },
    { header: 'Total a reponer', key: 'total', width: 15 },
    { header: 'Revisados', key: 'checked', width: 11 },
  ])

  for (const item of report.replacementNeeds) {
    sheet.addRow({
      name: item.name,
      group: item.groupName,
      missing: item.missing,
      faulty: item.faulty,
      total: item.missing + item.faulty,
      checked: item.total,
    })
  }
  if (report.replacementNeeds.length > 0) {
    const last = sheet.rowCount
    const totalRow = sheet.addRow({
      name: 'Total',
      missing: { formula: `SUM(C2:C${last})` },
      faulty: { formula: `SUM(D2:D${last})` },
      total: { formula: `SUM(E2:E${last})` },
    })
    totalRow.font = { bold: true }
  }
  styleBody(sheet, 2)
}

function addWearSheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const showUnrated = report.wearTotals.unrated > 0
  const sheet = tableSheet(workbook, 'Desgaste', [
    { header: 'Consumible', key: 'name', width: 38 },
    { header: 'Grupo', key: 'group', width: 18 },
    ...WEAR_KEYS.filter((key) => key !== 'unrated' || showUnrated).map((key) => ({ header: wearLabel(key, true), key, width: 12 })),
    { header: 'Funcionan', key: 'total', width: 11 },
  ])
  for (const item of report.wearByConsumable) {
    sheet.addRow({ ...item, group: item.groupName })
  }
  if (report.wearByConsumable.length > 0) {
    const last = sheet.rowCount
    const totals: Record<string, { formula: string }> = {}
    for (let column = 3; column <= sheet.columnCount; column++) {
      const letter = sheet.getColumn(column).letter
      totals[sheet.getColumn(column).key!] = { formula: `SUM(${letter}2:${letter}${last})` }
    }
    sheet.addRow({ name: 'Total', ...totals }).font = { bold: true }
  }
  styleBody(sheet, 2)
}

function addWearAttentionSheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const sheet = tableSheet(workbook, 'Reemplazo prioritario', [
    { header: 'Desgaste', key: 'wear', width: 26 },
    { header: 'Consumible', key: 'consumable', width: 34 },
    { header: 'Grupo', key: 'group', width: 16 },
    { header: 'Servicio', key: 'service', width: 24 },
    { header: 'Ubicación', key: 'location', width: 14 },
    { header: 'Modelo', key: 'model', width: 26 },
    { header: 'No. de serie', key: 'serial', width: 18 },
    { header: 'No. nacional de inventario', key: 'inventory', width: 22 },
    { header: 'Observaciones', key: 'notes', width: 40 },
  ])

  for (const item of report.wearAttention) {
    const row = sheet.addRow({
      wear: wearLabel(item.wear),
      consumable: item.consumable,
      group: item.groupName,
      service: item.serviceName,
      location: item.location ?? '',
      model: item.modelLabel,
      serial: item.serialNumber ?? 'S/N',
      inventory: item.inventoryNumber ?? '',
      notes: item.notes ?? '',
    })
    row.getCell('wear').fill = fill(WEAR_FILL[item.wear])
    row.getCell('serial').numFmt = '@'
    row.getCell('inventory').numFmt = '@'
  }
  styleBody(sheet, 2)
}

function addModelsSheet(workbook: ExcelJS.Workbook, report: HospitalReport): void {
  const sheet = tableSheet(workbook, 'Por modelo', [
    { header: 'Modelo', key: 'name', width: 30 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Equipos', key: 'total', width: 10 },
    { header: STATUS_LABELS.complete, key: 'complete', width: 12 },
    { header: STATUS_LABELS.functional_incomplete, key: 'incomplete', width: 20 },
    { header: STATUS_LABELS.non_functional, key: 'nonFunctional', width: 14 },
  ])

  for (const item of report.byModel) {
    sheet.addRow({
      name: item.name,
      type: item.detail ?? '',
      total: item.total,
      complete: item.complete,
      incomplete: item.functional_incomplete,
      nonFunctional: item.non_functional,
    })
  }
  styleBody(sheet, 2)
}
