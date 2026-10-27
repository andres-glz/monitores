import { Circle, Document, Font, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import inter500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url'
import { formatDateTime, formatLongDate, formatPercent } from '../../lib/format'
import {
  CONDITION_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  UNRATED_WEAR_HEX,
  UNRATED_WEAR_LABEL,
  WEAR_HEX,
  WEAR_LABELS,
  WEAR_SHORT_LABELS,
  type ConsumableCondition,
} from '../../lib/status'
import type { MonitorStatus } from '../../lib/types'
import {
  REPORT_TITLE,
  WEAR_KEYS,
  type ConditionTally,
  type HospitalReport,
  type NamedBreakdown,
  type ReportMonitor,
  type WearCounts,
  type WearKey,
} from '../buildReport'

// Fuentes incluidas en la app para generar el PDF sin conexión
Font.register({
  family: 'Inter',
  fonts: [
    { src: inter400, fontWeight: 400 },
    { src: inter500, fontWeight: 500 },
    { src: inter600, fontWeight: 600 },
    { src: inter700, fontWeight: 700 },
  ],
})
// Sin división de palabras con guion (las reglas por defecto son para inglés)
Font.registerHyphenationCallback((word) => [word])

// ------------------------------------------------------------ Paleta

const C = {
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  soft: '#f8fafc',
  brand: '#0f766e',
  brandSoft: '#f0fdfa',
}

const TONES: Record<MonitorStatus, { main: string; soft: string; text: string }> = {
  complete: { main: '#10b981', soft: '#ecfdf5', text: '#047857' },
  functional_incomplete: { main: '#f59e0b', soft: '#fffbeb', text: '#b45309' },
  non_functional: { main: '#f43f5e', soft: '#fff1f2', text: '#be123c' },
}

const CONDITION_TONES: Record<ConsumableCondition, { main: string; soft: string; text: string }> = {
  working: TONES.complete,
  faulty: TONES.functional_incomplete,
  missing: TONES.non_functional,
}

const WEAR_TONES: Record<WearKey, { main: string; text: string }> = {
  optimal: { main: WEAR_HEX.optimal, text: '#047857' },
  light: { main: WEAR_HEX.light, text: '#4d7c0f' },
  moderate: { main: WEAR_HEX.moderate, text: '#b45309' },
  advanced: { main: WEAR_HEX.advanced, text: '#c2410c' },
  unrated: { main: UNRATED_WEAR_HEX, text: '#64748b' },
}

function wearLabel(key: WearKey, short = false): string {
  if (key === 'unrated') return UNRATED_WEAR_LABEL
  return short ? WEAR_SHORT_LABELS[key] : WEAR_LABELS[key]
}

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: C.text, paddingTop: 40, paddingBottom: 54, paddingHorizontal: 36, lineHeight: 1.35 },
  // Se posiciona con top (alto de A4 = 841.89 pt): en páginas que se dividen, bottom no se calcula por hoja
  footer: {
    position: 'absolute',
    top: 804,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 6,
    fontSize: 7,
    color: C.faint,
  },
  runningHeader: {
    position: 'absolute',
    top: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: C.faint,
  },
  eyebrow: { fontSize: 7.5, fontWeight: 600, color: C.brand, letterSpacing: 1.2, textTransform: 'uppercase' },
  // El interlineado se define en cada texto grande: el heredado de la página se calcula con 9 pt
  h1: { fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.2 },
  h2: { fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2, lineHeight: 1.3 },
  h3: { fontSize: 10, fontWeight: 600, color: C.ink, lineHeight: 1.3 },
  kpi: { fontSize: 26, fontWeight: 700, marginTop: 4, marginBottom: 2, lineHeight: 1.1 },
  caption: { fontSize: 8, color: C.muted },
  card: { borderWidth: 0.75, borderColor: C.line, borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.soft,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 7,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.line },
  num: { textAlign: 'right' },
})

// ------------------------------------------------------------ Piezas reutilizables

