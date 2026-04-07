import { useEffect, useRef, useState } from 'react'
import { Bell, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/stores/authStore'
import { useTaskStore } from '@/stores/taskStore'
import { NotificationPanel } from './NotificationPanel'

interface TopRightUtilityBarProps {
  compact?: boolean
  embedded?: boolean
  className?: string
  hideAuxiliary?: boolean
}

function formatPlanLabel(plan: 'free' | 'pro' | 'studio' | undefined) {
  if (!plan || plan === 'free') return 'Upgrade'
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

export function TopRightUtilityBar({
  compact = false,
  embedded = false,
  className,
  hideAuxiliary = false,
}: TopRightUtilityBarProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const tasks = useTaskStore((s) => s.tasks)
  const planLabel = formatPlanLabel(user?.plan)
  const credits = 80
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notificationsOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [notificationsOpen])

  return (
    <div ref={containerRef} className={cn('relative flex items-center gap-2', compact ? 'text-sm' : 'text-[15px]', className)}>
      <div
        className={cn(
          'flex items-center gap-2 overflow-hidden transition-[max-width,opacity,margin] duration-200 ease-out',
          hideAuxiliary ? 'pointer-events-none -mr-2 max-w-0 opacity-0' : 'max-w-[180px] opacity-100',
        )}
        aria-hidden={hideAuxiliary}
      >
        <button
          type="button"
          className={cn(
            'hidden items-center px-2 text-text-primary transition-opacity hover:opacity-70 md:inline-flex',
            compact ? 'h-10' : 'h-11',
          )}
          aria-label="Current language"
          tabIndex={hideAuxiliary ? -1 : undefined}
        >
          <span>EN</span>
        </button>

        <span className="hidden h-5 w-px bg-border md:block" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex items-center justify-center text-text-secondary transition-opacity hover:text-text-primary hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
            compact ? 'h-10 w-10' : 'h-11 w-11',
            notificationsOpen && 'text-text-primary',
          )}
          aria-label="Notifications"
          tabIndex={hideAuxiliary ? -1 : undefined}
        >
          <Bell className="size-4" />
          {tasks.length > 0 ? (
            <span className="absolute -right-0.5 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] leading-none text-text-primary">
              {tasks.length}
            </span>
          ) : null}
        </button>

        <span className="h-5 w-px bg-border" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={() => navigate('/pricing')}
        className={cn(
          'inline-flex items-center gap-3 rounded-full bg-text-primary px-3.5 font-medium text-surface-0 transition-opacity duration-200 hover:opacity-92 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          compact ? 'h-10 text-sm' : 'h-11 text-[15px]',
        )}
        aria-label={`${planLabel} plan`}
      >
        <span>{planLabel}</span>
        <span className="inline-flex items-center gap-0.5 text-[13px] leading-none text-current">
          <span className="tabular-nums">{credits}</span>
          <Zap className="size-3.5" />
        </span>
      </button>

      <Link
        to="/profile"
        className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="Open profile"
      >
        <Avatar
          name={user?.name || 'Guest'}
          src={user?.avatarUrl}
          size={compact ? 'sm' : 'md'}
          className={cn(
            'bg-surface-2 text-text-primary',
            compact ? 'h-10 w-10 text-sm' : 'h-11 w-11'
          )}
        />
      </Link>

      {notificationsOpen ? (
        <NotificationPanel
          onClose={() => setNotificationsOpen(false)}
          className={cn(
            'absolute right-0 top-[calc(100%+12px)] z-50',
            compact && 'top-[calc(100%+8px)]'
          )}
        />
      ) : null}
    </div>
  )
}
