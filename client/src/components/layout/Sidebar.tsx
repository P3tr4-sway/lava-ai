import { NavLink } from 'react-router-dom'
import { BookOpen, Music, Layers, Wrench, FolderOpen } from 'lucide-react'
import { cn } from '@/components/ui/utils'

const NAV_ITEMS = [
  { to: '/learn', icon: BookOpen, label: 'Learn' },
  { to: '/jam', icon: Music, label: 'Jam' },
  { to: '/create', icon: Layers, label: 'Create' },
  { to: '/tools', icon: Wrench, label: 'Tools' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
]

export function Sidebar() {
  return (
    <nav className="flex flex-col items-center w-14 h-full bg-surface-0 border-r border-border py-4 gap-1 shrink-0">
      <div className="mb-4 w-8 h-8 flex items-center justify-center">
        <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
          <rect width="32" height="32" rx="6" fill="#fff" />
          <path
            d="M8 16 L14 8 L20 20 L24 14"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="14" r="2" fill="#000" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1 w-full px-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 px-1 rounded text-xs transition-colors w-full',
                isActive
                  ? 'text-text-primary bg-surface-3'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2',
              )
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
