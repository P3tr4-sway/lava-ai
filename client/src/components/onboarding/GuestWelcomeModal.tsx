import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Music, Sparkles, FileMusic, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { LavaLogo } from '@/components/layout/LavaLogo'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/components/ui/utils'

const STORAGE_KEY = 'lava-guest-welcomed'
const SHOW_DELAY_MS = 2000

const FEATURES = [
  { icon: Music, text: 'Search any song and practice it' },
  { icon: Sparkles, text: 'AI breaks songs into chord charts and tabs' },
  { icon: FileMusic, text: 'Track progress and build practice plans' },
] as const

export function GuestWelcomeModal() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [visible, setVisible] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    if (isAuthenticated || localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => setAnimateIn(true))
    }, SHOW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [isAuthenticated])

  if (!visible) return null

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setAnimateIn(false)
    setTimeout(() => setVisible(false), 200)
  }

  // bg-accent is light in dark mode (#e5e5e5) and dark in light mode (#0d0d0d)
  // text-surface-0 is the inverse — black in dark, white in light
  // This guarantees contrast in both themes without overlays
  return createPortal(
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[100] w-full max-w-sm transition-all duration-300',
        animateIn
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4',
      )}
    >
      <div
        className="rounded-xl bg-accent p-6 relative"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-surface-0 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="text-surface-0">
            <LavaLogo />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-0">Welcome to LAVA AI</h2>
            <p className="text-sm text-surface-0 opacity-70">Your AI-powered practice partner</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon className="size-4 text-surface-0 opacity-60 shrink-0" />
              <span className="text-sm text-surface-0">{text}</span>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full bg-surface-0 text-accent hover:opacity-90"
          onClick={handleDismiss}
        >
          Get Started
        </Button>
      </div>
    </div>,
    document.body,
  )
}
