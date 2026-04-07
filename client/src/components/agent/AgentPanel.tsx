import { useAgentStore } from '@/stores/agentStore'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { Bot, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useAgent } from '@/hooks/useAgent'
import { useCallback, useEffect, useRef } from 'react'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'

const PANEL_HEADINGS: Record<string, string> = {
  home: 'What do you want to create?',
  create: 'What do you want to create or adapt?',
  projects: 'What would you like to open or organize?',
}

export function AgentPanel() {
  const { canShowPanel, isMobile, desktopMode, mobileOpen, showPanel, hidePanel } = useAgentPanelControls()
  const messages = useAgentStore((s) => s.messages)
  const toolActivities = useAgentStore((s) => s.toolActivities)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const currentSpace = useAgentStore((s) => s.spaceContext.currentSpace)
  const clearMessages = useAgentStore((s) => s.clearMessages)
  const { sendMessage, handleChipClick } = useAgent()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isDesktopExpanded = desktopMode === 'expanded'
  const isOpen = isMobile ? mobileOpen : isDesktopExpanded

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent, isOpen])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (isMobile) {
      if (mobileOpen) hidePanel()
      return
    }
    if (isDesktopExpanded) hidePanel()
  }, [hidePanel, isDesktopExpanded, isMobile, mobileOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const hasMessages = messages.length > 0 || (isStreaming && streamingContent)
  const canClearContext = messages.length > 0 || toolActivities.length > 0 || Boolean(streamingContent)
  const heading = PANEL_HEADINGS[currentSpace] ?? 'What do you want to make?'

  if (!canShowPanel) {
    return null
  }

  const renderContent = (compactWelcome = false) => {
    if (hasMessages) {
      return (
        <>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onChipClick={handleChipClick}
              />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{ id: 'streaming', role: 'assistant', content: streamingContent, createdAt: Date.now() }}
                isStreaming
              />
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 border-t border-border shrink-0 flex flex-col gap-2">
            <ChatInput
              onSend={sendMessage}
              disabled={isStreaming}
              compact
            />
          </div>
        </>
      )
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={cn('flex-1 overflow-y-auto flex flex-col', compactWelcome ? 'p-4 gap-3' : 'p-5 gap-4')}>
          <div className={cn('rounded-full bg-surface-2 flex items-center justify-center', compactWelcome ? 'size-10' : 'size-11')}>
            <Bot size={compactWelcome ? 18 : 20} className="text-text-secondary" />
          </div>

          <p className="text-base font-semibold text-text-primary leading-snug">
            {heading}
          </p>
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <ChatInput
            onSend={sendMessage}
            disabled={isStreaming}
          />
        </div>
      </div>
    )
  }

  if (!isMobile) {
    if (!isDesktopExpanded) {
      return (
        <div className="h-full p-3">
          <button
            type="button"
            onClick={showPanel}
            className="h-full w-full rounded-2xl border border-border bg-surface-0 px-4 py-5 text-left transition-colors hover:bg-surface-1"
            aria-label="Expand AI assistant"
          >
            <div className="flex h-full flex-col items-start gap-5">
              <div className="flex size-10 items-center justify-center rounded-full bg-surface-2">
                <Bot size={18} className="text-text-secondary" />
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-semibold tracking-wide text-text-primary">LAVA AI</p>
                <p className="max-w-[10rem] text-xs leading-5 text-text-secondary">
                  Click to open chat
                </p>
              </div>

              <div className="mt-auto inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-text-primary">
                <ChevronLeft size={14} />
                Expand
              </div>
            </div>
          </button>
        </div>
      )
    }

    return (
      <div className="h-full bg-surface-0 flex flex-col overflow-hidden">
        <div className="h-11 flex items-center px-4 border-b border-border gap-2 shrink-0">
          <Bot size={15} className="text-text-secondary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">LAVA AI</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            disabled={!canClearContext || isStreaming}
            className="rounded-full px-2.5"
            title="Clear current context"
          >
            <Trash2 size={13} />
            Clear
          </Button>
          <button
            onClick={hidePanel}
            aria-label="Collapse"
            className="flex items-center justify-center size-7 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {renderContent()}
      </div>
    )
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={hidePanel}
        />
      )}

      <div
        className={cn(
          'fixed bottom-6 right-6 w-[380px] bg-surface-0 border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40',
          'transition-all duration-200 ease-out origin-bottom-right',
          mobileOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-3 pointer-events-none',
        )}
        style={{ maxHeight: 'min(560px, calc(100vh - 108px))' }}
      >
        <div className="h-11 flex items-center px-4 border-b border-border gap-2 shrink-0">
          <Bot size={15} className="text-text-secondary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">LAVA AI</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearMessages}
            disabled={!canClearContext || isStreaming}
            className="shrink-0"
            title="Clear current context"
            aria-label="Clear current context"
          >
            <Trash2 size={13} />
          </Button>
          <button
            onClick={hidePanel}
            aria-label="Close"
            className="flex items-center justify-center size-6 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {renderContent()}
      </div>
    </>
  )
}
