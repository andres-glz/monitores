import { Document, Page, Text, View } from '@react-pdf/renderer'
import { formatDate, formatLongDate, formatPercent } from '../../lib/format'
import { NOT_FOUND_HEX } from '../../lib/status'
import { NOT_FOUND_REPORT_TITLE, type CountLine, type NotFoundReport } from '../buildNotFoundReport'
// Comparte paleta, estilos y fuentes con el reporte de diagnóstico
import { C, Dot, Empty, SectionTitle, ValueBar, s } from './HospitalReportDocument'

/**
 * PDF breve con los monitores registrados que no se encontraron: indicadores, conteo por marca y modelo, y el listado.
 */
export function NotFoundReportDocument({ report }: { report: NotFoundReport }) {
  const kpis = [
    { label: 'Del total registrado', value: formatPercent(report.total, report.registered), caption: `de ${report.registered} monitores registrados` },
    { label: 'Marcas', value: String(report.byBrand.length), caption: 'distintas' },
    { label: 'Modelos', value: String(report.byModel.length), caption: 'distintos' },
  ]

  return (
    <Document title={report.title} author={report.generatedBy} subject={NOT_FOUND_REPORT_TITLE} creator="Monitores" language="es-MX">
      <Page size="A4" style={s.page}>
        <View style={s.runningHeader} fixed>
          <Text>{report.hospital.name}</Text>
          <Text>{formatLongDate(report.generatedAt)}</Text>
        </View>

        <View style={{ ...s.row, justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={s.eyebrow}>Inventario · Equipo biomédico</Text>
        </View>

        <View style={{ borderLeftWidth: 3, borderLeftColor: NOT_FOUND_HEX, paddingLeft: 12, marginBottom: 6 }}>
          <Text style={s.h1}>{NOT_FOUND_REPORT_TITLE}.</Text>
          <Text style={{ ...s.h1, color: C.brand }}>{report.hospital.name}</Text>
        </View>
        <Text style={{ ...s.caption, marginLeft: 15, marginBottom: 2 }}>Elaborado por {report.generatedBy || '—'}</Text>
        <Text style={{ ...s.caption, marginLeft: 15, marginBottom: 18 }}>
          Monitores con registro que no se localizaron físicamente en el hospital. No forman parte del reporte de diagnóstico.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ ...s.card, flex: 1, backgroundColor: C.ink, borderColor: C.ink }}>
            <Text style={{ fontSize: 7, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.6 }}>No encontrados</Text>
            <Text style={{ ...s.kpi, color: '#ffffff' }}>{report.total}</Text>
            <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>monitores</Text>
          </View>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={{ ...s.card, flex: 1, borderTopWidth: 3, borderTopColor: NOT_FOUND_HEX }}>
              <Text style={{ fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{kpi.label}</Text>
              <Text style={{ ...s.kpi, color: C.ink }}>{kpi.value}</Text>
              <Text style={{ fontSize: 7.5, color: C.muted }}>{kpi.caption}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          <View style={{ ...s.card, flex: 1 }}>
            <Text style={{ ...s.h3, marginBottom: 8 }}>Por marca</Text>
            <CountList items={report.byBrand} total={report.total} />
          </View>
          <View style={{ ...s.card, flex: 1.4 }}>
            <Text style={{ ...s.h3, marginBottom: 8 }}>Por modelo</Text>
            <CountList items={report.byModel} total={report.total} />
          </View>
        </View>

        <SectionTitle title="Listado" subtitle="Ordenado por marca, modelo y número de serie." />
        <MonitorList report={report} />

        <View style={s.footer} fixed>
          <Text>
            {NOT_FOUND_REPORT_TITLE} · {report.hospital.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function CountList({ items, total }: { items: CountLine[]; total: number }) {
  if (items.length === 0) return <Empty>Sin registros.</Empty>
  const max = Math.max(...items.map((item) => item.count))

  return (
    <View style={{ gap: 6 }}>
      {items.map((item) => (
        <View key={item.name} style={{ ...s.row, gap: 6 }} wrap={false}>
          <Dot color={NOT_FOUND_HEX} size={5} />
          <Text style={{ width: '45%', fontSize: 8.5, color: C.ink }}>
            {item.name}
            {item.detail ? <Text style={{ color: C.muted }}> · {item.detail}</Text> : null}
          </Text>
          <ValueBar value={item.count} max={max} color={NOT_FOUND_HEX} />
          <Text style={{ width: 20, fontSize: 8.5, fontWeight: 600, color: C.ink, ...s.num }}>{item.count}</Text>
          <Text style={{ width: 26, fontSize: 8, color: C.muted, ...s.num }}>{formatPercent(item.count, total)}</Text>
        </View>
      ))}
    </View>
  )
}

function MonitorList({ report }: { report: NotFoundReport }) {
  if (report.monitors.length === 0) return <Empty>Sin monitores no encontrados.</Empty>

  return (
    <View>
      <View style={s.tableHeader} fixed>
        <Text style={{ width: 18 }}>#</Text>
        <Text style={{ width: 62 }}>Marca</Text>
        <Text style={{ width: 80 }}>Modelo</Text>
        <Text style={{ width: 74 }}>No. de serie</Text>
        <Text style={{ width: 74 }}>NNI</Text>
        <Text style={{ width: 74 }}>Servicio</Text>
        <Text style={{ flex: 1 }}>Observaciones</Text>
        <Text style={{ width: 46, ...s.num }}>Registro</Text>
      </View>
      {report.monitors.map((monitor, index) => (
        <View key={monitor.uuid} style={{ ...s.tableRow, alignItems: 'flex-start' }} wrap={false}>
          <Text style={{ width: 18, color: C.faint }}>{index + 1}</Text>
          <Text style={{ width: 62 }}>{monitor.brandName || '—'}</Text>
          <Text style={{ width: 80, fontWeight: 500, color: C.ink }}>{monitor.modelName}</Text>
          <Text style={{ width: 74, fontWeight: 600, color: C.ink }}>{monitor.serialNumber ?? 'S/N'}</Text>
          <Text style={{ width: 74 }}>{monitor.inventoryNumber ?? '—'}</Text>
          <Text style={{ width: 74 }}>
            {monitor.serviceName}
            {monitor.location ? <Text style={{ color: C.muted }}> · {monitor.location}</Text> : null}
          </Text>
          <Text style={{ flex: 1, color: C.muted }}>{monitor.notes ?? '—'}</Text>
          <Text style={{ width: 46, color: C.muted, ...s.num }}>{formatDate(monitor.registeredAt)}</Text>
        </View>
      ))}
    </View>
  )
}
