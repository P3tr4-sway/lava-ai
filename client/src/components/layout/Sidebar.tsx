import { useState, useRef, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowRight,
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
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  DEFAULT_HOME_SECTION,
  getHomeSectionFromSearch,
  HOME_NAV_RESET_EVENT,
  HOME_SECTION_ITEMS,
  NAV_ITEMS,
  SETTINGS_ITEM,
} from './navItems'
import { LavaLogo } from './LavaLogo'

function AITonesEntry({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-2">
      <button
        type="button"
        onClick={onClick}
        className="group w-full rounded-[20px] p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5"
        style={{
          border: '1px solid color-mix(in srgb, #d9ff3f 68%, var(--border))',
          background: 'color-mix(in srgb, #f4ff9c 26%, var(--surface-0))',
        }}
      >
        <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]"
            style={{
              border: '1px solid color-mix(in srgb, #c7f000 72%, var(--border))',
              background: '#e6ff3b',
            }}
          >
            <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between">
              {Array.from({ length: 3 }).map((_, index) => (
                <span
                  key={index}
                  className="size-1.5 rounded-full"
                  style={{ background: 'rgba(17, 24, 39, 0.22)' }}
                />
              ))}
            </div>
            <div
              className="absolute inset-x-2.5 bottom-2.5 top-5 rounded-[0.85rem]"
              style={{
                background:
                  'repeating-linear-gradient(0deg, rgba(17, 24, 39, 0.14) 0px, rgba(17, 24, 39, 0.14) 1px, transparent 1px, transparent 4px), rgba(255,255,255,0.72)',
                border: '1px solid rgba(17, 24, 39, 0.12)',
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.26em]"
              style={{ color: 'rgba(17, 24, 39, 0.52)' }}
            >
              AI Tones
            </p>
            <p className="mt-1 text-sm font-semibold tracking-tight text-[#111827]">Amp & FX</p>
          </div>

          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
            style={{
              background: '#111827',
              color: '#e6ff3b',
            }}
          >
            <ArrowRight size={15} />
          </div>
        </div>
      </button>
    </div>
  )
}

function NavItems({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const libraryItem = NAV_ITEMS.find((item) => item.to === '/files')
  const SettingsIcon = SETTINGS_ITEM.icon
  const activeHomeSection =
    location.pathname === '/' ? getHomeSectionFromSearch(location.search) : null

  return (
    <>
      {/* Main nav */}
      <div className="flex flex-col gap-1 px-2">
        {HOME_SECTION_ITEMS.map(({ id, to, label }) => {
          const isActive = activeHomeSection === id

          return (
            <Link
              key={id}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                if (isActive) {
                  e.preventDefault()
                  window.dispatchEvent(
                    new CustomEvent(HOME_NAV_RESET_EVENT, {
                      detail: { section: id },
                    }),
                  )
                }
                onClose?.()
              }}
            className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface-3 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
              )}
            >
              <span>{label}</span>
            </Link>
          )
        })}
      </div>

      <div className="px-2 mt-2">
        <div className="h-px bg-border mb-2" />
        {libraryItem && (
          <NavLink
            to={libraryItem.to}
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
            <libraryItem.icon size={17} className="shrink-0" />
            <span>{libraryItem.label}</span>
          </NavLink>
        )}
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
              <Avatar name={user.name} size="md" />
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
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const currentHomeSection =
    location.pathname === '/' ? getHomeSectionFromSearch(location.search) : null

  const handleOpenAiTones = () => {
    const from = `${location.pathname}${location.search}${location.hash}`
    navigate('/tools/new', { state: { from } })
    if (isMobile) setSidebarOpen(false)
  }

  if (isMobile) {
    return (
      <nav
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-surface-0 border-r border-border flex flex-col transition-transform duration-200',
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

        {/* Bottom: AI tones + user info */}
        <div className="shrink-0 border-t border-border py-3 px-0 flex flex-col gap-2">
          <AITonesEntry onClick={handleOpenAiTones} />
          <UserInfoSection />
        </div>
      </nav>
    )
  }

  return (
    <nav className="flex flex-col h-full w-64 bg-surface-0 border-r border-border shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center h-14 px-4 shrink-0">
          <Link
            to="/"
            onClick={() => {
              if (location.pathname === '/' && currentHomeSection === DEFAULT_HOME_SECTION) {
                window.dispatchEvent(new Event(HOME_NAV_RESET_EVENT))
              }
            }}
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

      {/* Bottom: AI tones + user info */}
      <div className="shrink-0 border-t border-border py-3 px-0 flex flex-col gap-2">
        <AITonesEntry onClick={handleOpenAiTones} />
        <UserInfoSection />
      </div>
    </nav>
  )
}
