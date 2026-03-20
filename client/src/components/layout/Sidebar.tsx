import { NavLink, Link } from 'react-router-dom'
import {
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'
import { useIsMobile } from '@/hooks/useIsMobile'
import { NAV_ITEMS } from './navItems'
import { LavaLogo } from './LavaLogo'

const THEME_OPTIONS = [
  { value: 'system' as const, icon: Monitor, label: 'System' },
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
]

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <nav
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 bg-surface-0 border-r border-border flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 shrink-0">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 flex-1 min-w-0 group"
          >
            <LavaLogo />
            <span className="text-base font-semibold tracking-wide text-text-primary group-hover:opacity-80 transition-opacity">
              LAVA
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col py-2 overflow-y-auto">
          <div className="flex flex-col gap-0.5 px-2">
            {NAV_ITEMS.map(({ to, icon: Icon, label, ...rest }) => (
              <NavLink
                key={to}
                to={to}
                end={'end' in rest}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 py-2 px-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'text-text-primary bg-surface-3'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                  )
                }
              >
                <Icon size={17} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Theme picker */}
        <div className="shrink-0 border-t border-border py-3 px-2 flex flex-col gap-2">
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider px-2 mb-1.5">Theme</p>
            <div className="flex gap-1">
              {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  title={label}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors',
                    theme === value
                      ? 'bg-surface-3 text-text-primary'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
                  )}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="flex flex-col h-full w-60 bg-surface-0 border-r border-border shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center h-14 px-4 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
        >
          <LavaLogo />
          <span className="text-base font-semibold tracking-wide text-text-primary group-hover:opacity-80 transition-opacity">
            LAVA
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col py-2 overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 py-2 px-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'text-text-primary bg-surface-3'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                )
              }
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Bottom: theme picker */}
      <div className="shrink-0 border-t border-border py-3 px-2 flex flex-col gap-2">
        <div>
          <p className="text-2xs text-text-muted uppercase tracking-wider px-2 mb-1.5">Theme</p>
          <div className="flex gap-1">
            {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors',
                  theme === value
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
                )}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
