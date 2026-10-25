interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  size?: 'md' | 'lg'
  tone?: 'teal' | 'emerald'
  showLabel?: boolean
}

/**
 * Interruptor accesible y con área táctil amplia (toda la etiqueta es clicable).
 */
export function Switch({ checked, onChange, label, disabled = false, size = 'md', tone = 'teal', showLabel = true }: SwitchProps) {
  const track = size === 'lg' ? 'h-8 w-14' : 'h-6 w-11'
  const thumb = size === 'lg' ? 'size-7' : 'size-5'
  const shift = size === 'lg' ? 'translate-x-6' : 'translate-x-5'
  const onColor = tone === 'emerald' ? 'bg-emerald-600' : 'bg-teal-600'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-10 items-center gap-2 rounded-lg py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 ${track} ${checked ? onColor : 'bg-slate-300'}`}
      >
        <span
          className={`inline-block rounded-full bg-white shadow ring-0 transition-transform duration-150 ${thumb} ${checked ? shift : 'translate-x-0'}`}
        />
      </span>
      {showLabel && <span className="text-sm font-medium text-slate-700 select-none">{label}</span>}
    </button>
  )
}
