import { useUIStore } from '@/stores/uiStore'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/components/ui/utils'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { X, Bot } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAgent } from '@/hooks/useAgent'
import { useEffect, useRef } from 'react'

export function AgentPanel() {
  const open = useUIStore((s) => s.agentPanelOpen)
  const setOpen = useUIStore((s) => s.setAgentPanelOpen)
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const { sendMessage } = useAgent()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-full w-[360px] bg-surface-0 border-l border-border flex flex-col',
        'transition-transform duration-200 z-20',
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot size={32} className="text-text-muted" />
            <p className="text-sm text-text-secondary">
              Ask me anything about your music.
            </p>
            <p className="text-xs text-text-muted">
              I can navigate you around, help transcribe audio, start a jam session, or compose
              ideas.
            </p>
          </div>
        )}
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

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </aside>
  )
}
