import { useUIStore } from '@/stores/uiStore'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/components/ui/utils'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { QuickActions } from './QuickActions'
import { X, Bot } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAgent } from '@/hooks/useAgent'
import { useEffect, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

export function AgentPanel() {
  const open = useUIStore((s) => s.agentPanelOpen)
  const setOpen = useUIStore((s) => s.setAgentPanelOpen)
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const { sendMessage } = useAgent()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  // Lock body scroll on mobile when panel is open
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isMobile, open])

  const hasMessages = messages.length > 0 || (isStreaming && streamingContent)

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-full bg-surface-0 border-l border-border flex flex-col',
        'transition-transform duration-200',
        isMobile
          ? 'w-full z-50'
          : 'w-[360px] z-20',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-border gap-2 shrink-0">
        <Bot size={16} className="text-text-secondary" />
        <span className="text-sm font-medium flex-1">LAVA AI</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
          <X size={14} />
        </Button>
      </div>

      {hasMessages ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: Date.now(),
                }}
                isStreaming
              />
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions + Compact Input */}
          <div className={cn('px-3 pt-2 pb-3 border-t border-border shrink-0 flex flex-col gap-2', isMobile && 'pb-safe')}>
            <QuickActions onSend={sendMessage} disabled={isStreaming} />
            <ChatInput onSend={sendMessage} disabled={isStreaming} compact />
          </div>
        </>
      ) : (
        /* Entrance / Welcome state */
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center">
              <Bot size={24} className="text-text-secondary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">How can I help?</p>
              <p className="text-xs text-text-muted mt-1">
                Ask me anything about your music.
              </p>
            </div>
          </div>

          <div className="w-full flex flex-col gap-3">
            <ChatInput onSend={sendMessage} disabled={isStreaming} />
            <QuickActions onSend={sendMessage} disabled={isStreaming} />
          </div>
        </div>
      )}
    </aside>
  )
}
