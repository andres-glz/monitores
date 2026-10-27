import type { ConsumableState, ConsumableWear, MonitorStatus, MountType } from './types'

/**
 * Regla del dictamen (la misma que api/src/Services/MonitorStatus.php):
 * - No funcional: el equipo no funciona.
 * - Completo: funciona y todos sus consumibles están presentes y funcionando.
 * - Funcional incompleto: funciona pero falta o falla algún consumible.
 */
export function evaluateStatus(isOperational: boolean, consumables: ConsumableState[]): MonitorStatus {
  if (!isOperational) return 'non_functional'
  return consumables.every((item) => item.is_present && item.is_working) ? 'complete' : 'functional_incomplete'
}

export const STATUS_ORDER: MonitorStatus[] = ['complete', 'functional_incomplete', 'non_functional']

export const STATUS_LABELS: Record<MonitorStatus, string> = {
  complete: 'Completo',
  functional_incomplete: 'Funcional incompleto',
  non_functional: 'No funcional',
}

// Clases de Tailwind por dictamen
export const STATUS_STYLES: Record<MonitorStatus, { badge: string; dot: string; soft: string; text: string }> = {
  complete: {
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  functional_incomplete: {
    badge: 'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30',
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
  },
  non_functional: {
    badge: 'bg-rose-100 text-rose-800 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30',
    dot: 'bg-rose-500',
    soft: 'bg-rose-50 dark:bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-400',
  },
}

// Colores hexadecimales para PDF y Excel
export const STATUS_HEX: Record<MonitorStatus, string> = {
  complete: '#10b981',
  functional_incomplete: '#f59e0b',
  non_functional: '#f43f5e',
}

export const MOUNT_TYPE_LABELS: Record<MountType, string> = {
  portable: 'Portátil',
  mounted: 'Empotrable',
}

export type ConsumableCondition = 'working' | 'faulty' | 'missing'

export function consumableCondition(item: Pick<ConsumableState, 'is_present' | 'is_working'>): ConsumableCondition {
  if (!item.is_present) return 'missing'
  return item.is_working ? 'working' : 'faulty'
}

export const CONDITION_LABELS: Record<ConsumableCondition, string> = {
  working: 'Funciona',
  faulty: 'No funciona',
  missing: 'Falta',
}

/**
 * Desgaste de un consumible que se tiene y funciona (la misma lista que MonitorConsumable::WEAR_LEVELS).
 * Es informativo: no cambia el dictamen del monitor.
 */
export const WEAR_LEVELS: ConsumableWear[] = ['optimal', 'light', 'moderate', 'advanced']

export const DEFAULT_WEAR: ConsumableWear = 'optimal'

export const WEAR_LABELS: Record<ConsumableWear, string> = {
  optimal: 'Óptimo (Sin desgaste)',
  light: 'Desgaste leve',
  moderate: 'Desgaste moderado (A vigilar)',
  advanced: 'Desgaste avanzado (Reemplazo prioritario)',
}

// Etiquetas cortas para tablas y gráficas de los reportes
export const WEAR_SHORT_LABELS: Record<ConsumableWear, string> = {
  optimal: 'Óptimo',
  light: 'Leve',
  moderate: 'Moderado',
  advanced: 'Avanzado',
}

export const UNRATED_WEAR_LABEL = 'Sin evaluar'

export const WEAR_DOT_STYLES: Record<ConsumableWear, string> = {
  optimal: 'bg-emerald-500',
  light: 'bg-lime-500',
  moderate: 'bg-amber-500',
  advanced: 'bg-orange-600',
}

// Colores hexadecimales para PDF y Excel
export const WEAR_HEX: Record<ConsumableWear, string> = {
  optimal: '#10b981',
  light: '#84cc16',
  moderate: '#f59e0b',
  advanced: '#ea580c',
}

export const UNRATED_WEAR_HEX = '#94a3b8'

/** Desgaste que pide observaciones y se incluye en la lista de reemplazo prioritario */
export function needsAttention(wear: ConsumableWear | null | undefined): boolean {
  return wear === 'moderate' || wear === 'advanced'
}
