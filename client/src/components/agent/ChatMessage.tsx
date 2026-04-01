import type { AgentMessage, MessageChip } from '@lava/shared'
import { cn } from '@/components/ui/utils'
import { Bot, User } from 'lucide-react'
import { MarkdownContent } from './MarkdownContent'

interface ChatMessageProps {
  message: AgentMessage
  isStreaming?: boolean
  onChipClick?: (chip: MessageChip) => void
  onApplyToneAction?: (messageId: string) => void
  onUndoToneAction?: (messageId: string) => void
  onRetryToneAction?: (messageId: string) => void
  onPreviewVersion?: (versionId: string) => void
  onApplyVersion?: (versionId: string) => void
}

export function ChatMessage({
  message,
  isStreaming,
  onChipClick,
  onApplyToneAction,
  onUndoToneAction,
  onRetryToneAction,
  onPreviewVersion,
  onApplyVersion,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isPracticeStatus = message.subtype === 'practiceStatus'
  const isPracticeNudge = message.subtype === 'practiceNudge'

  if (message.hidden) return null

  if (isPracticeStatus) {
    return (
      <div className="flex justify-start">
        <div className="rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5',
          isUser ? 'bg-surface-3' : 'bg-surface-2',
        )}
      >
        {isUser ? (
          <User size={12} className="text-text-secondary" />
        ) : (
          <Bot size={12} className="text-text-secondary" />
        )}
      </div>
      <div className={cn('max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-3 py-2.5',
            isUser
              ? 'bg-surface-3 text-sm text-text-primary leading-relaxed'
              : isPracticeNudge
                ? 'bg-surface-1 text-sm text-text-primary border border-border'
                : 'bg-surface-2 text-text-primary border border-border',
          )}
        >
          {isUser ? (
            <>
              {message.content}
              {isStreaming && (
                <span className="inline-block w-1 h-3.5 bg-text-primary/60 ml-0.5 animate-pulse align-middle" />
              )}
            </>
          ) : (
            <>
              <MarkdownContent content={message.content} />
              {isStreaming && (
                <span className="inline-block w-[3px] h-[14px] bg-text-primary/50 ml-0.5 rounded-sm animate-pulse align-middle" />
              )}
            </>
          )}
        </div>
        {message.chips && message.chips.length > 0 && onChipClick && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.chips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => onChipClick(chip)}
                className="rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-3 hover:text-text-primary"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        {message.toneAction && (
          <div className="mt-2 rounded-2xl border border-border bg-surface-1 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Tone Preview</p>
            <p className="mt-2 text-sm font-medium text-text-primary">{message.toneAction.summary}</p>
            <div className="mt-2 flex flex-col gap-1">
              {message.toneAction.changes.map((change) => (
                <p key={change} className="text-xs text-text-secondary">
                  {change}
                </p>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onApplyToneAction?.(message.id)}
                className="rounded-full bg-text-primary px-3 py-1.5 text-[11px] font-medium text-surface-0 transition-opacity hover:opacity-80"
              >
                {message.toneAction.state === 'applied' ? 'Applied' : 'Apply'}
              </button>
              <button
                type="button"
                onClick={() => onUndoToneAction?.(message.id)}
                className="rounded-full border border-border bg-surface-0 px-3 py-1.5 text-[11px] font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-surface-2"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => onRetryToneAction?.(message.id)}
                className="rounded-full border border-border bg-surface-0 px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
              >
                Try another
              </button>
            </div>
          </div>
        )}
        {message.subtype === 'versionCreated' && message.versionAction && (
          <div className="mt-2 rounded-2xl border border-border bg-surface-1 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">New Version</p>
            <p className="mt-2 text-sm font-medium text-text-primary">{message.versionAction.name}</p>
            <div className="mt-2 flex flex-col gap-1">
              {message.versionAction.changeSummary.map((item) => (
                <p key={item} className="text-xs text-text-secondary">
                  {item}
                </p>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {message.versionAction.state === 'applied' ? (
                <span className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-text-secondary">
                  Applied
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onPreviewVersion?.(message.versionAction!.versionId)}
                    disabled={!onPreviewVersion}
                    className={cn(
                      'rounded-full border border-border bg-surface-0 px-3 py-1.5 text-[11px] font-medium text-text-primary transition-colors',
                      onPreviewVersion
                        ? 'hover:border-border-hover hover:bg-surface-2'
                        : 'cursor-not-allowed opacity-50',
                    )}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyVersion?.(message.versionAction!.versionId)}
                    disabled={!onApplyVersion}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[11px] font-medium text-surface-0 transition-opacity',
                      onApplyVersion
                        ? 'bg-text-primary hover:opacity-80'
                        : 'cursor-not-allowed bg-text-primary opacity-50',
                    )}
                  >
                    Apply
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
