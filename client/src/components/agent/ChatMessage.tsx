import type { AgentMessage } from '@lava/shared'
import { cn } from '@/components/ui/utils'
import { Bot, User } from 'lucide-react'

interface ChatMessageProps {
  message: AgentMessage
  isStreaming?: boolean
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user'

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
      <div
        className={cn(
          'max-w-[80%] rounded px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-surface-3 text-text-primary'
            : 'bg-surface-2 text-text-primary border border-border',
        )}
      >
        {message.content}
        {isStreaming && (
          <span className="inline-block w-1 h-3.5 bg-text-primary/60 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
