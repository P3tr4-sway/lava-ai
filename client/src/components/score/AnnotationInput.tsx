import { useState, useRef, useEffect } from 'react'
import { cn } from '@/components/ui/utils'

interface AnnotationInputProps {
  x: number
  y: number
  visible: boolean
  initialValue?: string
  onSubmit: (text: string) => void
  onDismiss: () => void
  className?: string
}

export function AnnotationInput({ x, y, visible, initialValue = '', onSubmit, onDismiss, className }: AnnotationInputProps) {
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
        } else if (e.key === 'Escape') {
          onDismiss()
        }
      }}
      className={cn(
        'absolute bg-surface-1 border border-border rounded px-1.5 py-0.5 text-xs text-text-primary font-medium',
        'outline-none focus:border-accent w-32 z-40',
        className,
      )}
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
      placeholder="annotation..."
    />
  )
}
