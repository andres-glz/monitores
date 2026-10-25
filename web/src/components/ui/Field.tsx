import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const CONTROL =
  'block w-full rounded-lg border-0 bg-white px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600 disabled:bg-slate-50 disabled:text-slate-500'

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string | null
  hint?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, htmlFor, error, hint, required, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-rose-600">{error}</p>
      ) : (
        hint && <div className="mt-1.5 text-xs text-slate-500">{hint}</div>
      )}
    </div>
  )
}

export function TextInput({
  className = '',
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={`${CONTROL} h-11 sm:h-10 ${className}`} {...props} />
}

export function TextArea({
  className = '',
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} rows={3} className={`${CONTROL} py-2 ${className}`} {...props} />
}

export function Select({
  className = '',
  children,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className={`${CONTROL} h-11 pr-8 sm:h-10 ${className}`} {...props}>
      {children}
    </select>
  )
}
