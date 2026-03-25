import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'
import { cn } from '@/components/ui/utils'
import { DawPanel } from '@/components/daw/DawPanel'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Save,
  Share2,
  Power,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pedal {
  id: string
  name: string
  category: PedalCategory
  color: string
  knobs: Knob[]
}

interface Knob {
  id: string
  label: string
  value: number // 0-100
  min?: number
  max?: number
}

type PedalCategory = 'overdrive' | 'distortion' | 'delay' | 'reverb' | 'modulation' | 'amp' | 'cab' | 'compressor'

interface ChainSlot {
  id: string
  pedal: Pedal | null
}

interface Preset {
  id: string
  name: string
  chain: string[]
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PEDAL_CATALOG: Pedal[] = [
  // Overdrive
  { id: 'tube-808', name: 'Tube 808', category: 'overdrive', color: 'bg-green-600', knobs: [
    { id: 'drive', label: 'Drive', value: 55 },
    { id: 'tone', label: 'Tone', value: 60 },
    { id: 'level', label: 'Level', value: 70 },
  ]},
  { id: 'warm-od', name: 'Warm OD', category: 'overdrive', color: 'bg-yellow-600', knobs: [
    { id: 'gain', label: 'Gain', value: 45 },
    { id: 'tone', label: 'Tone', value: 50 },
    { id: 'vol', label: 'Volume', value: 65 },
  ]},
  { id: 'blues-driver', name: 'Blues Driver', category: 'overdrive', color: 'bg-blue-600', knobs: [
    { id: 'gain', label: 'Gain', value: 40 },
    { id: 'tone', label: 'Tone', value: 55 },
    { id: 'level', label: 'Level', value: 60 },
  ]},
  // Distortion
  { id: 'heavy-metal', name: 'Heavy Metal', category: 'distortion', color: 'bg-red-700', knobs: [
    { id: 'dist', label: 'Distortion', value: 80 },
    { id: 'low', label: 'Low', value: 50 },
    { id: 'high', label: 'High', value: 65 },
    { id: 'level', label: 'Level', value: 70 },
  ]},
  { id: 'fuzz-face', name: 'Fuzz Face', category: 'distortion', color: 'bg-orange-700', knobs: [
    { id: 'fuzz', label: 'Fuzz', value: 70 },
    { id: 'vol', label: 'Volume', value: 55 },
  ]},
  // Delay
  { id: 'tape-delay', name: 'Tape Delay', category: 'delay', color: 'bg-teal-600', knobs: [
    { id: 'time', label: 'Time', value: 45 },
    { id: 'feedback', label: 'Feedback', value: 35 },
    { id: 'mix', label: 'Mix', value: 40 },
  ]},
  { id: 'digital-delay', name: 'Digital Delay', category: 'delay', color: 'bg-cyan-600', knobs: [
    { id: 'time', label: 'Time', value: 50 },
    { id: 'feedback', label: 'Feedback', value: 30 },
    { id: 'mix', label: 'Mix', value: 35 },
    { id: 'mod', label: 'Mod', value: 20 },
  ]},
  // Reverb
  { id: 'spring-reverb', name: 'Spring Reverb', category: 'reverb', color: 'bg-emerald-600', knobs: [
    { id: 'decay', label: 'Decay', value: 55 },
    { id: 'mix', label: 'Mix', value: 40 },
    { id: 'tone', label: 'Tone', value: 50 },
  ]},
  { id: 'bright-reverb', name: 'Bright Reverb', category: 'reverb', color: 'bg-sky-500', knobs: [
    { id: 'decay', label: 'Decay', value: 65 },
    { id: 'mix', label: 'Mix', value: 50 },
    { id: 'shimmer', label: 'Shimmer', value: 40 },
  ]},
  // Modulation
  { id: 'chorus', name: 'Chorus', category: 'modulation', color: 'bg-purple-600', knobs: [
    { id: 'rate', label: 'Rate', value: 40 },
    { id: 'depth', label: 'Depth', value: 55 },
    { id: 'mix', label: 'Mix', value: 45 },
  ]},
  { id: 'phaser', name: 'Phaser', category: 'modulation', color: 'bg-violet-600', knobs: [
    { id: 'rate', label: 'Rate', value: 35 },
    { id: 'depth', label: 'Depth', value: 60 },
    { id: 'feedback', label: 'Feedback', value: 30 },
  ]},
  // Amp
  { id: 'ma-jmp-50', name: 'MA JMP 50', category: 'amp', color: 'bg-amber-700', knobs: [
    { id: 'gain', label: 'Gain', value: 50 },
    { id: 'bass', label: 'Bass', value: 55 },
    { id: 'mid', label: 'Mid', value: 60 },
    { id: 'treble', label: 'Treble', value: 55 },
    { id: 'master', label: 'Master', value: 45 },
  ]},
  { id: 'clean-amp', name: 'Clean Twin', category: 'amp', color: 'bg-stone-600', knobs: [
    { id: 'vol', label: 'Volume', value: 50 },
    { id: 'bass', label: 'Bass', value: 50 },
    { id: 'mid', label: 'Mid', value: 50 },
    { id: 'treble', label: 'Treble', value: 55 },
    { id: 'reverb', label: 'Reverb', value: 30 },
  ]},
  // Cab
  { id: 'ma-412-v2', name: 'MA 412 V2', category: 'cab', color: 'bg-stone-700', knobs: [
    { id: 'mic', label: 'Mic Pos', value: 50 },
    { id: 'room', label: 'Room', value: 35 },
  ]},
  // Compressor
  { id: 'studio-comp', name: 'Studio Comp', category: 'compressor', color: 'bg-slate-600', knobs: [
    { id: 'threshold', label: 'Threshold', value: 40 },
    { id: 'ratio', label: 'Ratio', value: 50 },
    { id: 'attack', label: 'Attack', value: 35 },
    { id: 'release', label: 'Release', value: 55 },
  ]},
]

const CATEGORIES: { key: PedalCategory; label: string }[] = [
  { key: 'overdrive', label: 'Overdrive' },
  { key: 'distortion', label: 'Distortion' },
  { key: 'delay', label: 'Delay' },
  { key: 'reverb', label: 'Reverb' },
  { key: 'modulation', label: 'Modulation' },
  { key: 'amp', label: 'Amp' },
  { key: 'cab', label: 'Cabinet' },
  { key: 'compressor', label: 'Compressor' },
]

const PRESETS: Preset[] = [
  { id: 'blues-crunch', name: 'Blues Crunch', chain: ['tube-808', 'ma-jmp-50', 'ma-412-v2', 'spring-reverb'] },
  { id: 'clean-jazz', name: 'Clean Jazz', chain: ['studio-comp', 'clean-amp', 'chorus', 'tape-delay'] },
  { id: 'metal-tone', name: 'Metal Tone', chain: ['heavy-metal', 'ma-jmp-50', 'ma-412-v2'] },
  { id: 'ambient-shimmer', name: 'Ambient Shimmer', chain: ['chorus', 'tape-delay', 'bright-reverb'] },
]

const TOTAL_BARS = 16
const BEATS_PER_BAR = 4

function findPedal(id: string): Pedal | undefined {
  return PEDAL_CATALOG.find((p) => p.id === id)
}

// ─── Knob component ──────────────────────────────────────────────────────────

interface KnobControlProps {
  knob: Knob
  onChange: (value: number) => void
  size?: 'sm' | 'lg'
}

function KnobControl({ knob, onChange, size = 'sm' }: KnobControlProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  const rotation = (knob.value / 100) * 270 - 135 // -135 to +135 degrees

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startValue: knob.value }
    const el = knobRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [knob.value])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = (dragRef.current.startY - e.clientY) * 0.5
    const newValue = Math.max(0, Math.min(100, dragRef.current.startValue + delta))
    onChange(Math.round(newValue))
  }, [onChange])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const isLarge = size === 'lg'

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          'rounded-full bg-surface-0 border-2 border-border-hover cursor-grab active:cursor-grabbing relative select-none',
          isLarge ? 'w-14 h-14' : 'w-8 h-8',
        )}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Indicator line */}
        <div className={cn(
          'absolute left-1/2 bg-text-primary rounded-full -translate-x-1/2',
          isLarge ? 'w-1 h-3 top-1' : 'w-0.5 h-2 top-0.5',
        )} />
      </div>
      <span className={cn(
        'text-text-secondary leading-none',
        isLarge ? 'text-xs' : 'text-2xs',
      )}>{knob.label}</span>
      <span className={cn(
        'text-text-muted leading-none tabular-nums',
        isLarge ? 'text-xs' : 'text-2xs',
      )}>{knob.value}</span>
    </div>
  )
}

