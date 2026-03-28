import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { DawPanel, type DawPanelProps } from '@/components/daw/DawPanel'
import { useEditorStore } from '@/stores/editorStore'

interface CompactDawStripProps {
  dawProps: DawPanelProps
  className?: string
}

export function CompactDawStrip({ dawProps, className }: CompactDawStripProps) {
  const expanded = useEditorStore((s) => s.dawPanelExpanded)
  const toggle = useEditorStore((s) => s.toggleDawPanel)
  const trackCount = dawProps.tracks.length

  return (
    <div
      className={cn('border-t border-border bg-surface-1', className)}
      style={{ height: expanded ? 200 : 'var(--editor-daw-collapsed-height)' }}
    >
      {/* Collapsed strip header */}
      <button
        onClick={toggle}
        className="flex h-[var(--editor-daw-collapsed-height)] w-full items-center gap-2 px-4 text-xs text-text-secondary hover:bg-surface-2"
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        <span className="font-medium">{trackCount} track{trackCount !== 1 ? 's' : ''}</span>
      </button>

      {/* Expanded DawPanel */}
      {expanded && (
        <div className="h-[calc(100%-var(--editor-daw-collapsed-height))] overflow-y-auto">
          <DawPanel {...dawProps} showTransportBar={false} className="h-full" />
        </div>
      )}
    </div>
  )
}
