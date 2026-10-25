import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  backTo?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {backTo && (
          <Link
            to={backTo}
            className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Regresar"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
