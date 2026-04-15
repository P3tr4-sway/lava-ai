import { Check, X, Columns2, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface PreviewBarProps {
  onApply?: () => void
  onDiscard?: () => void
  onCompare?: () => void
  className?: string
}

function deriveChangeTags(name: string): string[] {
  const tags: string[] = []
  const lower = name.toLowerCase()
  if (lower.includes('fingerstyle')) tags.push('Fingerstyle')
  if (lower.includes('blues')) tags.push('Blues')
  if (lower.includes('simplif')) tags.push('Simplified')
  if (lower.includes('fresh') || lower.includes('cover')) tags.push('Fresh cover')
  if (lower.includes('solo')) tags.push('Solo')
  if (lower.includes('open chord')) tags.push('Open chords')
  if (tags.length === 0) tags.push('AI stylized')
  return tags
}

export function PreviewBar({ onApply, onDiscard, onCompare, className }: PreviewBarProps) {
  const previewVersionId = useVersionStore((s) => s.previewVersionId)
  const versions = useVersionStore((s) => s.versions)
  const previewVersion = previewVersionId
    ? versions.find((v) => v.id === previewVersionId)
    : undefined

  if (!previewVersion) return null

  const changeTags = deriveChangeTags(previewVersion.name)

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 z-30 flex flex-col gap-2',
        'border-b border-border bg-surface-1 px-4 py-2.5',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Sparkles className="size-4 shrink-0 text-accent-dim" />
          <span className="text-sm font-medium text-text-primary truncate">
            Previewing: <span className="text-accent">{previewVersion.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            onClick={onDiscard}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            <X className="size-3.5" />
            Discard
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-80"
          >
            <Check className="size-3.5" />
            Apply
          </button>
        </div>
      </div>

      {changeTags.length > 0 && (
        <div className="flex items-center gap-1.5 pl-7">
          <span className="text-[11px] text-text-muted">Changes:</span>
          {changeTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
