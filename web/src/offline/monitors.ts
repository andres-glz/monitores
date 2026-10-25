import { evaluateStatus } from '../lib/status'
import type { LocalMonitor, MonitorInput, PhotoRef } from '../lib/types'
import { db } from './db'
import { requestSync } from './sync'

/**
 * Operaciones locales sobre monitores: se guardan al instante en el dispositivo
 * y se agregan a la cola para enviarse al servidor cuando haya conexión.
 */

export interface PhotoChanges {
  added: { uuid: string; blob: Blob }[]
  removed: string[]
}

export function newUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Respaldo para navegadores sin randomUUID (contextos no seguros)
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function saveMonitor(
  uuid: string,
  input: MonitorInput,
  userName: string,
  photoChanges: PhotoChanges = { added: [], removed: [] },
): Promise<LocalMonitor> {
  const now = new Date().toISOString()

  const record = await db.transaction('rw', [db.monitors, db.outbox, db.photoBlobs], async () => {
    const existing = await db.monitors.get(uuid)

    // Fotos quitadas: si nunca se subieron basta con borrarlas del dispositivo
    for (const photoUuid of photoChanges.removed) {
      const localBlob = await db.photoBlobs.get(photoUuid)
      if (localBlob) {
        await db.photoBlobs.delete(photoUuid)
        await db.outbox
          .where('monitor_uuid')
          .equals(uuid)
          .filter((item) => item.type === 'upload_photo' && item.photo_uuid === photoUuid)
          .delete()
      }
    }

    const photos: PhotoRef[] = [
      ...(existing?.photos ?? []).filter((photo) => !photoChanges.removed.includes(photo.uuid)),
      ...photoChanges.added.map((photo) => ({ uuid: photo.uuid, created_at: now, local: true })),
    ]

    const monitor: LocalMonitor = {
      uuid,
      ...input,
      status: evaluateStatus(input.is_operational, input.consumables),
      photos,
      created_by_name: existing?.created_by_name ?? userName,
      updated_by_name: userName,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      pending: true,
    }
    await db.monitors.put(monitor)

    // Si ya hay un alta/edición en cola para este monitor, se reemplaza su contenido
    const queued = await db.outbox
      .where('monitor_uuid')
      .equals(uuid)
      .filter((item) => item.type === 'upsert_monitor')
      .first()
    if (queued) {
      await db.outbox.update(queued.id!, { payload: input, version: queued.version + 1, error: null })
    } else {
      await db.outbox.add({
        type: 'upsert_monitor',
        monitor_uuid: uuid,
        payload: input,
        version: 1,
        created_at: now,
        attempts: 0,
        error: null,
      })
    }

    for (const photoUuid of photoChanges.removed) {
      const wasUploaded = existing?.photos.some((photo) => photo.uuid === photoUuid && !photo.local)
      if (wasUploaded) {
        await db.outbox.add({
          type: 'delete_photo',
          monitor_uuid: uuid,
          photo_uuid: photoUuid,
          version: 1,
          created_at: now,
          attempts: 0,
          error: null,
        })
      }
    }

    for (const photo of photoChanges.added) {
      await db.photoBlobs.put({ uuid: photo.uuid, monitor_uuid: uuid, blob: photo.blob, created_at: now })
      await db.outbox.add({
        type: 'upload_photo',
        monitor_uuid: uuid,
        photo_uuid: photo.uuid,
        version: 1,
        created_at: now,
        attempts: 0,
        error: null,
      })
    }

    return monitor
  })

  void requestSync()
  return record
}

export async function deleteMonitor(uuid: string): Promise<void> {
  await db.transaction('rw', [db.monitors, db.outbox, db.photoBlobs], async () => {
    await db.outbox.where('monitor_uuid').equals(uuid).delete()
    await db.photoBlobs.where('monitor_uuid').equals(uuid).delete()
    await db.monitors.delete(uuid)
    // Se envía siempre: el servidor responde bien aunque el monitor nunca haya llegado
    await db.outbox.add({
      type: 'delete_monitor',
      monitor_uuid: uuid,
      version: 1,
      created_at: new Date().toISOString(),
      attempts: 0,
      error: null,
    })
  })

  void requestSync()
}
