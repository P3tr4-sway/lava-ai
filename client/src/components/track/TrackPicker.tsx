import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Music } from 'lucide-react'
import { cn } from '@/components/ui/utils'

export interface TrackItem {
  id: string
  name: string
  instrument: number
}

interface TrackPickerProps {
  tracks: TrackItem[]
  activeIndex: number
  onSwitch: (index: number) => void
  className?: string
}

export function TrackPicker({ tracks, activeIndex, onSwitch, className }: TrackPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Single track — static badge, no interactivity
  if (tracks.length <= 1) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-surface-0 px-3 py-1 text-[13px] font-medium text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
          className,
        )}
      >
        <Music className="size-3.5 text-text-muted" />
        {tracks[0]?.name || 'Track'}
      </span>
    )
  }

  const activeTrack = tracks[activeIndex] ?? tracks[0]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-surface-0 px-3 py-1 text-[13px] font-medium text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors',
          'hover:bg-surface-2',
          open && 'bg-surface-2',
        )}
      >
        <Music className="size-3.5 text-text-muted" />
        {activeTrack?.name || 'Track'}
        <ChevronDown
          className={cn('size-3 text-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-surface-0 py-1 shadow-lg animate-fade-in">
          {tracks.map((track, i) => (
            <button
              key={track.id}
              type="button"
              onClick={() => {
                onSwitch(i)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
                i === activeIndex
                  ? 'bg-surface-2 font-medium text-text-primary'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              <Music className="size-3.5 shrink-0 text-text-muted" />
              {track.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
