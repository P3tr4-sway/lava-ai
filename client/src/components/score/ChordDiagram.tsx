import { cn } from '@/components/ui/utils'
import { type ChordVoicing } from '@/lib/chordVoicings'

interface ChordDiagramProps {
  voicing: ChordVoicing
  width?: number
  height?: number
  className?: string
}

const STRINGS = 6
const FRETS = 4
const PAD_TOP = 10
const PAD_LEFT = 8
const PAD_RIGHT = 4

export function ChordDiagram({ voicing, width = 40, height = 48, className }: ChordDiagramProps) {
  const fretH = (height - PAD_TOP) / FRETS
  const stringW = (width - PAD_LEFT - PAD_RIGHT) / (STRINGS - 1)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
    >
      {/* Chord name */}
      <text
        x={width / 2}
        y={8}
        textAnchor="middle"
        className="fill-text-primary text-[8px] font-medium"
      >
        {voicing.name}
      </text>

      {/* Nut (thick line at top for open position) */}
      {voicing.baseFret === 1 && (
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT + (STRINGS - 1) * stringW}
          y2={PAD_TOP}
          className="stroke-text-primary"
          strokeWidth={2}
        />
      )}

      {/* Fret lines — skip i=0 when nut is drawn (they are coincident) */}
      {Array.from({ length: FRETS + 1 }, (_, i) => {
        if (i === 0 && voicing.baseFret === 1) return null
        return (
          <line
            key={`fret-${i}`}
            x1={PAD_LEFT}
            y1={PAD_TOP + i * fretH}
            x2={PAD_LEFT + (STRINGS - 1) * stringW}
            y2={PAD_TOP + i * fretH}
            className="stroke-text-muted"
            strokeWidth={0.5}
          />
        )
      })}

      {/* String lines */}
      {Array.from({ length: STRINGS }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={PAD_LEFT + i * stringW}
          y1={PAD_TOP}
          x2={PAD_LEFT + i * stringW}
          y2={PAD_TOP + FRETS * fretH}
          className="stroke-text-muted"
          strokeWidth={0.5}
        />
      ))}

      {/* Finger dots + muted/open markers */}
      {voicing.frets.map((fret, i) => {
        const x = PAD_LEFT + i * stringW
        if (fret === -1) {
          return (
            <text key={i} x={x} y={PAD_TOP - 2} textAnchor="middle" className="fill-text-muted text-[7px]">
              ×
            </text>
          )
        }
        if (fret === 0) {
          return (
            <circle key={i} cx={x} cy={PAD_TOP - 3} r={2} className="fill-none stroke-text-muted" strokeWidth={0.8} />
          )
        }
        const adjustedFret = fret - voicing.baseFret + 1
        return (
          <circle
            key={i}
            cx={x}
            cy={PAD_TOP + (adjustedFret - 0.5) * fretH}
            r={2.5}
            className="fill-text-primary"
          />
        )
      })}
    </svg>
  )
}
