import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { Music, ChevronRight } from 'lucide-react'
import { SpaceAgentInput } from '@/components/agent/SpaceAgentInput'

const SUB_HUBS = [
  {
    key: 'card-1',
    label: 'AI Effect Pedals',
    description: 'AI-powered audio effects at your fingertips',
    route: '/jam',
  },
  {
    key: 'card-2',
    label: 'AI Sheet Music',
    description: 'Generate & transcribe sheet music with AI',
    route: '/jam',
  },
  {
    key: 'card-3',
    label: 'More AI Tools',
    description: 'Explore all other AI functions',
    route: '/jam',
  },
]

export function PlayHubPage() {
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam' })
  }, [setSpaceContext])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 pt-8 md:pt-12 flex flex-col gap-6 pb-12">

        {/* ── Space header ─────────────────────────────────────── */}
        <section className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-2 border-l-2 border-violet-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <Music size={20} className="text-text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Play</h1>
            <p className="text-sm text-text-muted mt-0.5">AI-powered tools for playing and jamming</p>
          </div>
        </section>

        {/* ── AI prompt bar ───────────────────────────────────── */}
        <SpaceAgentInput placeholder="Describe an effect, generate sheet music, or ask anything..." />

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
