import type { AgentMessage, ToneAction, ToneProjectSnapshot } from '@lava/shared'
import { findPedal, getPresetName } from './toneModel'

function cloneSnapshot(snapshot: ToneProjectSnapshot): ToneProjectSnapshot {
  return {
    selectedPreset: snapshot.selectedPreset,
    selectedSlotId: snapshot.selectedSlotId,
    activeCategory: snapshot.activeCategory,
    chain: snapshot.chain.map((slot) => ({ ...slot })),
    pedalKnobs: Object.fromEntries(
      Object.entries(snapshot.pedalKnobs).map(([slotId, knobs]) => [
        slotId,
        knobs.map((knob) => ({ ...knob })),
      ]),
    ),
  }
}

function ensureSlotKnobs(snapshot: ToneProjectSnapshot, slotId: string) {
  const slot = snapshot.chain.find((item) => item.id === slotId)
  const pedal = findPedal(slot?.pedalId ?? '')
  if (!pedal) return null

  if (!snapshot.pedalKnobs[slotId]) {
    snapshot.pedalKnobs[slotId] = pedal.knobs.map((knob) => ({ ...knob }))
  }

  return snapshot.pedalKnobs[slotId]
}

function adjustKnob(snapshot: ToneProjectSnapshot, slotId: string, knobId: string, delta: number) {
  const knobs = ensureSlotKnobs(snapshot, slotId)
  if (!knobs) return null
  const knob = knobs.find((item) => item.id === knobId)
  if (!knob) return null
  knob.value = Math.max(0, Math.min(100, knob.value + delta))
  return knob
}

function findSlotByCategory(snapshot: ToneProjectSnapshot, category: string) {
  return snapshot.chain.find((slot) => findPedal(slot.pedalId ?? '')?.category === category) ?? null
}

function swapPedal(snapshot: ToneProjectSnapshot, category: string, pedalId: string) {
  const existing = findSlotByCategory(snapshot, category)
  if (existing) {
    existing.pedalId = pedalId
    delete snapshot.pedalKnobs[existing.id]
    return existing.id
  }

  const slotId = `slot-${Date.now()}`
  snapshot.chain.push({ id: slotId, pedalId })
  return slotId
}

function buildExplanation(snapshot: ToneProjectSnapshot) {
  const parts = snapshot.chain
    .map((slot) => findPedal(slot.pedalId ?? '')?.name)
    .filter(Boolean)

  return parts.length > 0
    ? `Current chain: ${parts.join(' -> ')}.`
    : 'The chain is still empty, so this is a clean starting point.'
}

