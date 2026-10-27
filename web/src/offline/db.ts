import { Dexie, type EntityTable } from 'dexie'
import { DEFAULT_WEAR } from '../lib/status'
import type { Catalog, ConsumableState, LocalMonitor, MonitorInput } from '../lib/types'

export type OutboxType = 'upsert_monitor' | 'delete_monitor' | 'upload_photo' | 'delete_photo'

/** Operación pendiente de enviar al servidor (cola de sincronización) */
export interface OutboxItem {
  id?: number
  type: OutboxType
  monitor_uuid: string
  photo_uuid?: string
  payload?: MonitorInput
  // Aumenta cada vez que se reemplaza el payload, para no borrar una edición hecha durante el envío
  version: number
  created_at: string
  attempts: number
  // Mensaje del servidor si rechazó la operación (requiere corrección del usuario)
  error: string | null
}

/** Foto tomada en el dispositivo que aún no se sube */
export interface PhotoBlob {
  uuid: string
  monitor_uuid: string
  blob: Blob
  created_at: string
}

interface MetaRecord {
  key: string
  value: unknown
}

class AppDatabase extends Dexie {
  monitors!: EntityTable<LocalMonitor, 'uuid'>
  outbox!: EntityTable<OutboxItem, 'id'>
  photoBlobs!: EntityTable<PhotoBlob, 'uuid'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor() {
    super('monitores')
    this.version(1).stores({
      monitors: 'uuid, hospital_id, serial_number, inventory_number',
      outbox: '++id, monitor_uuid',
      photoBlobs: 'uuid, monitor_uuid',
      meta: 'key',
    })
    // v2: desgaste de consumibles. Los ya capturados (incluidos los pendientes de enviar) quedan como óptimos
    this.version(2).upgrade(async (tx) => {
      await tx
        .table<LocalMonitor>('monitors')
        .toCollection()
        .modify((monitor) => {
          monitor.consumables = withDefaultWear(monitor.consumables)
        })
      await tx
        .table<OutboxItem>('outbox')
        .toCollection()
        .modify((item) => {
          if (item.payload) item.payload.consumables = withDefaultWear(item.payload.consumables)
        })
    })
  }
}

/**
 * Completa el desgaste en datos guardados antes de que existiera (misma regla que la migración del servidor):
 * los que se tienen y funcionan quedan como óptimos.
 */
function withDefaultWear(items: ConsumableState[]): ConsumableState[] {
  return items.map((item) => ({ ...item, wear: item.wear !== undefined ? item.wear : item.is_present && item.is_working ? DEFAULT_WEAR : null }))
}

export const db = new AppDatabase()

export const META_CATALOG = 'catalog'
export const META_LAST_SYNC = 'last_sync'

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export async function getCatalog(): Promise<Catalog | null> {
  return (await getMeta<Catalog>(META_CATALOG)) ?? null
}

/** Borra todos los datos locales (al cerrar sesión) */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [db.monitors, db.outbox, db.photoBlobs, db.meta], async () => {
    await Promise.all([db.monitors.clear(), db.outbox.clear(), db.photoBlobs.clear(), db.meta.clear()])
  })
}

/** Pide al navegador no borrar IndexedDB cuando falta espacio (importante para capturas sin conexión) */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    // Algunos navegadores no lo soportan; no es crítico
  }
}
