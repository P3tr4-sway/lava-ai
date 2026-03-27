import { Bot, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useCoachStore } from '@/stores/coachStore'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'
import { usePracticeAssistStore } from '@/stores/practiceAssistStore'

interface CoachBarProps {
  className?: string
  tip: string | null
}

export function CoachBar({ className, tip }: CoachBarProps) {
  const { coachBarCollapsed, setCoachBarCollapsed, coachingStyle } = useCoachStore()
  const practiceStatus = usePracticeAssistStore((s) => s.status)
  const { showPanel } = useAgentPanelControls()

  const displayText =
    (practiceStatus === 'permission'
      ? 'Mic access needed'
      : practiceStatus === 'arming'
        ? 'Getting ready...'
        : practiceStatus === 'summary'
          ? 'Summary ready'
          : practiceStatus === 'listening'
            ? 'Review in progress'
            : tip ?? (coachingStyle === 'passive'
              ? 'AI practice ready.'
              : coachingStyle === 'checkpoint'
                ? 'Working on your current goal...'
                : 'AI practice ready.'))

  if (coachBarCollapsed) {
    return (
      <button
        onClick={() => setCoachBarCollapsed(false)}
        aria-label="Expand coach bar"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 bg-surface-1 border-b border-border text-text-muted text-xs hover:text-text-secondary transition-colors',
          className,
        )}
      >
        <Bot size={14} />
        <ChevronUp size={12} />
      </button>
    )
  }

  const handleBarClick = (e: React.MouseEvent) => {
    // On mobile, tapping the bar opens the agent panel
    // Only if the click wasn't on an interactive child (button)
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    showPanel()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-surface-1 border-b border-border cursor-pointer md:cursor-default',
        className,
      )}
      onClick={handleBarClick}
    >
      <Bot size={16} className="flex-shrink-0 text-text-secondary" />
      <span className="flex-1 text-sm text-text-primary truncate">
        {displayText}
      </span>
      <button
        onClick={showPanel}
        aria-label="Open chat"
        className="hidden md:flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-text-secondary bg-surface-2 border border-border rounded-full hover:bg-surface-3 hover:text-text-primary transition-colors"
      >
        <MessageCircle size={10} />
        Chat
      </button>
      <button
        onClick={() => setCoachBarCollapsed(true)}
        aria-label="Collapse coach bar"
        className="text-text-muted hover:text-text-secondary transition-colors"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
