import type { ReactNode } from 'react'
import { cn } from '@/components/ui/utils'

interface ScoreOverlayProps {
  className?: string
  children?: ReactNode
}

/**
 * Absolute overlay that sits on top of the OSMD score container.
 * Child elements have pointer-events enabled; the overlay itself is pass-through.
 */
export function ScoreOverlay({ className, children }: ScoreOverlayProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}
