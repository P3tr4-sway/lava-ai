import { NavLink, Link } from 'react-router-dom'
import {
  BookOpen,
  Music,
  Layers,
  Wrench,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from '@/hooks/useTheme'

const NAV_ITEMS = [
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/jam', icon: Music, label: 'Jam' },
  { to: '/create', icon: Layers, label: 'Create' },
  { to: '/tools', icon: Wrench, label: 'Tools' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
]

const THEME_OPTIONS = [
  { value: 'system' as const, icon: Monitor, label: 'System' },
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
]

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const { theme, setTheme } = useTheme()

  return (
    <nav
      className={cn(
        'flex flex-col h-full bg-surface-0 border-r border-border shrink-0 transition-all duration-200 overflow-hidden',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* Logo + collapse */}
      <div className="flex items-center h-12 px-3 shrink-0 border-b border-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 flex-1 min-w-0 group">
            <LavaLogo />
            <span className="text-sm font-semibold tracking-wide text-text-primary group-hover:opacity-80 transition-opacity">
              LAVA
            </span>
          </Link>
        )}
        {collapsed && (
          <Link to="/" className="flex items-center justify-center flex-1">
            <LavaLogo />
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col py-2 overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 py-2 px-2 rounded-md text-sm transition-colors',
                  collapsed ? 'justify-center' : '',
                  isActive
                    ? 'text-text-primary bg-surface-3'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
                )
              }
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="shrink-0 border-t border-border py-3 px-2">
        {collapsed ? (
          /* Cycle through themes when collapsed */
          <button
            onClick={() => {
              const idx = THEME_OPTIONS.findIndex((o) => o.value === theme)
              setTheme(THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length].value)
            }}
            className="w-full flex justify-center p-2 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
            title={`Theme: ${theme}`}
          >
            {theme === 'light' ? (
              <Sun size={16} />
            ) : theme === 'dark' ? (
              <Moon size={16} />
            ) : (
              <Monitor size={16} />
            )}
          </button>
        ) : (
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
                  <span className="hidden xl:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

function LavaLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6 shrink-0">
      <rect width="32" height="32" rx="6" fill="var(--text-primary)" />
      <path
        d="M8 16 L14 8 L20 20 L24 14"
        stroke="var(--surface-0)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="14" r="2" fill="var(--surface-0)" />
    </svg>
  )
}
