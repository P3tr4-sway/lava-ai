import {
  ARRANGEMENT_COPY,
  ARRANGEMENT_ORDER,
  type ArrangementId,
  type AnalysisScore,
  type LeadSheetMeasure,
  type LeadSheetSection,
  type LeadSheetSectionType,
  type PlayableArrangement,
} from '../types/score.js'

let idCounter = 0

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${(++idCounter).toString(36)}`
}

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const OPEN_FRIENDLY_CHORDS = new Set(['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'G', 'A', 'Am'])
const OPEN_FRIENDLY_EXTENSIONS = new Set(['Em7', 'A7sus4', 'Dsus4', 'Dsus2', 'Asus2', 'Asus4', 'Cadd9', 'G6'])

function cloneMeasure(measure: LeadSheetMeasure, chords = measure.chords): LeadSheetMeasure {
  return {
    id: makeId('m'),
    chords: [...chords],
    barline: measure.barline,
  }
}

function cloneSections(
  sections: LeadSheetSection[],
  transformMeasure?: (measure: LeadSheetMeasure, section: LeadSheetSection, measureIndex: number) => LeadSheetMeasure,
): LeadSheetSection[] {
  return sections.map((section) => ({
    id: makeId('s'),
    label: section.label,
    type: section.type,
    measures: section.measures.map((measure, index) =>
      transformMeasure ? transformMeasure(measure, section, index) : cloneMeasure(measure),
    ),
  }))
}

function splitChord(chord: string): { root: string; suffix: string } {
  const match = chord.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!match) return { root: chord, suffix: '' }
  return { root: match[1], suffix: match[2] ?? '' }
}

function transposeRoot(root: string, semitones: number): string {
  const value = NOTE_TO_SEMITONE[root]
  if (value === undefined) return root
  const index = (value + semitones + 120) % 12
  return SEMITONE_TO_NOTE[index]
}

function stripSlashChord(suffix: string): string {
  return suffix.replace(/\/[A-G](?:#|b)?/g, '')
}

function simplifyChordAggressive(chord: string): string {
  if (!chord) return chord
  const { root, suffix } = splitChord(chord)
  let next = stripSlashChord(suffix)

  next = next
    .replace(/m7b5|ø7/gi, 'm')
    .replace(/m(?:Maj7|9|11|13|7)/gi, 'm')
    .replace(/maj(?:7|9|11|13)/gi, '')
    .replace(/(?:add\d+|sus2|sus4|6|7|9|11|13|alt)/gi, '')
    .replace(/dim7|dim|aug/gi, '')
    .replace(/[b#]\d+/g, '')

  if (next.startsWith('m')) return `${root}m`
  return root
}

function simplifyChordLight(chord: string): string {
  if (!chord) return chord
  const { root, suffix } = splitChord(chord)
  let next = stripSlashChord(suffix)

  next = next
    .replace(/maj9|maj11|maj13/gi, 'maj7')
    .replace(/m(?:9|11|13)/gi, 'm7')
    .replace(/(?:add\d+|alt)/gi, '')
    .replace(/[b#]\d+/g, '')

  return `${root}${next}`
}

function simplifyChordForSingPlay(chord: string): string {
  if (!chord) return chord
  if (OPEN_FRIENDLY_EXTENSIONS.has(chord)) return chord

  const simplified = simplifyChordAggressive(chord)
  if (OPEN_FRIENDLY_CHORDS.has(simplified)) return simplified

  const { root, suffix } = splitChord(chord)
  if (/sus2|sus4/.test(suffix) && ['A', 'D'].includes(root)) return `${root}${suffix.includes('sus2') ? 'sus2' : 'sus4'}`
  if (/m7/.test(suffix) && ['A', 'E'].includes(root)) return `${root}m7`

  return simplified
}

function transposeChord(chord: string, semitones: number): string {
  if (!chord) return chord
  const match = chord.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!match) return chord

  const root = transposeRoot(match[1], semitones)
  const suffix = (match[2] ?? '').replace(/\/([A-G](?:#|b)?)/g, (_, bass: string) => `/${transposeRoot(bass, semitones)}`)
  return `${root}${suffix}`
}

function transposeKey(key: string, semitones: number): string {
  if (!key) return key
  const match = key.match(/^([A-G](?:#|b)?)(.*)$/)
  if (!match) return key
  return `${transposeRoot(match[1], semitones)}${match[2] ?? ''}`
}

function getChordShapeScore(chord: string): number {
  const simplified = simplifyChordAggressive(chord)
  if (OPEN_FRIENDLY_CHORDS.has(simplified)) return 3
  if (/#|b/.test(simplified)) return -2
  return 1
}

function chooseCapoFret(sections: LeadSheetSection[]): number {
  const uniqueChords = [...new Set(sections.flatMap((section) => section.measures.flatMap((measure) => measure.chords.filter(Boolean))))]
  let bestFret = 2
  let bestScore = Number.NEGATIVE_INFINITY

  for (let fret = 1; fret <= 5; fret++) {
    const score = uniqueChords.reduce((total, chord) => total + getChordShapeScore(transposeChord(chord, -fret)), 0)
    if (score > bestScore) {
      bestScore = score
      bestFret = fret
    }
  }

  return bestFret
}

function buildFocusBars(sections: LeadSheetSection[]): string[] {
  const preferredTypes: LeadSheetSectionType[] = ['intro', 'chorus', 'bridge']
  const focusBars = sections.flatMap((section) => {
    if (!preferredTypes.includes(section.type)) return []
    return section.measures.slice(0, Math.min(2, section.measures.length)).map((measure) => `${section.id}:${measure.id}`)
  })

  if (focusBars.length > 0) return focusBars

  const fallbackSection = sections[0]
  if (!fallbackSection) return []
  return fallbackSection.measures.slice(0, Math.min(4, fallbackSection.measures.length)).map((measure) => `${fallbackSection.id}:${measure.id}`)
}

function buildArrangement(
  id: ArrangementId,
  base: Pick<AnalysisScore, 'key' | 'tempo' | 'timeSignature' | 'sections'>,
): PlayableArrangement {
  const copy = ARRANGEMENT_COPY[id]

  if (id === 'original') {
    return {
      id,
      ...copy,
      concertKey: base.key,
      displayKey: base.key,
      tempo: base.tempo,
      timeSignature: base.timeSignature,
      sections: cloneSections(base.sections),
      changeSummary: ['Full changes', 'Full form'],
      format: 'lead_sheet',
    }
  }

  if (id === 'simplified') {
    return {
      id,
      ...copy,
      concertKey: base.key,
      displayKey: base.key,
      tempo: base.tempo,
      timeSignature: base.timeSignature,
      sections: cloneSections(base.sections, (measure) => cloneMeasure(measure, measure.chords.slice(0, 1).map(simplifyChordAggressive).filter(Boolean))),
      changeSummary: ['Easier chords', 'One chord per bar', 'Lower complexity'],
      recommended: true,
      recommendedReason: 'Fewer hard changes.',
      format: 'lead_sheet',
    }
  }

  if (id === 'sing_play') {
    return {
      id,
      ...copy,
      concertKey: base.key,
      displayKey: base.key,
      tempo: base.tempo,
      timeSignature: base.timeSignature,
      sections: cloneSections(base.sections, (measure) => cloneMeasure(measure, measure.chords.slice(0, 1).map(simplifyChordForSingPlay).filter(Boolean))),
      changeSummary: ['Steady rhythm', 'Open shapes', 'Vocal-first'],
      format: 'lead_sheet',
    }
  }

  if (id === 'solo_focus') {
    const sections = cloneSections(base.sections)
    return {
      id,
      ...copy,
      concertKey: base.key,
      displayKey: base.key,
      tempo: base.tempo,
      timeSignature: base.timeSignature,
      sections,
      changeSummary: ['Main hooks', 'Focus bars', 'Full form'],
      focusBars: buildFocusBars(sections),
      format: 'lead_sheet',
    }
  }

  if (id === 'low_position') {
    return {
      id,
      ...copy,
      concertKey: base.key,
      displayKey: base.key,
      tempo: base.tempo,
      timeSignature: base.timeSignature,
      sections: cloneSections(base.sections, (measure) => cloneMeasure(measure, measure.chords.map(simplifyChordLight).filter(Boolean))),
      fretRange: '0-5',
      changeSummary: ['Lower frets', 'No capo', 'Cleaner shapes'],
      format: 'lead_sheet',
    }
  }

  const capoFret = chooseCapoFret(base.sections)
  return {
    id,
    ...copy,
    concertKey: base.key,
    displayKey: transposeKey(base.key, -capoFret),
    tempo: base.tempo,
    timeSignature: base.timeSignature,
    sections: cloneSections(base.sections, (measure) => cloneMeasure(measure, measure.chords.map((chord) => transposeChord(chord, -capoFret)).filter(Boolean))),
    capoFret,
    changeSummary: [`Capo ${capoFret}`, 'Easier shapes', 'Same key'],
    format: 'lead_sheet',
  }
}

export function buildPlayableArrangements(
  base: Pick<AnalysisScore, 'key' | 'tempo' | 'timeSignature' | 'sections'>,
): {
  arrangements: PlayableArrangement[]
  defaultArrangementId: ArrangementId
} {
  return {
    arrangements: ARRANGEMENT_ORDER.map((id) => buildArrangement(id, base)),
    defaultArrangementId: 'simplified',
  }
}
