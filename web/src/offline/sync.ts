import { useSyncExternalStore } from 'react'
import { ApiError, NetworkError, api, errorMessage } from '../lib/api'
import type { Monitor, PhotoRef, SyncResponse } from '../lib/types'
import { META_CATALOG, META_LAST_SYNC, type OutboxItem, db, getMeta, setMeta } from './db'

/**
 * Motor de sincronización:
 * 1) envía en orden la cola de operaciones locales (outbox),
 * 2) descarga catálogos y los monitores que cambiaron desde la última sincronización.
 */

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error' | 'unauthorized'

export interface SyncState {
  phase: SyncPhase
  lastSyncAt: string | null
  message: string | null
}

let state: SyncState = { phase: 'idle', lastSyncAt: null, message: null }
const listeners = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

let enabled = false
let running: Promise<void> | null = null
let rerun = false
let fullRequested = false

/** Pide una sincronización; si ya hay una en curso se repite al terminar */
export function requestSync(options: { full?: boolean } = {}): Promise<void> {
  if (!enabled) return Promise.resolve()
  if (options.full) fullRequested = true
  if (running) {
    rerun = true
    return running
  }

  running = (async () => {
    do {
      rerun = false
      const full = fullRequested
      fullRequested = false
      await runOnce(full)
    } while (rerun)
  })().finally(() => {
    running = null
  })

  return running
}

/** Activa la sincronización automática (al iniciar sesión). Devuelve la función para detenerla. */
export function startSyncLoop(): () => void {
  enabled = true
  getMeta<string>(META_LAST_SYNC).then((lastSyncAt) => setState({ lastSyncAt: lastSyncAt ?? null }))

  const onOnline = () => requestSync()
  const onOffline = () => setState({ phase: 'offline' })
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestSync()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') requestSync()
  }, 60_000)

  requestSync()

  return () => {
    enabled = false
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(interval)
  }
}

async function runOnce(full: boolean): Promise<void> {
  if (!navigator.onLine) {
    setState({ phase: 'offline' })
    return
  }

  setState({ phase: 'syncing' })
  try {
    await pushOutbox()
    const serverTime = await pull(full)
    setState({ phase: 'idle', lastSyncAt: serverTime, message: null })
  } catch (error) {
    if (error instanceof NetworkError) {
      setState({ phase: 'offline', message: null })
    } else if (error instanceof ApiError && error.status === 401) {
      setState({ phase: 'unauthorized', message: error.message })
    } else {
      setState({ phase: 'error', message: errorMessage(error) })
    }
  }
}

// ---------------------------------------------------------------- Envío de la cola

/** Errores que no se resuelven reintentando (datos inválidos, registro inexistente...) */
function isPermanentError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status)
}

async function pushOutbox(): Promise<void> {
  const items = await db.outbox.orderBy('id').toArray()
  // Si una operación de un monitor falla, las siguientes del mismo monitor esperan para respetar el orden
  const blocked = new Set<string>()

  for (const item of items) {
    if (blocked.has(item.monitor_uuid)) continue
    if (item.error) {
      blocked.add(item.monitor_uuid)
      continue
    }

    try {
      const result = await sendItem(item)
      await completeItem(item, result)
    } catch (error) {
      if (isPermanentError(error)) {
        await db.outbox.update(item.id!, { error: error.message, attempts: item.attempts + 1 })
        await refreshPending(item.monitor_uuid)
        blocked.add(item.monitor_uuid)
        continue
      }
      await db.outbox.update(item.id!, { attempts: item.attempts + 1 })
      throw error
    }
  }
}

async function sendItem(item: OutboxItem): Promise<Monitor | undefined> {
  switch (item.type) {
    case 'upsert_monitor':
      return api.put<Monitor>(`/monitors/${item.monitor_uuid}`, item.payload)
    case 'delete_monitor':
      await api.delete(`/monitors/${item.monitor_uuid}`)
      return undefined
    case 'upload_photo': {
      const photo = await db.photoBlobs.get(item.photo_uuid!)
      if (!photo) return undefined
      const form = new FormData()
      form.append('uuid', photo.uuid)
      form.append('file', photo.blob, `${photo.uuid}.jpg`)
      await api.post(`/monitors/${item.monitor_uuid}/photos`, form)
      return undefined
    }
    case 'delete_photo':
      await api.delete(`/photos/${item.photo_uuid}`)
      return undefined
  }
}

