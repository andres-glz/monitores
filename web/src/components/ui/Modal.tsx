import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'full'
}

const SIZES = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  full: 'sm:max-w-4xl',
}

/**
 * Ventana modal: en celular aparece como hoja desde abajo, en escritorio centrada.
 */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-150 data-closed:opacity-0 dark:bg-black/60"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl transition duration-200 data-closed:translate-y-8 data-closed:opacity-0 sm:rounded-2xl dark:bg-slate-900 ${SIZES[size]}`}
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-400"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end dark:border-slate-800">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
