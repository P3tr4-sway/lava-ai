import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask LAVA AI..."
        rows={1}
        className={cn(
          'flex-1 bg-surface-3 border border-border rounded px-3 py-2 text-sm text-text-primary',
          'placeholder:text-text-muted resize-none',
          'focus:outline-none focus:border-border-hover',
          'transition-colors',
          'min-h-[36px] max-h-[120px]',
          disabled && 'opacity-50',
        )}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="shrink-0"
      >
        <Send size={14} />
      </Button>
    </div>
  )
}
