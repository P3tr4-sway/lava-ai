import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAgent } from '@/hooks/useAgent'
import { ChatInput } from '@/components/agent/ChatInput'

// ─── Mock data ────────────────────────────────────────────────────────────────

const HOT_CHORD_CHARTS = [
  {
    title: 'Autumn Leaves',
    style: 'Jazz Standard',
    key: 'Gm',
  },
  {
    title: '12 Bar Blues',
    style: 'Blues',
    key: 'A',
  },
  {
    title: 'ii-V-I Progressions',
    style: 'Jazz',
    key: 'C',
  },
]

const HOT_BACKING_TRACKS = [
  {
    title: 'Midnight Blues Groove',
    style: 'Blues',
    bpm: 85,
    gradient: 'from-indigo-600 to-purple-800',
  },
  {
    title: 'Funk City Jam',
    style: 'Funk',
    bpm: 110,
    gradient: 'from-orange-500 to-pink-600',
  },
  {
    title: 'Smooth Jazz Vibes',
    style: 'Jazz',
    bpm: 72,
    gradient: 'from-teal-500 to-blue-700',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const { sendMessage } = useAgent()
  const navigate = useNavigate()

  const handleSend = (message: string) => {
    sendMessage(message)
    navigate('/learn')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 pt-[28vh] flex flex-col gap-10 pb-12">

        {/* ── Hero prompt ──────────────────────────────────────── */}
        <section className="pb-4">
          <h1 className="text-3xl font-semibold text-text-primary mb-8 text-center">Play the music you love</h1>
          <ChatInput onSend={handleSend} placeholder="What do you want to play?" />
        </section>

        {/* ── Hot ChordChart ──────────────────────────────────── */}
        <section>
          <div className="mb-2">
            <button
              onClick={() => navigate('/chord-charts')}
              className="flex items-center gap-1 group"
            >
              <h2 className="text-2xl font-semibold text-text-primary">Hot ChordChart</h2>
              <ChevronRight size={20} className="text-text-muted group-hover:text-text-primary transition-colors mt-0.5" />
            </button>
            <p className="text-sm text-text-muted mt-1">Popular chord progressions to learn</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {HOT_CHORD_CHARTS.map((chart) => (
              <div
                key={chart.title}
                onClick={() => navigate('/learn')}
                className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden cursor-pointer transition-colors group"
              >
                {/* Album Art — black mockup */}
                <div className="aspect-square w-full bg-black flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-white/60 text-xs font-mono tracking-widest uppercase mb-2">{chart.style}</p>
                    <p className="text-white text-2xl font-bold">{chart.key}</p>
                  </div>
                </div>
                {/* Info */}
                <div className="flex flex-col gap-2 p-6">
                  <p className="text-base font-semibold text-text-primary leading-tight">{chart.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-muted">{chart.style}</span>
                    <span className="text-text-muted">·</span>
                    <span className="text-sm text-text-muted">Key of {chart.key}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Hot Backing Track ─────────────────────────────────── */}
        <section>
          <div className="mb-2">
            <button
              onClick={() => navigate('/backing-tracks')}
              className="flex items-center gap-1 group"
            >
              <h2 className="text-2xl font-semibold text-text-primary">Hot Backing Track</h2>
              <ChevronRight size={20} className="text-text-muted group-hover:text-text-primary transition-colors mt-0.5" />
            </button>
            <p className="text-sm text-text-muted mt-1">Trending tracks to jam with</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {HOT_BACKING_TRACKS.map((track) => (
              <div
                key={track.title}
                onClick={() => navigate('/jam')}
                className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden cursor-pointer transition-colors group"
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-muted">{track.style}</span>
                    <span className="text-text-muted">·</span>
                    <span className="text-sm text-text-muted">{track.bpm} BPM</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
