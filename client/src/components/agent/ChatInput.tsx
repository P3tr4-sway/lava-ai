import { useState, useRef, forwardRef, useImperativeHandle, type KeyboardEvent } from 'react'
import { ArrowUp, Plus } from 'lucide-react'
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
  density?: 'default' | 'roomy'
  placeholder?: string
  className?: string
  onAttachClick?: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSend,
  disabled,
  compact,
  density = 'default',
  placeholder = 'Ask anything about your practice...',
  className,
  onAttachClick,
}, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    setValue,
    focus: () => textareaRef.current?.focus(),
  }), [])

  const hasContent = value.trim().length > 0
  const isActive = focused || hasContent
  const isRoomy = density === 'roomy'

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
        'flex flex-col bg-surface-0 border border-border shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-colors',
        isRoomy ? 'gap-6 rounded-[28px] p-5 min-h-[132px]' : 'gap-5 rounded-[18px] p-4 min-h-[88px]',
        isActive && 'border-border-hover',
        className,
      )}
    >
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
          'w-full resize-none bg-transparent outline-none',
          isRoomy ? 'text-[1.18rem] leading-8' : 'text-base leading-7',
          'text-text-primary placeholder:text-text-muted',
          disabled && 'opacity-50',
        )}
        style={{ fieldSizing: 'content', maxHeight: isRoomy ? '176px' : '120px' } as React.CSSProperties}
      />

      <div className="flex items-center justify-between gap-3">
        {!compact ? (
          <div className="flex items-center gap-1.5">
            <IconButton icon={Plus} label="Add attachment" onClick={() => onAttachClick?.()} />
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !hasContent}
          aria-label="Send message"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border transition-colors',
            isRoomy ? 'size-12' : 'size-10',
            hasContent
              ? 'border-text-primary bg-text-primary text-surface-0 hover:opacity-85'
              : 'cursor-default border-border bg-surface-3 text-text-muted',
          )}
        >
          <ArrowUp size={isRoomy ? 18 : 16} />
        </button>
      </div>
    </div>
  )
})

function IconButton({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-1"
    >
      <Icon size={18} strokeWidth={1.9} />
    </button>
  )
}
