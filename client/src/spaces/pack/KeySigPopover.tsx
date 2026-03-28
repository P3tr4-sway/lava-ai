import { useState, useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'] as const
const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8'] as const

interface KeySigPopoverProps {
  position: { x: number; y: number }
  currentKey?: string
  currentTimeSig?: string
  onSelect: (keySig: { key: string; mode: 'major' | 'minor'; timeSig: string }) => void
  onClose: () => void
  className?: string
}

export function KeySigPopover({
  position,
  currentKey,
  currentTimeSig,
  onSelect,
  onClose,
  className,
}: KeySigPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState(currentKey ?? 'C')
  const [selectedTimeSig, setSelectedTimeSig] = useState(currentTimeSig ?? '4/4')
  const [mode, setMode] = useState<'major' | 'minor'>('major')

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

  function handleKeyClick(key: string) {
    setSelectedKey(key)
    onSelect({ key, mode, timeSig: selectedTimeSig })
  }

  function handleTimeSigClick(timeSig: string) {
    setSelectedTimeSig(timeSig)
    onSelect({ key: selectedKey, mode, timeSig })
  }

  function handleModeClick(newMode: 'major' | 'minor') {
    setMode(newMode)
    onSelect({ key: selectedKey, mode: newMode, timeSig: selectedTimeSig })
  }

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 rounded-lg border border-border bg-surface-0 p-3 shadow-lg animate-fade-in',
        className,
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div className="mb-2 flex gap-1">
        <button
          onClick={() => handleModeClick('major')}
          className={cn(
            'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors',
            mode === 'major'
              ? 'bg-surface-3 text-accent'
              : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          )}
        >
          Major
        </button>
        <button
          onClick={() => handleModeClick('minor')}
          className={cn(
            'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors',
            mode === 'minor'
              ? 'bg-surface-3 text-accent'
              : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          )}
        >
          Minor
        </button>
      </div>

      <div className="mb-2 text-xs font-medium text-text-muted">Key</div>
      <div className="mb-3 grid grid-cols-4 gap-1">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => handleKeyClick(k)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              selectedKey === k
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
            onClick={() => handleTimeSigClick(ts)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              selectedTimeSig === ts
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
