import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowRight, ChevronRight, Music } from 'lucide-react'
import { SpaceAgentInput } from '@/components/agent/SpaceAgentInput'
import { Button } from '@/components/ui/Button'
import { ModuleDrawer } from '@/components/ModuleDrawer'
import { CHORD_CHARTS } from '@/data/chordCharts'

// Continue where you left off — only shown if user has activity
const CONTINUE_ITEM = {
  songTitle: 'Autumn Leaves',
  artist: 'Joseph Kosma',
  part: 'Rhythm Guitar',
  section: 'Section 2',
  progress: 42, // percent
  coverGradient: 'from-amber-700 to-orange-900',
  route: '/learn/songs/autumn-leaves',
}

const RECOMMENDED_GRADIENTS = [
  'from-slate-700 to-slate-900',
  'from-sky-700 to-indigo-900',
  'from-amber-600 to-rose-800',
]

const RECOMMENDED_IDS = ['1', '7', '6'] // Autumn Leaves, Bossa Nova Basics, Minor Swing
const RECOMMENDED = RECOMMENDED_IDS.map((id, i) => {
  const chart = CHORD_CHARTS.find((c) => c.id === id)!
  return { ...chart, gradient: RECOMMENDED_GRADIENTS[i] }
})

const DAILY_SKILL = {
  title: 'Fingerpicking Pattern #3',
  description: 'A classic Travis picking pattern used in folk & country',
}

const SUB_HUBS = [
  {
    key: 'songs',
    label: 'Songs',
    description: 'Practice your favorite tracks',
    route: '/files',
  },
  {
    key: 'jam',
    label: 'Practice Session',
    description: 'Practice with backing tracks',
    route: '/learn/jam',
  },
  {
    key: 'techniques',
    label: 'Techniques',
    description: 'Master scales, chords & more',
    route: '/learn/techniques',
  },
]

export function LearnPage() {
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn' })
  }, [setSpaceContext])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-10 md:px-8 md:pt-14">

        {/* ── Space header ─────────────────────────────────────── */}
        <section className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Learn</h1>
            <p className="text-sm text-text-muted mt-0.5">Master songs, techniques, and musical concepts</p>
          </div>
          <ModuleDrawer moduleSpace="learn" label="My Learn" />
        </section>

        {/* ── AI prompt bar ───────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <SpaceAgentInput
            density="roomy"
            placeholder="Paste a link, describe a song, or ask anything..."
          />
          <p className="text-xs text-text-muted">Pick a song. Get live practice help.</p>
        </div>

        {/* ── Sub-hub entries ──────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SUB_HUBS.map((hub) => (
            <div
              key={hub.key}
              onClick={() => navigate(hub.route)}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-6 cursor-pointer transition-colors hover:border-border-hover hover:bg-surface-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">{hub.label}</h2>
                <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary transition-colors" />
              </div>
              <p className="text-sm text-text-secondary">{hub.description}</p>
            </div>
          ))}
        </div>

        {/* ── Continue where you left off ────────────────────── */}
        {CONTINUE_ITEM && (
          <div className="bg-surface-2 border border-border rounded-lg p-5">
            <p className="text-xs text-text-muted mb-3">Continue where you left off</p>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${CONTINUE_ITEM.coverGradient} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{CONTINUE_ITEM.songTitle}</p>
                <p className="text-xs text-text-muted">{CONTINUE_ITEM.artist}</p>
                <div className="mt-1.5 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${CONTINUE_ITEM.progress}%` }}
                  />
                </div>
                <p className="text-xs text-text-secondary mt-1">{CONTINUE_ITEM.part} · {CONTINUE_ITEM.section}</p>
              </div>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => navigate(CONTINUE_ITEM.route)}
              >
                Continue <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Recommended for you ────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">Recommended for you</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {RECOMMENDED.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/learn/songs/${item.id}`)}
                className="bg-surface-2 border border-border rounded-lg overflow-hidden cursor-pointer hover:bg-surface-3 hover:border-border-hover transition-all hover:-translate-y-0.5 group"
              >
                <div className={`aspect-[16/9] bg-gradient-to-br ${item.gradient}`} />
                <div className="p-4">
                  <span className="mb-2 inline-flex rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                    AI Practice
                  </span>
                  <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{item.artist ?? item.style}</p>
                  <div className="flex gap-1.5 mt-2">
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary">{item.key}</span>
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary">{item.style}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Daily skill ────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">Daily skill</p>
          <div className="bg-surface-2 border border-border rounded-lg p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                <Music size={20} className="text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{DAILY_SKILL.title}</p>
                <p className="text-sm text-text-secondary">{DAILY_SKILL.description}</p>
              </div>
              <button className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 text-sm shrink-0">
                Try it <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
