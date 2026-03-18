import { cn } from './utils'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export function Card({ className, hoverable, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-2 border border-border rounded-md p-4',
        hoverable && 'cursor-pointer hover:bg-surface-3 hover:border-border-hover transition-colors',
        className,
      )}
      {...props}
    />
  )
}
