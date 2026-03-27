import { useAgentStore } from '@/stores/agentStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { usePracticeAssistStore } from '@/stores/practiceAssistStore'
import { useToneStore } from '@/stores/toneStore'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { getQuickActionsForSpace, type QuickActionDefinition } from './QuickActions'
import { Bot, Music, Mic, Lightbulb, BookOpen, CalendarDays, Search, Sparkles, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useAgent } from '@/hooks/useAgent'
import { useCallback, useEffect, useRef } from 'react'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'
import { buildPracticeSummary, getPracticeStatusText } from '@/utils/practiceAssist'

const ACTION_ICONS = {
  'Find a song to practice': Search,
  'Beginner recommendations': Sparkles,
  'Break down a song': BookOpen,
  'Start a practice plan': CalendarDays,
  'Practice plan': CalendarDays,
  'Review My Play': Mic,
  'End Review': Mic,
  'How to play this': BookOpen,
  'Chord breakdown': Music,
  'Fingering tips': Lightbulb,
  'Technique tips': Lightbulb,
  'Tone presets': Music,
  'Suggest scale': Music,
  'Effects chain': Lightbulb,
  'Metronome drill': Bot,
  'Record session': Mic,
  'Add backing track': Music,
  'Make it cleaner': Sparkles,
  'Add gain': Music,
  'Explain this chain': BookOpen,
  'Match Mayer clean': Sparkles,
  'Add ambience': Lightbulb,
  'Tighten low end': Bot,
  'Chord suggestion': BookOpen,
  'Chord progression': BookOpen,
  'Section structure': CalendarDays,
  'Bridge idea': Sparkles,
  'Arrangement notes': Lightbulb,
  'Lyric rhythm': Music,
  'Practice tips': Lightbulb,
  'How to mix': Bot,
  Export: Bot,
  'Export lead sheet': Bot,
} as const

const PANEL_HEADINGS: Record<string, string> = {
  home: 'What do you want to practice?',
  learn: 'How can I help with this song?',
  jam: 'What kind of session do you want to shape?',
  tone: 'Tone Copilot',
  create: 'What do you want to write or arrange?',
  projects: 'What would you like to open or organize?',
  library: 'What do you want to revisit?',
}

