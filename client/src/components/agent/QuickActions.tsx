import { useAgentStore } from '@/stores/agentStore'

// ─── Quick actions per space ─────────────────────────────────────────────────

const ACTIONS: Record<string, { label: string; prompt: string }[]> = {
  learn: [
    { label: 'Practice plan', prompt: 'Create a practice plan for this song' },
    { label: 'How to play this', prompt: 'How do I play the current section?' },
    { label: 'Chord breakdown', prompt: 'Break down the chords in this piece' },
    { label: 'Fingering tips', prompt: 'Suggest fingering for this passage' },
    { label: 'Technique tips', prompt: 'What techniques should I focus on here?' },
    { label: 'Record snippet', prompt: 'Record a quick snippet of my playing for feedback' },
    { label: 'Coaching style', prompt: 'I want to change my coaching style' },
  ],
  jam: [
    { label: 'Tone presets', prompt: 'Show me tone presets for this practice session' },
    { label: 'Suggest scale', prompt: 'What scale works over this progression?' },
    { label: 'Effects chain', prompt: 'Set up an effects chain for my tone' },
    { label: 'Metronome drill', prompt: 'Set up a metronome exercise for this tempo' },
    { label: 'Record session', prompt: 'Record this practice session' },
    { label: 'Add backing track', prompt: 'Generate a backing track to practice with' },
  ],
  create: [
    { label: 'Tone presets', prompt: 'Browse tone presets for this project' },
    { label: 'Effects chain', prompt: 'Apply effects to this track' },
    { label: 'Chord suggestion', prompt: 'Suggest chords that fit this progression' },
    { label: 'Practice tips', prompt: 'Give me practice tips for what I just wrote' },
    { label: 'How to mix', prompt: 'How should I mix these tracks?' },
    { label: 'Export', prompt: 'Export this project' },
  ],
}

const DEFAULT_ACTIONS = [
  { label: 'Practice plan', prompt: 'Help me create a practice plan' },
  { label: 'Song breakdown', prompt: 'Break down a song into something I can practice' },
  { label: 'Get started', prompt: 'How do I get started practicing?' },
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
