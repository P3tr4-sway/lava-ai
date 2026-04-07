const parser = new DOMParser()
const serializer = new XMLSerializer()

export function parseXml(xml: string): Document {
  const doc = parser.parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error(`MusicXML parse error: ${err.textContent}`)
  return doc
}

export function serializeXml(doc: Document): string {
  return serializer.serializeToString(doc)
}

export function getMeasures(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('part > measure'))
}

function getNotes(measure: Element): Element[] {
  return Array.from(measure.querySelectorAll('note'))
}

function getTimeInfo(doc: Document): { divisions: number; beats: number } {
  const divEl = doc.querySelector('attributes > divisions')
  const beatsEl = doc.querySelector('time > beats')
  return {
    divisions: divEl ? parseInt(divEl.textContent || '1', 10) : 1,
    beats: beatsEl ? parseInt(beatsEl.textContent || '4', 10) : 4,
  }
}

export interface NoteOnset {
  barIndex: number
  noteIndex: number
  onsetTime: number  // seconds
  duration: number   // seconds
}

// --- Score summary for agent context ---

const FIFTHS_TO_KEY: Record<number, string> = {
  [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F',
  [0]: 'C', [1]: 'G', [2]: 'D', [3]: 'A', [4]: 'E', [5]: 'B', [6]: 'F#',
}

function harmonyToChordName(harmony: Element): string {
  const rootStep = harmony.querySelector('root > root-step')?.textContent ?? ''
  const rootAlterEl = harmony.querySelector('root > root-alter')
  const rootAlter = rootAlterEl ? parseInt(rootAlterEl.textContent ?? '0', 10) : 0
  const kind = harmony.querySelector('kind')?.textContent ?? 'major'

  let name = rootStep
  if (rootAlter === 1) name += '#'
  else if (rootAlter === -1) name += 'b'

  const kindSuffix: Record<string, string> = {
    'major': '', 'minor': 'm', 'dominant': '7', 'major-seventh': 'maj7',
    'minor-seventh': 'm7', 'diminished': 'dim', 'diminished-seventh': 'dim7',
    'augmented': 'aug', 'suspended-second': 'sus2', 'suspended-fourth': 'sus4',
    'major-sixth': '6', 'minor-sixth': 'm6', 'dominant-ninth': '9',
    'major-ninth': 'maj9', 'minor-ninth': 'm9', 'power': '5',
  }
  name += kindSuffix[kind] ?? ''
  return name
}

export function buildScoreSummary(xml: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const parts: string[] = []

  // Key
  const fifthsEl = doc.querySelector('key > fifths')
  const modeEl = doc.querySelector('key > mode')
  if (fifthsEl) {
    const fifths = parseInt(fifthsEl.textContent ?? '0', 10)
    const keyName = FIFTHS_TO_KEY[fifths] ?? 'C'
    const mode = modeEl?.textContent ?? 'major'
    parts.push(`Key: ${keyName} ${mode}`)
  }

  // Tempo
  const soundEl = doc.querySelector('sound[tempo]')
  if (soundEl) {
    parts.push(`Tempo: ${soundEl.getAttribute('tempo')} BPM`)
  }

  // Time signature
  const beatsEl = doc.querySelector('time > beats')
  const beatTypeEl = doc.querySelector('time > beat-type')
  if (beatsEl && beatTypeEl) {
    parts.push(`Time: ${beatsEl.textContent}/${beatTypeEl.textContent}`)
  }

  // Bar count
  parts.push(`${measures.length} bars`)

  const header = parts.join(' | ')

  // Chords per bar
  const chordLines: string[] = []
  for (let i = 0; i < measures.length; i++) {
    const harmonies = measures[i].querySelectorAll('harmony')
    if (harmonies.length > 0) {
      const names = Array.from(harmonies).map(harmonyToChordName).join(', ')
      chordLines.push(`Bar ${i + 1}: ${names}`)
    }
  }

  // Sections from rehearsal marks
  const sectionLabels: string[] = []
  for (let i = 0; i < measures.length; i++) {
    const rehearsal = measures[i].querySelector('direction > direction-type > rehearsal')
    if (rehearsal?.textContent) {
      sectionLabels.push(`${rehearsal.textContent} (${i + 1})`)
    }
  }

  let summary = header
  if (chordLines.length > 0) {
    summary += '\nChords: ' + chordLines.join(' — ')
  }
  if (sectionLabels.length > 0) {
    summary += '\nSections: ' + sectionLabels.join(', ')
  }

  return summary
}

export function buildNoteOnsetMap(xml: string, bpm: number): NoteOnset[] {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions } = getTimeInfo(doc)
  const secondsPerDivision = 60 / (bpm * divisions)
  const onsets: NoteOnset[] = []
  let currentTime = 0

  for (let barIndex = 0; barIndex < measures.length; barIndex++) {
    const notes = getNotes(measures[barIndex])
    let noteIndex = 0
    for (const note of notes) {
      const durEl = note.querySelector('duration')
      const durDivisions = durEl ? parseInt(durEl.textContent || '1', 10) : 1
      const durSeconds = durDivisions * secondsPerDivision

      // Rests are included — they still consume time in the onset map.
      // Callers can detect rests by checking the source MusicXML.
      onsets.push({
        barIndex,
        noteIndex,
        onsetTime: currentTime,
        duration: durSeconds,
      })

      // Note: <chord> elements are not handled; chords with shared onset are
      // treated as sequential for now (out of scope for single-note guitar editor).
      currentTime += durSeconds
      noteIndex++
    }
  }

  return onsets
}
