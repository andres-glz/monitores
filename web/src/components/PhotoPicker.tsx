import { Camera, ImageOff, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { usePhotoSrc } from '../hooks/usePhotoSrc'
import { Modal } from './ui/Modal'

export interface PhotoItem {
  uuid: string
  // URL directa (fotos recién tomadas) o null para resolverla con usePhotoSrc
  url: string | null
  local?: boolean
}

interface PhotoPickerProps {
  photos: PhotoItem[]
  onAdd: (files: File[]) => void
  onRemove: (uuid: string) => void
}

/**
 * Fotos de evidencia: abre la cámara del celular y muestra miniaturas.
 */
export function PhotoPicker({ photos, onAdd, onRemove }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<PhotoItem | null>(null)

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((photo) => (
          <div key={photo.uuid} className="relative aspect-square">
            <button type="button" onClick={() => setViewing(photo)} className="block size-full overflow-hidden rounded-xl bg-slate-100">
              <PhotoImage photo={photo} className="size-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(photo.uuid)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-slate-900/80 p-1 text-white shadow"
              aria-label="Quitar foto"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-teal-500 hover:text-teal-700"
        >
          <Camera className="size-6" />
          <span className="text-xs font-medium">Agregar</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          if (files.length > 0) onAdd(files)
          event.target.value = ''
        }}
      />
      <Modal open={viewing !== null} onClose={() => setViewing(null)} title="Foto" size="full">
        {viewing && <PhotoImage photo={viewing} className="mx-auto max-h-[75dvh] rounded-lg object-contain" />}
      </Modal>
    </>
  )
}

export function PhotoImage({ photo, className }: { photo: PhotoItem; className?: string }) {
  const resolved = usePhotoSrc(photo.uuid, photo.local)
  const src = photo.url ?? resolved
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`} title="Foto no disponible sin conexión">
        <ImageOff className="size-5" />
      </div>
    )
  }
  return <img src={src} alt="Foto del monitor" loading="lazy" className={className} onError={() => setFailed(true)} />
}
