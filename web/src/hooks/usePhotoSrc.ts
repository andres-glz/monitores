import { useEffect, useState } from 'react'
import { photoUrl } from '../lib/api'
import { db } from '../offline/db'

/**
 * URL para mostrar una foto: si aún está solo en el dispositivo se usa el archivo local,
 * si ya se subió se pide al servidor.
 */
export function usePhotoSrc(uuid: string, local: boolean | undefined): string | null {
  const [src, setSrc] = useState<string | null>(local ? null : photoUrl(uuid))

  useEffect(() => {
    if (!local) {
      setSrc(photoUrl(uuid))
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    db.photoBlobs.get(uuid).then((photo) => {
      if (cancelled) return
      if (photo) {
        objectUrl = URL.createObjectURL(photo.blob)
        setSrc(objectUrl)
      } else {
        // Ya se subió mientras tanto
        setSrc(photoUrl(uuid))
      }
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [uuid, local])

  return src
}
