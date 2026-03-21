/**
 * Converts ChordMiniApp output (chords + beats) into LeadSheetSection[] format
 * compatible with the frontend leadSheetStore.
 */

export interface ChordMiniAppChord {
  time: number       // seconds
  chord: string      // e.g. "C:maj", "A:min", "G:7", "N" (no chord)
  confidence: number // 0-1
}

export interface ChordMiniAppBeats {
  bpm: number
  beats: number[]       // beat times in seconds
  downbeats: number[]   // indices of downbeats within beats array
  time_signature: number | string
}

export interface LeadSheetMeasure {
  id: string
  chords: string[]
}

export interface LeadSheetSection {
  id: string
  label: string
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom'
  measures: LeadSheetMeasure[]
}

export interface AnalysisScore {
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  duration: number
}

/** Map ChordMiniApp chord notation to standard shorthand */
function normalizeChordName(raw: string): string {
  if (raw === 'N' || raw === 'X') return ''

  const parts = raw.split(':')
  const root = parts[0] ?? raw
  const quality = parts[1] ?? ''

  // Map common quality labels
  const qMap: Record<string, string> = {
    'maj': '',
    'min': 'm',
    '7': '7',
    'maj7': 'maj7',
    'min7': 'm7',
    'dim': 'dim',
    'aug': 'aug',
    'sus2': 'sus2',
    'sus4': 'sus4',
    'dim7': 'dim7',
    'hdim7': 'm7b5',
    'minmaj7': 'mMaj7',
    '9': '9',
    'min9': 'm9',
    'maj9': 'maj9',
    '11': '11',
    '13': '13',
    '1': '',
    '5': '5',
  }

  const suffix = qMap[quality] ?? quality
  return `${root}${suffix}`
}

let idCounter = 0
function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${(++idCounter).toString(36)}`
}

/**
 * Groups chords into measures based on beat positions.
 * Each measure spans `beatsPerMeasure` beats.
 */
export function chordsToMeasures(
  chords: ChordMiniAppChord[],
  beats: number[],
  beatsPerMeasure: number,
): LeadSheetMeasure[] {
  if (beats.length === 0 || chords.length === 0) return []

  // Build measure boundaries from beats
  const measures: LeadSheetMeasure[] = []
  for (let i = 0; i < beats.length; i += beatsPerMeasure) {
    const measureStart = beats[i]
    const measureEnd = i + beatsPerMeasure < beats.length
      ? beats[i + beatsPerMeasure]
      : Infinity

    // Find chords that fall within this measure
    const chordsInMeasure = chords
      .filter((c) => c.time >= measureStart && c.time < measureEnd)
      .map((c) => normalizeChordName(c.chord))
      .filter((c) => c !== '')

    // Deduplicate consecutive same chords
    const deduped: string[] = []
    for (const c of chordsInMeasure) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== c) {
        deduped.push(c)
      }
    }

    // Limit to 2 chords per measure (most common in lead sheets)
    const finalChords = deduped.slice(0, 2)

    measures.push({
      id: makeId('m'),
      chords: finalChords,
    })
  }

  return measures
}

/**
 * Splits measures into sections of `barsPerSection` bars each.
 * Labels them sequentially: Verse 1, Verse 2, etc.
 */
function splitIntoSections(measures: LeadSheetMeasure[], barsPerSection = 8): LeadSheetSection[] {
  const sections: LeadSheetSection[] = []
  const typeRotation: Array<{ type: LeadSheetSection['type']; label: string }> = [
    { type: 'intro', label: 'Intro' },
    { type: 'verse', label: 'Verse 1' },
    { type: 'chorus', label: 'Chorus' },
    { type: 'verse', label: 'Verse 2' },
    { type: 'chorus', label: 'Chorus 2' },
    { type: 'bridge', label: 'Bridge' },
    { type: 'chorus', label: 'Chorus 3' },
    { type: 'outro', label: 'Outro' },
  ]

  for (let i = 0; i < measures.length; i += barsPerSection) {
    const chunk = measures.slice(i, i + barsPerSection)
    if (chunk.length === 0) continue

    const sectionIdx = Math.min(Math.floor(i / barsPerSection), typeRotation.length - 1)
    const info = typeRotation[sectionIdx]

    sections.push({
      id: makeId('s'),
      label: info.label,
      type: info.type,
      measures: chunk,
    })
  }

  return sections
}

/** Attempt to detect key from chord distribution */
function detectKey(chords: ChordMiniAppChord[]): string {
  const counts: Record<string, number> = {}
  for (const c of chords) {
    const name = normalizeChordName(c.chord)
    if (!name) continue
    const root = name.replace(/[m7dimaugsuj\d(b#)]/g, '')
    if (root) {
      counts[root] = (counts[root] ?? 0) + 1
    }
  }

  // Most frequent root is likely the key
  let maxCount = 0
  let key = 'C'
  for (const [root, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      key = root
    }
  }

  return key
}

/**
 * Main entry: converts ChordMiniApp responses into an AnalysisScore.
 */
export function buildAnalysisScore(
  chordResult: { chords: ChordMiniAppChord[]; duration: number },
  beatResult: ChordMiniAppBeats,
): AnalysisScore {
  const beatsPerMeasure = typeof beatResult.time_signature === 'number'
    ? beatResult.time_signature
    : parseInt(String(beatResult.time_signature), 10) || 4

  const measures = chordsToMeasures(chordResult.chords, beatResult.beats, beatsPerMeasure)
  const sections = splitIntoSections(measures)
  const key = detectKey(chordResult.chords)

  return {
    key,
    tempo: Math.round(beatResult.bpm),
    timeSignature: `${beatsPerMeasure}/4`,
    sections,
    duration: chordResult.duration,
  }
}
