import { NavLink, useLocation } from 'react-router-dom'
import { User, LogIn } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/stores/authStore'
import { HOME_NAV_RESET_EVENT, NAV_ITEMS } from './navItems'

export function BottomNav() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const lastTab = isAuthenticated
    ? { to: '/settings', icon: User, label: 'Profile' }
    : { to: '/login', icon: LogIn, label: 'Sign In' }

  const bottomNavItems = [...NAV_ITEMS, lastTab]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface-0 border-t border-border pb-safe">
      <div className="flex items-center justify-around h-14">
        {bottomNavItems.map(({ to, icon: Icon, label, ...rest }) => {
          const end = 'end' in rest
          const isOnRoute = end
            ? location.pathname === to
            : location.pathname === to || location.pathname.startsWith(to + '/')

          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={(e) => {
                if (isOnRoute) {
                  e.preventDefault()
                  if (to === '/') window.dispatchEvent(new Event(HOME_NAV_RESET_EVENT))
                  if (to === '/search') window.dispatchEvent(new Event('focus-search-input'))
                }
              }}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-center transition-colors',
                  isActive
                    ? 'text-text-primary'
                    : 'text-text-muted',
                )
              }
            >
              <Icon size={18} />
              <span className="text-2xs">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
