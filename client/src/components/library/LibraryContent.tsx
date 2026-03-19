import { useState } from 'react'
import { Drum, Music2, Disc3, Sparkles, Play, Pause } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useJamStore } from '@/stores/jamStore'
import { useAudioStore } from '@/stores/audioStore'
import type { BackingTrack } from '@lava/shared'

export const LIBRARY_CATEGORIES = [
  { id: 'drums', label: 'Drum Grooves', icon: Drum },
  { id: 'melodic', label: 'Melodic Loops', icon: Music2 },
  { id: 'backing', label: 'Backing Tracks', icon: Disc3 },
  { id: 'ai', label: 'AI Generation', icon: Sparkles },
] as const

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]['id']

interface LibraryContentProps {
  onSelect?: (track: BackingTrack) => void
}

export function LibraryContent({ onSelect }: LibraryContentProps) {
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('drums')
  const availableTracks = useJamStore((s) => s.availableTracks)
  const selectedTrackId = useJamStore((s) => s.selectedTrackId)
  const selectTrack = useJamStore((s) => s.selectTrack)
  const playbackState = useAudioStore((s) => s.playbackState)
  const isPlaying = playbackState === 'playing'

  const filteredTracks = availableTracks.filter((t) => {
    if (activeCategory === 'drums') return t.genre.toLowerCase().includes('drum')
    if (activeCategory === 'melodic') return t.loops.length > 0
    if (activeCategory === 'backing') return !t.audioUrl.startsWith('ai://')
    if (activeCategory === 'ai') return t.audioUrl.startsWith('ai://')
    return true
  })

  const handleSelect = (track: BackingTrack) => {
    selectTrack(track.id)
    onSelect?.(track)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Category tabs */}
      <div className="flex gap-1 bg-surface-2 border border-border rounded p-0.5">
        {LIBRARY_CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors',
              activeCategory === id
                ? 'bg-surface-4 text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Track list */}
      {filteredTracks.length > 0 ? (
        <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
          {filteredTracks.map((track) => {
            const selected = selectedTrackId === track.id
            return (
              <button
                key={track.id}
                onClick={() => handleSelect(track)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-colors',
                  selected
                    ? 'bg-white/10 border-white/30'
                    : 'bg-surface-3 border-transparent hover:bg-surface-4',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded flex items-center justify-center shrink-0',
                    selected ? 'bg-white text-black' : 'bg-surface-4 text-text-muted',
                  )}
                >
                  {selected && isPlaying ? (
                    <Pause size={14} />
                  ) : (
                    <Play size={14} className="ml-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{track.name}</p>
                  <p className="text-[11px] text-text-muted">
                    {track.genre} &middot; {track.key} &middot; {track.bpm} BPM
                  </p>
                </div>
                {track.audioUrl.startsWith('ai://') && (
                  <span className="text-[10px] font-medium text-text-muted bg-surface-4 px-1.5 py-0.5 rounded uppercase shrink-0">
                    AI
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 bg-surface-3/50 rounded border border-dashed border-border">
          <p className="text-xs text-text-muted">
            {activeCategory === 'ai'
              ? 'No AI-generated tracks yet — use the Jam page to create one'
              : 'No tracks in this category'}
          </p>
        </div>
      )}
    </div>
  )
}
