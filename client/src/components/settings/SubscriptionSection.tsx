import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/stores/authStore'

interface SubscriptionSectionProps {
  className?: string
}

interface UsageBarProps {
  label: string
  used: number
  total: number
  unit?: string
}

function UsageBar({ label, used, total, unit = '' }: UsageBarProps) {
  const percentage = Math.min((used / total) * 100, 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-xs text-text-secondary">
          {used}{unit} of {total}{unit} used
        </span>
      </div>
      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

const BILLING_HISTORY = [
  { date: 'Mar 1, 2026', plan: 'Free Plan', amount: '$0.00' },
  { date: 'Feb 1, 2026', plan: 'Free Plan', amount: '$0.00' },
  { date: 'Jan 15, 2026', plan: 'Account Created', amount: '' },
]

export function SubscriptionSection({ className }: SubscriptionSectionProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const planLabel = user?.plan === 'pro' ? 'Pro' : user?.plan === 'studio' ? 'Studio' : 'Free'

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* Current plan card */}
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-base font-semibold text-text-primary">{planLabel} Plan</h3>
          <span className="text-xs bg-surface-3 text-text-secondary px-2 py-0.5 rounded-full">
            Current
          </span>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <UsageBar label="AI Transcriptions" used={2} total={3} />
          <UsageBar label="Storage" used={45} total={100} unit="MB" />
        </div>

        <Button
          variant="outline"
          onClick={() => navigate('/pricing')}
        >
          Change Plan
        </Button>
      </div>

      {/* Billing history */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Billing History</h3>
        <div className="border-t border-border">
          {BILLING_HISTORY.map((entry, i) => (
            <div
              key={i}
              className="flex justify-between py-3 border-b border-border text-sm"
            >
              <span className="text-text-secondary">{entry.date}</span>
              <span className="text-text-secondary">{entry.plan}</span>
              <span className="text-text-primary font-medium">{entry.amount || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
