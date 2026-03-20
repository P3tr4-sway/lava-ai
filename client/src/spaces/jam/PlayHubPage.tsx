import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowRight, ChevronRight, Sparkles, Headphones } from 'lucide-react'
import { SpaceAgentInput } from '@/components/agent/SpaceAgentInput'
import { Button } from '@/components/ui/Button'

const FEATURED_TONES = [
  {
    name: 'Vintage Blues Crunch',
    tags: ['Blues', 'Overdrive'],
    gradient: 'from-orange-700 to-red-900',
  },
  {
    name: 'John Mayer Clean',
    tags: ['Clean', 'Chorus'],
    gradient: 'from-sky-700 to-indigo-900',
  },
  {
    name: 'Ambient Shimmer',
    tags: ['Reverb', 'Delay'],
    gradient: 'from-violet-700 to-purple-900',
  },
]

// My Gear — previously saved tone chains
const MY_GEAR = {
  name: 'Sunday Jazz Warmth',
  chain: 'Compressor → Warm OD → Spring Reverb',
  lastUsed: '2 days ago',
  gradient: 'from-amber-700 to-orange-900',
  route: '/jam',
}

const NEW_ARRIVALS = [
  { name: 'Tape Saturation', description: 'Warm analog tape character' },
  { name: 'Spectral Freeze', description: 'Sustain any moment in time' },
  { name: 'Envelope Filter', description: 'Auto-wah with AI dynamics' },
]

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
        <section>
          <h1 className="text-xl font-semibold text-text-primary">Play</h1>
          <p className="text-sm text-text-muted mt-0.5">AI-powered tools for playing and jamming</p>
        </section>

        {/* ── AI prompt bar ───────────────────────────────────── */}
        <SpaceAgentInput placeholder="Describe the tone you want — e.g. 'warm fingerpicking tone'..." />

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

        {/* ── Today's Featured Tones ─────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">Today's Featured Tones</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FEATURED_TONES.map((tone) => (
              <div
                key={tone.name}
                className="bg-surface-2 border border-border rounded-lg overflow-hidden cursor-pointer hover:bg-surface-3 hover:border-border-hover transition-all hover:-translate-y-0.5 group"
              >
                <div className={`aspect-[16/9] bg-gradient-to-br ${tone.gradient} flex items-center justify-center`}>
                  <Headphones size={28} className="text-white/30" />
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-text-primary">{tone.name}</p>
                  <div className="flex gap-1.5 mt-2">
                    {tone.tags.map((tag) => (
                      <span key={tag} className="text-2xs px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── My Gear ────────────────────────────────────────── */}
        {MY_GEAR && (
          <div className="bg-surface-2 border border-border rounded-lg p-5">
            <p className="text-xs text-text-muted mb-3">My Gear</p>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${MY_GEAR.gradient} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{MY_GEAR.name}</p>
                <p className="text-xs text-text-muted">{MY_GEAR.chain}</p>
                <p className="text-xs text-text-secondary mt-1">Last used {MY_GEAR.lastUsed}</p>
              </div>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => navigate(MY_GEAR.route)}
              >
                Load <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Gear Shop: New Arrivals ────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">Gear Shop: New Arrivals</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NEW_ARRIVALS.map((item) => (
              <div
                key={item.name}
                className="bg-surface-2 border border-border rounded-lg p-5 cursor-pointer hover:bg-surface-3 hover:border-border-hover transition-all hover:-translate-y-0.5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-secondary">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
