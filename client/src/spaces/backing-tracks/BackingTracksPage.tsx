import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Music } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ─── Mock data ────────────────────────────────────────────────────────────────

const BACKING_TRACKS = [
  { id: '1', title: 'Midnight Blues Groove', style: 'Blues', bpm: 85, key: 'Am', gradient: 'from-indigo-600 to-purple-800' },
  { id: '2', title: 'Funk City Jam', style: 'Funk', bpm: 110, key: 'E', gradient: 'from-orange-500 to-pink-600' },
  { id: '3', title: 'Smooth Jazz Vibes', style: 'Jazz', bpm: 72, key: 'Dm', gradient: 'from-teal-500 to-blue-700' },
  { id: '4', title: 'Rock Anthem', style: 'Rock', bpm: 130, key: 'G', gradient: 'from-red-600 to-rose-800' },
  { id: '5', title: 'Lo-fi Chill Session', style: 'Lo-fi', bpm: 78, key: 'C', gradient: 'from-violet-500 to-indigo-700' },
  { id: '6', title: 'Latin Fiesta', style: 'Latin', bpm: 105, key: 'Bm', gradient: 'from-amber-500 to-red-600' },
  { id: '7', title: 'R&B Slow Burn', style: 'R&B', bpm: 68, key: 'F', gradient: 'from-pink-500 to-purple-700' },
  { id: '8', title: 'Electronic Pulse', style: 'Electronic', bpm: 128, key: 'Cm', gradient: 'from-cyan-500 to-blue-800' },
  { id: '9', title: 'Country Roads Strum', style: 'Country', bpm: 95, key: 'D', gradient: 'from-yellow-500 to-orange-600' },
]

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
            <p className="text-sm text-text-muted">Browse and pick a track, then jump into Jam to play along.</p>
          </div>
          <Button onClick={() => navigate('/jam')} className="gap-2">
            <ArrowLeft size={14} />
            Back to Jam
          </Button>
        </div>

        {/* Track Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {BACKING_TRACKS.map((track) => (
            <button
              key={track.id}
              onClick={() => navigate('/jam')}
              className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden text-left transition-colors group"
            >
              {/* Album Art */}
              <div className={`aspect-square w-full bg-gradient-to-br ${track.gradient} flex items-center justify-center`}>
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-6 h-6 rounded-full bg-white/20" />
                </div>
              </div>
              {/* Info */}
              <div className="flex flex-col gap-2 p-6">
                <p className="text-base font-semibold text-text-primary leading-tight">{track.title}</p>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span>{track.style}</span>
                  <span>·</span>
                  <span>{track.key}</span>
                  <span>·</span>
                  <span>{track.bpm} BPM</span>
                </div>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