export function AgentPanel() {
  const { canShowPanel, isMobile, desktopMode, mobileOpen, showPanel, hidePanel } = useAgentPanelControls()
  const messages = useAgentStore((s) => s.messages)
  const toolActivities = useAgentStore((s) => s.toolActivities)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const currentSpace = useAgentStore((s) => s.spaceContext.currentSpace)
  const currentProjectId = useAgentStore((s) => s.spaceContext.projectId)
  const toneContext = useAgentStore((s) => s.spaceContext.toneContext)
  const clearMessages = useAgentStore((s) => s.clearMessages)
  const practiceStatus = usePracticeAssistStore((s) => s.status)
  const startReview = usePracticeAssistStore((s) => s.startReview)
  const retryPermission = usePracticeAssistStore((s) => s.retryPermission)
  const endReview = usePracticeAssistStore((s) => s.endReview)
  const clearReview = usePracticeAssistStore((s) => s.clearReview)
  const { sendMessage, handleChipClick, applyToneAction, undoToneAction, retryToneAction } = useAgent()
  const selectedPreset = useToneStore((s) => s.selectedPreset)
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
  const isLearnSurface = currentSpace === 'learn'
  const isToneSurface = currentSpace === 'tone'
  const welcomeActions = getQuickActionsForSpace(currentSpace)
  const heading = PANEL_HEADINGS[currentSpace] ?? 'What can I help with?'
  const practiceStatusText = getPracticeStatusText('review', practiceStatus)
  const toneSubtitle = toneContext
    ? `${toneContext.selectedPresetName} · ${toneContext.chainSummary.filter((item) => item !== 'Empty').length} pedals`
    : `${selectedPreset} tone`

  if (!canShowPanel) {
    return null
  }

  const handlePracticeAction = async (action: QuickActionDefinition) => {
    if (action.kind === 'start_review') {
      if (!currentProjectId) return
      await startReview(currentProjectId)
      return
    }

    if (action.kind === 'end_review') {
      endReview(buildPracticeSummary(useLeadSheetStore.getState().sections))
      return
    }

    sendMessage(action.prompt)
  }

  const renderPracticePanelCard = () => {
    if (currentSpace !== 'learn' || !currentProjectId) return null

    const subtitle =
      practiceStatus === 'permission'
        ? 'Allow mic to start.'
        : practiceStatus === 'arming'
          ? 'Start playing when ready.'
          : practiceStatus === 'listening'
            ? 'Play through once, then end the pass.'
            : practiceStatus === 'summary'
              ? 'Quick take. Run it again if needed.'
              : 'Onsite coaching for this song.'

    return (
      <div className="rounded-2xl border border-border bg-surface-1/85 p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">AI Assisted Practice</p>
              <p className="mt-0.5 text-xs text-text-secondary">{practiceStatusText ?? subtitle}</p>
            </div>
            {practiceStatusText && (
              <span className="shrink-0 rounded-full border border-border bg-surface-0 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                {practiceStatusText}
              </span>
            )}
          </div>

          {!practiceStatusText && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="rounded-full px-3" onClick={() => void startReview(currentProjectId)}>Review My Play</Button>
            </div>
          )}

          {practiceStatusText && (
            <div className="flex flex-wrap gap-2">
              {practiceStatus === 'permission' && (
                <>
                  <Button size="sm" className="rounded-full px-3" onClick={() => void retryPermission()}>Allow Mic</Button>
                  <Button size="sm" variant="outline" className="rounded-full px-3" onClick={() => void retryPermission()}>Try Again</Button>
                </>
              )}
              {practiceStatus === 'summary' && (
                <Button size="sm" className="rounded-full px-3" onClick={() => void startReview(currentProjectId)}>Review My Play</Button>
              )}
              {practiceStatus === 'listening' && (
                <Button size="sm" className="rounded-full px-3" onClick={() => endReview(buildPracticeSummary(useLeadSheetStore.getState().sections))}>
                  End Review
                </Button>
              )}
              {practiceStatus === 'summary' && (
                <Button size="sm" variant="outline" className="rounded-full px-3" onClick={clearReview}>Done</Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
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
                onApplyToneAction={applyToneAction}
                onUndoToneAction={undoToneAction}
                onRetryToneAction={retryToneAction}
              />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{ id: 'streaming', role: 'assistant', content: streamingContent, createdAt: Date.now() }}
                isStreaming
                onApplyToneAction={applyToneAction}
                onUndoToneAction={undoToneAction}
                onRetryToneAction={retryToneAction}
              />
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 border-t border-border shrink-0 flex flex-col gap-2">
            {isLearnSurface && renderPracticePanelCard()}
            <ChatInput
              onSend={sendMessage}
              disabled={isStreaming}
              compact
              placeholder={isToneSurface ? 'Describe the tone you want...' : undefined}
            />
          </div>
        </>
      )
    }

    if (isLearnSurface) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" />

          <div className="px-3 py-3 border-t border-border shrink-0 flex flex-col gap-2">
            {renderPracticePanelCard()}
            <ChatInput
              onSend={sendMessage}
              disabled={isStreaming}
              compact
              placeholder={isToneSurface ? 'Describe the tone you want...' : undefined}
            />
          </div>
        </div>
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
          {isToneSurface && (
            <p className="text-sm leading-6 text-text-secondary">
              {toneSubtitle}
            </p>
          )}

          <div className="flex flex-col">
            {welcomeActions.map((action) => {
              const Icon = ACTION_ICONS[action.label as keyof typeof ACTION_ICONS] ?? Bot

              return (
                <button
                  key={action.label}
                  onClick={() => void handlePracticeAction(action)}
                  disabled={isStreaming}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors text-left w-full disabled:opacity-40"
                >
                  <Icon size={15} className="shrink-0 text-text-muted" />
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <ChatInput
            onSend={sendMessage}
            disabled={isStreaming}
            placeholder={isToneSurface ? 'Describe the tone you want...' : undefined}
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
                <p className="text-sm font-semibold tracking-wide text-text-primary">{isToneSurface ? 'Tone Copilot' : 'LAVA AI'}</p>
                <p className="max-w-[10rem] text-xs leading-5 text-text-secondary">
                  {isToneSurface ? 'Open tone chat' : 'Click to open chat'}
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
            <p className="text-sm font-medium">{isToneSurface ? 'Tone Copilot' : 'LAVA AI'}</p>
            {isToneSurface && <p className="text-[11px] text-text-secondary truncate">{toneSubtitle}</p>}
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
            <p className="text-sm font-medium">{isToneSurface ? 'Tone Copilot' : 'LAVA AI'}</p>
            {isToneSurface && <p className="text-[11px] text-text-secondary truncate">{toneSubtitle}</p>}
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
