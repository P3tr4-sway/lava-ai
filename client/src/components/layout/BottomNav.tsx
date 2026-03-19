import { NavLink } from 'react-router-dom'
import { cn } from '@/components/ui/utils'
import { NAV_ITEMS } from './navItems'

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface-0 border-t border-border pb-safe">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
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
        ))}
      </div>
    </nav>
  )
}
