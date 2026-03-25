import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/components/ui/utils'

interface PricingCardsProps {
  className?: string
}

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  name: string
  price: string
  period: string
  features: PlanFeature[]
  cta: string
  ctaVariant: 'default' | 'outline'
  ctaDisabled?: boolean
  highlighted?: boolean
  badge?: string
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      { text: '3 AI transcriptions/month', included: true },
      { text: 'Basic backing tracks', included: true },
      { text: 'PDF export', included: true },
      { text: '2 recording tracks', included: true },
      { text: '100MB storage', included: true },
      { text: 'Basic AI agent', included: true },
    ],
    cta: 'Current Plan',
    ctaVariant: 'outline',
    ctaDisabled: true,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: 'per month',
    features: [
      { text: '50 AI transcriptions/month', included: true },
      { text: 'Full backing track library', included: true },
      { text: 'PDF + MusicXML export', included: true },
      { text: '8 recording tracks', included: true },
      { text: '5GB storage', included: true },
      { text: 'Advanced AI agent', included: true },
    ],
    cta: 'Upgrade to Pro',
    ctaVariant: 'default',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Studio',
    price: '$19.99',
    period: 'per month',
    features: [
      { text: 'Unlimited AI transcriptions', included: true },
      { text: 'Full + custom backing tracks', included: true },
      { text: 'All export formats', included: true },
      { text: 'Unlimited recording tracks', included: true },
      { text: '50GB storage', included: true },
      { text: 'Priority AI agent', included: true },
    ],
    cta: 'Upgrade to Studio',
    ctaVariant: 'outline',
  },
]

export function PricingCards({ className }: PricingCardsProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch', className)}>
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            'flex flex-col bg-surface-0 border rounded-xl p-6 relative',
            plan.highlighted ? 'border-accent' : 'border-border',
          )}
        >
          {plan.badge && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-surface-0 text-xs px-2 py-0.5 rounded-full font-medium">
              {plan.badge}
            </span>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-text-primary">{plan.price}</span>
              <span className="text-sm text-text-secondary">/ {plan.period}</span>
            </div>
          </div>

          <ul className="flex flex-col gap-3 flex-1 mb-6">
            {plan.features.map((feature) => (
              <li key={feature.text} className="flex items-start gap-2">
                {feature.included ? (
                  <Check size={16} className="text-success shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <X size={16} className="text-text-muted shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    'text-sm',
                    feature.included ? 'text-text-primary' : 'text-text-muted',
                  )}
                >
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>

          <Button
            variant={plan.ctaVariant}
            size="lg"
            className="w-full"
            disabled={plan.ctaDisabled}
            onClick={() => {
              if (!plan.ctaDisabled) {
                alert('Coming soon!')
              }
            }}
          >
            {plan.cta}
          </Button>
        </div>
      ))}
    </div>
  )
}
