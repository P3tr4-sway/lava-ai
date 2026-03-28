import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { DawPanel, type DawPanelProps } from '@/components/daw/DawPanel'
import { useEditorStore } from '@/stores/editorStore'
import { useDawPanelStore } from '@/stores/dawPanelStore'
import { useAudioStore } from '@/stores/audioStore'

interface CompactDawStripProps {
  dawProps: DawPanelProps
  className?: string
}

export function CompactDawStrip({ dawProps, className }: CompactDawStripProps) {
  const expanded = useEditorStore((s) => s.dawPanelExpanded)
  const toggle = useEditorStore((s) => s.toggleDawPanel)
  const trackCount = useDawPanelStore((s) => s.tracks.length)
  const isPlaying = useAudioStore((s) => s.playbackState === 'playing')

  return (
    <div
      className={cn(
        'border-t border-border bg-surface-1',
        expanded ? 'max-h-[200px] overflow-y-auto' : 'h-[var(--editor-daw-collapsed-height)]',
        className,
      )}
    >
      {/* Collapsed strip header */}
      <button
        onClick={toggle}
        className="flex h-[var(--editor-daw-collapsed-height)] w-full items-center gap-2 px-4 text-xs text-text-secondary hover:bg-surface-2"
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        <span className="font-medium">{trackCount} track{trackCount !== 1 ? 's' : ''}</span>
        <span className={cn('size-1.5 rounded-full', isPlaying ? 'bg-success' : 'bg-text-muted')} />
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
