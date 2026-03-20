import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Play, ArrowRight } from 'lucide-react'
import { useAgent } from '@/hooks/useAgent'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { CHORD_CHARTS } from '@/data/chordCharts'

// ─── Mock data ────────────────────────────────────────────────────────────────

const HOT_CHORD_CHARTS = CHORD_CHARTS.filter((c) =>
  ['wonderwall', 'wish-you-were-here', 'let-her-go'].includes(c.id),
)

const HOT_BACKING_TRACKS = [
  {
    title: 'Indie Pop Groove',
    style: 'Pop',
    bpm: 95,
    gradient: 'from-pink-500 to-orange-400',
  },
  {
    title: 'Country Fingerpick',
    style: 'Country',
    bpm: 78,
    gradient: 'from-amber-500 to-yellow-600',
  },
  {
    title: 'Rock Anthem Drive',
    style: 'Rock',
    bpm: 120,
    gradient: 'from-red-600 to-rose-800',
  },
]

const SUGGESTIONS = [
  'Wonderwall by Oasis',
  'A simple blues in E',
  'Something easy for beginners',
]

// TODO: replace with real auth + activity data
const IS_LOGGED_IN = false
const PREVIOUS_ACTIVITY: {
  title: string
  thumbnail: string
  progress: number
  sublabel: string
  href: string
} | null = null

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const { sendMessage } = useAgent()
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)

  const handleSend = (message: string) => {
    sendMessage(message)
    navigate('/learn')
  }

  const showContinue = IS_LOGGED_IN && PREVIOUS_ACTIVITY

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 pt-[28vh] flex flex-col gap-14 pb-12">

        {/* ── Hero prompt ──────────────────────────────────────── */}
        <section className="pb-4">
          <h1 className="text-4xl font-bold text-text-primary mb-2 text-center">Play the music you love</h1>
          <p className="text-base text-text-secondary text-center mb-8">Your AI-powered music companion</p>
          <ChatInput ref={chatRef} onSend={handleSend} placeholder="What do you want to play?" />

          {/* Suggestion tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => chatRef.current?.setValue(s)}
                className="px-3 py-1.5 text-xs text-text-secondary bg-surface-1 border border-border rounded-full hover:border-border-hover hover:text-text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Free quota nudge */}
          <p className="text-xs text-text-muted text-center mt-6">
            3 free AI transcriptions every month. No credit card required.
          </p>

          <div className="w-24 h-px bg-gradient-to-r from-transparent via-text-muted/30 to-transparent mx-auto mt-8" />
        </section>

        {/* ── Continue Where You Left Off ──────────────────────── */}
        {showContinue && (
          <section>
            <h2 className="text-2xl font-semibold text-text-primary mb-4">Continue Where You Left Off</h2>
            <div
              onClick={() => navigate(PREVIOUS_ACTIVITY.href)}
              className="flex items-center gap-4 bg-surface-0 border border-border hover:border-border-hover rounded-lg p-4 cursor-pointer transition-colors"
            >
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-lg bg-surface-2 shrink-0 overflow-hidden">
                <img
                  src={PREVIOUS_ACTIVITY.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-text-primary leading-tight truncate">
                  {PREVIOUS_ACTIVITY.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-text-primary rounded-full"
                      style={{ width: `${PREVIOUS_ACTIVITY.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{PREVIOUS_ACTIVITY.progress}%</span>
                </div>
                <p className="text-xs text-text-muted mt-1">{PREVIOUS_ACTIVITY.sublabel}</p>
              </div>

              {/* Continue button */}
              <button className="flex items-center gap-1.5 px-4 py-2 bg-text-primary text-surface-0 text-sm font-medium rounded-full shrink-0 hover:opacity-80 transition-opacity">
                Continue
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {HOT_CHORD_CHARTS.map((chart) => (
              <div
                key={chart.title}
                onClick={() => navigate(`/learn/songs/${chart.id}`)}
                className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden cursor-pointer transition-colors group"
              >
                {/* Album Art — black mockup */}
                <div className="aspect-[4/3] w-full bg-black flex items-center justify-center">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {HOT_BACKING_TRACKS.map((track) => (
              <BackingTrackCard key={track.title} track={track} onClick={() => navigate('/jam')} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

// ─── Backing Track Card with hover play ───────────────────────────────────────

function BackingTrackCard({
  track,
  onClick,
}: {
  track: (typeof HOT_BACKING_TRACKS)[number]
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden cursor-pointer transition-colors group"
    >
      {/* Album Art */}
      <div className={`aspect-[4/3] w-full bg-gradient-to-br ${track.gradient} relative flex items-center justify-center`}>
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <div className="w-6 h-6 rounded-full bg-white/20" />
        </div>

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm">
            <Play size={22} className="text-white ml-0.5" fill="white" />
          </div>
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
  )
}
