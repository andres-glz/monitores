import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

type BarcodeModule = typeof import('barcode-detector/ponyfill')

let loading: Promise<BarcodeModule> | null = null

/**
 * Carga el lector de códigos (ZXing en WebAssembly) desde la propia app,
 * no desde un CDN, para que funcione sin conexión.
 */
export function loadBarcodeDetector(): Promise<BarcodeModule> {
  loading ??= import('barcode-detector/ponyfill').then(async (module) => {
    await module.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
      },
      fireImmediately: true,
    })
    return module
  })
  loading.catch(() => {
    loading = null
  })
  return loading
}

// Formatos comunes en etiquetas de equipo médico e inventarios
export const BARCODE_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'itf',
  'upc_a',
  'upc_e',
  'qr_code',
  'data_matrix',
  'pdf417',
] as const
