import { useState, useRef, forwardRef, useImperativeHandle, type KeyboardEvent } from 'react'
import { ArrowUp, Dices, Plus } from 'lucide-react'
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
  canSend?: boolean
  onValueChange?: (value: string) => void
  /** When set, replaces the arrow-up icon with a text pill button */
  submitLabel?: string
  /** When set, shows a dice button to the left of the submit button */
  onRandomize?: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSend,
  disabled,
  compact,
  density = 'default',
  placeholder = 'Describe the version you want to create...',
  className,
  onAttachClick,
  canSend = false,
  onValueChange,
  submitLabel,
  onRandomize,
}, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    setValue: (nextValue: string) => {
      setValue(nextValue)
      onValueChange?.(nextValue)
    },
    focus: () => textareaRef.current?.focus(),
  }), [onValueChange])

  const hasContent = value.trim().length > 0
  const canSubmit = hasContent || canSend
  const isActive = focused || hasContent
  const isRoomy = density === 'roomy'

  const handleSend = () => {
    const trimmed = value.trim()
    if (!canSubmit || disabled) return
    onSend(trimmed)
    setValue('')
    onValueChange?.('')
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
        'border border-border bg-surface-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-colors',
        isRoomy ? 'flex min-h-[132px] flex-col gap-6 rounded-[28px] p-5' : 'flex min-h-[88px] flex-col gap-5 rounded-[18px] p-4',
        isActive && 'border-border-hover',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onValueChange?.(e.target.value)
        }}
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

        <div className="flex items-center gap-2">
          {onRandomize && (
            <button
              type="button"
              onClick={onRandomize}
              aria-label="Random style suggestion"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/60 text-[#555] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-all hover:bg-white/80"
            >
              <Dices size={16} />
            </button>
          )}
          {submitLabel ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || !canSubmit}
              aria-label={submitLabel}
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full px-5 font-medium transition-colors',
                isRoomy ? 'h-12 text-[15px]' : 'h-10 text-sm',
                canSubmit
                  ? 'bg-text-primary text-surface-0 hover:opacity-85'
                  : 'cursor-default bg-surface-3 text-text-muted',
              )}
            >
              {submitLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || !canSubmit}
              aria-label="Send message"
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full border transition-colors',
                isRoomy ? 'size-12' : 'size-10',
                canSubmit
                  ? 'border-text-primary bg-text-primary text-surface-0 hover:opacity-85'
                  : 'cursor-default border-border bg-surface-3 text-text-muted',
              )}
            >
              <ArrowUp size={isRoomy ? 18 : 16} />
            </button>
          )}
        </div>
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
