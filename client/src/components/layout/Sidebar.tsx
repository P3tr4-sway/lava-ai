import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, PanelLeft, PanelLeftOpen } from 'lucide-react'
import { SIDEBAR_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { LavaLogo } from './LavaLogo'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/components/ui/utils'
import { projectService } from '@/services/projectService'

export function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const handleNavClick = (to: string) => {
    if (to === '/' && pathname === '/') {
      window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
    }
  }

  const handleNewPack = async () => {
    try {
      const project = await projectService.create({ name: 'Untitled Pack', space: 'learn', metadata: {} })
      navigate(`/pack/${project.id}`)
    } catch {
      navigate('/pack/new')
    }
  }

  return (
    <nav
      className={cn(
        'flex flex-col shrink-0 border-r border-border bg-surface-0 py-4 transition-[width] duration-200 overflow-hidden',
        collapsed ? 'w-14 items-center' : 'w-52 items-stretch'
      )}
    >
      {/* ── Top: logo + collapse button ── */}
      <div className={cn('flex items-center mb-4', collapsed ? 'justify-center px-0' : 'justify-between px-3')}>
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <LavaLogo />
          {!collapsed && (
            <span className="text-sm font-semibold text-text-primary truncate">Lava</span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center size-7 rounded text-text-muted hover:text-text-primary hover:bg-surface-1 transition-colors flex-shrink-0"
            title="Collapse sidebar"
          >
            <PanelLeft className="size-4" />
          </button>
        )}
      </div>

      {/* ── New pack button ── */}
      <div className={cn('mb-2', collapsed ? 'px-0 flex justify-center' : 'px-3')}>
        <button
          onClick={handleNewPack}
          title={collapsed ? 'New Pack' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-accent text-surface-0 hover:opacity-90 transition-opacity',
            collapsed ? 'justify-center size-10' : 'px-3 h-10 w-full'
          )}
        >
          <Plus className="size-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">New Pack</span>}
        </button>
      </div>

      {/* ── Nav items ── */}
      <div className={cn('flex flex-col gap-1 flex-1', collapsed ? 'items-center px-0' : 'px-3')}>
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => handleNavClick(to)}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg transition-colors',
                collapsed ? 'justify-center size-10' : 'px-3 h-10 w-full',
                isActive
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'
              )}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span className="text-sm">{label}</span>}
            </Link>
          )
        })}
      </div>

      {/* ── Expand button (visible only when collapsed) ── */}
      {collapsed && (
        <div className="flex justify-center mt-2">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center size-10 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-1 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}
