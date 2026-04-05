import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/authStore'

type PlanTier = 'free' | 'pro' | 'studio'

type Plan = {
  id: PlanTier
  name: string
  price: string
  cadence: string
  note?: string
  lines: string[]
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: '/mo',
    lines: ['Try it out', 'Limited versions', 'Basic export'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    cadence: '/mo',
    note: 'Best for teachers and creators',
    lines: ['More versions', 'PDF + MusicXML export', 'Version history'],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$24',
    cadence: '/mo',
    lines: ['Unlimited versions', 'Priority processing', 'Commercial use'],
  },
]

export function PricingPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

  const currentPlan = user?.plan ?? 'free'

  const orderedPlans = useMemo(() => {
    return PLANS.map((plan) => ({
      ...plan,
      isCurrent: plan.id === currentPlan,
      isRecommended: plan.id === 'pro',
    }))
  }, [currentPlan])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12 md:px-10 md:py-16">
      <div className="flex flex-col gap-6 pb-2 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[32rem]">
          <p className="text-[13px] text-text-secondary">Pricing</p>
          <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.04em] text-text-primary md:text-[56px]">
            Choose your plan.
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-text-secondary">
            Monthly. Cancel anytime.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {orderedPlans.map((plan) => (
          <section
            key={plan.id}
            className={cn(
              'flex min-h-[360px] flex-col rounded-[28px] px-6 py-6 md:px-8 md:py-8',
              plan.isRecommended ? 'bg-surface-1' : 'bg-surface-0',
            )}
          >
            <div className="flex min-h-[72px] items-start justify-between gap-4">
              <div className="flex min-h-[72px] flex-col">
                <p className="text-[20px] font-medium tracking-[-0.02em] text-text-primary">{plan.name}</p>
                {plan.note ? (
                  <p className="mt-2 text-[13px] leading-5 text-text-secondary">{plan.note}</p>
                ) : null}
              </div>
              {plan.isCurrent ? (
                <span className="rounded-full border border-border px-3 py-1 text-[12px] font-medium text-text-secondary">
                  Current
                </span>
              ) : null}
            </div>

            <div className="mt-10 flex items-end gap-2">
              <span className="text-[42px] font-semibold tracking-[-0.04em] text-text-primary">{plan.price}</span>
              <span className="pb-1 text-[14px] text-text-secondary">{plan.cadence}</span>
            </div>

            <div className="mt-10 space-y-3">
              {plan.lines.map((line) => (
                <p key={line} className="text-[15px] leading-6 text-text-primary">
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-auto pt-10">
              <Button
                variant={plan.isCurrent ? 'outline' : plan.isRecommended ? 'default' : 'outline'}
                size="lg"
                className="w-full"
                disabled={plan.isCurrent}
                onClick={() => {
                  if (plan.isCurrent) return
                  toast(`${plan.name} coming soon.`)
                }}
              >
                {plan.isCurrent ? 'Current' : plan.id === 'free' ? 'Start Free' : `Get ${plan.name}`}
              </Button>
            </div>
          </section>
        ))}
      </div>

      <p className="text-[13px] text-text-muted">Tax may apply.</p>
    </div>
  )
}
