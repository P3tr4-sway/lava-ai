import { useAgentStore } from '@/stores/agentStore'

// ─── Quick actions per space ─────────────────────────────────────────────────

const ACTIONS: Record<string, { label: string; prompt: string }[]> = {
  learn: [
    { label: 'Score analysis', prompt: 'Analyze the current score and highlight key sections' },
    { label: 'How to play this', prompt: 'How do I play the current section?' },
    { label: 'Chord breakdown', prompt: 'Break down the chords in this piece' },
    { label: 'Fingering tips', prompt: 'Suggest fingering for this passage' },
    { label: 'Simplify section', prompt: 'Simplify the current section for a beginner' },
  ],
  jam: [
    { label: 'Sound presets', prompt: 'Show me sound presets for this jam session' },
    { label: 'Suggest scale', prompt: 'What scale works over this progression?' },
    { label: 'Add backing track', prompt: 'Generate a backing track for this jam' },
    { label: 'Loop section', prompt: 'Loop the current section for practice' },
    { label: 'Change tempo', prompt: 'Adjust the tempo of this session' },
  ],
  create: [
    { label: 'Sound presets', prompt: 'Browse sound presets for this project' },
    { label: 'Chord suggestion', prompt: 'Suggest chords that fit this progression' },
    { label: 'How to mix', prompt: 'How should I mix these tracks?' },
    { label: 'Add melody', prompt: 'Generate a melody over this arrangement' },
    { label: 'Export options', prompt: 'What are my export options?' },
  ],
}

const DEFAULT_ACTIONS = [
  { label: 'Sound presets', prompt: 'Show me available sound presets' },
  { label: 'How to...', prompt: 'How do I get started?' },
  { label: 'Score analysis', prompt: 'Analyze a score for me' },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface QuickActionsProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function QuickActions({ onSend, disabled }: QuickActionsProps) {
  const currentSpace = useAgentStore((s) => s.spaceContext.currentSpace)
  const actions = ACTIONS[currentSpace ?? ''] ?? DEFAULT_ACTIONS

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => !disabled && onSend(action.prompt)}
          disabled={disabled}
          className="px-2.5 py-1 text-2xs font-medium text-text-secondary bg-surface-2 border border-border rounded-full hover:bg-surface-3 hover:border-border-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
