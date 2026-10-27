import ExcelJS from 'exceljs'
import { downloadBlob, reportFileName } from '../../lib/download'
import { formatDate, formatLongDate } from '../../lib/format'
import type { ReportOptions } from '../buildReport'
import { buildNotFoundReport, type CountLine, type NotFoundReport } from '../buildNotFoundReport'
import { BRAND, percent, styleBody, styleHeader, tableSheet } from './exportHospitalExcel'

/**
 * Genera y descarga el Excel con los monitores no encontrados del hospital: resumen y listado (se carga bajo demanda).
 */
export async function exportNotFoundExcel(options: ReportOptions): Promise<void> {
  const report = buildNotFoundReport(options)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = report.generatedBy || 'Monitores'
  workbook.created = report.generatedAt
  workbook.title = report.title

  addSummarySheet(workbook, report)
  addListSheet(workbook, report)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, reportFileName(options.hospital.name, 'xlsx', 'monitores-no-encontrados'))
}

function addSummarySheet(workbook: ExcelJS.Workbook, report: NotFoundReport): void {
  const sheet = workbook.addWorksheet('Resumen')
  sheet.columns = [{ width: 36 }, { width: 14 }, { width: 14 }]

  sheet.mergeCells('A1:C1')
  sheet.getCell('A1').value = report.title
  sheet.getCell('A1').font = { bold: true, size: 15, color: { argb: BRAND } }
  sheet.getRow(1).height = 26
  sheet.getCell('A2').value = `Generado el ${formatLongDate(report.generatedAt)} por ${report.generatedBy || '—'}`
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } }

  let row = 4
  sheet.getRow(row).values = ['Indicador', 'Monitores', '% del registro']
  styleHeader(sheet.getRow(row))
  const totals: [string, number][] = [
    ['No encontrados', report.total],
    ['Registrados en el hospital', report.registered],
  ]
  for (const [label, value] of totals) {
    row++
    sheet.getRow(row).values = [label, value, percent(value, report.registered)]
    sheet.getRow(row).getCell(3).numFmt = '0%'
  }

  row = writeCounts(sheet, row + 2, 'Marca', report.byBrand, report.total)
  writeCounts(sheet, row + 2, 'Modelo', report.byModel, report.total)
}

/** Tabla de conteo con su porcentaje; devuelve la última fila escrita */
function writeCounts(sheet: ExcelJS.Worksheet, startRow: number, label: string, items: CountLine[], total: number): number {
  const header = sheet.getRow(startRow)
  header.values = [label, 'No encontrados', '% de los no encontrados']
  styleHeader(header)
  items.forEach((item, index) => {
    const current = sheet.getRow(startRow + index + 1)
    current.values = [item.detail ? `${item.name} (${item.detail})` : item.name, item.count, percent(item.count, total)]
    current.getCell(3).numFmt = '0%'
  })
  return startRow + items.length
}

function addListSheet(workbook: ExcelJS.Workbook, report: NotFoundReport): void {
  const sheet = tableSheet(workbook, 'No encontrados', [
    { header: '#', key: 'index', width: 6 },
    { header: 'Marca', key: 'brand', width: 16 },
    { header: 'Modelo', key: 'model', width: 20 },
    { header: 'Tipo', key: 'mountType', width: 12 },
    { header: 'No. de serie', key: 'serial', width: 18 },
    { header: 'No. nacional de inventario', key: 'inventory', width: 22 },
    { header: 'Servicio', key: 'service', width: 24 },
    { header: 'Ubicación', key: 'location', width: 14 },
    { header: 'Observaciones', key: 'notes', width: 40 },
    { header: 'Fecha de registro', key: 'registeredAt', width: 16 },
  ])

  report.monitors.forEach((monitor, index) => {
    const row = sheet.addRow({
      index: index + 1,
      brand: monitor.brandName,
      model: monitor.modelName,
      mountType: monitor.mountTypeLabel,
      serial: monitor.serialNumber ?? 'S/N',
      inventory: monitor.inventoryNumber ?? '',
      service: monitor.serviceName,
      location: monitor.location ?? '',
      notes: monitor.notes ?? '',
      registeredAt: formatDate(monitor.registeredAt),
    })
    // Los números de serie se guardan como texto para no perder ceros a la izquierda
    row.getCell('serial').numFmt = '@'
    row.getCell('inventory').numFmt = '@'
  })
  styleBody(sheet, 2)
}
