import { useState, useRef, forwardRef, useImperativeHandle, type KeyboardEvent } from 'react'
import { ArrowUp, Image, Mic } from 'lucide-react'
import { cn } from '@/components/ui/utils'

export interface ChatInputRef {
  setValue: (v: string) => void
  focus: () => void
}

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  /** Compact mode hides the icon toolbar (used inside the agent panel when messages exist) */
  compact?: boolean
  placeholder?: string
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({ onSend, disabled, compact, placeholder = 'Ask anything about your practice...' }, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    setValue,
    focus: () => textareaRef.current?.focus(),
  }), [])

  const hasContent = value.trim().length > 0
  const isActive = focused || hasContent

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
    <div
      className={cn(
        'flex flex-col gap-4 bg-surface-0 border border-border rounded-2xl p-4 min-h-[80px] transition-colors',
        isActive && 'border-border-hover',
      )}
    >
      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className={cn(
          'w-full bg-transparent text-sm leading-relaxed outline-none resize-none',
          'text-text-primary placeholder:text-text-muted',
          disabled && 'opacity-50',
        )}
        style={{ fieldSizing: 'content', maxHeight: '120px' } as React.CSSProperties}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Left icons */}
        {!compact ? (
          <div className="flex items-center gap-1">
            <IconButton icon={Image} label="Attach image" />
            <IconButton icon={Mic} label="Voice" />
          </div>
        ) : (
          <div />
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !hasContent}
          className={cn(
            'flex items-center justify-center size-9 rounded-full transition-colors shrink-0',
            hasContent
              ? 'bg-text-primary text-surface-0 hover:opacity-80'
              : 'bg-surface-3 text-text-muted cursor-default',
          )}
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  )
})

function IconButton({ icon: Icon, label }: { icon: typeof Image; label: string }) {
  return (
    <button
      type="button"
      title={label}
      className="flex items-center justify-center size-9 rounded-full text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
    >
      <Icon size={18} />
    </button>
  )
}
