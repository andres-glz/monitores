import { pdf } from '@react-pdf/renderer'
import { downloadBlob, reportFileName } from '../../lib/download'
import { buildHospitalReport, type ReportOptions } from '../buildReport'
import { HospitalReportDocument } from './HospitalReportDocument'

/**
 * Genera y descarga el PDF de diagnóstico del hospital (se carga bajo demanda).
 */
export async function exportHospitalPdf(options: ReportOptions): Promise<void> {
  const report = buildHospitalReport(options)
  const blob = await pdf(<HospitalReportDocument report={report} />).toBlob()
  downloadBlob(blob, reportFileName(options.hospital.name, 'pdf'))
}
