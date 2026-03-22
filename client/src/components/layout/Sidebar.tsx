import { useState, useRef, useEffect } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Settings,
  CreditCard,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/hooks/useTheme'
import { useIsMobile } from '@/hooks/useIsMobile'
import { NAV_ITEMS, NEW_SHEET_ITEM, SETTINGS_ITEM } from './navItems'
import { LavaLogo } from './LavaLogo'

const THEME_OPTIONS = [
  { value: 'system' as const, icon: Monitor, label: 'System' },
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
]

function NavItems({ onClose }: { onClose?: () => void }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const NewSheetIcon = NEW_SHEET_ITEM.icon
  const SettingsIcon = SETTINGS_ITEM.icon
  return (
    <>
      {/* Main nav */}
      <div className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 py-2 px-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'text-text-primary bg-surface-3'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
              )
            }
          >
            <Icon size={17} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Divider + New Sheet action */}
      <div className="px-2 mt-2">
        <div className="h-px bg-border mb-2" />
        <NavLink
          to={NEW_SHEET_ITEM.to}
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 py-2 px-2 rounded-md text-sm transition-colors',
              isActive
                ? 'text-text-primary bg-surface-3'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
            )
          }
        >
          <NewSheetIcon size={17} className="shrink-0" />
          <span>{NEW_SHEET_ITEM.label}</span>
        </NavLink>
        {isAuthenticated && (
          <NavLink
            to={SETTINGS_ITEM.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 py-2 px-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'text-text-primary bg-surface-3'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
              )
            }
          >
            <SettingsIcon size={17} className="shrink-0" />
            <span>{SETTINGS_ITEM.label}</span>
          </NavLink>
        )}
      </div>
    </>
  )
}

function UserInfoSection() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [popupOpen, setPopupOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Close popup on outside click
  useEffect(() => {
    if (!popupOpen) return
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popupOpen])

  if (!user) {
    return (
      <div className="px-2 mb-2 flex flex-col gap-1.5">
        <button
          onClick={() => navigate('/signup')}
          className="w-full py-2 px-3 bg-accent text-surface-0 text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          Sign Up Free
        </button>
        <button
          onClick={() => navigate('/login')}
          className="w-full py-2 px-3 text-text-secondary text-sm font-medium rounded-md hover:bg-surface-2 hover:text-text-primary transition-colors"
        >
          Sign In
        </button>
      </div>
    )
  }

  const planLabel = user.plan.charAt(0).toUpperCase() + user.plan.slice(1)

  return (
    <div className="relative px-2 mb-2" ref={popupRef}>
      {/* Popup panel — appears above the user row */}
      {popupOpen && (
        <div className="absolute bottom-full left-2 right-2 mb-2 rounded-xl bg-surface-2 border border-border shadow-2xl animate-fade-in overflow-hidden">
          {/* User info header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size="default" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
                <p className="text-xs text-text-secondary truncate">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant={user.plan === 'pro' ? 'pro' : user.plan === 'studio' ? 'studio' : 'default'}>
                {planLabel} Plan
              </Badge>
              {user.plan === 'free' && (
                <button
                  onClick={() => { setPopupOpen(false); navigate('/pricing') }}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={() => { setPopupOpen(false); navigate('/settings') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <Settings size={15} />
              Settings
            </button>
            <button
              onClick={() => { setPopupOpen(false); navigate('/pricing') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <CreditCard size={15} />
              Plans & Billing
            </button>
            <div className="h-px bg-border mx-3 my-1" />
            <button
              onClick={() => { setPopupOpen(false); logout(); navigate('/login') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-surface-3 transition-colors"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* User row trigger */}
      <button
        onClick={() => setPopupOpen(!popupOpen)}
        className="w-full flex items-center gap-2.5 py-2 px-2 rounded-md hover:bg-surface-2 cursor-pointer transition-colors"
      >
        <Avatar name={user.name} size="sm" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
          <Badge variant={user.plan === 'pro' ? 'pro' : user.plan === 'studio' ? 'studio' : 'default'}>
            {planLabel}
          </Badge>
        </div>
        <ChevronUp
          size={14}
          className={cn(
            'text-text-muted shrink-0 transition-transform',
            popupOpen ? 'rotate-180' : '',
          )}
        />
      </button>
    </div>
  )
}

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <nav
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 bg-surface-0 border-r border-border flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 shrink-0">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 flex-1 min-w-0 group"
          >
            <LavaLogo />
            <span className="text-base font-semibold tracking-wide text-text-primary group-hover:opacity-80 transition-opacity">
              LAVA
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col py-2 overflow-y-auto">
          <NavItems onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Bottom: user info + theme picker */}
        <div className="shrink-0 border-t border-border py-3 px-0 flex flex-col gap-2">
          <UserInfoSection />
          <div className="px-2">
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
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="flex flex-col h-full w-60 bg-surface-0 border-r border-border shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center h-14 px-4 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
        >
          <LavaLogo />
          <span className="text-base font-semibold tracking-wide text-text-primary group-hover:opacity-80 transition-opacity">
            LAVA
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col py-2 overflow-y-auto">
        <NavItems />
      </div>

      {/* Bottom: user info + theme picker */}
      <div className="shrink-0 border-t border-border py-3 px-0 flex flex-col gap-2">
        <UserInfoSection />
        <div className="px-2">
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
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
