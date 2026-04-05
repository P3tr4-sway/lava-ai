import { Sparkles, Music2, Guitar, Mic2, Hand, Scissors, Zap, RefreshCw, Sliders } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface EditorChatEmptyStateProps {
  onSuggestionClick: (text: string) => void
  selectedBars: number[]
  className?: string
}

const GLOBAL_GROUPS = [
  {
    title: 'Quick Starts',
    items: [
      { icon: Sparkles, label: 'More teachable', prompt: 'Make this version easier to teach and learn' },
      { icon: Hand, label: 'Open chords', prompt: 'Rearrange this song to use only open chords' },
      { icon: Sliders, label: 'Simplify rhythm', prompt: 'Simplify the rhythm in this version' },
      { icon: Mic2, label: 'Transpose', prompt: 'Transpose this song to fit this singer better' },
    ],
  },
  {
    title: 'Style',
    items: [
      { icon: Guitar, label: 'Fingerstyle', prompt: 'Create a fingerstyle version of this song' },
      { icon: Music2, label: 'Blues', prompt: 'Create a blues arrangement of this song' },
      { icon: RefreshCw, label: 'Fresh cover', prompt: 'Create a fresh cover arrangement of this song' },
    ],
  },
] as const

function getSectionSuggestions(bars: number[]) {
  const min = Math.min(...bars) + 1
  const max = Math.max(...bars) + 1
  const range = min === max ? `bar ${min}` : `bars ${min}–${max}`
  return [
    {
      title: 'Quick Starts',
      items: [
        { icon: Scissors, label: 'Simplify section', prompt: `Simplify ${range}` },
        { icon: Hand, label: 'Open chords', prompt: `Use simpler open chords in ${range}` },
        { icon: Sliders, label: 'Simplify rhythm', prompt: `Simplify the rhythm in ${range}` },
        { icon: Sparkles, label: 'Add fills', prompt: `Add fills and embellishments to ${range}` },
      ],
    },
    {
      title: 'Style',
      items: [
        { icon: Zap, label: 'Solo section', prompt: `Turn ${range} into a guitar solo section` },
        { icon: RefreshCw, label: 'New strumming', prompt: `Change the strumming pattern for ${range}` },
        { icon: Music2, label: 'Change chords', prompt: `Suggest alternative chords for ${range}` },
      ],
    },
  ] as const
}

export function EditorChatEmptyState({ onSuggestionClick, selectedBars, className }: EditorChatEmptyStateProps) {
  const hasBarsSelected = selectedBars.length > 0
  const groups = hasBarsSelected ? getSectionSuggestions(selectedBars) : GLOBAL_GROUPS
  return (
    <div className={cn('flex flex-1 flex-col justify-start gap-8 px-5 py-6', className)}>
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.title} className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
              {group.title}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => onSuggestionClick(item.prompt)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface-0 px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/10"
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
