import { HeartPulse, House, LogOut, Search, Settings, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { useLogout } from '../../hooks/useLogout'
import { CatalogGate } from './CatalogGate'
import { SessionBanner } from './SessionBanner'
import { SyncIndicator } from './SyncIndicator'
import { ThemeToggle } from './ThemeToggle'

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Hospitales', icon: House, end: true },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/settings', label: 'Configuración', icon: Settings },
]

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-xl bg-teal-700 p-1.5 text-white shadow-sm">
        <HeartPulse className="size-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Monitores</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Inventario y diagnóstico</div>
      </div>
    </div>
  )
}

/**
 * Estructura principal: barra lateral en escritorio y navegación inferior en celular.
 */
export function AppLayout() {
  const { user } = useAuth()
  const logout = useLogout()

  return (
    <div className="min-h-dvh">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:dark:border-slate-800 lg:dark:bg-slate-900">
        <div className="flex h-16 items-center justify-between gap-2 pr-3 pl-5">
          <Logo />
          <ThemeToggle />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/10 dark:text-teal-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
                }`
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-800">
          <SyncIndicator />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user?.name}</div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-400"
              title="Cerrar sesión"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex h-14 items-center justify-between gap-3 pr-2 pl-4">
            <Logo />
            <div className="flex items-center gap-1">
              <SyncIndicator compact />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <SessionBanner />

        <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 lg:px-8 lg:py-8">
          <CatalogGate>
            <Outlet />
          </CatalogGate>
        </main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <div className="grid grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/**
 * Estructura sin navegación para la pantalla de captura (más espacio y menos distracciones).
 */
export function FocusLayout() {
  return (
    <div className="min-h-dvh">
      <SessionBanner />
      <CatalogGate>
        <Outlet />
      </CatalogGate>
    </div>
  )
}
