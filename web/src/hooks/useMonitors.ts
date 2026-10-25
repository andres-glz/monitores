import { useLiveQuery } from 'dexie-react-hooks'
import type { LocalMonitor } from '../lib/types'
import { db } from '../offline/db'

/** Monitores de un hospital (se actualizan solos al guardar o sincronizar) */
export function useHospitalMonitors(hospitalId: number): LocalMonitor[] | undefined {
  return useLiveQuery(() => db.monitors.where('hospital_id').equals(hospitalId).toArray(), [hospitalId])
}

export function useAllMonitors(): LocalMonitor[] | undefined {
  return useLiveQuery(() => db.monitors.toArray(), [])
}

export function useMonitor(uuid: string | undefined): LocalMonitor | null | undefined {
  return useLiveQuery(async () => (uuid ? ((await db.monitors.get(uuid)) ?? null) : null), [uuid])
}
