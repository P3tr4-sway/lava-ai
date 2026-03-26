import { cn } from '@/components/ui/utils'
import { KEYS } from '@lava/shared'

const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8']

interface MetadataBarProps {
  keyValue: string
  timeSignature: string
  tempo: number
  editable?: boolean
  onKeyChange?: (key: string) => void
  onTimeSignatureChange?: (ts: string) => void
  onTempoChange?: (bpm: number) => void
  className?: string
}

export function MetadataBar({
  keyValue,
  timeSignature,
  tempo,
  editable = false,
  onKeyChange,
  onTimeSignatureChange,
  onTempoChange,
  className,
}: MetadataBarProps) {
  return (
    <div data-coach-target="metadata-bar" className={cn('flex items-center gap-1.5', className)}>
      <span className="text-xs text-text-muted">Key</span>
      {editable ? (
        <select
          value={keyValue}
          onChange={(e) => onKeyChange?.(e.target.value)}
          className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary focus:outline-none focus:border-text-primary/40 cursor-pointer"
        >
          {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      ) : (
        <span className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary tabular-nums">
          {keyValue}
        </span>
      )}

      <span className="text-xs text-text-muted">Time</span>
      {editable ? (
        <select
          value={timeSignature}
          onChange={(e) => onTimeSignatureChange?.(e.target.value)}
          className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary focus:outline-none focus:border-text-primary/40 cursor-pointer"
        >
          {TIME_SIGS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
        </select>
      ) : (
        <span className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary tabular-nums">
          {timeSignature}
        </span>
      )}

      <span className="text-xs text-text-muted">♩=</span>
      {editable ? (
        <input
          type="number"
          min={40}
          max={300}
          value={tempo}
          onChange={(e) => onTempoChange?.(Number(e.target.value))}
          className="w-14 text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary focus:outline-none focus:border-text-primary/40 tabular-nums text-center"
        />
      ) : (
        <span className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary tabular-nums">
          {tempo ?? '—'}
        </span>
      )}
    </div>
  )
}