async function completeItem(item: OutboxItem, result: Monitor | undefined): Promise<void> {
  await db.transaction('rw', [db.outbox, db.monitors, db.photoBlobs], async () => {
    const current = await db.outbox.get(item.id!)
    // Si el usuario editó mientras se enviaba, la nueva versión se queda en la cola
    if (current && current.version === item.version) {
      await db.outbox.delete(item.id!)
    }

    if (item.type === 'upload_photo' && item.photo_uuid) {
      await db.photoBlobs.delete(item.photo_uuid)
      await db.monitors
        .where('uuid')
        .equals(item.monitor_uuid)
        .modify((monitor) => {
          monitor.photos = monitor.photos.map((photo) =>
            photo.uuid === item.photo_uuid ? { uuid: photo.uuid, created_at: photo.created_at } : photo,
          )
        })
    }

    const stillPending = (await db.outbox.where('monitor_uuid').equals(item.monitor_uuid).count()) > 0
    const local = await db.monitors.get(item.monitor_uuid)
    if (!local) return

    if (result && !stillPending) {
      await db.monitors.put({ ...result, photos: mergePhotos(result.photos, local.photos), pending: false })
    } else if (local.pending !== stillPending) {
      await db.monitors.update(item.monitor_uuid, { pending: stillPending })
    }
  })
}

function mergePhotos(serverPhotos: PhotoRef[], localPhotos: PhotoRef[]): PhotoRef[] {
  const known = new Set(serverPhotos.map((photo) => photo.uuid))
  return [...serverPhotos, ...localPhotos.filter((photo) => photo.local && !known.has(photo.uuid))]
}

export async function refreshPending(monitorUuid: string): Promise<void> {
  const pending = (await db.outbox.where('monitor_uuid').equals(monitorUuid).count()) > 0
  await db.monitors.update(monitorUuid, { pending })
}

// ---------------------------------------------------------------- Descarga

async function pull(full: boolean): Promise<string> {
  const since = full ? undefined : await getMeta<string>(META_LAST_SYNC)
  const data = await api.get<SyncResponse>(`/sync${since ? `?since=${encodeURIComponent(since)}` : ''}`)

  await db.transaction('rw', [db.monitors, db.outbox, db.photoBlobs, db.meta], async () => {
    await setMeta(META_CATALOG, data.catalog)

    // Los monitores con cambios locales pendientes no se sobrescriben
    const pendingUuids = new Set((await db.outbox.toArray()).map((item) => item.monitor_uuid))

    if (data.full) {
      const serverUuids = new Set(data.monitors.map((monitor) => monitor.uuid))
      const localUuids = (await db.monitors.toCollection().primaryKeys()) as string[]
      await removeMonitors(localUuids.filter((uuid) => !serverUuids.has(uuid) && !pendingUuids.has(uuid)))
    }

    await db.monitors.bulkPut(
      data.monitors
        .filter((monitor) => !pendingUuids.has(monitor.uuid))
        .map((monitor) => ({ ...monitor, pending: false })),
    )

    await removeMonitors(data.deleted_monitor_uuids.filter((uuid) => !pendingUuids.has(uuid)))

    // Monitores de hospitales que ya no existen
    const hospitalIds = new Set(data.catalog.hospitals.map((hospital) => hospital.id))
    const orphans = await db.monitors
      .filter((monitor) => !hospitalIds.has(monitor.hospital_id) && !pendingUuids.has(monitor.uuid))
      .primaryKeys()
    await removeMonitors(orphans as string[])

    await setMeta(META_LAST_SYNC, data.server_time)
  })

  return data.server_time
}

async function removeMonitors(uuids: string[]): Promise<void> {
  if (uuids.length === 0) return
  await db.monitors.bulkDelete(uuids)
  await db.photoBlobs.where('monitor_uuid').anyOf(uuids).delete()
}

// ---------------------------------------------------------------- Gestión manual de la cola

/** Reintenta una operación que el servidor rechazó */
export async function retryOutboxItem(id: number): Promise<void> {
  await db.outbox.update(id, { error: null })
  await requestSync()
}

/** Descarta una operación rechazada (el dato local se reemplaza en la siguiente sincronización completa) */
export async function discardOutboxItem(id: number): Promise<void> {
  const item = await db.outbox.get(id)
  if (!item) return
  await db.outbox.delete(id)
  if (item.type === 'upload_photo' && item.photo_uuid) {
    await db.photoBlobs.delete(item.photo_uuid)
  }
  await refreshPending(item.monitor_uuid)
  await requestSync({ full: true })
}
