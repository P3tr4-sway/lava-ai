import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui'
import { Moon, Sun } from 'lucide-react'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-text-primary">Profile</h1>

      {/* Account */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Account</h2>
        <div className="flex flex-col gap-2 p-4 rounded-lg border border-border">
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Name</span>
            <span className="text-sm text-text-primary">{user?.name || 'Guest'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Email</span>
            <span className="text-sm text-text-primary">{user?.email || '—'}</span>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Preferences</h2>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <span className="text-sm text-text-primary">Theme</span>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>
      </section>

      {/* Sign out */}
      <Button variant="outline" onClick={logout} className="w-fit">
        Sign out
      </Button>
    </div>
  )
}
