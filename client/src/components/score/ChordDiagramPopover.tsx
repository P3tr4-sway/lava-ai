import { cn } from '@/components/ui/utils'
import { ChordDiagram } from './ChordDiagram'
import { CHORD_VOICINGS } from '@/lib/chordVoicings'

interface ChordDiagramPopoverProps {
  chordName: string
  x: number
  y: number
  visible: boolean
  className?: string
}

export function ChordDiagramPopover({ chordName, x, y, visible, className }: ChordDiagramPopoverProps) {
  if (!visible) return null

  const voicing = CHORD_VOICINGS[chordName]
  if (!voicing) return null

  return (
    <div
      className={cn(
        'absolute bg-surface-1 border border-border rounded-lg shadow-xl p-2 z-40 animate-fade-in',
        className,
      )}
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
    >
      <ChordDiagram voicing={voicing} width={60} height={72} />
    </div>
  )
}
