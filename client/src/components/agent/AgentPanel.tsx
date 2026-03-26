import { useUIStore } from '@/stores/uiStore'
import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/components/ui/utils'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { QuickActions } from './QuickActions'
import { X, Bot, Music, Mic, Lightbulb, BookOpen } from 'lucide-react'
import { useAgent } from '@/hooks/useAgent'
import { useCallback, useEffect, useRef } from 'react'

const WELCOME_ACTIONS = [
  { icon: BookOpen,  label: 'Analyze this score',     prompt: 'Analyze the current score and highlight key sections' },
  { icon: Mic,       label: 'Transcribe audio',        prompt: 'Transcribe an audio file to sheet music' },
  { icon: Lightbulb, label: 'Suggest chords',          prompt: 'Suggest chords that fit this progression' },
  { icon: Music,     label: 'Generate a backing track', prompt: 'Generate a backing track for this piece' },
]

export function AgentPanel() {
  const open = useUIStore((s) => s.agentPanelOpen)
  const setOpen = useUIStore((s) => s.setAgentPanelOpen)
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const { sendMessage, handleChipClick } = useAgent()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) setOpen(false)
  }, [open, setOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const hasMessages = messages.length > 0 || (isStreaming && streamingContent)

  return (
    <>
      {/* Invisible backdrop — click anywhere outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed bottom-6 right-6 w-[380px] bg-surface-0 border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40',
          'transition-all duration-200 ease-out origin-bottom-right',
          open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-3 pointer-events-none',
        )}
        style={{ maxHeight: 'min(560px, calc(100vh - 108px))' }}
      >
        {/* Header */}
        <div className="h-11 flex items-center px-4 border-b border-border gap-2 shrink-0">
          <Bot size={15} className="text-text-secondary" />
          <span className="text-sm font-medium flex-1">LAVA AI</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex items-center justify-center size-6 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {hasMessages ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} onChipClick={handleChipClick} />
              ))}
              {isStreaming && streamingContent && (
                <ChatMessage
                  message={{ id: 'streaming', role: 'assistant', content: streamingContent, createdAt: Date.now() }}
                  isStreaming
                />
              )}
              <div ref={bottomRef} />
            </div>

            {/* Compact input */}
            <div className="px-3 pt-2 pb-3 border-t border-border shrink-0 flex flex-col gap-2">
              <QuickActions onSend={sendMessage} disabled={isStreaming} />
              <ChatInput onSend={sendMessage} disabled={isStreaming} compact />
            </div>
          </>
        ) : (
          /* Welcome state — Notion-style */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Avatar */}
              <div className="size-11 rounded-full bg-surface-2 flex items-center justify-center">
                <Bot size={20} className="text-text-secondary" />
              </div>

              {/* Heading */}
              <p className="text-base font-semibold text-text-primary leading-snug">
                What can I help with?
              </p>

              {/* Suggestion list */}
              <div className="flex flex-col">
                {WELCOME_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    disabled={isStreaming}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors text-left w-full disabled:opacity-40"
                  >
                    <action.icon size={15} className="shrink-0 text-text-muted" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input pinned at bottom */}
            <div className="p-3 border-t border-border shrink-0">
              <ChatInput onSend={sendMessage} disabled={isStreaming} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
