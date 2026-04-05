import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Sparkles, Layers } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface VersionPickerProps {
  className?: string
  onSelectVersion?: (id: string) => void | Promise<void>
  disabled?: boolean
  loadingVersionId?: string | null
}

export function VersionPicker({ className, onSelectVersion, disabled, loadingVersionId }: VersionPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const versions = useVersionStore((s) => s.versions)
  const activeVersionId = useVersionStore((s) => s.activeVersionId)
  const setActiveVersion = useVersionStore((s) => s.setActiveVersion)
  const isPreview = useVersionStore((s) => s.previewVersionId !== null)
  const generatedVersions = versions.filter((version) => version.source === 'ai-transform')

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

  if (generatedVersions.length === 0) return null

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
        disabled={isPreview || disabled}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-0 px-3 text-xs font-medium transition-colors',
          'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          (isPreview || disabled) && 'cursor-not-allowed opacity-40',
        )}
      >
        <Layers className="size-3.5" />
        <span className="max-w-[100px] truncate">{activeVersion?.name ?? 'Original'}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 min-w-[220px] rounded-2xl border border-border bg-surface-0 p-1.5 shadow-lg">
          {generatedVersions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                if (loadingVersionId || v.id === activeVersionId) {
                  setOpen(false)
                  return
                }
                if (onSelectVersion) {
                  void onSelectVersion(v.id)
                } else {
                  setActiveVersion(v.id)
                }
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors',
                v.id === activeVersionId
                  ? 'bg-surface-2 text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              <span className="flex-1 truncate">{v.name}</span>
              {loadingVersionId === v.id && (
                <span className="inline-flex size-2 animate-pulse rounded-full bg-text-primary" />
              )}
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
