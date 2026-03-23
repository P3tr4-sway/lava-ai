import { cn } from './utils'
import { cva, type VariantProps } from 'class-variance-authority'

const avatarVariants = cva(
  'inline-flex items-center justify-center rounded-full bg-surface-3 text-text-primary font-medium shrink-0 select-none',
  {
    variants: {
      size: {
        sm: 'w-7 h-7 text-xs',
        md: 'w-9 h-9 text-sm',
        lg: 'w-12 h-12 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name?: string
  src?: string
  className?: string
}

export function Avatar({ name, src, size, className }: AvatarProps) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={cn(avatarVariants({ size }), 'object-cover', className)}
      />
    )
  }

  return (
    <div className={cn(avatarVariants({ size }), className)}>
      {initials}
    </div>
  )
}
