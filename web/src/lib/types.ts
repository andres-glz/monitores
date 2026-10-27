// Tipos compartidos; los nombres de campos coinciden con la API (snake_case)

export type MountType = 'portable' | 'mounted'
export type MonitorStatus = 'complete' | 'functional_incomplete' | 'non_functional'

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  last_login_at: string | null
  created_at: string | null
}

export interface Hospital {
  id: number
  name: string
  description: string | null
}

export interface Service {
  id: number
  name: string
  description: string | null
}

export interface Brand {
  id: number
  name: string
}

export interface ConsumableGroup {
  id: number
  name: string
  description: string | null
  sort_order: number
}

export interface Consumable {
  id: number
  consumable_group_id: number | null
  name: string
  description: string | null
  sort_order: number
}

export interface MonitorModel {
  id: number
  brand_id: number
  name: string
  description: string | null
  mount_type: MountType
  consumable_ids: number[]
}

export interface Catalog {
  hospitals: Hospital[]
  services: Service[]
  brands: Brand[]
  consumable_groups: ConsumableGroup[]
  consumables: Consumable[]
  monitor_models: MonitorModel[]
}

export type ConsumableWear = 'optimal' | 'light' | 'moderate' | 'advanced'

export interface ConsumableState {
  consumable_id: number
  is_present: boolean
  is_working: boolean
  // Solo aplica si lo tiene y funciona; null = sin evaluar (capturas de versiones anteriores)
  wear: ConsumableWear | null
  notes: string | null
}

export interface PhotoRef {
  uuid: string
  created_at: string | null
  // true mientras la foto solo existe en el dispositivo
  local?: boolean
}

/** Datos que captura el usuario (cuerpo del PUT /api/monitors/{uuid}) */
export interface MonitorInput {
  hospital_id: number
  service_id: number
  monitor_model_id: number
  serial_number: string | null
  inventory_number: string | null
  location: string | null
  is_operational: boolean
  notes: string | null
  consumables: ConsumableState[]
}

export interface Monitor extends MonitorInput {
  uuid: string
  status: MonitorStatus
  photos: PhotoRef[]
  created_by_name: string | null
  updated_by_name: string | null
  created_at: string | null
  updated_at: string | null
}

/** Monitor guardado en el dispositivo */
export interface LocalMonitor extends Monitor {
  // true si tiene cambios que aún no llegan al servidor
  pending: boolean
}

export interface SyncResponse {
  server_time: string
  full: boolean
  catalog: Catalog
  monitors: Monitor[]
  deleted_monitor_uuids: string[]
}
