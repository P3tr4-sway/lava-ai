import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Music } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BACKING_TRACKS } from '@/data/backingTracks'
import { BackingTrackGrid } from '@/components/library/BackingTrackGrid'

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BackingTracksPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Music size={20} className="text-text-secondary" />
              <h1 className="text-xl font-semibold text-text-primary">Backing Tracks</h1>
            </div>
            <p className="text-sm text-text-muted">Browse and pick a track, then jump into a practice session.</p>
          </div>
          <Button onClick={() => navigate('/?tab=tools')} className="gap-2">
            <ArrowLeft size={14} />
            Back to AI Tools
          </Button>
        </div>

        <BackingTrackGrid tracks={BACKING_TRACKS} onSelect={() => navigate('/?tab=tools')} />

      </div>
    </div>
  )
}
