import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Sparkles, Layers } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface VersionPickerProps {
  className?: string
}

export function VersionPicker({ className }: VersionPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const versions = useVersionStore((s) => s.versions)
  const activeVersionId = useVersionStore((s) => s.activeVersionId)
  const setActiveVersion = useVersionStore((s) => s.setActiveVersion)
  const isPreview = useVersionStore((s) => s.isPreview())

  const activeVersion = versions.find((v) => v.id === activeVersionId)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (versions.length <= 1) return null

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isPreview}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
          'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          isPreview && 'cursor-not-allowed opacity-40',
        )}
      >
        <Layers className="size-3.5" />
        <span className="max-w-[100px] truncate">{activeVersion?.name ?? 'Original'}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 min-w-[180px] rounded-lg border border-border bg-surface-0 p-1 shadow-lg">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveVersion(v.id)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                v.id === activeVersionId
                  ? 'bg-surface-2 text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              <span className="flex-1 truncate">{v.name}</span>
              {v.source === 'ai-transform' && (
                <span className="flex items-center gap-0.5 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-text-muted">
                  <Sparkles className="size-2.5" />
                  AI
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
