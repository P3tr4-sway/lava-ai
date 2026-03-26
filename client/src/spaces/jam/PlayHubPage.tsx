import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowRight, Play, Sparkles, Headphones, Plus } from 'lucide-react'
import { SpaceAgentInput, type SpaceAgentInputRef } from '@/components/agent/SpaceAgentInput'
import { Button } from '@/components/ui/Button'
import { PricingCards } from '@/components/marketing/PricingCards'
import { useRequireAuth } from '@/hooks/useRequireAuth'

// ─── Mock data ────────────────────────────────────────────────────────────────

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

const MY_GEAR = {
  name: 'Sunday Jazz Warmth',
  chain: 'Compressor → Warm OD → Spring Reverb',
  lastUsed: '2 days ago',
  gradient: 'from-amber-700 to-orange-900',
  route: '/tools',
}

const NEW_ARRIVALS = [
  { name: 'Tape Saturation', description: 'AI-trained warm analog character' },
  { name: 'Spectral Freeze', description: 'Freeze any moment with AI' },
  { name: 'Envelope Filter', description: 'Adaptive auto-wah, AI-driven' },
]

const SUGGESTIONS = [
  'Warm fingerpicking tone',
  'Heavy distortion for metal',
  'Clean jazz with reverb',
  'Lo-fi ambient shimmer',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PlayHubPage() {
  const navigate = useNavigate()
  const inputRef = useRef<SpaceAgentInputRef>(null)
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const { isAuthenticated } = useRequireAuth()

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam' })
  }, [setSpaceContext])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 pt-[22vh] flex flex-col gap-10 pb-12">

        {/* ── 1. Hero — search-first ──────────────────────────── */}
        <section>
          <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">Your AI music toolkit</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Describe the sound you're after and LAVA AI builds a custom amp and effects chain — ready to tweak, save, and drop into any DAW.</p>
          <SpaceAgentInput
            ref={inputRef}
            placeholder="Describe a tone — e.g. 'warm fingerpicking with spring reverb'..."
          />

          {/* Suggestion tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => inputRef.current?.setValue(s)}
                className="px-3 py-1.5 text-xs text-text-secondary bg-surface-1 border border-border rounded-full hover:border-border-hover hover:text-text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Create a Tone CTA */}
          <div className="flex justify-center mt-6">
            <Button onClick={() => navigate('/tools/new')} className="rounded-full px-6">
              <Plus size={16} className="mr-2" />
              Build a Tone with AI
            </Button>
          </div>
        </section>

        {/* ── 2. My Gear — continue where you left off ────────── */}
        {MY_GEAR && (
          <section>
            <button
              onClick={() => navigate(MY_GEAR.route)}
              className="w-full bg-surface-1 border border-border hover:border-border-hover rounded-2xl p-6 cursor-pointer transition-all group text-left"
            >
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-2">Continue where you left off</p>
                  <p className="text-2xl font-bold text-text-primary leading-tight truncate">{MY_GEAR.name}</p>
                  <p className="text-sm text-text-secondary mt-1">{MY_GEAR.chain}</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Play size={22} className="text-surface-0 ml-1" fill="currentColor" />
                </div>
              </div>
              <p className="text-xs text-text-muted">Last used {MY_GEAR.lastUsed}</p>
            </button>
          </section>
        )}

        {/* ── 3. Featured Tones ───────────────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">AI-generated tones to get you started</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURED_TONES.map((tone) => (
              <div
                key={tone.name}
                className="flex flex-col bg-surface-0 border border-border hover:border-border-hover rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 group"
              >
                <div className={`aspect-[16/9] bg-gradient-to-br ${tone.gradient} flex items-center justify-center relative`}>
                  <Headphones size={28} className="text-white/30" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-0/50 backdrop-blur-sm">
                      <Play size={18} className="text-text-primary ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="text-sm font-semibold text-text-primary leading-tight">{tone.name}</p>
                  <div className="flex gap-1.5 mt-2">
                    {tone.tags.map((tag) => (
                      <span key={tag} className="text-2xs text-text-secondary bg-surface-2 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. Gear Shop: New Arrivals ──────────────────────── */}
        <section>
          <p className="text-sm text-text-muted mb-4">New AI-powered effects</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {NEW_ARRIVALS.map((item) => (
              <button
                key={item.name}
                className="bg-surface-0 border border-border hover:border-border-hover rounded-xl p-4 cursor-pointer transition-all group text-left"
              >
                <Sparkles size={20} className="text-text-secondary group-hover:text-text-primary transition-colors mb-2" />
                <p className="text-sm font-medium text-text-primary">{item.name}</p>
                <p className="text-xs text-text-secondary mt-0.5">{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── 5. Pricing (guests only) ─────────────────────────── */}
        {!isAuthenticated && (
          <section>
            <p className="text-sm text-text-muted mb-4">Plans & Pricing</p>
            <PricingCards />
          </section>
        )}

      </div>
    </div>
  )
}
