import { cn } from '@/components/ui/utils'
import { STANDARD_TUNING, fretToMidi, midiToFret } from '@/lib/pitchUtils'

interface MiniFretboardProps {
  currentMidi?: number
  onFretSelect: (midi: number) => void
  x: number
  y: number
  visible: boolean
  className?: string
}

const STRING_LABELS = ['E', 'B', 'G', 'D', 'A', 'E']
const FRET_COUNT = 12
const DOT_FRETS = [3, 5, 7, 9]
const DOUBLE_DOT_FRETS = [12]

export function MiniFretboard({ currentMidi, onFretSelect, x, y, visible, className }: MiniFretboardProps) {
  if (!visible) return null

  const currentPositions = currentMidi != null ? midiToFret(currentMidi, STANDARD_TUNING) : []

  const isHighlighted = (string: number, fret: number) =>
    currentPositions.some((p) => p.string === string && p.fret === fret)

  return (
    <div
      className={cn(
        'absolute bg-surface-1 border border-border rounded-lg shadow-xl p-3 z-40 animate-fade-in',
        className,
      )}
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
    >
      {/* Fret numbers */}
      <div className="flex ml-8 mb-1">
        {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
          <div key={i} className="w-5 text-center text-[10px] text-text-muted">
            {i === 0 ? '' : i}
          </div>
        ))}
      </div>

      {/* Strings */}
      {STRING_LABELS.map((label, stringVisualIdx) => {
        const stringNum = stringVisualIdx + 1 // 1=high E, 6=low E
        return (
          <div key={stringNum} className="flex items-center h-5">
            <span className="w-8 text-right pr-2 text-[10px] text-text-secondary font-mono">
              {label}
            </span>
            {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => (
              <button
                key={fret}
                onClick={() => onFretSelect(fretToMidi(stringNum, fret, STANDARD_TUNING))}
                className={cn(
                  'w-5 h-5 flex items-center justify-center border-r border-border transition-colors',
                  fret === 0 ? 'border-r-2 border-r-text-primary' : '',
                  isHighlighted(stringNum, fret)
                    ? 'bg-accent text-surface-0 rounded-full'
                    : 'hover:bg-surface-3',
                )}
              >
                {isHighlighted(stringNum, fret) && (
                  <div className="size-3 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>
        )
      })}

      {/* Dot markers row */}
      <div className="flex ml-8 mt-1">
        {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
          <div key={i} className="w-5 flex justify-center">
            {DOT_FRETS.includes(i) && <div className="size-1.5 rounded-full bg-text-muted" />}
            {DOUBLE_DOT_FRETS.includes(i) && (
              <div className="flex gap-0.5">
                <div className="size-1.5 rounded-full bg-text-muted" />
                <div className="size-1.5 rounded-full bg-text-muted" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
