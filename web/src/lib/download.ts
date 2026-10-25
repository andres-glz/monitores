import { slugify } from './format'

/** Descarga un archivo generado en el navegador */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Se libera después para dar tiempo a que inicie la descarga
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function reportFileName(hospitalName: string, extension: 'pdf' | 'xlsx'): string {
  const date = new Date().toISOString().slice(0, 10)
  return `diagnostico-monitores-${slugify(hospitalName)}-${date}.${extension}`
}
