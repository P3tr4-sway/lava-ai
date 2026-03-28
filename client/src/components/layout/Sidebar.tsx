import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SIDEBAR_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { LavaLogo } from './LavaLogo'
import { cn } from '@/components/ui/utils'

export function Sidebar() {
  const { pathname } = useLocation()

  const handleNavClick = (to: string) => {
    if (to === '/' && pathname === '/') {
      window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
    }
  }

  return (
    <nav className="flex flex-col items-center w-14 border-r border-border bg-surface-0 py-4 gap-2">
      {/* Logo */}
      <Link to="/" className="mb-4">
        <LavaLogo />
      </Link>

      {/* New pack shortcut */}
      <Link
        to="/"
        className="flex items-center justify-center size-10 rounded-lg bg-accent text-surface-0 hover:opacity-90 transition-opacity mb-2"
        title="New Pack"
      >
        <Plus className="size-5" />
      </Link>

      {/* Nav items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => handleNavClick(to)}
              className={cn(
                'flex items-center justify-center size-10 rounded-lg transition-colors',
                isActive
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'
              )}
              title={label}
            >
              <Icon className="size-5" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
