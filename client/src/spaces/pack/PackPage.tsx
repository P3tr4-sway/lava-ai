import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Share2, ArrowLeft } from 'lucide-react'
import { MetadataBar, LeadSheetPlaybackBar, ScoreVersionRail, FollowView } from '@/components/score'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { ChatMessage } from '@/components/agent/ChatMessage'
import { Button } from '@/components/ui'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAgentStore } from '@/stores/agentStore'
import { useAgent } from '@/hooks/useAgent'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/components/ui/utils'

export function PackPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const chatRef = useRef<ChatInputRef>(null)

  // Score state — leadSheetStore has individual fields, not a metadata object
  const arrangements = useLeadSheetStore((s) => s.arrangements)
  const selectedArrangementId = useLeadSheetStore((s) => s.selectedArrangementId)
  const selectArrangement = useLeadSheetStore((s) => s.selectArrangement)
  const key = useLeadSheetStore((s) => s.key)
  const tempo = useLeadSheetStore((s) => s.tempo)
  const timeSignature = useLeadSheetStore((s) => s.timeSignature)

  // Agent — messages/streaming live on agentStore, not useAgent return
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const { sendMessage } = useAgent()

  // Chat panel visibility (mobile)
  const [chatOpen, setChatOpen] = useState(false)

  const handleSend = (text: string) => {
    if (!text.trim()) return
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with back + actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" title="Export">
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Share">
            <Share2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Score zone */}
      <div className={cn('flex flex-col', isMobile ? 'flex-1' : 'h-[70%]', 'overflow-hidden')}>
        {/* Metadata — individual store fields, not a metadata object */}
        <MetadataBar
          keyValue={key || 'C'}
          timeSignature={timeSignature || '4/4'}
          tempo={tempo || 120}
          className="px-4 py-2 border-b border-border"
        />

        {/* Version rail — renders null internally when arrangements.length <= 1 */}
        <ScoreVersionRail
          arrangements={arrangements}
          selectedArrangementId={selectedArrangementId}
          onSelect={(arrId) => selectArrangement(arrId)}
          className="px-4 py-2 border-b border-border"
        />

        {/* Score viewer */}
        <div className="flex-1 overflow-y-auto p-4">
          <FollowView />
        </div>

        {/* Playback controls */}
        <LeadSheetPlaybackBar
          totalBars={16}
          beatsPerBar={4}
          className="border-t border-border"
        />
      </div>

      {/* AI Chat zone */}
      {isMobile ? (
        <>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center justify-center py-2 border-t border-border bg-surface-1 text-sm text-text-secondary"
          >
            {chatOpen ? 'Hide AI Editor' : 'AI Editor'}
          </button>
          {chatOpen && (
            <div className="h-[40vh] flex flex-col border-t border-border">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <ChatMessage key={i} message={msg} />
                ))}
                {messages.length === 0 && (
                  <p className="text-sm text-text-muted text-center py-8">
                    Ask the AI to edit your arrangement — change key, simplify, restyle...
                  </p>
                )}
              </div>
              <div className="p-3 border-t border-border">
                <ChatInput ref={chatRef} onSend={handleSend} disabled={isStreaming} compact placeholder="Edit arrangement..." />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="h-[30%] flex flex-col border-t border-border">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">
                Ask the AI to edit your arrangement — change key, simplify, restyle...
              </p>
            )}
          </div>
          <div className="p-3 border-t border-border">
            <ChatInput ref={chatRef} onSend={handleSend} disabled={isStreaming} compact placeholder="Edit arrangement..." />
          </div>
        </div>
      )}
    </div>
  )
}
