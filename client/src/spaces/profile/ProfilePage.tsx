import { Avatar, Button } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const planLabel =
    user?.plan === 'studio' ? 'Studio' : user?.plan === 'pro' ? 'Pro' : 'Free'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 py-12 md:px-10 md:py-16">
      <header className="max-w-2xl">
        <p className="text-[13px] text-text-secondary">Profile</p>
        <h1 className="mt-3 text-[44px] font-semibold tracking-[-0.05em] text-text-primary md:text-[64px]">
          Account
        </h1>
        <p className="mt-4 text-[16px] leading-7 text-text-secondary">
          Your plan, publishing defaults, and account settings.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[32px] bg-surface-0 px-7 py-7 md:px-8 md:py-8">
          <div className="flex items-start gap-5">
            <Avatar
              name={user?.name || 'Guest'}
              src={user?.avatarUrl}
              size="lg"
              className="h-16 w-16 text-lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="truncate text-[28px] font-medium tracking-[-0.03em] text-text-primary">
                  {user?.name || 'Guest'}
                </h2>
                <span className="rounded-full bg-surface-1 px-3 py-1 text-[12px] font-medium text-text-secondary">
                  {planLabel}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-6 text-text-secondary">
                {user?.email || 'No email'}
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[13px] text-text-secondary">Name</p>
              <p className="text-[18px] font-medium tracking-[-0.02em] text-text-primary">
                {user?.name || 'Guest'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[13px] text-text-secondary">Email</p>
              <p className="break-all text-[18px] font-medium tracking-[-0.02em] text-text-primary">
                {user?.email || '—'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[13px] text-text-secondary">Plan</p>
              <p className="text-[18px] font-medium tracking-[-0.02em] text-text-primary">
                {planLabel}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[13px] text-text-secondary">Status</p>
              <p className="text-[18px] font-medium tracking-[-0.02em] text-text-primary">
                Active
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] bg-surface-1 px-7 py-7 md:px-8 md:py-8">
          <div>
            <p className="text-[13px] text-text-secondary">Preferences</p>
            <h2 className="mt-3 text-[28px] font-medium tracking-[-0.03em] text-text-primary">
              Defaults
            </h2>
          </div>

          <div className="mt-10 space-y-8">
            <div className="space-y-3">
              <p className="text-[13px] text-text-secondary">Theme</p>
              <div className="flex flex-wrap gap-2">
                {(['light', 'dark', 'system'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    className={`rounded-full px-4 py-2 text-[14px] transition-colors ${
                      theme === option
                        ? 'bg-text-primary text-surface-0'
                        : 'bg-surface-0 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {option === 'system' ? 'System' : option === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] text-text-secondary">Workspace</p>
              <p className="text-[18px] font-medium tracking-[-0.02em] text-text-primary">
                Lava AI
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Button variant="outline" onClick={logout} className="w-full sm:w-auto">
              Sign out
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
