import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/stores/authStore'

interface AccountSectionProps {
  className?: string
}

export function AccountSection({ className }: AccountSectionProps) {
  const user = useAuthStore((s) => s.user)
  const [name, setName] = useState(user?.name ?? '')

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const planLabel = user?.plan === 'pro' ? 'Pro' : user?.plan === 'studio' ? 'Studio' : 'Free'

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* User info card */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center text-sm font-semibold text-text-primary shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-text-primary truncate">{user?.name ?? 'User'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-text-secondary truncate">{user?.email ?? 'No email'}</p>
            <span className="text-xs bg-surface-2 text-text-secondary px-2 py-0.5 rounded-full shrink-0">
              {planLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="flex flex-col gap-4">
        <Input
          id="account-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <Input
            id="account-email"
            label="Email"
            value={user?.email ?? ''}
            disabled
          />
          <p className="text-xs text-text-muted mt-1">Managed by LAVA ID</p>
        </div>
      </div>

      <Button
        size="lg"
        className="self-start"
        onClick={() => alert('Saved!')}
      >
        Save Changes
      </Button>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Danger zone */}
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-error mb-1">Danger Zone</h3>
        <p className="text-sm text-text-secondary mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => alert('Contact support to delete your account')}
        >
          Delete Account
        </Button>
      </div>
    </div>
  )
}
