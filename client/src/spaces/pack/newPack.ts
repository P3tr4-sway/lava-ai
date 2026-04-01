import { buildPlayableArrangements, type ScoreDocument } from '@lava/shared'
import { exportScoreDocumentToMusicXml, createEmptyScoreDocument } from '@/lib/scoreDocument'

export type NewPackLayout = 'tab' | 'staff' | 'split'
export type NewPackTuningId = 'standard' | 'drop-d' | 'dadgad'

export interface NewPackPreset {
  id: string
  label: string
  description: string
  bars: number
  tempo: number
  timeSignature: string
  layout: NewPackLayout
  tuning: NewPackTuningId
}

export interface NewPackDraft {
  name: string
  bars: number
  tempo: number
  timeSignature: string
  key: string
  layout: NewPackLayout
  tuning: NewPackTuningId
  capo: number
}

interface LeadSheetSectionSeed {
  label: string
  type: 'intro' | 'verse' | 'chorus' | 'bridge'
  bars: number
}

export const NEW_PACK_PRESETS: NewPackPreset[] = [
  {
    id: 'blank-8',
    label: 'Blank 8 bars',
    description: 'Quick riff sketch with a short form.',
    bars: 8,
    tempo: 120,
    timeSignature: '4/4',
    layout: 'split',
    tuning: 'standard',
  },
  {
    id: 'practice-32',
    label: '32-bar practice chart',
    description: 'A full exercise grid closer to real score setup defaults.',
    bars: 32,
    tempo: 92,
    timeSignature: '4/4',
    layout: 'split',
    tuning: 'standard',
  },
  {
    id: 'fingerstyle-16',
    label: 'Fingerstyle study',
    description: 'Sixteen bars with a gentler tempo and score+tab view.',
    bars: 16,
    tempo: 72,
    timeSignature: '4/4',
    layout: 'split',
    tuning: 'dadgad',
  },
]

export const NEW_PACK_TUNINGS: Array<{ id: NewPackTuningId; label: string; midi: number[] }> = [
  { id: 'standard', label: 'Standard EADGBE', midi: [64, 59, 55, 50, 45, 40] },
  { id: 'drop-d', label: 'Drop D', midi: [64, 59, 55, 50, 45, 38] },
  { id: 'dadgad', label: 'DADGAD', midi: [62, 57, 55, 50, 45, 38] },
]

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function parseTimeSignature(value: string) {
  const [numeratorPart, denominatorPart] = value.split('/')
  const numerator = Math.max(1, Number(numeratorPart) || 4)
  const denominator = Math.max(1, Number(denominatorPart) || 4)
  return { numerator, denominator }
}

function buildSectionSeeds(barCount: number): LeadSheetSectionSeed[] {
  if (barCount <= 8) {
    return [{ label: 'Idea', type: 'intro', bars: barCount }]
  }
  if (barCount <= 16) {
    return [
      { label: 'Intro', type: 'intro', bars: 4 },
      { label: 'Verse 1', type: 'verse', bars: Math.max(4, barCount - 4) },
    ]
  }
  if (barCount <= 32) {
    return [
      { label: 'Intro', type: 'intro', bars: 4 },
      { label: 'Verse 1', type: 'verse', bars: 8 },
      { label: 'Chorus', type: 'chorus', bars: 8 },
      { label: 'Bridge', type: 'bridge', bars: Math.max(4, barCount - 20) },
    ]
  }
  return [
    { label: 'Intro', type: 'intro', bars: 4 },
    { label: 'Verse 1', type: 'verse', bars: 8 },
    { label: 'Chorus', type: 'chorus', bars: 8 },
    { label: 'Verse 2', type: 'verse', bars: 8 },
    { label: 'Bridge', type: 'bridge', bars: Math.max(4, barCount - 28) },
  ]
}

function normalizeSectionSeeds(barCount: number) {
  const seeds = buildSectionSeeds(barCount)
  const normalized: LeadSheetSectionSeed[] = []
  let remaining = barCount

  for (const seed of seeds) {
    if (remaining <= 0) break
    const bars = Math.max(1, Math.min(seed.bars, remaining))
    normalized.push({ ...seed, bars })
    remaining -= bars
  }

  if (remaining > 0) {
    normalized.push({ label: 'Outro', type: 'chorus', bars: remaining })
  }

  return normalized
}

export function createSectionsForBars(barCount: number) {
  return normalizeSectionSeeds(Math.max(1, barCount)).map((seed) => ({
    id: makeId('section'),
    label: seed.label,
    type: seed.type,
    measures: Array.from({ length: seed.bars }, () => ({
      id: makeId('measure'),
      chords: [],
    })),
  }))
}

export function createConfiguredScoreDocument(draft: NewPackDraft): ScoreDocument {
  const base = createEmptyScoreDocument()
  const tuning = NEW_PACK_TUNINGS.find((entry) => entry.id === draft.tuning)?.midi ?? NEW_PACK_TUNINGS[0].midi
  const meter = parseTimeSignature(draft.timeSignature)
  const barCount = Math.max(1, draft.bars)

  base.title = draft.name
  base.tempo = Math.max(40, Math.min(240, draft.tempo))
  base.meter = meter
  base.keySignature = { key: draft.key || 'C', mode: 'major' }
  base.measures = Array.from({ length: barCount }, (_, index) => ({
    id: index === 0 ? base.measures[0]?.id ?? makeId('measure') : makeId('measure'),
    index,
    harmony: [],
    annotations: [],
    chordDiagramPlacement: 'hidden',
  }))
  base.tracks = base.tracks.map((track) => ({
    ...track,
    name: 'Guitar',
    instrument: 'guitar',
    tuning: [...tuning],
    capo: Math.max(0, draft.capo),
    notes: [],
  }))
  base.lastExportedXml = exportScoreDocumentToMusicXml(base)
  return base
}

export function buildNewPackProjectPayload(draft: NewPackDraft) {
  const scoreDocument = createConfiguredScoreDocument(draft)
  const musicXml = scoreDocument.lastExportedXml ?? exportScoreDocumentToMusicXml(scoreDocument)
  const sections = createSectionsForBars(draft.bars)
  const { arrangements, defaultArrangementId } = buildPlayableArrangements({
    key: draft.key,
    tempo: draft.tempo,
    timeSignature: draft.timeSignature,
    sections,
  })

  return {
    name: draft.name,
    space: 'learn' as const,
    metadata: {
      key: draft.key,
      tempo: draft.tempo,
      timeSignature: draft.timeSignature,
      scoreView: draft.layout,
      musicXml,
      scoreDocument,
      sections,
      arrangements,
      selectedArrangementId: defaultArrangementId,
    },
  }
}
