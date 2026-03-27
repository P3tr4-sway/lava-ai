import { useAgentStore } from '@/stores/agentStore'
import { usePracticeAssistStore } from '@/stores/practiceAssistStore'

// ─── Quick actions per space ─────────────────────────────────────────────────

export interface QuickActionDefinition {
  label: string
  prompt: string
  kind?: 'prompt' | 'start_review' | 'end_review'
}

const HOME_ACTIONS: QuickActionDefinition[] = [
  { label: 'Find a song to practice', prompt: 'Find a song to practice' },
  { label: 'Beginner recommendations', prompt: 'Give me beginner recommendations' },
  { label: 'Break down a song', prompt: 'Break down a song' },
  { label: 'Start a practice plan', prompt: 'Start a practice plan' },
]

const ACTIONS: Record<string, QuickActionDefinition[]> = {
  home: HOME_ACTIONS,
  learn: [
    { label: 'Practice plan', prompt: 'Create a practice plan for this song' },
    { label: 'How to play this', prompt: 'How do I play the current section?' },
    { label: 'Chord breakdown', prompt: 'Break down the chords in this piece' },
    { label: 'Fingering tips', prompt: 'Suggest fingering for this passage' },
  ],
  jam: [
    { label: 'Tone presets', prompt: 'Show me tone presets for this practice session' },
    { label: 'Suggest scale', prompt: 'What scale works over this progression?' },
    { label: 'Effects chain', prompt: 'Set up an effects chain for my tone' },
    { label: 'Metronome drill', prompt: 'Set up a metronome exercise for this tempo' },
    { label: 'Record session', prompt: 'Record this practice session' },
    { label: 'Add backing track', prompt: 'Generate a backing track to practice with' },
  ],
  tone: [
    { label: 'Make it cleaner', prompt: 'Make it cleaner' },
    { label: 'Add gain', prompt: 'Add gain' },
    { label: 'Explain this chain', prompt: 'Explain this chain' },
    { label: 'Match Mayer clean', prompt: 'Match John Mayer clean' },
    { label: 'Add ambience', prompt: 'Add ambience' },
    { label: 'Tighten low end', prompt: 'Tighten low end' },
  ],
  create: [
    { label: 'Chord progression', prompt: 'Help me write a chord progression for this song' },
    { label: 'Section structure', prompt: 'Suggest a clear section structure for this lead sheet' },
    { label: 'Bridge idea', prompt: 'Suggest a bridge or contrasting section for this arrangement' },
    { label: 'Arrangement notes', prompt: 'Give me arrangement notes for what I have so far' },
    { label: 'Lyric rhythm', prompt: 'Help me shape the lyric rhythm and phrasing for this section' },
    { label: 'Export lead sheet', prompt: 'Help me prepare this lead sheet for export' },
  ],
}

export function getQuickActionsForSpace(currentSpace?: string): QuickActionDefinition[] {
  if (currentSpace === 'learn') {
    const { mode, status } = usePracticeAssistStore.getState()
    const actions = [...ACTIONS.learn]

    if (mode === 'review' && status === 'listening') {
      actions.push({ label: 'End Review', prompt: 'End review', kind: 'end_review' })
    }

    return actions
  }

  return ACTIONS[currentSpace ?? ''] ?? HOME_ACTIONS
}

// ─── Component ───────────────────────────────────────────────────────────────

interface QuickActionsProps {
  onAction: (action: QuickActionDefinition) => void
  disabled?: boolean
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  const currentSpace = useAgentStore((s) => s.spaceContext.currentSpace)
  const actions = getQuickActionsForSpace(currentSpace)

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => !disabled && onAction(action)}
          disabled={disabled}
          className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-3 hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
