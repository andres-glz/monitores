import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, NetworkError, errorMessage } from '../lib/api'
import { requestSync } from '../offline/sync'

/**
 * Ejecuta un cambio de catálogo en el servidor (requiere conexión) y luego
 * sincroniza para que el dispositivo tenga la versión nueva.
 * Devuelve los errores de validación por campo para mostrarlos en el formulario.
 */
export function useCatalogMutation() {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function run<T>(action: () => Promise<T>, successMessage: string): Promise<T | undefined> {
    setSaving(true)
    setFieldErrors({})
    try {
      const result = await action()
      await requestSync()
      toast.success(successMessage)
      return result
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setFieldErrors(Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])))
      }
      if (error instanceof NetworkError) {
        toast.error('Necesitas conexión a internet para modificar la configuración.')
      } else {
        toast.error(errorMessage(error))
      }
      return undefined
    } finally {
      setSaving(false)
    }
  }

  const clearErrors = useCallback(() => setFieldErrors({}), [])

  return { run, saving, fieldErrors, clearErrors }
}