function Footer({ report }: { report: HospitalReport }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {REPORT_TITLE} · {report.hospital.name}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function RunningHeader({ report }: { report: HospitalReport }) {
  return (
    <View style={s.runningHeader} fixed>
      <Text>{report.hospital.name}</Text>
      <Text>{formatLongDate(report.generatedAt)}</Text>
    </View>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 8 }} minPresenceAhead={60}>
      <Text style={s.h2}>{title}</Text>
      {subtitle && <Text style={s.caption}>{subtitle}</Text>}
    </View>
  )
}

function Dot({ color, size = 6 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
}

/** Barra horizontal apilada */
function StackedBar({ segments, height = 6 }: { segments: { value: number; color: string }[]; height?: number }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: height / 2, backgroundColor: C.line, overflow: 'hidden' }}>
      {total > 0 &&
        segments
          .filter((segment) => segment.value > 0)
          .map((segment, index) => <View key={index} style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }} />)}
    </View>
  )
}

/** Barra simple proporcional a un máximo */
function ValueBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <View style={{ height: 5, borderRadius: 2.5, backgroundColor: C.line, flexGrow: 1 }}>
      <View style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: 5, borderRadius: 2.5, backgroundColor: color }} />
    </View>
  )
}

function statusSegments(item: { complete: number; functional_incomplete: number; non_functional: number }) {
  return STATUS_ORDER.map((status) => ({ value: item[status], color: TONES[status].main }))
}

function conditionSegments(item: { working: number; faulty: number; missing: number }) {
  return (['working', 'faulty', 'missing'] as ConsumableCondition[]).map((condition) => ({
    value: item[condition],
    color: CONDITION_TONES[condition].main,
  }))
}

function wearSegments(item: WearCounts) {
  return WEAR_KEYS.map((key) => ({ value: item[key], color: WEAR_TONES[key].main }))
}

/** Niveles de desgaste a mostrar ("Sin evaluar" solo si hay datos sin desgaste) */
function visibleWearKeys(totals: WearCounts): WearKey[] {
  return WEAR_KEYS.filter((key) => key !== 'unrated' || totals.unrated > 0)
}

