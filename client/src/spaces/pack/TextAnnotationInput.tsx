import { useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

interface TextAnnotationInputProps {
  position: { x: number; y: number }
  defaultValue?: string
  onSubmit: (text: string) => void
  onCancel: () => void
  className?: string
}

export function TextAnnotationInput({
  position,
  defaultValue = '',
  onSubmit,
  onCancel,
  className,
}: TextAnnotationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const val = inputRef.current?.value.trim()
      if (val) onSubmit(val)
      else onCancel()
    }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      className={cn(
        'absolute z-50 animate-fade-in',
        className,
      )}
      style={{ left: position.x, top: position.y }}
    >
      <input
        ref={inputRef}
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        className="h-7 w-48 rounded border border-border bg-surface-0 px-2 text-sm text-text-primary shadow-lg outline-none focus:border-border-hover"
        placeholder="Add annotation..."
      />
    </div>
  )
}
