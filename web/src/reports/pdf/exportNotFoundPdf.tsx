import { pdf } from '@react-pdf/renderer'
import { downloadBlob, reportFileName } from '../../lib/download'
import type { ReportOptions } from '../buildReport'
import { buildNotFoundReport } from '../buildNotFoundReport'
import { NotFoundReportDocument } from './NotFoundReportDocument'

/**
 * Genera y descarga el PDF con los monitores no encontrados del hospital (se carga bajo demanda).
 */
export async function exportNotFoundPdf(options: ReportOptions): Promise<void> {
  const report = buildNotFoundReport(options)
  const blob = await pdf(<NotFoundReportDocument report={report} />).toBlob()
  downloadBlob(blob, reportFileName(options.hospital.name, 'pdf', 'monitores-no-encontrados'))
}
