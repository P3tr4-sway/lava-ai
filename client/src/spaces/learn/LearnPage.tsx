import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { BookOpen, ChevronRight } from 'lucide-react'
import { SpaceAgentInput } from '@/components/agent/SpaceAgentInput'

const SUB_HUBS = [
  {
    key: 'songs',
    label: 'Songs',
    description: 'Learn your favorite tracks',
    route: '/learn/songs',
  },
  {
    key: 'jam',
    label: 'Jam',
    description: 'Play along with backing tracks',
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
      <div className="max-w-5xl mx-auto px-6 pt-8 md:pt-12 flex flex-col gap-6 pb-12">

        {/* ── Space header ─────────────────────────────────────── */}
        <section className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-2 border-l-2 border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen size={20} className="text-text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Learn</h1>
            <p className="text-sm text-text-muted mt-0.5">Master songs, techniques, and musical concepts</p>
          </div>
        </section>

        {/* ── AI prompt bar ───────────────────────────────────── */}
        <SpaceAgentInput placeholder="Paste a link, describe a song, or ask anything..." />

        {/* ── Sub-hub entries ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SUB_HUBS.map((hub) => (
            <div
              key={hub.key}
              onClick={() => navigate(hub.route)}
              className="bg-surface-2 border border-border rounded-lg p-5 cursor-pointer hover:bg-surface-3 hover:border-border-hover transition-colors group flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">{hub.label}</h2>
                <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary transition-colors" />
              </div>
              <p className="text-sm text-text-secondary">{hub.description}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
