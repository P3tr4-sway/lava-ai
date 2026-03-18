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
      {/* Logo */}
      <div className="flex items-center h-14 px-4 shrink-0">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2.5 flex-1 min-w-0 group',
            collapsed && 'justify-center',
          )}
        >
          <LavaLogo />
          {!collapsed && (
            <span className="text-base font-semibold tracking-wide text-text-primary group-hover:opacity-80 transition-opacity">
              LAVA
            </span>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
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
                  collapsed && 'justify-center',
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

      {/* Bottom: theme picker */}
      <div className="shrink-0 border-t border-border py-3 px-2 flex flex-col gap-2">
        {/* Theme */}
        {collapsed ? (
          <button
            onClick={() => {
              const idx = THEME_OPTIONS.findIndex((o) => o.value === theme)
              setTheme(THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length].value)
            }}
            className="w-full flex justify-center p-2 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
            title={`Theme: ${theme}`}
          >
            {theme === 'light' ? <Sun size={15} /> : theme === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}
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
    <svg width="20" height="27" viewBox="0 0 31 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path
        d="M14.5726 23.8173C18.8644 25.9846 25.2216 19.5846 22.6794 11.8396C27.6257 14.4311 30.9967 19.6109 31 25.58C31 34.1374 24.0574 41.0767 15.5 41.0767C6.93932 41.0767 0 34.1374 0 25.58C0 22.7846 0.739974 20.1634 2.02918 17.9008C2.74276 16.6505 3.86922 15.2356 5.08071 13.714C8.39752 9.5481 12.3516 4.58173 10.2149 0C22.35 6.9623 18.1413 12.9563 15.016 17.4073C14.4712 18.1832 13.9594 18.9122 13.5728 19.5912C13.3195 20.0451 13.1025 20.6469 13.1025 21.183C13.1025 22.2979 13.6912 23.2713 14.5726 23.8173Z"
        fill="var(--text-primary)"
      />
    </svg>
  )
}
