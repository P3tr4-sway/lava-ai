import { Link, useLocation } from 'react-router-dom'
import { MOBILE_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { cn } from '@/components/ui/utils'

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="flex items-center justify-around border-t border-border bg-surface-0 h-14 px-2">
      {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            onClick={() => {
              if (to === '/' && pathname === '/') {
                window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
              isActive ? 'text-text-primary' : 'text-text-muted'
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px] leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