function buildSuggestion(prompt: string, before: ToneProjectSnapshot, variation = 0): { message: string; action?: ToneAction } {
  const normalized = prompt.toLowerCase()
  const after = cloneSnapshot(before)
  const changes: string[] = []
  let summary = ''

  if (normalized.includes('explain')) {
    const selectedPedal = before.chain.find((slot) => slot.id === before.selectedSlotId)
    const pedalName = findPedal(selectedPedal?.pedalId ?? '')?.name
    const message = pedalName
      ? `${buildExplanation(before)} ${pedalName} is selected now, so I’d shape that first before swapping the whole chain.`
      : buildExplanation(before)
    return { message }
  }

  if (normalized.includes('clean') || normalized.includes('clear')) {
    const ampSlot = findSlotByCategory(after, 'amp')
    const driveSlot = findSlotByCategory(after, 'overdrive') ?? findSlotByCategory(after, 'distortion')
    if (ampSlot) {
      const gainKnob = adjustKnob(after, ampSlot.id, 'gain', variation % 2 === 0 ? -12 : -8)
      const trebleKnob = adjustKnob(after, ampSlot.id, 'treble', 6)
      if (gainKnob) changes.push(`Lower ${getPedalName(ampSlot.pedalId)} ${gainKnob.label} to ${gainKnob.value}`)
      if (trebleKnob) changes.push(`Raise ${getPedalName(ampSlot.pedalId)} ${trebleKnob.label} to ${trebleKnob.value}`)
    }
    if (driveSlot) {
      const driveKnob = adjustKnob(after, driveSlot.id, 'drive', -18) ?? adjustKnob(after, driveSlot.id, 'gain', -18)
      if (driveKnob) changes.push(`Back off ${getPedalName(driveSlot.pedalId)} ${driveKnob.label} to ${driveKnob.value}`)
    }
    summary = 'Cleaner headroom with less breakup.'
  } else if (normalized.includes('gain') || normalized.includes('drive') || normalized.includes('heavier') || normalized.includes('distortion')) {
    const driveSlotId = swapPedal(after, normalized.includes('metal') ? 'distortion' : 'overdrive', normalized.includes('metal') ? 'heavy-metal' : 'tube-808')
    const gainKnob = adjustKnob(after, driveSlotId, 'drive', 14) ?? adjustKnob(after, driveSlotId, 'gain', 14)
    if (gainKnob) changes.push(`Push ${getPedalName(after.chain.find((slot) => slot.id === driveSlotId)?.pedalId)} ${gainKnob.label} to ${gainKnob.value}`)
    const ampSlot = findSlotByCategory(after, 'amp')
    if (ampSlot) {
      const ampGain = adjustKnob(after, ampSlot.id, 'gain', 8)
      if (ampGain) changes.push(`Add amp gain to ${ampGain.value}`)
    }
    summary = 'More sustain and edge for lead work.'
  } else if (normalized.includes('ambient') || normalized.includes('ambience') || normalized.includes('reverb') || normalized.includes('worship')) {
    const delaySlotId = swapPedal(after, 'delay', variation % 2 === 0 ? 'tape-delay' : 'digital-delay')
    const reverbSlotId = swapPedal(after, 'reverb', variation % 2 === 0 ? 'bright-reverb' : 'spring-reverb')
    const delayMix = adjustKnob(after, delaySlotId, 'mix', 12)
    const reverbMix = adjustKnob(after, reverbSlotId, 'mix', 15)
    if (delayMix) changes.push(`Raise ${getPedalName(after.chain.find((slot) => slot.id === delaySlotId)?.pedalId)} mix to ${delayMix.value}`)
    if (reverbMix) changes.push(`Raise ${getPedalName(after.chain.find((slot) => slot.id === reverbSlotId)?.pedalId)} mix to ${reverbMix.value}`)
    summary = 'More space and trail without changing the core chain.'
  } else if (normalized.includes('tighten') || normalized.includes('low end') || normalized.includes('mud')) {
    const ampSlot = findSlotByCategory(after, 'amp')
    if (ampSlot) {
      const bass = adjustKnob(after, ampSlot.id, 'bass', -10)
      const mid = adjustKnob(after, ampSlot.id, 'mid', 6)
      if (bass) changes.push(`Trim bass to ${bass.value}`)
      if (mid) changes.push(`Push mids to ${mid.value}`)
    }
    const cabSlot = findSlotByCategory(after, 'cab')
    if (cabSlot) {
      const room = adjustKnob(after, cabSlot.id, 'room', -8)
      if (room) changes.push(`Reduce cabinet room to ${room.value}`)
    }
    summary = 'A tighter low end with more definition in the mids.'
  } else if (normalized.includes('mayer') || normalized.includes('john mayer')) {
    after.selectedPreset = 'clean-jazz'
    after.chain = [
      { id: 'slot-0', pedalId: 'studio-comp' },
      { id: 'slot-1', pedalId: 'clean-amp' },
      { id: 'slot-2', pedalId: 'chorus' },
      { id: 'slot-3', pedalId: 'spring-reverb' },
    ]
    after.selectedSlotId = 'slot-1'
    after.activeCategory = 'amp'
    after.pedalKnobs = {}
    const ampVol = adjustKnob(after, 'slot-1', 'vol', 8)
    const ampReverb = adjustKnob(after, 'slot-1', 'reverb', 10)
    if (ampVol) changes.push(`Set clean amp volume to ${ampVol.value}`)
    if (ampReverb) changes.push(`Lift amp reverb to ${ampReverb.value}`)
    changes.push('Switch to a cleaner compressor-forward chain')
    summary = 'Clean edge-of-breakup feel with soft compression.'
  } else {
    const selectedSlotId = after.selectedSlotId
    const pedalName = getPedalName(after.chain.find((slot) => slot.id === selectedSlotId)?.pedalId)
    const firstKnob = adjustKnob(after, selectedSlotId, 'gain', 8)
      ?? adjustKnob(after, selectedSlotId, 'drive', 8)
      ?? adjustKnob(after, selectedSlotId, 'mix', 8)
      ?? adjustKnob(after, selectedSlotId, 'tone', 6)
    if (firstKnob) changes.push(`Move ${pedalName} ${firstKnob.label} to ${firstKnob.value}`)
    summary = 'A small targeted tweak to move the tone forward.'
  }

  if (changes.length === 0) {
    return {
      message: `${buildExplanation(before)} I don’t have a better structured change yet, so I’d start from the selected pedal and adjust one control at a time.`,
    }
  }

  const message = `${summary} Preview the update before applying it.`
  return {
    message,
    action: {
      kind: 'preview',
      prompt,
      summary,
      changes,
      before,
      after,
      state: 'pending',
    },
  }
}

function getPedalName(pedalId?: string | null) {
  return findPedal(pedalId ?? '')?.name ?? 'selected pedal'
}

export function buildToneAssistantReply(prompt: string, snapshot: ToneProjectSnapshot, messages: AgentMessage[]): AgentMessage {
  const variation = messages.filter((message) => message.toneAction?.prompt === prompt).length
  const { message, action } = buildSuggestion(prompt, snapshot, variation)

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: message,
    createdAt: Date.now(),
    toneAction: action,
  }
}

export function buildToneAlternativePrompt(prompt: string) {
  return `Try another version of: ${prompt}`
}
