import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as Tone from 'tone'
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  FilePenLine,
  Headphones,
  Minus,
  Music2,
  Play,
  Plus,
  Sparkles,
  Waves,
} from 'lucide-react'
import { ToneMetronome } from '@/audio/ToneMetronome'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PricingCards } from '@/components/marketing/PricingCards'
import { useAgent } from '@/hooks/useAgent'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useAgentStore } from '@/stores/agentStore'

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
  route: '/tools/new',
}

const NEW_ARRIVALS = [
  { name: 'Tape Saturation', description: 'AI-trained warm analog character' },
  { name: 'Spectral Freeze', description: 'Freeze any moment with AI' },
  { name: 'Envelope Filter', description: 'Adaptive auto-wah, AI-driven' },
]

const BPM_PRESETS = [60, 80, 100, 120]

const ESSENTIAL_PRACTICE_TOOLS = [
  {
    id: 'metronome',
    icon: Clock3,
    tag: 'Tempo',
    title: 'Metronome',
    description: '',
  },
  {
    id: 'tuner',
    icon: Music2,
    tag: 'Tune',
    title: 'Tuner',
    description: '',
  },
  {
    id: 'backing-track',
    icon: Waves,
    tag: 'Groove',
    title: 'Backing Track',
    description: '',
  },
  {
    id: 'tone-builder',
    icon: Headphones,
    tag: 'Sound',
    title: 'Tone Builder',
    description: '',
  },
  {
    id: 'practice-plan',
    icon: CalendarDays,
    tag: 'Coach',
    title: 'Practice Plan',
    description: '',
  },
  {
    id: 'chart-editor',
    icon: FilePenLine,
    tag: 'Edit',
    title: 'Chart Editor',
    description: '',
  },
] as const