// ─── Chain pedal thumbnail ───────────────────────────────────────────────────

interface ChainPedalProps {
  slot: ChainSlot
  isSelected: boolean
  onClick: () => void
}

function ChainPedalThumbnail({ slot, isSelected, onClick }: ChainPedalProps) {
  if (!slot.pedal) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-20 h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-text-muted hover:border-border-hover hover:text-text-secondary transition-colors shrink-0',
          isSelected ? 'border-accent bg-surface-3' : 'border-border',
        )}
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-20 h-24 rounded-lg border-2 flex flex-col items-center justify-center gap-1 shrink-0 transition-all',
        isSelected ? 'border-accent ring-1 ring-accent/30 bg-surface-3' : 'border-border hover:border-border-hover',
      )}
    >
      <div className={cn('w-10 h-10 rounded-md flex items-center justify-center', slot.pedal.color)}>
        <Power size={16} className="text-white/80" />
      </div>
      <span className="text-2xs text-text-primary font-medium leading-tight text-center px-1 truncate w-full">
        {slot.pedal.name}
      </span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TonePage() {
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  // DAW
  const dawTracks = useDawPanelStore((s) => s.tracks)
  const setDawTracks = useDawPanelStore((s) => s.setTracks)
  const addDawTrack = useDawPanelStore((s) => s.addTrack)
  const updateDawTrack = useDawPanelStore((s) => s.updateTrack)

  // Tone state
  const [chain, setChain] = useState<ChainSlot[]>(() =>
    PRESETS[0].chain.map((pedalId, i) => ({
      id: `slot-${i}`,
      pedal: findPedal(pedalId) ?? null,
    })),
  )
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-0')
  const [activeCategory, setActiveCategory] = useState<PedalCategory>('overdrive')
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESETS[0].id)
  const [presetOpen, setPresetOpen] = useState(false)
  const [pedalKnobs, setPedalKnobs] = useState<Record<string, Knob[]>>({})

  const selectedSlot = chain.find((s) => s.id === selectedSlotId)
  const selectedPedal = selectedSlot?.pedal ?? null

  // Get knobs for current pedal (with overrides)
  const currentKnobs = selectedPedal
    ? pedalKnobs[selectedSlot!.id] ?? selectedPedal.knobs
    : []

  // When selecting a slot with a pedal, jump to its category
  useEffect(() => {
    if (selectedPedal) {
      setActiveCategory(selectedPedal.category)
    }
  }, [selectedPedal])

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam' })
  }, [setSpaceContext])

  // Seed DAW tracks
  useEffect(() => {
    setDawTracks([
      makeTrack('Guitar', 0),
      makeTrack('Reference', 1),
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKnobChange = useCallback((knobId: string, value: number) => {
    if (!selectedSlot) return
    const knobs = pedalKnobs[selectedSlot.id] ?? selectedPedal!.knobs
    const updated = knobs.map((k) => (k.id === knobId ? { ...k, value } : k))
    setPedalKnobs((prev) => ({ ...prev, [selectedSlot.id]: updated }))
  }, [selectedSlot, pedalKnobs, selectedPedal])

  const handlePickPedal = (pedal: Pedal) => {
    setChain((prev) =>
      prev.map((slot) =>
        slot.id === selectedSlotId ? { ...slot, pedal } : slot,
      ),
    )
    // Clear knob overrides for this slot
    setPedalKnobs((prev) => {
      const next = { ...prev }
      delete next[selectedSlotId]
      return next
    })
  }

  const handleAddSlot = () => {
    const newSlot: ChainSlot = { id: `slot-${Date.now()}`, pedal: null }
    setChain((prev) => [...prev, newSlot])
    setSelectedSlotId(newSlot.id)
  }

  const handleRemoveSlot = (slotId: string) => {
    setChain((prev) => {
      const next = prev.filter((s) => s.id !== slotId)
      if (selectedSlotId === slotId && next.length > 0) {
        setSelectedSlotId(next[0].id)
      }
      return next
    })
  }

  const handleLoadPreset = (preset: Preset) => {
    const newChain = preset.chain.map((pedalId, i) => ({
      id: `slot-${i}`,
      pedal: findPedal(pedalId) ?? null,
    }))
    setChain(newChain)
    setSelectedSlotId('slot-0')
    setSelectedPreset(preset.id)
    setPedalKnobs({})
    setPresetOpen(false)
  }

  const filteredPedals = PEDAL_CATALOG.filter((p) => p.category === activeCategory)
  const currentPreset = PRESETS.find((p) => p.id === selectedPreset)

  return (
    <div className="h-full flex flex-col">

      {/* ── Main content area ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col md:flex-row">

          {/* ── Left column ───────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

            {/* Preset picker area */}
            <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon-sm" onClick={() => navigate('/jam')}>
                  <ChevronLeft size={16} />
                </Button>
                <div className="relative">
                  <button
                    onClick={() => setPresetOpen(!presetOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-lg hover:border-border-hover transition-colors"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {currentPreset?.name ?? 'Custom'}
                    </span>
                    <ChevronDown size={14} className="text-text-muted" />
                  </button>
                  {presetOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-surface-2 border border-border rounded-lg shadow-lg z-20 py-1">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleLoadPreset(preset)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm hover:bg-surface-3 transition-colors',
                            selectedPreset === preset.id ? 'text-text-primary font-medium' : 'text-text-secondary',
                          )}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" title="Reset">
                  <RotateCcw size={14} />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Save">
                  <Save size={14} />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Share">
                  <Share2 size={14} />
                </Button>
              </div>
            </div>

            {/* Chain area */}
            <div className="border-b border-border bg-surface-1 px-4 py-5">
              <p className="text-xs text-text-muted mb-3 uppercase tracking-widest">Signal Chain</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {/* IN label */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-2xs font-mono text-green-500 uppercase">IN</span>
                  <div className="w-6 h-px bg-green-500/50" />
                </div>

                {chain.map((slot, i) => (
                  <div key={slot.id} className="flex items-center gap-2 shrink-0">
                    <ChainPedalThumbnail
                      slot={slot}
                      isSelected={slot.id === selectedSlotId}
                      onClick={() => setSelectedSlotId(slot.id)}
                    />
                    {i < chain.length - 1 && (
                      <div className="w-4 h-px bg-border" />
                    )}
                  </div>
                ))}

                {/* Add slot */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-4 h-px bg-border" />
                  <button
                    onClick={handleAddSlot}
                    className="w-8 h-8 rounded-full border border-dashed border-border hover:border-border-hover flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <span className="text-sm leading-none">+</span>
                  </button>
                </div>

                {/* OUT label */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-6 h-px bg-red-500/50" />
                  <span className="text-2xs font-mono text-red-500 uppercase">OUT</span>
                </div>
              </div>
            </div>

            {/* Effect pedal picking area */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Category tabs */}
              <div className="border-b border-border px-4 py-2 flex gap-1 overflow-x-auto">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors shrink-0',
                      activeCategory === cat.key
                        ? 'bg-accent text-surface-0'
                        : 'bg-surface-2 text-text-secondary hover:bg-surface-3',
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Pedal grid */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredPedals.map((pedal) => {
                    const isInChain = chain.some((s) => s.pedal?.id === pedal.id)
                    return (
                      <button
                        key={pedal.id}
                        onClick={() => handlePickPedal(pedal)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:-translate-y-0.5',
                          isInChain
                            ? 'border-accent bg-surface-2'
                            : 'border-border hover:border-border-hover bg-surface-1 hover:bg-surface-2',
                        )}
                      >
                        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', pedal.color)}>
                          <Power size={20} className="text-white/80" />
                        </div>
                        <span className="text-xs font-medium text-text-primary text-center leading-tight">{pedal.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column — Effect show area ───────────────── */}
          <div className="w-full md:w-[340px] lg:w-[400px] border-l border-border bg-surface-1 flex flex-col shrink-0">
            {selectedPedal ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
                {/* Pedal visual */}
                <div className={cn(
                  'w-48 h-64 rounded-2xl border-4 border-surface-4 flex flex-col items-center justify-between py-6 px-4 shadow-lg relative',
                  selectedPedal.color,
                )}>
                  {/* LED */}
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />

                  {/* Knobs */}
                  <div className="flex flex-wrap justify-center gap-4">
                    {currentKnobs.map((knob) => (
                      <KnobControl
                        key={knob.id}
                        knob={knob}
                        onChange={(v) => handleKnobChange(knob.id, v)}
                        size="lg"
                      />
                    ))}
                  </div>

                  {/* Name plate */}
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-md px-3 py-1.5">
                    <p className="text-sm font-bold text-white tracking-wide text-center uppercase">
                      {selectedPedal.name}
                    </p>
                  </div>

                  {/* Footswitch */}
                  <div className="w-10 h-5 rounded bg-surface-4/80 border border-white/10" />
                </div>

                {/* Pedal info */}
                <div className="text-center">
                  <p className="text-base font-semibold text-text-primary">{selectedPedal.name}</p>
                  <p className="text-xs text-text-muted capitalize mt-0.5">{selectedPedal.category}</p>
                </div>

                {/* Remove from chain */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSlot(selectedSlotId)}
                  className="text-text-muted hover:text-error"
                >
                  Remove from chain
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
                  <Power size={32} className="text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary">Select a slot in the chain</p>
                <p className="text-xs text-text-muted mt-1">Then pick a pedal from the left</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── DAW Panel — fixed at bottom ──────────────────────── */}
      <DawPanel
        tracks={dawTracks}
        onUpdateTrack={updateDawTrack}
        onAddTrack={() => addDawTrack()}
        showRecordButton={true}
        totalBars={TOTAL_BARS}
        beatsPerBar={BEATS_PER_BAR}
      />
    </div>
  )
}
