import type { ToneChainSlotSnapshot, ToneKnobValue, ToneProjectSnapshot } from '@lava/shared'
import { EFFECTS_PRESETS, type EffectsPreset } from '@/data/effectsPresets'

export interface Pedal {
  id: string
  name: string
  category: PedalCategory
  color: string
  knobs: Knob[]
}

export interface Knob {
  id: string
  label: string
  value: number
  min?: number
  max?: number
}

export type PedalCategory =
  | 'overdrive'
  | 'distortion'
  | 'delay'
  | 'reverb'
  | 'modulation'
  | 'amp'
  | 'cab'
  | 'compressor'

export interface ChainSlot {
  id: string
  pedal: Pedal | null
}

export type Preset = EffectsPreset

export const PEDAL_CATALOG: Pedal[] = [
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
  { id: 'ma-412-v2', name: 'MA 412 V2', category: 'cab', color: 'bg-stone-700', knobs: [
    { id: 'mic', label: 'Mic Pos', value: 50 },
    { id: 'room', label: 'Room', value: 35 },
  ]},
  { id: 'studio-comp', name: 'Studio Comp', category: 'compressor', color: 'bg-slate-600', knobs: [
    { id: 'threshold', label: 'Threshold', value: 40 },
    { id: 'ratio', label: 'Ratio', value: 50 },
    { id: 'attack', label: 'Attack', value: 35 },
    { id: 'release', label: 'Release', value: 55 },
  ]},
]

export const CATEGORIES: { key: PedalCategory; label: string }[] = [
  { key: 'overdrive', label: 'Overdrive' },
  { key: 'distortion', label: 'Distortion' },
  { key: 'delay', label: 'Delay' },
  { key: 'reverb', label: 'Reverb' },
  { key: 'modulation', label: 'Modulation' },
  { key: 'amp', label: 'Amp' },
  { key: 'cab', label: 'Cabinet' },
  { key: 'compressor', label: 'Compressor' },
]

export const PRESETS: Preset[] = EFFECTS_PRESETS

export function findPedal(id: string): Pedal | undefined {
  return PEDAL_CATALOG.find((pedal) => pedal.id === id)
}

export function getPresetName(presetId: string): string {
  return PRESETS.find((preset) => preset.id === presetId)?.name ?? 'Custom'
}

export function makeChainFromPreset(presetId: string): ChainSlot[] {
  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0]
  return preset.chain.map((pedalId, index) => ({
    id: `slot-${index}`,
    pedal: findPedal(pedalId) ?? null,
  }))
}

export function createDefaultToneState(): ToneProjectSnapshot {
  return {
    selectedPreset: PRESETS[0].id,
    selectedSlotId: 'slot-0',
    activeCategory: 'overdrive',
    chain: makeChainFromPreset(PRESETS[0].id).map((slot) => ({ id: slot.id, pedalId: slot.pedal?.id ?? null })),
    pedalKnobs: {},
  }
}

export function deserializeToneState(snapshot?: Partial<ToneProjectSnapshot> | null): ToneProjectSnapshot {
  const fallback = createDefaultToneState()
  if (!snapshot) return fallback

  const chain = Array.isArray(snapshot.chain) && snapshot.chain.length > 0
    ? snapshot.chain.map<ToneChainSlotSnapshot>((slot, index) => ({
        id: slot.id ?? `slot-${index}`,
        pedalId: slot.pedalId ?? null,
      }))
    : fallback.chain

  const selectedSlotId = typeof snapshot.selectedSlotId === 'string' && chain.some((slot) => slot.id === snapshot.selectedSlotId)
    ? snapshot.selectedSlotId
    : chain[0]?.id ?? fallback.selectedSlotId

  const pedalKnobs = Object.fromEntries(
    Object.entries(snapshot.pedalKnobs ?? {}).map(([slotId, knobs]) => [
      slotId,
      Array.isArray(knobs)
        ? knobs.map<ToneKnobValue>((knob) => ({
            id: knob.id,
            label: knob.label,
            value: knob.value,
          }))
        : [],
    ]),
  )

  return {
    selectedPreset: typeof snapshot.selectedPreset === 'string' ? snapshot.selectedPreset : fallback.selectedPreset,
    selectedSlotId,
    activeCategory: typeof snapshot.activeCategory === 'string' ? snapshot.activeCategory : fallback.activeCategory,
    chain,
    pedalKnobs,
  }
}

export function hydrateChain(snapshot: ToneProjectSnapshot): ChainSlot[] {
  return snapshot.chain.map((slot) => ({
    id: slot.id,
    pedal: slot.pedalId ? findPedal(slot.pedalId) ?? null : null,
  }))
}

export function buildChainSummary(snapshot: ToneProjectSnapshot): string[] {
  return snapshot.chain.map((slot) => findPedal(slot.pedalId ?? '')?.name ?? 'Empty')
}

export function buildKnobSummary(snapshot: ToneProjectSnapshot): string[] {
  const lines: string[] = []

  snapshot.chain.forEach((slot) => {
    const pedal = findPedal(slot.pedalId ?? '')
    if (!pedal) return
    const knobs = snapshot.pedalKnobs[slot.id] ?? pedal.knobs
    const summary = knobs.slice(0, 3).map((knob) => `${knob.label} ${knob.value}`).join(', ')
    lines.push(`${pedal.name}: ${summary}`)
  })

  return lines
}
