import { useRef, useState, useCallback, useEffect } from 'react'
import { MessageSquarePlus, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { ChatMessage } from '@/components/agent/ChatMessage'
import { useAgentStore } from '@/stores/agentStore'
import { useAgent } from '@/hooks/useAgent'
import { useEditorStore } from '@/stores/editorStore'
import { useVersionStore } from '@/stores/versionStore'
import { EditorChatEmptyState } from './EditorChatEmptyState'
import type { AgentMessage } from '@lava/shared'

interface EditorChatPanelProps {
  className?: string
}

export function EditorChatPanel({ className }: EditorChatPanelProps) {
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const clearMessages = useAgentStore((s) => s.clearMessages)

  const { sendMessage, handleChipClick } = useAgent()
  const chatInputRef = useRef<ChatInputRef>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const collapsed = useEditorStore((s) => s.chatPanelCollapsed)
  const toggleChat = useEditorStore((s) => s.toggleChatPanel)
  const width = useEditorStore((s) => s.chatPanelWidth)
  const setChatPanelWidth = useEditorStore((s) => s.setChatPanelWidth)
  const selectedBars = useEditorStore((s) => s.selectedBars)

  const [resizing, setResizing] = useState(false)

  const handlePreviewVersion = useCallback((versionId: string) => {
    useVersionStore.getState().startPreview(versionId)
  }, [])

  const handleApplyVersion = useCallback((versionId: string) => {
    useVersionStore.getState().applyVersion(versionId)
  }, [])

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, streamingContent])

  // Resize drag handler — dragging left makes panel wider
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      setResizing(true)
      const startX = e.clientX
      const startWidth = width

      function onMove(ev: PointerEvent) {
        const delta = startX - ev.clientX
        setChatPanelWidth(startWidth + delta)
      }
      function onEnd() {
        setResizing(false)
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onEnd)
        target.removeEventListener('pointercancel', onEnd)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onEnd)
      target.addEventListener('pointercancel', onEnd)
    },
    [width, setChatPanelWidth],
  )

  function handleSuggestionClick(text: string) {
    chatInputRef.current?.setValue(text)
    chatInputRef.current?.focus()
  }

  const visibleMessages = messages.filter((m) => !m.hidden)
  const hasMessages = visibleMessages.length > 0

  const streamingMessage: AgentMessage | null =
    isStreaming && streamingContent
      ? {
          id: 'streaming',
          role: 'assistant',
          content: streamingContent,
          createdAt: Date.now(),
        }
      : null

  // Collapsed state — thin 40px strip with toggle icon
  if (collapsed) {
    return (
      <div className={cn('flex w-10 flex-col items-center border-l border-black/8 bg-white pt-3', className)}>
        <button
          onClick={toggleChat}
          className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          aria-label="Open chat panel"
          type="button"
        >
          <PanelRightOpen className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn('relative flex flex-col border-l border-black/8 bg-white', className)}
      style={{ width, minWidth: 320, maxWidth: '50vw' }}
    >
      {/* Resize handle — left edge drag target */}
      <div
        onPointerDown={handleResizeStart}
        className={cn(
          'absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-accent/20',
          resizing && 'bg-accent/20',
        )}
      />

      {/* Header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-black/8 px-5">
        <span className="text-sm font-semibold text-text-primary">New chat</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearMessages}
            className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          <button
            type="button"
            onClick={toggleChat}
            className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            aria-label="Collapse chat panel"
          >
            <PanelRightClose className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {hasMessages ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {visibleMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onChipClick={handleChipClick}
                onPreviewVersion={handlePreviewVersion}
                onApplyVersion={handleApplyVersion}
              />
            ))}
            {streamingMessage && (
              <ChatMessage
                message={streamingMessage}
                isStreaming
                onPreviewVersion={handlePreviewVersion}
                onApplyVersion={handleApplyVersion}
              />
            )}
          </div>
        </div>
      ) : (
        <EditorChatEmptyState onSuggestionClick={handleSuggestionClick} selectedBars={selectedBars} />
      )}

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-black/8 px-4 py-3">
        {selectedBars.length > 0 && (
          <div className="mb-1.5 flex">
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs text-text-secondary">
              Selected: bars {selectedBars.reduce((a, b) => Math.min(a, b)) + 1}–{selectedBars.reduce((a, b) => Math.max(a, b)) + 1}
            </span>
          </div>
        )}
        <ChatInput
          ref={chatInputRef}
          onSend={sendMessage}
          disabled={isStreaming}
          compact
          placeholder="Start with an idea..."
        />
      </div>
    </div>
  )
}
