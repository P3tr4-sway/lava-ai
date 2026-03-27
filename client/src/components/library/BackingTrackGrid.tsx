import { cn } from '@/components/ui/utils'
import type { BackingTrackAsset } from '@/data/backingTracks'

interface BackingTrackGridProps {
  tracks: BackingTrackAsset[]
  onSelect: (track: BackingTrackAsset) => void
  className?: string
}

export function BackingTrackGrid({ tracks, onSelect, className }: BackingTrackGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2', className)}>
      {tracks.map((track) => (
        <button
          key={track.id}
          type="button"
          onClick={() => onSelect(track)}
          className="group flex flex-col gap-3 rounded-md border border-border bg-surface-0 p-4 text-left transition-colors hover:border-border-hover hover:bg-surface-1"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight text-text-primary">{track.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{track.description}</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-text-secondary">
              Track
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
            <span>{track.style}</span>
            <span>·</span>
            <span>{track.key}</span>
            <span>·</span>
            <span>{track.bpm} BPM</span>
          </div>

          <span className="text-sm font-medium text-text-secondary transition-colors group-hover:text-text-primary">
            Open in Practice Tools
          </span>
        </button>
      ))}
    </div>
  )
}
