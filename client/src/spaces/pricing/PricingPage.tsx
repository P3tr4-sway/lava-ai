import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PricingCards } from '@/components/marketing/PricingCards'
import { cn } from '@/components/ui/utils'

interface FAQItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes, cancel anytime from your account settings. Your plan stays active until the end of the current billing period.',
  },
  {
    question: 'What happens to my projects if I downgrade?',
    answer:
      'Your projects are always yours. If you exceed the storage limit of the lower plan, you can still access everything but won\'t be able to create new projects until you free up space.',
  },
  {
    question: 'Do you offer student discounts?',
    answer:
      'Yes! Email us at students@lava.ai with your .edu email address and we\'ll set you up with 50% off any paid plan.',
  },
  {
    question: 'Is there a yearly plan?',
    answer:
      'Coming soon! Yearly plans will save 20% compared to monthly billing.',
  },
]

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
          {item.question}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'text-text-muted shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <p className="text-sm text-text-secondary pb-4 leading-relaxed">
          {item.answer}
        </p>
      )}
    </div>
  )
}

export function PricingPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Choose Your Plan
          </h1>
          <p className="text-base text-text-secondary">
            Start free, upgrade when you&apos;re ready
          </p>
        </div>

        {/* Pricing Cards */}
        <PricingCards className="mb-16" />

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Frequently Asked Questions
          </h2>
          <div>
            {FAQ_ITEMS.map((item) => (
              <FAQAccordion key={item.question} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
