import { useState, useRef, useEffect } from 'react'
import { cn } from '@/components/ui/utils'

interface LyricInputProps {
  x: number
  y: number
  visible: boolean
  initialValue?: string
  onSubmit: (text: string) => void
  onAdvance: () => void  // Tab to next note
  onDismiss: () => void
  className?: string
}

export function LyricInput({ x, y, visible, initialValue = '', onSubmit, onAdvance, onDismiss, className }: LyricInputProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [visible, initialValue])

  if (!visible) return null

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSubmit(value)
          onAdvance()
        } else if (e.key === 'Tab') {
          e.preventDefault()
          onSubmit(value)
          onAdvance()
        } else if (e.key === ' ' || e.key === '-') {
          // Space or hyphen submits current syllable and advances
          onSubmit(value + (e.key === '-' ? '-' : ''))
          onAdvance()
          e.preventDefault()
        } else if (e.key === 'Escape') {
          onDismiss()
        }
      }}
      className={cn(
        'absolute bg-surface-1 border border-border rounded px-1 py-0.5 text-xs text-text-secondary italic',
        'outline-none focus:border-accent w-16 z-40',
        className,
      )}
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
      placeholder="lyric..."
    />
  )
}
