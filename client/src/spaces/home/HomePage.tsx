import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, ArrowRight } from 'lucide-react'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { CHORD_CHARTS } from '@/data/chordCharts'

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECOMMENDED_CHARTS = CHORD_CHARTS.filter((c) =>
  ['wish-you-were-here', 'let-her-go', 'hotel-california', 'wonderwall'].includes(c.id),
)

const SUGGESTIONS = [
  'Wonderwall by Oasis',
  'Hotel California',
  'A simple blues in E',
  'Something easy for beginners',
]

const DIFFICULTY_MAP: Record<string, { label: string; stars: string }> = {
  'wonderwall': { label: 'Beginner', stars: '★' },
  'wish-you-were-here': { label: 'Intermediate', stars: '★★' },
  'let-her-go': { label: 'Beginner', stars: '★' },
  'hotel-california': { label: 'Advanced', stars: '★★★' },
}

// TODO: replace with real auth + activity data
const LAST_PLAYED = {
  id: 'wish-you-were-here',
  title: 'Wish You Were Here',
  artist: 'Pink Floyd',
  progress: 45,
  section: 'Chorus',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)

  const handleSend = (message: string) => {
    navigate(`/search?q=${encodeURIComponent(message)}`)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 pt-[22vh] flex flex-col gap-10 pb-12">

        {/* ── 1. Hero — search-first ────────────────────────────── */}
        <section>
          <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">What do you want to play?</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Search for any song — AI generates the score and backing track for you</p>
          <ChatInput ref={chatRef} onSend={handleSend} placeholder="Song name, artist, or paste a link..." />

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
        </section>

        {/* ── 2. Continue where you left off ────────────────────── */}
        <section>
          <button
            onClick={() => navigate(`/learn/songs/${LAST_PLAYED.id}`)}
            className="w-full flex items-center gap-4 bg-surface-0 border border-border hover:border-border-hover rounded-xl p-4 cursor-pointer transition-colors group text-left"
          >
            {/* Play icon */}
            <div className="w-12 h-12 rounded-full bg-text-primary/10 flex items-center justify-center shrink-0 group-hover:bg-text-primary/15 transition-colors">
              <Play size={18} className="text-text-primary ml-0.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted mb-0.5">Continue playing</p>
              <p className="text-sm font-semibold text-text-primary">{LAST_PLAYED.title}</p>
              <p className="text-xs text-text-muted">{LAST_PLAYED.artist} · {LAST_PLAYED.section} · {LAST_PLAYED.progress}%</p>
            </div>
            {/* Progress ring */}
            <div className="relative w-10 h-10 shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-3" />
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-text-primary"
                  strokeDasharray={`${LAST_PLAYED.progress * 0.94} 94`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xs font-medium text-text-primary">
                {LAST_PLAYED.progress}%
              </span>
            </div>
            <ArrowRight size={16} className="text-text-muted shrink-0" />
          </button>
        </section>

        {/* ── 3. Picked for you ─────────────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Picked for you</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {RECOMMENDED_CHARTS.map((chart) => {
              const diff = DIFFICULTY_MAP[chart.id]
              return (
                <div
                  key={chart.id}
                  onClick={() => navigate(`/learn/songs/${chart.id}`)}
                  className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 group"
                >
                  {/* Cover */}
                  <div className="aspect-square w-full bg-surface-2 relative flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted text-[10px] font-mono tracking-widest uppercase mb-1">{chart.style}</p>
                      <p className="text-text-primary text-xl font-bold">{chart.key}</p>
                    </div>
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-0/50 backdrop-blur-sm">
                        <Play size={18} className="text-text-primary ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3.5">
                    <p className="text-sm font-semibold text-text-primary leading-tight truncate">{chart.title}</p>
                    <p className="text-xs text-text-muted mt-0.5 truncate">{chart.artist}</p>
                    <div className="mt-2">
                      <span className="text-2xs text-text-secondary bg-surface-2 px-2 py-0.5 rounded-full">
                        {diff?.stars} {diff?.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 4. Free tier note ─────────────────────────────────── */}
        <p className="text-xs text-text-muted text-center">
          3 free AI transcriptions every month · No credit card required
        </p>

      </div>
    </div>
  )
}
