import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default: 'bg-accent text-surface-0 hover:opacity-90',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-3',
        outline: 'border border-border text-text-primary hover:bg-surface-3 hover:border-border-hover',
        destructive: 'bg-error text-surface-0 hover:opacity-90',
        link: 'text-text-secondary underline-offset-4 hover:underline hover:text-text-primary',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs rounded',
        default: 'h-8 px-3 rounded',
        lg: 'h-10 px-4 rounded-md',
        icon: 'h-8 w-8 rounded',
        'icon-sm': 'h-7 w-7 rounded',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
