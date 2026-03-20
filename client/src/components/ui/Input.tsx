import { cn } from './utils'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'h-8 w-full rounded bg-surface-3 border border-border px-3 text-sm text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:border-border-hover focus:bg-surface-4',
          'transition-colors',
          error && 'border-error',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
