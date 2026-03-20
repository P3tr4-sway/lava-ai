import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, ArrowRight, Music } from 'lucide-react'
import { useAgent } from '@/hooks/useAgent'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { CHORD_CHARTS } from '@/data/chordCharts'

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECOMMENDED_CHARTS = CHORD_CHARTS.filter((c) =>
  ['wish-you-were-here', 'let-her-go', 'hotel-california'].includes(c.id),
)

const TRENDING_BACKING_TRACKS = [
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

const DIFFICULTY_MAP: Record<string, { label: string; stars: string }> = {
  'wish-you-were-here': { label: 'Intermediate', stars: '★★' },
  'let-her-go': { label: 'Beginner', stars: '★' },
  'hotel-california': { label: 'Advanced', stars: '★★★' },
}

// TODO: replace with real auth + activity data
const HAS_PREVIOUS_SESSION = false

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const { sendMessage } = useAgent()
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)

  const handleSend = (message: string) => {
    sendMessage(message)
    navigate('/learn')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 pt-[28vh] flex flex-col gap-14 pb-12">

        {/* ── 1. Hero ──────────────────────────────────────────── */}
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

          {/* 7. Free quota line */}
          <p className="text-xs text-text-muted text-center mt-6">
            3 free AI transcriptions every month. No credit card required.
          </p>

          <div className="w-24 h-px bg-gradient-to-r from-transparent via-text-muted/30 to-transparent mx-auto mt-8" />
        </section>

        {/* ── 2. Today's Recommendation ────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Picked for you</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Today's Song */}
            <div
              onClick={() => navigate('/learn/songs/wonderwall')}
              className="flex items-start gap-4 bg-surface-0 border border-border hover:border-border-hover rounded-lg p-5 cursor-pointer transition-colors"
            >
              <div className="w-16 h-16 rounded-lg bg-black shrink-0 flex items-center justify-center">
                <p className="text-white text-lg font-bold">G</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted mb-1">Today&apos;s Song</p>
                <p className="text-base font-semibold text-text-primary leading-tight">Wonderwall</p>
                <p className="text-sm text-text-muted">Oasis</p>
                <p className="text-xs text-text-secondary mt-2">★★ Intermediate</p>
                <button className="flex items-center gap-1 mt-3 px-4 py-1.5 bg-text-primary text-surface-0 text-xs font-medium rounded-full hover:opacity-80 transition-opacity">
                  Start Learning
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* 30s Riff */}
            <div
              onClick={() => navigate('/jam')}
              className="flex items-start gap-4 bg-surface-0 border border-border hover:border-border-hover rounded-lg p-5 cursor-pointer transition-colors"
            >
              <div className="w-16 h-16 rounded-lg bg-surface-2 shrink-0 flex items-center justify-center">
                <Music size={24} className="text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted mb-1">30s Riff</p>
                <p className="text-base font-semibold text-text-primary leading-tight">Classic Blues Turnaround</p>
                <p className="text-sm text-text-muted mt-1">A must-know phrase for any jam session</p>
                <button className="flex items-center gap-1 mt-3 text-xs text-text-secondary hover:text-text-primary transition-colors">
                  Try it
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Quick Start ───────────────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Quick Start</p>
          <div className="flex flex-wrap gap-3">
            {HAS_PREVIOUS_SESSION && (
              <button
                onClick={() => navigate('/learn')}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-text-primary text-surface-0 text-sm font-medium rounded-full hover:opacity-80 transition-opacity"
              >
                Continue Last Session
                <ArrowRight size={14} />
              </button>
            )}
            <button
              onClick={() => navigate('/jam')}
              className="px-5 py-2.5 text-sm font-medium text-text-primary border border-border rounded-full hover:border-border-hover transition-colors"
            >
              Random Jam
            </button>
            <button
              onClick={() => navigate('/jam')}
              className="px-5 py-2.5 text-sm font-medium text-text-primary border border-border rounded-full hover:border-border-hover transition-colors"
            >
              30s Warm-up
            </button>
          </div>
        </section>

        {/* ── 4. My Progress ───────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-6 px-5 py-3 bg-surface-0 border border-border rounded-lg">
            <span className="text-sm text-text-secondary">Songs learned: <span className="text-text-primary font-medium">8</span></span>
            <span className="w-px h-4 bg-border" />
            <span className="text-sm text-text-secondary">This week: <span className="text-text-primary font-medium">2.5 hrs</span></span>
          </div>
        </section>

        {/* ── 5. Recommended for you ───────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Recommended for you</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RECOMMENDED_CHARTS.map((chart) => {
              const diff = DIFFICULTY_MAP[chart.id]
              return (
                <div
                  key={chart.id}
                  onClick={() => navigate(`/learn/songs/${chart.id}`)}
                  className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-lg overflow-hidden cursor-pointer transition-all hover:-translate-y-1 group"
                >
                  {/* Cover */}
                  <div className="aspect-[4/3] w-full bg-black relative flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-white/60 text-xs font-mono tracking-widest uppercase mb-2">{chart.style}</p>
                      <p className="text-white text-2xl font-bold">{chart.key}</p>
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
                    <p className="text-base font-semibold text-text-primary leading-tight">{chart.title}</p>
                    <p className="text-sm text-text-muted">{chart.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-secondary bg-surface-2 px-2 py-0.5 rounded-full">
                        {diff?.stars} {diff?.label}
                      </span>
                      <span className="text-xs text-text-secondary bg-surface-2 px-2 py-0.5 rounded-full">
                        {chart.style}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 6. Trending backing tracks ───────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Trending backing tracks</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRENDING_BACKING_TRACKS.map((track) => (
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
  track: (typeof TRENDING_BACKING_TRACKS)[number]
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
