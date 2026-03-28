import { useState, useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

const ROOTS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const QUALITIES = ['maj', 'min', '7', 'maj7', 'min7', 'dim', 'aug', 'sus2', 'sus4'] as const

interface ChordPopoverProps {
  position?: { x: number; y: number }
  currentChord?: string
  onSelect: (chord: { root: string; quality: string }) => void
  onClose: () => void
  className?: string
}

export function ChordPopover({ position, currentChord, onSelect, onClose, className }: ChordPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [selectedRoot, setSelectedRoot] = useState('')
  const [selectedQuality, setSelectedQuality] = useState('')

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

  function handleRootClick(root: string) {
    setSelectedRoot(root)
  }

  function handleQualityClick(quality: string) {
    setSelectedQuality(quality)
    const root = selectedRoot || 'C'
    onSelect({ root, quality })
  }

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 rounded-lg border border-border bg-surface-0 p-3 shadow-lg animate-fade-in',
        className,
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div className="mb-2 text-xs font-medium text-text-muted">Root</div>
      <div className="mb-3 grid grid-cols-6 gap-1">
        {ROOTS.map((root) => (
          <button
            key={root}
            onClick={() => handleRootClick(root)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              selectedRoot === root
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {root}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-medium text-text-muted">Quality</div>
      <div className="grid grid-cols-3 gap-1">
        {QUALITIES.map((q) => (
          <button
            key={q}
            onClick={() => handleQualityClick(q)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              selectedQuality === q
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