/** Gráfica de dona con los dictámenes */
function Donut({ report, size = 104 }: { report: HospitalReport; size?: number }) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const center = size / 2
  const total = report.totals.total
  let angle = -Math.PI / 2

  const arcs = STATUS_ORDER.filter((status) => report.totals[status] > 0).map((status) => {
    const value = report.totals[status]
    if (value === total) {
      return <Circle key={status} cx={center} cy={center} r={radius} stroke={TONES[status].main} strokeWidth={stroke} fill="none" />
    }
    const start = angle
    const end = angle + (value / total) * Math.PI * 2
    angle = end
    const x1 = center + radius * Math.cos(start)
    const y1 = center + radius * Math.sin(start)
    const x2 = center + radius * Math.cos(end)
    const y2 = center + radius * Math.sin(end)
    const large = end - start > Math.PI ? 1 : 0
    return (
      <Path
        key={status}
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`}
        stroke={TONES[status].main}
        strokeWidth={stroke}
        fill="none"
      />
    )
  })

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} stroke={C.line} strokeWidth={stroke} fill="none" />
        {arcs}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1 }}>{total}</Text>
        <Text style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>equipos</Text>
      </View>
    </View>
  )
}

function StatusPill({ status }: { status: MonitorStatus }) {
  const tone = TONES[status]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tone.soft, borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 7, gap: 4 }}>
      <Dot color={tone.main} size={5} />
      <Text style={{ fontSize: 7.5, fontWeight: 600, color: tone.text }}>{STATUS_LABELS[status]}</Text>
    </View>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <Text style={{ ...s.caption, paddingVertical: 6 }}>{children}</Text>
}

// ------------------------------------------------------------ Página 1: resumen

function SummaryPage({ report }: { report: HospitalReport }) {
  const { totals, consumableTotals } = report

  return (
    <Page size="A4" style={s.page}>
      <View style={{ ...s.row, justifyContent: 'space-between', marginBottom: 18 }}>
        <Text style={s.eyebrow}>Reporte de diagnóstico · Equipo biomédico</Text>
        <Text style={s.caption}>{formatLongDate(report.generatedAt)}</Text>
      </View>

      <View style={{ borderLeftWidth: 3, borderLeftColor: C.brand, paddingLeft: 12, marginBottom: 6 }}>
        <Text style={s.h1}>{REPORT_TITLE}.</Text>
        <Text style={{ ...s.h1, color: C.brand }}>{report.hospital.name}</Text>
      </View>
      {report.hospital.description && <Text style={{ ...s.caption, marginLeft: 15, marginBottom: 4 }}>{report.hospital.description}</Text>}
      <Text style={{ ...s.caption, marginLeft: 15, marginBottom: 20 }}>
        Elaborado por {report.generatedBy || '—'} · {totals.total} equipos evaluados
      </Text>

      {/* Indicadores principales */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ ...s.card, flex: 1, backgroundColor: C.ink, borderColor: C.ink }}>
          <Text style={{ fontSize: 7, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.6 }}>Total de equipos</Text>
          <Text style={{ ...s.kpi, color: '#ffffff' }}>{totals.total}</Text>
          <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>monitores de signos vitales</Text>
        </View>
        {STATUS_ORDER.map((status) => (
          <View key={status} style={{ ...s.card, flex: 1, borderTopWidth: 3, borderTopColor: TONES[status].main }}>
            <Text style={{ fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{STATUS_LABELS[status]}</Text>
            <Text style={{ ...s.kpi, color: C.ink }}>{totals[status]}</Text>
            <Text style={{ fontSize: 7.5, fontWeight: 600, color: TONES[status].text }}>{formatPercent(totals[status], totals.total)} del total</Text>
          </View>
        ))}
      </View>

      {/* Distribución y consumibles */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        <View style={{ ...s.card, flex: 1 }}>
          <Text style={{ ...s.h3, marginBottom: 10 }}>Distribución de dictámenes</Text>
          <View style={{ ...s.row, gap: 14 }}>
            <Donut report={report} />
            <View style={{ flex: 1, gap: 8 }}>
              {STATUS_ORDER.map((status) => (
                <View key={status} style={{ ...s.row, gap: 6 }}>
                  <Dot color={TONES[status].main} size={7} />
                  <Text style={{ flex: 1, fontSize: 8.5 }}>{STATUS_LABELS[status]}</Text>
                  <Text style={{ fontSize: 8.5, fontWeight: 600, color: C.ink }}>{totals[status]}</Text>
                  <Text style={{ width: 28, fontSize: 8, color: C.muted, ...s.num }}>{formatPercent(totals[status], totals.total)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ ...s.card, flex: 1 }}>
          <Text style={{ ...s.h3, marginBottom: 2 }}>Estado de consumibles</Text>
          <Text style={{ ...s.caption, marginBottom: 10 }}>{consumableTotals.total} consumibles revisados</Text>
          <StackedBar segments={conditionSegments(consumableTotals)} height={8} />
          <View style={{ marginTop: 10, gap: 6 }}>
            {(['working', 'faulty', 'missing'] as ConsumableCondition[]).map((condition) => (
              <View key={condition} style={{ ...s.row, gap: 6 }}>
                <Dot color={CONDITION_TONES[condition].main} size={7} />
                <Text style={{ flex: 1, fontSize: 8.5 }}>{condition === 'missing' ? 'Faltantes' : CONDITION_LABELS[condition]}</Text>
                <Text style={{ fontSize: 8.5, fontWeight: 600, color: C.ink }}>{consumableTotals[condition]}</Text>
                <Text style={{ width: 28, fontSize: 8, color: C.muted, ...s.num }}>
                  {formatPercent(consumableTotals[condition], consumableTotals.total)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ ...s.caption, marginTop: 8 }}>
            {report.monitorsWithIssues} de {totals.total} equipos tienen al menos un consumible faltante o que no funciona.
          </Text>

          {report.wearTotals.total > 0 && (
            <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, marginTop: 8, paddingTop: 8 }}>
              <Text style={{ fontSize: 8, fontWeight: 600, color: C.ink, marginBottom: 5 }}>Desgaste de los {report.wearTotals.total} que funcionan</Text>
              <StackedBar segments={wearSegments(report.wearTotals)} height={6} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 3, marginTop: 6 }}>
                {visibleWearKeys(report.wearTotals).map((key) => (
                  <View key={key} style={{ ...s.row, gap: 4 }}>
                    <Dot color={WEAR_TONES[key].main} size={6} />
                    <Text style={{ fontSize: 7.5 }}>
                      {wearLabel(key, true)} <Text style={{ fontWeight: 600, color: C.ink }}>{report.wearTotals[key]}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Dictamen por servicio */}
      <SectionTitle title="Dictamen por servicio" />
      <BreakdownTable items={report.byService} firstColumn="Servicio" />

      {/* Criterios */}
      <View style={{ marginTop: 16, backgroundColor: C.soft, borderRadius: 8, padding: 10 }} wrap={false}>
        <Text style={{ fontSize: 7.5, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Criterios de dictamen</Text>
        <Text style={{ fontSize: 7.5, color: C.muted }}>
          <Text style={{ fontWeight: 600, color: TONES.complete.text }}>Completo: </Text>
          el equipo funciona y cuenta con todos sus consumibles en buen estado.{'  '}
          <Text style={{ fontWeight: 600, color: TONES.functional_incomplete.text }}>Funcional incompleto: </Text>
          el equipo funciona, pero le falta o falla al menos un consumible.{'  '}
          <Text style={{ fontWeight: 600, color: TONES.non_functional.text }}>No funcional: </Text>
          el equipo no enciende u opera de forma incorrecta.{'  '}
          <Text style={{ fontWeight: 600, color: C.ink }}>Desgaste: </Text>
          se registra en los consumibles que funcionan y no cambia el dictamen.
        </Text>
      </View>

      <Footer report={report} />
    </Page>
  )
}

function BreakdownTable({ items, firstColumn, showDetail = false }: { items: NamedBreakdown[]; firstColumn: string; showDetail?: boolean }) {
  if (items.length === 0) return <Empty>Sin registros.</Empty>
  const total = items.reduce(
    (sum, item) => ({
      total: sum.total + item.total,
      complete: sum.complete + item.complete,
      functional_incomplete: sum.functional_incomplete + item.functional_incomplete,
      non_functional: sum.non_functional + item.non_functional,
    }),
    { total: 0, complete: 0, functional_incomplete: 0, non_functional: 0 },
  )

  return (
    <View>
      <View style={s.tableHeader} fixed>
        <Text style={{ flex: 1 }}>{firstColumn}</Text>
        {showDetail && <Text style={{ width: 60 }}>Tipo</Text>}
        <Text style={{ width: 42, ...s.num }}>Equipos</Text>
        <Text style={{ width: 50, ...s.num }}>Completo</Text>
        <Text style={{ width: 56, ...s.num }}>Incompleto</Text>
        <Text style={{ width: 52, ...s.num }}>No func.</Text>
        <Text style={{ width: 86, paddingLeft: 12 }}>Distribución</Text>
      </View>
      {items.map((item) => (
        <View key={item.name} style={s.tableRow} wrap={false}>
          <Text style={{ flex: 1, fontWeight: 500, color: C.ink }}>{item.name}</Text>
          {showDetail && <Text style={{ width: 60, color: C.muted }}>{item.detail}</Text>}
          <Text style={{ width: 42, ...s.num, fontWeight: 600, color: C.ink }}>{item.total}</Text>
          <Text style={{ width: 50, ...s.num }}>{item.complete}</Text>
          <Text style={{ width: 56, ...s.num }}>{item.functional_incomplete}</Text>
          <Text style={{ width: 52, ...s.num }}>{item.non_functional}</Text>
          <View style={{ width: 86, paddingLeft: 12 }}>
            <StackedBar segments={statusSegments(item)} />
          </View>
        </View>
      ))}
      <View style={{ ...s.tableRow, borderBottomWidth: 0 }} wrap={false}>
        <Text style={{ flex: 1, fontWeight: 700, color: C.ink }}>Total</Text>
        {showDetail && <Text style={{ width: 60 }} />}
        <Text style={{ width: 42, ...s.num, fontWeight: 700, color: C.ink }}>{total.total}</Text>
        <Text style={{ width: 50, ...s.num, fontWeight: 600 }}>{total.complete}</Text>
        <Text style={{ width: 56, ...s.num, fontWeight: 600 }}>{total.functional_incomplete}</Text>
        <Text style={{ width: 52, ...s.num, fontWeight: 600 }}>{total.non_functional}</Text>
        <View style={{ width: 86, paddingLeft: 12 }}>
          <StackedBar segments={statusSegments(total)} />
        </View>
      </View>
    </View>
  )
}

// ------------------------------------------------------------ Detalle por equipo

function DetailPages({ report }: { report: HospitalReport }) {
  const services: { name: string; monitors: ReportMonitor[] }[] = []
  for (const monitor of report.monitors) {
    const last = services[services.length - 1]
    if (last?.name === monitor.serviceName) last.monitors.push(monitor)
    else services.push({ name: monitor.serviceName, monitors: [monitor] })
  }
  let index = 0

  return (
    <Page size="A4" style={s.page}>
      <RunningHeader report={report} />
      <SectionTitle
        title="Detalle por equipo"
        subtitle="Consumibles revisados en cada monitor, agrupados por servicio. Los que no tienen anotación funcionan y no presentan desgaste."
      />

      {services.map((service) => (
        <View key={service.name}>
          <View
            style={{ ...s.row, justifyContent: 'space-between', backgroundColor: C.brandSoft, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, marginTop: 6, marginBottom: 6 }}
            minPresenceAhead={120}
          >
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.brand }}>{service.name}</Text>
            <Text style={{ fontSize: 7.5, color: C.brand }}>{service.monitors.length} equipos</Text>
          </View>
          {service.monitors.map((monitor) => {
            index++
            return <MonitorCard key={monitor.uuid} monitor={monitor} index={index} total={report.monitors.length} />
          })}
        </View>
      ))}

      <Footer report={report} />
    </Page>
  )
}

function MonitorCard({ monitor, index, total }: { monitor: ReportMonitor; index: number; total: number }) {
  const meta: [string, string][] = [
    ['Serie', monitor.serialNumber ?? 'S/N'],
    ['NNI', monitor.inventoryNumber ?? '—'],
    ['Ubicación', monitor.location ?? '—'],
    ['Equipo', monitor.isOperational ? 'Funciona' : 'No funciona'],
  ]

  return (
    <View style={{ ...s.card, padding: 10, marginBottom: 7 }} wrap={false}>
      <View style={{ ...s.row, justifyContent: 'space-between', marginBottom: 4 }}>
        <View style={{ ...s.row, gap: 6, flex: 1 }}>
          <Text style={{ fontSize: 7, color: C.faint }}>
            {index}/{total}
          </Text>
          <Text style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>{monitor.modelLabel}</Text>
          {monitor.mountTypeLabel && (
            <Text style={{ fontSize: 7, color: C.muted, backgroundColor: C.soft, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 4 }}>
              {monitor.mountTypeLabel}
            </Text>
          )}
        </View>
        <StatusPill status={monitor.status} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginBottom: 6 }}>
        {meta.map(([label, value]) => (
          <Text key={label} style={{ fontSize: 8 }}>
            <Text style={{ color: C.muted }}>{label}: </Text>
            <Text
              style={{
                fontWeight: 600,
                color: label === 'Equipo' && !monitor.isOperational ? TONES.non_functional.text : C.ink,
              }}
            >
              {value}
            </Text>
          </Text>
        ))}
      </View>

      {monitor.sections.length > 0 && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5, gap: 3 }}>
          {monitor.sections.map((section) => (
            <View key={section.groupName} style={{ flexDirection: 'row' }}>
              <Text style={{ width: 62, fontSize: 7.5, fontWeight: 600, color: C.muted, paddingTop: 0.5 }}>
                {section.groupName}
              </Text>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 }}>
                {section.items.map((item) => {
                  const tone = CONDITION_TONES[item.condition]
                  // En los que funcionan se anota el desgaste salvo que sea óptimo
                  const wearKey: WearKey | null = item.condition === 'working' && item.wear !== 'optimal' ? (item.wear ?? 'unrated') : null
                  return (
                    <View key={item.name} style={{ width: '50%', flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingRight: 6 }}>
                      <View style={{ paddingTop: 2.5 }}>
                        <Dot color={tone.main} size={5} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 7.5 }}>
                        <Text style={{ color: C.ink }}>{item.name}</Text>
                        {item.condition !== 'working' && (
                          <Text style={{ color: tone.text, fontWeight: 600 }}> · {CONDITION_LABELS[item.condition]}</Text>
                        )}
                        {wearKey && <Text style={{ color: WEAR_TONES[wearKey].text, fontWeight: 600 }}> · {wearLabel(wearKey)}</Text>}
                        {item.notes && <Text style={{ color: C.muted }}> ({item.notes})</Text>}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {monitor.notes && (
        <Text style={{ fontSize: 7.5, color: C.text, marginTop: 5 }}>
          <Text style={{ fontWeight: 600 }}>Observaciones: </Text>
          {monitor.notes}
        </Text>
      )}
    </View>
  )
}

// ------------------------------------------------------------ Estadísticas finales

function TallyList({ items, field, color, emptyText }: { items: ConditionTally[]; field: 'missing' | 'faulty'; color: string; emptyText: string }) {
  if (items.length === 0) return <Empty>{emptyText}</Empty>
  const max = Math.max(...items.map((item) => item[field]))
  return (
    <View style={{ gap: 5 }}>
      {items.map((item) => (
        <View key={`${item.groupName}-${item.name}`} style={{ ...s.row, gap: 8 }} wrap={false}>
          <View style={{ width: 190 }}>
            <Text style={{ fontSize: 8.5, color: C.ink }}>{item.name}</Text>
            <Text style={{ fontSize: 7, color: C.faint }}>{item.groupName}</Text>
          </View>
          <ValueBar value={item[field]} max={max} color={color} />
          <Text style={{ width: 24, fontSize: 9, fontWeight: 700, color: C.ink, ...s.num }}>{item[field]}</Text>
        </View>
      ))}
    </View>
  )
}

function StatsPage({ report }: { report: HospitalReport }) {
  const replacementTotals = report.replacementNeeds.reduce(
    (sum, item) => ({ missing: sum.missing + item.missing, faulty: sum.faulty + item.faulty }),
    { missing: 0, faulty: 0 },
  )

  return (
    <Page size="A4" style={s.page}>
      <RunningHeader report={report} />
      <Text style={{ ...s.eyebrow, marginBottom: 4 }}>Estadísticas</Text>
      <Text style={{ ...s.h1, fontSize: 18, marginBottom: 16 }}>Consumibles y equipos</Text>

      <View style={{ marginBottom: 18 }}>
        <SectionTitle title="Estado de consumibles por grupo" subtitle="Funcionando, con falla y faltantes en cada parámetro." />
        <View style={{ gap: 7 }}>
          {report.byGroup.map((group) => (
            <View key={group.name} style={{ ...s.row, gap: 8 }} wrap={false}>
              <Text style={{ width: 110, fontSize: 8.5, fontWeight: 500, color: C.ink }}>{group.name}</Text>
              <View style={{ flex: 1 }}>
                <StackedBar segments={conditionSegments(group)} height={7} />
              </View>
              <Text style={{ width: 150, fontSize: 7.5, color: C.muted, ...s.num }}>
                <Text style={{ color: TONES.complete.text }}>{group.working} funcionan</Text> ·{' '}
                <Text style={{ color: TONES.functional_incomplete.text }}>{group.faulty} fallan</Text> ·{' '}
                <Text style={{ color: TONES.non_functional.text }}>{group.missing} faltan</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginBottom: 18 }}>
        <SectionTitle title="Consumibles faltantes por tipo" />
        <TallyList items={report.missingByConsumable} field="missing" color={TONES.non_functional.main} emptyText="No se registraron consumibles faltantes." />
      </View>

      <View style={{ marginBottom: 18 }}>
        <SectionTitle title="Consumibles que no funcionan por tipo" />
        <TallyList items={report.faultyByConsumable} field="faulty" color={TONES.functional_incomplete.main} emptyText="No se registraron consumibles con falla." />
      </View>

      <View style={{ marginBottom: 18 }}>
        <SectionTitle title="Necesidades de reposición" subtitle="Consumibles faltantes más los que no funcionan: cantidad estimada a adquirir." />
        {report.replacementNeeds.length === 0 ? (
          <Empty>No se requiere reposición de consumibles.</Empty>
        ) : (
          <View>
            <View style={s.tableHeader} fixed>
              <Text style={{ flex: 1 }}>Consumible</Text>
              <Text style={{ width: 100 }}>Grupo</Text>
              <Text style={{ width: 50, ...s.num }}>Faltan</Text>
              <Text style={{ width: 66, ...s.num }}>No funcionan</Text>
              <Text style={{ width: 54, ...s.num }}>A reponer</Text>
            </View>
            {report.replacementNeeds.map((item) => (
              <View key={`${item.groupName}-${item.name}`} style={s.tableRow} wrap={false}>
                <Text style={{ flex: 1, color: C.ink }}>{item.name}</Text>
                <Text style={{ width: 100, color: C.muted }}>{item.groupName}</Text>
                <Text style={{ width: 50, ...s.num }}>{item.missing}</Text>
                <Text style={{ width: 66, ...s.num }}>{item.faulty}</Text>
                <Text style={{ width: 54, ...s.num, fontWeight: 700, color: C.ink }}>{item.missing + item.faulty}</Text>
              </View>
            ))}
            <View style={{ ...s.tableRow, borderBottomWidth: 0 }} wrap={false}>
              <Text style={{ flex: 1, fontWeight: 700, color: C.ink }}>Total</Text>
              <Text style={{ width: 100 }} />
              <Text style={{ width: 50, ...s.num, fontWeight: 600 }}>{replacementTotals.missing}</Text>
              <Text style={{ width: 66, ...s.num, fontWeight: 600 }}>{replacementTotals.faulty}</Text>
              <Text style={{ width: 54, ...s.num, fontWeight: 700, color: C.brand }}>{replacementTotals.missing + replacementTotals.faulty}</Text>
            </View>
          </View>
        )}
      </View>

      {report.wearTotals.total > 0 && (
        <View style={{ marginBottom: 18 }}>
          <SectionTitle title="Desgaste de consumibles por tipo" subtitle="Nivel de desgaste de los consumibles que funcionan." />
          <View style={{ ...s.row, flexWrap: 'wrap', columnGap: 12, rowGap: 3, marginBottom: 8 }}>
            {visibleWearKeys(report.wearTotals).map((key) => (
              <View key={key} style={{ ...s.row, gap: 4 }}>
                <Dot color={WEAR_TONES[key].main} size={6} />
                <Text style={{ fontSize: 7.5 }}>{wearLabel(key)}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 6 }}>
            {report.wearByConsumable.map((item) => (
              <View key={`${item.groupName}-${item.name}`} style={{ ...s.row, gap: 8 }} wrap={false}>
                <View style={{ width: 150 }}>
                  <Text style={{ fontSize: 8.5, color: C.ink }}>{item.name}</Text>
                  <Text style={{ fontSize: 7, color: C.faint }}>{item.groupName}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <StackedBar segments={wearSegments(item)} height={7} />
                </View>
                <Text style={{ width: 170, fontSize: 7.5, color: C.muted, ...s.num }}>
                  {visibleWearKeys(report.wearTotals)
                    .filter((key) => item[key] > 0)
                    .map((key, index) => (
                      <Text key={key}>
                        {index > 0 && ' · '}
                        <Text style={{ color: WEAR_TONES[key].text }}>
                          {item[key]} {wearLabel(key, true).toLowerCase()}
                        </Text>
                      </Text>
                    ))}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginBottom: 18 }}>
        <SectionTitle
          title="Reemplazo prioritario y consumibles a vigilar"
          subtitle="Consumibles que funcionan con desgaste avanzado (reemplazo prioritario) o moderado (a vigilar)."
        />
        {report.wearAttention.length === 0 ? (
          <Empty>No se registraron consumibles con desgaste moderado o avanzado.</Empty>
        ) : (
          <View>
            <View style={s.tableHeader} fixed>
              <Text style={{ width: 62 }}>Desgaste</Text>
              <Text style={{ width: 110 }}>Consumible</Text>
              <Text style={{ width: 90 }}>Servicio</Text>
              <Text style={{ width: 50 }}>Ubicación</Text>
              <Text style={{ width: 66 }}>Serie</Text>
              <Text style={{ flex: 1 }}>Observaciones</Text>
            </View>
            {report.wearAttention.map((item) => (
              <View key={`${item.monitorUuid}-${item.consumable}`} style={s.tableRow} wrap={false}>
                <View style={{ width: 62, ...s.row, gap: 4 }}>
                  <Dot color={WEAR_TONES[item.wear].main} size={5} />
                  <Text style={{ fontSize: 8, fontWeight: 600, color: WEAR_TONES[item.wear].text }}>{wearLabel(item.wear, true)}</Text>
                </View>
                <View style={{ width: 110, paddingRight: 4 }}>
                  <Text style={{ color: C.ink }}>{item.consumable}</Text>
                  <Text style={{ fontSize: 7, color: C.faint }}>{item.modelLabel}</Text>
                </View>
                <Text style={{ width: 90, paddingRight: 4 }}>{item.serviceName}</Text>
                <Text style={{ width: 50 }}>{item.location ?? '—'}</Text>
                <Text style={{ width: 66 }}>{item.serialNumber ?? 'S/N'}</Text>
                <Text style={{ flex: 1, color: C.muted }}>{item.notes ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {report.topNotes.length > 0 && (
        <View style={{ marginBottom: 18 }} wrap={false}>
          <SectionTitle title="Fallas y observaciones más frecuentes" subtitle="En consumibles faltantes o que no funcionan." />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {report.topNotes.map((item) => (
              <View key={item.note} style={{ ...s.row, gap: 5, backgroundColor: C.soft, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 8, color: C.ink }}>{item.note}</Text>
                <Text style={{ fontSize: 8, fontWeight: 700, color: C.brand }}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginBottom: 18 }}>
        <SectionTitle title="Equipos por modelo" />
        <BreakdownTable items={report.byModel} firstColumn="Modelo" showDetail />
      </View>

      {report.byMountType.length > 1 && (
        <View style={{ marginBottom: 18 }} wrap={false}>
          <SectionTitle title="Equipos por tipo" />
          <BreakdownTable items={report.byMountType} firstColumn="Tipo" />
        </View>
      )}

      <View>
        <SectionTitle title="Equipos no funcionales" subtitle="Requieren revisión técnica o reemplazo." />
        {report.nonFunctionalMonitors.length === 0 ? (
          <Empty>Todos los equipos registrados funcionan.</Empty>
        ) : (
          <View>
            <View style={s.tableHeader} fixed>
              <Text style={{ width: 96 }}>Servicio</Text>
              <Text style={{ width: 100 }}>Modelo</Text>
              <Text style={{ width: 70 }}>Serie</Text>
              <Text style={{ width: 70 }}>NNI</Text>
              <Text style={{ flex: 1 }}>Observaciones</Text>
            </View>
            {report.nonFunctionalMonitors.map((monitor) => (
              <View key={monitor.uuid} style={s.tableRow} wrap={false}>
                <Text style={{ width: 96 }}>{monitor.serviceName}</Text>
                <Text style={{ width: 100, color: C.ink }}>{monitor.modelLabel}</Text>
                <Text style={{ width: 70 }}>{monitor.serialNumber ?? 'S/N'}</Text>
                <Text style={{ width: 70 }}>{monitor.inventoryNumber ?? '—'}</Text>
                <Text style={{ flex: 1, color: C.muted }}>{monitor.notes ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={{ ...s.caption, marginTop: 24, textAlign: 'center' }}>
        Documento generado el {formatDateTime(report.generatedAt)} a partir de {report.totals.total} registros.
      </Text>

      <Footer report={report} />
    </Page>
  )
}

// ------------------------------------------------------------ Documento

export function HospitalReportDocument({ report }: { report: HospitalReport }) {
  return (
    <Document title={report.title} author={report.generatedBy} subject={REPORT_TITLE} creator="Monitores" language="es-MX">
      <SummaryPage report={report} />
      {report.monitors.length > 0 && <DetailPages report={report} />}
      <StatsPage report={report} />
    </Document>
  )
}
