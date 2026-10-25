const dateFormatter = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const longDateFormatter = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return dateFormatter.format(new Date(value))
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return dateTimeFormatter.format(new Date(value))
}

export function formatLongDate(value: Date): string {
  return longDateFormatter.format(value)
}

export function formatPercent(part: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

/** Igual que en el servidor: mayúsculas y espacios simples para comparar números de serie e inventario */
export function normalizeCode(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
  return normalized === '' ? null : normalized
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** Texto sin acentos y en minúsculas para búsquedas por coincidencia */
export function searchable(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function slugify(value: string): string {
  return searchable(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
