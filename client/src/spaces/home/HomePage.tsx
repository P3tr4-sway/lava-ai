import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Play, X, Search, Mic, FilePlus2, type LucideIcon } from 'lucide-react'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { PricingCards } from '@/components/marketing/PricingCards'
import { cn } from '@/components/ui/utils'
import { CHORD_CHARTS } from '@/data/chordCharts'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { UpcomingPractice } from '@/components/calendar/UpcomingPractice'

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECOMMENDED_CHARTS = CHORD_CHARTS.filter((c) =>
  ['wish-you-were-here', 'let-her-go', 'hotel-california', 'wonderwall'].includes(c.id),
)

const SUGGESTIONS = [
  'Wonderwall by Oasis',
  'Hotel California',
  'A simple 12-bar blues in E',
  'Something easy for a beginner guitarist',
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

// ─── QuickStartCard ──────────────────────────────────────────────────────────

interface QuickStartCardProps {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  className?: string
}

function QuickStartCard({ icon: Icon, title, description, onClick, className }: QuickStartCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-surface-0 border border-border hover:border-border-hover rounded-xl p-4 cursor-pointer transition-all group text-left',
        className,
      )}
    >
      <Icon size={20} className="text-text-secondary group-hover:text-text-primary transition-colors mb-2" />
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="text-xs text-text-secondary mt-0.5">{description}</p>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)
  const [showBanner, setShowBanner] = useState(true)
  const { isAuthenticated } = useRequireAuth()

  const handleSend = (message: string) => {
    navigate(`/search?q=${encodeURIComponent(message)}`)
  }

  return (
    <div className="h-full overflow-y-auto">

      {/* Guests: sign-up CTA banner */}
      {!isAuthenticated && (
        <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Create a free account to save your progress, get AI guidance, and unlock the full practice center
          </p>
          <Link to="/signup" className="text-sm font-medium text-accent hover:underline shrink-0 ml-4">
            Sign Up Free
          </Link>
        </div>
      )}

      {/* Logged-in: upgrade banner */}
      {isAuthenticated && showBanner && (
        <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">Free Plan</span> — 3 AI song breakdowns per month
          </p>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm font-medium text-accent hover:underline">
              Upgrade
            </Link>
            <button
              onClick={() => setShowBanner(false)}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 pt-[22vh] flex flex-col gap-10 pb-12">

        {/* ── 1. Hero — search-first ────────────────────────────── */}
        <section>
          <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">What do you want to practice today?</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Search for any song and LAVA AI turns it into playable chord charts and tabs, so you can start practicing right away.</p>
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

        {/* ── 1.5. Upcoming practice ──────────────────────────── */}
        <UpcomingPractice />

        {/* ── 2. Quick start ──────────────────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Quick start</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <QuickStartCard
              icon={Search}
              title="Practice a Song"
              description="Turn any song into playable charts and tabs"
              onClick={() => chatRef.current?.setValue('')}
            />
            <QuickStartCard
              icon={Mic}
              title="Play Center"
              description="Build tones with amp, effects, and looper tools"
              onClick={() => navigate('/jam')}
            />
            <QuickStartCard
              icon={FilePlus2}
              title="Create Charts"
              description="Write and edit your own chord charts"
              onClick={() => navigate('/editor')}
            />
          </div>
        </section>

        {/* ── 3. Continue where you left off (logged-in only) ───── */}
        {isAuthenticated && (
          <section>
            <button
              onClick={() => navigate(`/learn/songs/${LAST_PLAYED.id}`)}
              className="w-full bg-surface-1 border border-border hover:border-border-hover rounded-2xl p-6 cursor-pointer transition-all group text-left"
            >
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-2">Continue practicing</p>
                  <p className="text-2xl font-bold text-text-primary leading-tight truncate">{LAST_PLAYED.title}</p>
                  <p className="text-sm text-text-secondary mt-1">{LAST_PLAYED.artist} · {LAST_PLAYED.section}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Play size={22} className="text-surface-0 ml-1" fill="currentColor" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-text-primary rounded-full" style={{ width: `${LAST_PLAYED.progress}%` }} />
                </div>
                <span className="text-xs font-medium text-text-secondary shrink-0">{LAST_PLAYED.progress}%</span>
              </div>
            </button>
          </section>
        )}

        {/* ── 4. Picked for you ─────────────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">Recommended for practice</p>
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

        {/* ── 5. Pricing (guests only) ─────────────────────────── */}
        {!isAuthenticated && (
          <section>
            <p className="text-sm text-text-muted mb-4">Plans & Pricing</p>
            <PricingCards />
          </section>
        )}

        {/* ── 6. Free tier note ─────────────────────────────────── */}
        <p className="text-xs text-text-muted text-center">
          3 free AI song breakdowns every month · No credit card required
        </p>

      </div>
    </div>
  )
}
