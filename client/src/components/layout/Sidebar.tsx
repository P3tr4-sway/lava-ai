import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SIDEBAR_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { LavaLogo } from './LavaLogo'
import { cn } from '@/components/ui/utils'
import { NewPackDialog } from '@/components/projects/NewPackDialog'

export function Sidebar() {
  const { pathname } = useLocation()
  const [newPackOpen, setNewPackOpen] = useState(false)

  const handleNavClick = (to: string) => {
    if (to === '/' && pathname === '/') {
      window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
    }
  }

  return (
    <>
      <nav
        className="fixed left-4 top-1/2 z-40 flex w-16 -translate-y-1/2 flex-col items-center overflow-hidden rounded-[28px] border border-border/70 bg-surface-0/92 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur"
      >
      <div className="mb-4 flex items-center justify-center px-0">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-surface-1">
            <LavaLogo />
          </div>
        </Link>
      </div>

      <div className="mb-3 flex justify-center px-0">
        <button
          onClick={() => setNewPackOpen(true)}
          title="New Pack"
          className="flex size-11 items-center justify-center gap-2 rounded-2xl bg-accent text-surface-0 transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <Plus className="size-5 shrink-0" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1.5 px-0">
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => handleNavClick(to)}
              title={label}
              className={cn(
                'flex size-11 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/10',
                isActive
                  ? 'bg-surface-2 text-text-primary shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'
              )}
            >
              <Icon className="size-5 shrink-0" />
            </Link>
          )
        })}
      </div>
      </nav>

      <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} />
    </>
  )
}
