import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { Flashlight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BARCODE_FORMATS, loadBarcodeDetector } from '../lib/barcode'

interface BarcodeScannerProps {
  open: boolean
  title: string
  onClose: () => void
  onDetected: (value: string) => void
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean
}

/**
 * Lector de código de barras / QR con la cámara trasera del celular.
 */
export function BarcodeScanner({ open, title, onClose, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  // Se guarda en una ref para no reiniciar la cámara si cambia la función del padre
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let timer = 0
    let stream: MediaStream | null = null
    setError(null)
    setStarting(true)
    setTorchOn(false)

    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('La cámara solo está disponible con HTTPS. Escribe el número manualmente.')
        return
      }
      try {
        const { BarcodeDetector } = await loadBarcodeDetector()
        const detector = new BarcodeDetector({ formats: [...BARCODE_FORMATS] })
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) return

        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setStarting(false)

        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        setTorchAvailable(Boolean((track.getCapabilities?.() as TorchCapabilities | undefined)?.torch))

        const scan = async () => {
          if (cancelled) return
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video)
              const value = codes.map((code) => code.rawValue.trim()).find(Boolean)
              if (value && !cancelled) {
                navigator.vibrate?.(60)
                onDetectedRef.current(value)
                return
              }
            } catch {
              // Un cuadro ilegible no es un error; se intenta con el siguiente
            }
          }
          timer = window.setTimeout(scan, 150)
        }
        void scan()
      } catch (caught) {
        const name = caught instanceof DOMException ? caught.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Permite el acceso a la cámara en tu navegador para escanear.'
            : name === 'NotFoundError'
              ? 'No se encontró una cámara en este dispositivo.'
              : 'No se pudo iniciar el lector. Escribe el número manualmente.',
        )
      }
    }
    void start()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
      trackRef.current = null
    }
  }, [open])

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn(!torchOn)
    } catch {
      setTorchAvailable(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black">
        <DialogPanel className="flex h-full flex-col">
          <div className="safe-top flex items-center justify-between px-4 py-3 text-white">
            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
            <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar">
              <X className="size-6" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {!error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-72 max-w-[80%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            )}
            {starting && !error && <p className="absolute text-sm text-white/80">Iniciando cámara…</p>}
            {error && <p className="absolute mx-8 rounded-xl bg-white p-4 text-center text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">{error}</p>}
          </div>

          <div className="safe-bottom flex items-center justify-center gap-4 px-4 py-5">
            <p className="text-center text-sm text-white/80">Centra el código dentro del recuadro</p>
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`rounded-full p-3 ${torchOn ? 'bg-amber-400 text-slate-900' : 'bg-white/15 text-white'}`}
                aria-label="Linterna"
              >
                <Flashlight className="size-5" />
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
