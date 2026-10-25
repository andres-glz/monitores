import { readJson, writeJson } from './storage'

// Cómo se muestra la lista de monitores de un hospital; se recuerda en este dispositivo para todos los hospitales

export type MonitorViewMode = 'cards' | 'table'

const VIEW_KEY = 'monitores:monitor-view'
const COLUMNS_KEY = 'monitores:monitor-columns'

export function loadViewMode(): MonitorViewMode {
  return readJson<unknown>(VIEW_KEY, 'cards') === 'table' ? 'table' : 'cards'
}

export function saveViewMode(mode: MonitorViewMode): void {
  writeJson(VIEW_KEY, mode)
}

/** Columnas visibles de la tabla; null si nunca se han elegido */
export function loadTableColumns(): string[] | null {
  const value = readJson<unknown>(COLUMNS_KEY, null)
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : null
}

export function saveTableColumns(columnIds: string[]): void {
  writeJson(COLUMNS_KEY, columnIds)
}
