import { cn } from './utils'
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-surface-3 text-text-secondary',
        pro: 'bg-accent text-surface-0',
        studio: 'bg-surface-4 text-text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  className?: string
}

export function Badge({ variant, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  )
}
