// Recuerda las últimas selecciones de captura para agilizar el siguiente registro

interface CapturePrefs {
  serviceId?: number
  modelId?: number
}

const prefsKey = (hospitalId: number) => `monitores:capture:${hospitalId}`
const RECENT_MODELS_KEY = 'monitores:recent-models'
const MAX_RECENT = 4

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sin almacenamiento disponible simplemente no se recuerda
  }
}

export function loadCapturePrefs(hospitalId: number): CapturePrefs {
  return read<CapturePrefs>(prefsKey(hospitalId), {})
}

export function saveCapturePrefs(hospitalId: number, prefs: CapturePrefs): void {
  write(prefsKey(hospitalId), prefs)
}

export function loadRecentModels(): number[] {
  return read<number[]>(RECENT_MODELS_KEY, [])
}

export function pushRecentModel(modelId: number): void {
  write(RECENT_MODELS_KEY, [modelId, ...loadRecentModels().filter((id) => id !== modelId)].slice(0, MAX_RECENT))
}
