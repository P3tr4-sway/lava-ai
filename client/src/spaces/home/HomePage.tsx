import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, ChevronRight, FilePlus } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useAgent } from '@/hooks/useAgent'

// ─── Mock data ────────────────────────────────────────────────────────────────

const RECOMMENDATIONS = [
  { label: 'Learn Autumn Leaves', to: '/learn' },
  { label: 'Practice Hotel California', to: '/learn' },
  { label: 'Write a lo-fi beat', to: '/create' },
  { label: 'Jam in D minor', to: '/jam' },
  { label: 'Tune my guitar', to: '/tools' },
  { label: 'Open last session', to: '/projects' },
]

const MY_PROJECTS = [
  { label: 'Lo-fi Sunday Beat', to: '/projects' },
  { label: 'Hotel California Cover', to: '/projects' },
  { label: 'Jazz Improv Session', to: '/projects' },
]

const SCORE_CHART = [
  { title: 'Clair de Lune', sub: 'Debussy · Piano' },
  { title: 'Bohemian Rhapsody', sub: 'Queen · Piano' },
  { title: 'Fly Me to the Moon', sub: 'Sinatra' },
  { title: 'River Flows in You', sub: 'Yiruma · Piano' },
  { title: 'Hotel California', sub: 'Eagles · Guitar' },
]

const SONG_CHART = [
  { title: 'Blinding Lights', sub: 'The Weeknd' },
  { title: 'As It Was', sub: 'Harry Styles' },
  { title: 'Anti-Hero', sub: 'Taylor Swift' },
  { title: 'Levitating', sub: 'Dua Lipa' },
  { title: 'Shape of You', sub: 'Ed Sheeran' },
]

const PEDAL_CHART = [
  { title: 'Tube Screamer', sub: 'Overdrive · Ibanez' },
  { title: 'Big Muff', sub: 'Fuzz · Electro-Harmonix' },
  { title: 'Holy Grail', sub: 'Reverb · Electro-Harmonix' },
  { title: 'DD-8', sub: 'Delay · Boss' },
  { title: 'CE-2W', sub: 'Chorus · Boss' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const [query, setQuery] = useState('')
  const { sendMessage } = useAgent()
  const navigate = useNavigate()

  const handleSend = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    sendMessage(trimmed)
    setQuery('')
    navigate('/learn')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 pt-[28vh] flex flex-col gap-10 pb-12">

        {/* ── Hero prompt ──────────────────────────────────────── */}
        <section className="pb-4">
          <h1 className="text-3xl font-semibold text-text-primary mb-8 text-center">Play the music you love</h1>
          <div className="w-full flex items-center gap-2 bg-surface-0 border border-border rounded-full px-5 py-3 focus-within:border-border-hover transition-colors shadow-sm">
            <button
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
              title="Add file"
            >
              <FilePlus size={16} />
            </button>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to make?"
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none resize-none leading-relaxed"
              style={{ fieldSizing: 'content', maxHeight: '120px' } as React.CSSProperties}
            />
            <button
              onClick={handleSend}
              disabled={!query.trim()}
              className={cn(
                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                query.trim()
                  ? 'bg-text-primary text-surface-0 hover:opacity-80'
                  : 'bg-surface-3 text-text-muted cursor-default',
              )}
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </section>

        {/* ── Recommendations ─────────────────────────────────── */}
        <section>
          <SectionHeader title="Recommended for you" />
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {RECOMMENDATIONS.map(({ label, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="flex items-center px-4 py-2 bg-surface-0 border border-border hover:border-border-hover hover:bg-surface-2 rounded-full shrink-0 transition-colors"
              >
                <span className="text-xs font-medium text-text-primary whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── My Projects ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-secondary">My Projects</h2>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-0.5 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span>View all</span>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {MY_PROJECTS.map(({ label, to }) => (
              <button
                key={label}
                onClick={() => navigate(to)}
                className="flex flex-col gap-1 p-4 bg-surface-0 border border-border hover:border-border-hover hover:bg-surface-2 rounded-xl shrink-0 w-44 text-left transition-colors"
              >
                <p className="text-xs font-medium text-text-primary">{label}</p>
                <p className="text-2xs text-text-muted">Last edited recently</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Three Charts Side by Side ────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Top Sheet Music', items: SCORE_CHART },
            { title: 'Top Songs', items: SONG_CHART },
            { title: 'Top Pedal Effects', items: PEDAL_CHART },
          ].map(({ title, items }) => (
            <ChartCard key={title} title={title}>
              {items.map((item, i) => (
                <div
                  key={item.title}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors cursor-pointer rounded-lg"
                >
                  <span className="text-xs font-mono w-4 shrink-0 text-right text-text-muted">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{item.title}</p>
                    <p className="text-2xs text-text-muted truncate">{item.sub}</p>
                  </div>
                </div>
              ))}
            </ChartCard>
          ))}
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
    </div>
  )
}

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col bg-surface-0 border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {children}
      </div>
    </div>
  )
}
