import { Trash2, Eraser, Copy, ArrowUpDown } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui'

export type ContextPillSelectionType = 'none' | 'bar' | 'note'

interface ContextPillProps {
  selectionType: ContextPillSelectionType
  bounds: { x: number; y: number; width: number; height: number } | null
  onDelete: () => void
  onClear: () => void
  onCopy: () => void
  onTranspose?: () => void
  /** When true, suppresses editing action buttons (delete, clear, copy, transpose).
   *  The pill still renders to show users which bars are selected for chat context. */
  readOnly?: boolean
  className?: string
}

const PILL_HEIGHT = 36
const PILL_OFFSET = 8 // gap between pill bottom and selection top

/**
 * Floating action pill that appears above the selected bar(s) or note(s).
 * Shows Delete, Clear, Copy, and (for notes) Transpose buttons.
 * In readOnly mode only the selection label is shown (no action buttons).
 */
export function ContextPill({
  selectionType,
  bounds,
  onDelete,
  onClear,
  onCopy,
  onTranspose,
  readOnly = false,
  className,
}: ContextPillProps) {
  if (selectionType === 'none' || !bounds) return null

  const top = bounds.y - PILL_HEIGHT - PILL_OFFSET
  const left = bounds.x

  return (
    <div
      className={cn(
        'absolute z-20 flex items-center gap-1 rounded-lg bg-surface-3 px-2 py-1 shadow-lg ring-1 ring-border animate-fade-in',
        className,
      )}
      style={{ top, left }}
      role={readOnly ? 'status' : 'toolbar'}
      aria-label={readOnly ? 'Selection info' : 'Selection actions'}
    >
      {readOnly ? (
        <span className="px-1 text-xs text-text-secondary select-none">
          {selectionType === 'note' ? 'Note selected' : 'Bar selected'}
        </span>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Clear"
            title="Clear"
          >
            <Eraser className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCopy}
            aria-label="Copy"
            title="Copy"
          >
            <Copy className="size-3.5" />
          </Button>
          {selectionType === 'note' && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onTranspose}
              aria-label="Transpose"
              title="Transpose"
            >
              <ArrowUpDown className="size-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}
