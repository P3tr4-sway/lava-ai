import { Sparkles, Music2, Guitar, Mic2, Hand, Palette, Scissors, Zap, RefreshCw, Sliders } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface EditorChatEmptyStateProps {
  onSuggestionClick: (text: string) => void
  selectedBars: number[]
  className?: string
}

const GLOBAL_SUGGESTIONS = [
  { icon: Sparkles, label: 'Make easier', prompt: 'Make an easier version of this song' },
  { icon: Music2, label: 'Blues version', prompt: 'Create a blues arrangement of this song' },
  { icon: Guitar, label: 'Fingerpicking', prompt: 'Create a fingerpicking version of this song' },
  { icon: Mic2, label: 'Transpose for my voice', prompt: 'Transpose this song to suit my vocal range' },
  { icon: Hand, label: 'Open chords', prompt: 'Rearrange this song to use only open chords' },
  { icon: Palette, label: 'Unique cover version', prompt: 'Create a unique cover arrangement of this song' },
] as const

function getSectionSuggestions(bars: number[]) {
  const min = Math.min(...bars) + 1
  const max = Math.max(...bars) + 1
  const range = min === max ? `bar ${min}` : `bars ${min}–${max}`
  return [
    { icon: Scissors, label: 'Simplify this section', prompt: `Simplify ${range}` },
    { icon: Zap, label: 'Make this the solo', prompt: `Turn ${range} into a guitar solo section` },
    { icon: RefreshCw, label: 'Different strumming', prompt: `Change the strumming pattern for ${range}` },
    { icon: Sparkles, label: 'Add fills', prompt: `Add fills and embellishments to ${range}` },
    { icon: Music2, label: 'Change chords', prompt: `Suggest alternative chords for ${range}` },
    { icon: Sliders, label: 'Simplify rhythm', prompt: `Simplify the rhythm in ${range}` },
  ] as const
}

export function EditorChatEmptyState({ onSuggestionClick, selectedBars, className }: EditorChatEmptyStateProps) {
  const hasBarsSelected = selectedBars.length > 0
  const suggestions = hasBarsSelected ? getSectionSuggestions(selectedBars) : GLOBAL_SUGGESTIONS
  const heading = hasBarsSelected ? 'Transform this section' : 'Transform your song'

  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-6 px-6', className)}>
      <h3 className="text-base font-semibold text-text-primary">{heading}</h3>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            type="button"
            key={s.label}
            onClick={() => onSuggestionClick(s.prompt)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            <s.icon className="size-4" aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
