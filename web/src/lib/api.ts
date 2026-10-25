// Cliente HTTP para la API PHP (/api). La sesión viaja en una cookie HttpOnly.

export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

/** No hubo respuesta del servidor (sin internet o servidor caído) */
export class NetworkError extends Error {
  constructor() {
    super('Sin conexión con el servidor')
  }
}

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/** Permite reaccionar cuando la sesión expira (respuesta 401) */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Requerido por la protección CSRF de la API
    'X-Requested-With': 'XMLHttpRequest',
  }
  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' })
  } catch {
    throw new NetworkError()
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedListeners.forEach((listener) => listener())
    }
    // Respuestas 502/503 del hosting sin JSON se tratan como falta de conexión
    if (data === null && response.status >= 500) {
      throw new NetworkError()
    }
    throw new ApiError(response.status, data?.message ?? `Error ${response.status}`, data?.errors ?? {})
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
}

/** Mensaje legible para mostrar en pantalla */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) {
    return error.message
  }
  return 'Ocurrió un error inesperado.'
}

export function photoUrl(uuid: string): string {
  return `/api/photos/${uuid}`
}
