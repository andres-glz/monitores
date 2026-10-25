import type { ConsumableState, MonitorStatus, MountType } from './types'

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
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  functional_incomplete: {
    badge: 'bg-amber-100 text-amber-800 ring-amber-600/20',
    dot: 'bg-amber-500',
    soft: 'bg-amber-50',
    text: 'text-amber-700',
  },
  non_functional: {
    badge: 'bg-rose-100 text-rose-800 ring-rose-600/20',
    dot: 'bg-rose-500',
    soft: 'bg-rose-50',
    text: 'text-rose-700',
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
