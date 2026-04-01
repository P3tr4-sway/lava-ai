import { cn } from '@/components/ui/utils'

type DurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th'

interface DurationPaletteProps {
  currentDuration?: string
  dotted?: boolean
  triplet?: boolean
  onDurationSelect: (type: DurationType, divisions: number) => void
  onToggleDot: () => void
  onToggleTriplet: () => void
  x: number
  y: number
  visible: boolean
  className?: string
}

const DURATIONS: { type: DurationType; label: string; divisions: number }[] = [
  { type: 'whole',   label: '1',    divisions: 4 },
  { type: 'half',    label: '½',    divisions: 2 },
  { type: 'quarter', label: '¼',    divisions: 1 },
  { type: 'eighth',  label: '⅛',   divisions: 0.5 },
  { type: '16th',    label: '1/16', divisions: 0.25 },
]

export function DurationPalette({
  currentDuration, dotted, triplet,
  onDurationSelect, onToggleDot, onToggleTriplet,
  x, y, visible, className,
}: DurationPaletteProps) {
  if (!visible) return null

  return (
    <div
      className={cn(
        'absolute bg-surface-1 border border-border rounded-lg shadow-xl p-2 z-40 animate-fade-in',
        className,
      )}
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
    >
      {/* Duration buttons */}
      <div className="flex gap-1">
        {DURATIONS.map((d) => (
          <button
            key={d.type}
            onClick={() => onDurationSelect(d.type, d.divisions)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-xs transition-colors',
              currentDuration === d.type
                ? 'bg-surface-3 text-text-primary font-medium'
                : 'text-text-secondary hover:bg-surface-2',
            )}
          >
            <span className="text-sm font-mono">{d.label}</span>
          </button>
        ))}
      </div>

      {/* Dot + Triplet toggles */}
      <div className="flex gap-1 mt-1 pt-1 border-t border-border">
        <button
          onClick={onToggleDot}
          className={cn(
            'flex-1 text-center px-2 py-1 rounded-md text-xs transition-colors',
            dotted ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-2',
          )}
        >
          Dot •
        </button>
        <button
          onClick={onToggleTriplet}
          className={cn(
            'flex-1 text-center px-2 py-1 rounded-md text-xs transition-colors',
            triplet ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:bg-surface-2',
          )}
        >
          Triplet 3
        </button>
      </div>
    </div>
  )
}
