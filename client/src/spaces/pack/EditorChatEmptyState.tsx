import { Music, ArrowRightLeft, Layers, Mic, Sparkles, ListPlus } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface EditorChatEmptyStateProps {
  onSuggestionClick: (text: string) => void
  className?: string
}

const SUGGESTIONS = [
  { icon: Layers, label: 'Arrange for band', prompt: 'Arrange this score for a full band' },
  { icon: ArrowRightLeft, label: 'Transpose to...', prompt: 'Transpose this score to ' },
  { icon: Music, label: 'Add chord progression', prompt: 'Add a chord progression for ' },
  { icon: Mic, label: 'Generate accompaniment', prompt: 'Generate an accompaniment for this score' },
  { icon: Sparkles, label: 'Simplify chords', prompt: 'Simplify the chords in this score' },
  { icon: ListPlus, label: 'Add intro/outro', prompt: 'Add an intro and outro to this score' },
] as const

export function EditorChatEmptyState({ onSuggestionClick, className }: EditorChatEmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-6 px-6', className)}>
      <h3 className="text-base font-semibold text-text-primary">Try these Lava Skills</h3>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
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