const TUNING_PRESETS = [
  {
    id: 'standard',
    label: 'Standard',
    useCase: 'Everyday acoustic and electric practice',
    notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  {
    id: 'drop-d',
    label: 'Drop D',
    useCase: 'Riffs, drones, and heavier low-end voicings',
    notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  {
    id: 'dadgad',
    label: 'DADGAD',
    useCase: 'Folk textures and suspended voicings',
    notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
  },
  {
    id: 'open-g',
    label: 'Open G',
    useCase: 'Slide guitar and open chord resonance',
    notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
  },
] as const

export function PlayHubPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sendMessage } = useAgent()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const { isAuthenticated } = useRequireAuth()
  const aiToneState = { from: `${location.pathname}${location.search}${location.hash}` }

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam' })
  }, [setSpaceContext])

  const scrollToCard = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleEssentialToolClick = (toolId: (typeof ESSENTIAL_PRACTICE_TOOLS)[number]['id']) => {
    if (toolId === 'metronome') {
      scrollToCard('quick-metronome')
      return
    }

    if (toolId === 'tuner') {
      scrollToCard('tuning-reference')
      return
    }

    if (toolId === 'backing-track') {
      void sendMessage('Create a backing track in Am at 90 BPM')
      return
    }

    if (toolId === 'practice-plan') {
      void sendMessage('Build a 20-minute guitar practice plan for today')
      return
    }

    if (toolId === 'chart-editor') {
      navigate('/editor')
      return
    }

    navigate('/tools/new', { state: aiToneState })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-16 pt-12 md:px-8 md:pt-16">
        <section className="rounded-[30px] border border-border bg-surface-1 p-7 md:p-10">
          <div className="max-w-[52rem]">
            <h1 className="mb-3 text-3xl font-bold text-text-primary md:text-4xl">
              Practice tools for the everyday session
            </h1>
            <p className="text-sm leading-6 text-text-secondary md:text-base">
              Start with the basics like a metronome and tuner, then layer in
              backing tracks, tone design, and AI practice ideas when you need them.
            </p>
          </div>

        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold text-text-primary">Everyday practice tools</h2>
            <ArrowRight size={16} className="text-text-secondary" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ESSENTIAL_PRACTICE_TOOLS.map(({ id, icon: Icon, tag, title, description }) => (
              <button
                key={id}
                onClick={() => handleEssentialToolClick(id)}
                className="rounded-2xl border border-border bg-surface-1 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-border-hover"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <span className="rounded-full border border-border bg-surface-0 px-2.5 py-1 text-2xs font-medium text-text-secondary">
                    {tag}
                  </span>
                  <div className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-0 text-text-primary">
                    <Icon size={18} />
                  </div>
                </div>
                <p className="text-lg font-semibold text-text-primary">{title}</p>
                {description ? <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <QuickMetronomeCard />
          <TuningReferenceCard />
        </section>

        {MY_GEAR && (
          <section>
            <button
              onClick={() => navigate(MY_GEAR.route, { state: aiToneState })}
              className="w-full rounded-2xl border border-border bg-surface-1 p-6 text-left transition-all group hover:border-border-hover"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                    Continue where you left off
                  </p>
                  <p className="truncate text-2xl font-bold leading-tight text-text-primary">
                    {MY_GEAR.name}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">{MY_GEAR.chain}</p>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-text-primary transition-transform group-hover:scale-105">
                  <Play size={22} className="ml-1 text-surface-0" fill="currentColor" />
                </div>
              </div>
              <p className="text-xs text-text-muted">Last used {MY_GEAR.lastUsed}</p>
            </button>
          </section>
        )}

        <section>
          <p className="mb-4 text-sm text-text-muted">AI-generated tones to get you started</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURED_TONES.map((tone) => (
              <div
                key={tone.name}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-surface-0 transition-all hover:-translate-y-0.5 hover:border-border-hover"
              >
                <div
                  className={`relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br ${tone.gradient}`}
                >
                  <Headphones size={28} className="text-white/30" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-0/50 backdrop-blur-sm">
                      <Play size={18} className="ml-0.5 text-text-primary" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="text-sm font-semibold leading-tight text-text-primary">{tone.name}</p>
                  <div className="mt-2 flex gap-1.5">
                    {tone.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-4 text-sm text-text-muted">New AI-powered effects</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {NEW_ARRIVALS.map((item) => (
              <button
                key={item.name}
                className="group rounded-xl border border-border bg-surface-0 p-4 text-left transition-all hover:border-border-hover"
              >
                <Sparkles
                  size={20}
                  className="mb-2 text-text-secondary transition-colors group-hover:text-text-primary"
                />
                <p className="text-sm font-medium text-text-primary">{item.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        {!isAuthenticated && (
          <section>
            <p className="mb-4 text-sm text-text-muted">Plans & Pricing</p>
            <PricingCards />
          </section>
        )}
      </div>
    </div>
  )
}

function QuickMetronomeCard() {
  const metronomeRef = useRef<ToneMetronome | null>(null)
  const [bpm, setBpm] = useState(90)
  const [isRunning, setIsRunning] = useState(false)
  const [activeBeat, setActiveBeat] = useState(0)

  useEffect(() => {
    const metronome = new ToneMetronome(4, bpm)
    metronome.setEnabled(true)
    metronome.onBeat = () => {
      setActiveBeat((prev) => (prev % 4) + 1)
    }
    metronomeRef.current = metronome

    return () => {
      metronome.stopStandalone()
      metronome.dispose()
      metronomeRef.current = null
    }
  }, [])

  useEffect(() => {
    const metronome = metronomeRef.current
    if (!metronome) return

    metronome.setBpm(bpm)

    if (!isRunning) return

    // BPM 改变时重启 standalone 时钟，确保新的节拍间隔立刻生效。
    metronome.stopStandalone()
    setActiveBeat(0)
    metronome.startStandalone()
  }, [bpm, isRunning])

  const adjustBpm = (delta: number) => {
    setBpm((prev) => Math.min(220, Math.max(40, prev + delta)))
  }

  const toggleMetronome = async () => {
    const metronome = metronomeRef.current
    if (!metronome) return

    if (isRunning) {
      metronome.stopStandalone()
      setIsRunning(false)
      setActiveBeat(0)
      return
    }

    await Tone.start()
    metronome.setEnabled(true)
    metronome.setBpm(bpm)
    setActiveBeat(0)
    metronome.startStandalone()
    setIsRunning(true)
  }

  return (
    <Card id="quick-metronome" className="rounded-2xl bg-surface-1 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
            Essential tool
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-text-primary">Quick metronome</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
            Keep a steady click ready for warmups, strumming drills, and timing work.
          </p>
        </div>
        <div className="rounded-full border border-border bg-surface-0 px-4 py-2 text-lg font-semibold text-text-primary">
          {bpm} BPM
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {BPM_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => setBpm(preset)}
            className="rounded-full border border-border bg-surface-0 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            {preset} BPM
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => adjustBpm(-5)}>
          <Minus size={16} />
          5 BPM
        </Button>
        <Button variant="outline" onClick={() => adjustBpm(5)}>
          <Plus size={16} />
          5 BPM
        </Button>
        <Button onClick={() => void toggleMetronome()}>
          {isRunning ? 'Stop click' : 'Start click'}
        </Button>
      </div>

      <div className="mt-8 flex items-center gap-3">
        {[1, 2, 3, 4].map((beat) => (
          <div
            key={beat}
            className="h-3 flex-1 rounded-full transition-colors"
            style={{
              background:
                activeBeat === beat
                  ? beat === 1
                    ? 'var(--warning)'
                    : 'var(--accent)'
                  : 'var(--surface-3)',
            }}
          />
        ))}
      </div>
    </Card>
  )
}

function TuningReferenceCard() {
  const [selectedTuningId, setSelectedTuningId] =
    useState<(typeof TUNING_PRESETS)[number]['id']>('standard')
  const selectedTuning =
    TUNING_PRESETS.find((preset) => preset.id === selectedTuningId) ?? TUNING_PRESETS[0]

  return (
    <Card id="tuning-reference" className="rounded-2xl bg-surface-1 p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
        Essential tool
      </p>
      <h3 className="mt-2 text-2xl font-semibold text-text-primary">Tuning reference</h3>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        Keep your most-used guitar tunings visible before you jump into a practice block.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TUNING_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => setSelectedTuningId(preset.id)}
            className="rounded-full border px-3 py-1.5 text-xs transition-colors"
            style={{
              borderColor: selectedTuningId === preset.id ? 'var(--accent)' : 'var(--border)',
              background: selectedTuningId === preset.id ? 'var(--surface-0)' : 'var(--surface-2)',
              color: 'var(--text-primary)',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface-0 p-4">
        <p className="text-sm font-medium text-text-primary">{selectedTuning.label}</p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">{selectedTuning.useCase}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {selectedTuning.notes.map((note, index) => (
            <div
              key={`${selectedTuning.id}-${note}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-1 px-3 py-2"
            >
              <span className="text-xs text-text-secondary">String {6 - index}</span>
              <span className="text-sm font-semibold text-text-primary">{note}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-1 px-3 py-3 text-xs leading-5 text-text-secondary">
          Reference pitch: A4 = 440Hz. Tune low string to high string before opening a backing
          track or tone session.
        </div>
      </div>
    </Card>
  )
}
