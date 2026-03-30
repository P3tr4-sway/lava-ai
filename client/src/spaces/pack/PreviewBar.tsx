import { Check, X, Columns2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface PreviewBarProps {
  onCompare: () => void
  className?: string
}

export function PreviewBar({ onCompare, className }: PreviewBarProps) {
  const previewVersion = useVersionStore((s) => s.getPreviewVersion())
  const applyPreview = useVersionStore((s) => s.applyPreview)
  const discardPreview = useVersionStore((s) => s.discardPreview)

  if (!previewVersion) return null

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 z-30 flex items-center justify-between',
        'border-b border-border bg-surface-1 px-4 py-2',
        className,
      )}
    >
      <span className="text-sm font-medium text-text-primary">
        Previewing: <span className="text-accent">{previewVersion.name}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCompare}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
        >
          <Columns2 className="size-3.5" />
          Compare
        </button>
        <button
          type="button"
          onClick={discardPreview}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
        >
          <X className="size-3.5" />
          Discard
        </button>
        <button
          type="button"
          onClick={applyPreview}
          className="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-80"
        >
          <Check className="size-3.5" />
          Apply
        </button>
      </div>
    </div>
  )
}
