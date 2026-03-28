import { useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

const KEYS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'] as const
const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8'] as const

interface KeySigPopoverProps {
  position: { x: number; y: number }
  currentKey?: string
  currentTimeSig?: string
  onKeyChange: (key: string) => void
  onTimeSigChange: (timeSig: string) => void
  onClose: () => void
  className?: string
}

export function KeySigPopover({
  position,
  currentKey,
  currentTimeSig,
  onKeyChange,
  onTimeSigChange,
  onClose,
  className,
}: KeySigPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 rounded-lg border border-border bg-surface-0 p-3 shadow-lg animate-fade-in',
        className,
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div className="mb-2 text-xs font-medium text-text-muted">Key</div>
      <div className="mb-3 grid grid-cols-4 gap-1">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => onKeyChange(k)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              currentKey === k
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-medium text-text-muted">Time Signature</div>
      <div className="grid grid-cols-3 gap-1">
        {TIME_SIGS.map((ts) => (
          <button
            key={ts}
            onClick={() => onTimeSigChange(ts)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              currentTimeSig === ts
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {ts}
          </button>
        ))}
      </div>
    </div>
  )
}
