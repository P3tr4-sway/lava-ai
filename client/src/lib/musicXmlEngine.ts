import { type Pitch, pitchToMidi, midiToPitch } from './pitchUtils'

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

function renumberMeasures(doc: Document): void {
  getMeasures(doc).forEach((m, i) => m.setAttribute('number', String(i + 1)))
}

function buildWholeRestNote(doc: Document, divisions: number, beats: number): Element {
  const note = doc.createElement('note')
  const rest = doc.createElement('rest')
  const dur = doc.createElement('duration')
  dur.textContent = String(divisions * beats)
  const type = doc.createElement('type')
  type.textContent = 'whole'
  note.appendChild(rest)
  note.appendChild(dur)
  note.appendChild(type)
  return note
}

function createRestMeasure(doc: Document, divisions: number, beats: number): Element {
  const m = doc.createElement('measure')
  m.setAttribute('number', '0') // will be renumbered
  m.appendChild(buildWholeRestNote(doc, divisions, beats))
  return m
}

function getTimeInfo(doc: Document): { divisions: number; beats: number } {
  const divEl = doc.querySelector('attributes > divisions')
  const beatsEl = doc.querySelector('time > beats')
  return {
    divisions: divEl ? parseInt(divEl.textContent || '1', 10) : 1,
    beats: beatsEl ? parseInt(beatsEl.textContent || '4', 10) : 4,
  }
}

export function addBars(xml: string, afterIndex: number, count: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  if (afterIndex < 0 || afterIndex >= measures.length) {
    throw new RangeError(`addBars: afterIndex ${afterIndex} out of range (length ${measures.length})`)
  }
  const { divisions, beats } = getTimeInfo(doc)
  const ref = measures[afterIndex]
  const parent = ref.parentNode!

  let insertionPoint: Node | null = ref.nextSibling
  for (let i = 0; i < count; i++) {
    const newMeasure = createRestMeasure(doc, divisions, beats)
    parent.insertBefore(newMeasure, insertionPoint)
    insertionPoint = newMeasure.nextSibling
  }

  renumberMeasures(doc)
  return serializeXml(doc)
}

export function deleteBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  // Sort descending so removal doesn't shift indices
  const sorted = [...barIndices].sort((a, b) => b - a)
  for (const idx of sorted) {
    if (idx >= 0 && idx < measures.length) {
      measures[idx].parentNode!.removeChild(measures[idx])
    }
  }
  renumberMeasures(doc)
  return serializeXml(doc)
}

export function clearBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions, beats } = getTimeInfo(doc)

  for (const idx of barIndices) {
    const m = measures[idx]
    if (!m) continue
    // Remove all note, forward, backup, harmony, direction elements
    const toRemove = m.querySelectorAll('note, forward, backup, harmony, direction')
    toRemove.forEach((el) => el.parentNode!.removeChild(el))
    // Add whole rest
    m.appendChild(buildWholeRestNote(doc, divisions, beats))
  }

  return serializeXml(doc)
}

// --- Chord name → MusicXML harmony mapping ---

function parseChordName(name: string): { rootStep: string; rootAlter: number; kind: string } {
  // Extract root note (e.g., 'C', 'F#', 'Bb')
  let rootStep = name[0].toUpperCase()
  let rootAlter = 0
  let rest = name.slice(1)

  if (rest.startsWith('#') || rest.startsWith('♯')) {
    rootAlter = 1
    rest = rest.slice(1)
  } else if (rest.startsWith('b') || rest.startsWith('♭')) {
    rootAlter = -1
    rest = rest.slice(1)
  }

  // Map suffix to MusicXML kind
  const kindMap: Record<string, string> = {
    '': 'major',
    'm': 'minor',
    'min': 'minor',
    'minor': 'minor',
    '7': 'dominant',
    'maj7': 'major-seventh',
    'M7': 'major-seventh',
    'm7': 'minor-seventh',
    'min7': 'minor-seventh',
    'dim': 'diminished',
    'dim7': 'diminished-seventh',
    'aug': 'augmented',
    'sus2': 'suspended-second',
    'sus4': 'suspended-fourth',
    '6': 'major-sixth',
    'm6': 'minor-sixth',
    '9': 'dominant-ninth',
    'maj9': 'major-ninth',
    'm9': 'minor-ninth',
    'add9': 'major',
    '5': 'power',
  }

  const kind = kindMap[rest] ?? 'major'
  return { rootStep, rootAlter, kind }
}

export function setChord(xml: string, barIndex: number, beatIndex: number, chordSymbol: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml

  const { rootStep, rootAlter, kind } = parseChordName(chordSymbol)
  const { divisions } = getTimeInfo(doc)

  // Remove existing harmony at same beat
  const existing = m.querySelectorAll('harmony')
  existing.forEach((h) => {
    const offset = h.querySelector('offset')
    const hBeat = offset ? Math.round(parseInt(offset.textContent || '0', 10) / divisions) : 0
    if (hBeat === beatIndex) h.parentNode!.removeChild(h)
  })

  // Build <harmony> element
  const harmony = doc.createElement('harmony')
  const root = doc.createElement('root')
  const rootStepEl = doc.createElement('root-step')
  rootStepEl.textContent = rootStep
  root.appendChild(rootStepEl)
  if (rootAlter !== 0) {
    const rootAlterEl = doc.createElement('root-alter')
    rootAlterEl.textContent = String(rootAlter)
    root.appendChild(rootAlterEl)
  }
  harmony.appendChild(root)
  const kindEl = doc.createElement('kind')
  kindEl.textContent = kind
  harmony.appendChild(kindEl)

  if (beatIndex > 0) {
    const offset = doc.createElement('offset')
    offset.textContent = String(beatIndex * divisions)
    harmony.appendChild(offset)
  }

  // Insert harmony before first note
  const firstNote = m.querySelector('note')
  if (firstNote) {
    m.insertBefore(harmony, firstNote)
  } else {
    m.appendChild(harmony)
  }

  return serializeXml(doc)
}

const KEY_FIFTHS: Record<string, number> = {
  'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'Gb': -6,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Cb': -7,
  'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'C#m': 4, 'G#m': 5,
  'Dm': -1, 'Gm': -2, 'Cm': -3, 'Fm': -4, 'Bbm': -5, 'Ebm': -6,
}

export function setKeySig(xml: string, fromBar: number, key: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[fromBar]
  if (!m) return xml

  const fifths = KEY_FIFTHS[key] ?? 0

  // Find or create <attributes> block
  let attrs = m.querySelector('attributes')
  if (!attrs) {
    attrs = doc.createElement('attributes')
    m.insertBefore(attrs, m.firstChild)
  }

  // Find or create <key>
  let keyEl = attrs.querySelector('key')
  if (!keyEl) {
    keyEl = doc.createElement('key')
    attrs.appendChild(keyEl)
  }

  let fifthsEl = keyEl.querySelector('fifths')
  if (!fifthsEl) {
    fifthsEl = doc.createElement('fifths')
    keyEl.appendChild(fifthsEl)
  }
  fifthsEl.textContent = String(fifths)

  return serializeXml(doc)
}

export function setTimeSig(xml: string, fromBar: number, beats: number, beatType: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[fromBar]
  if (!m) return xml

  let attrs = m.querySelector('attributes')
  if (!attrs) {
    attrs = doc.createElement('attributes')
    m.insertBefore(attrs, m.firstChild)
  }

  let timeEl = attrs.querySelector('time')
  if (!timeEl) {
    timeEl = doc.createElement('time')
    attrs.appendChild(timeEl)
  }

  let beatsEl = timeEl.querySelector('beats')
  if (!beatsEl) {
    beatsEl = doc.createElement('beats')
    timeEl.appendChild(beatsEl)
  }
  beatsEl.textContent = String(beats)

  let beatTypeEl = timeEl.querySelector('beat-type')
  if (!beatTypeEl) {
    beatTypeEl = doc.createElement('beat-type')
    timeEl.appendChild(beatTypeEl)
  }
  beatTypeEl.textContent = String(beatType)

  return serializeXml(doc)
}

// --- Note operations ---

function getNotes(measure: Element): Element[] {
  return Array.from(measure.querySelectorAll('note'))
}

export function setNotePitch(xml: string, barIndex: number, noteIndex: number, pitch: Pitch): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml
  const notes = getNotes(m)
  const note = notes[noteIndex]
  if (!note) return xml

  // Remove existing rest if present (converting rest → note)
  const restEl = note.querySelector('rest')
  if (restEl) restEl.parentNode!.removeChild(restEl)

  // Find or create pitch element
  let pitchEl = note.querySelector('pitch')
  if (!pitchEl) {
    pitchEl = doc.createElement('pitch')
    note.insertBefore(pitchEl, note.firstChild)
  }

  let stepEl = pitchEl.querySelector('step')
  if (!stepEl) { stepEl = doc.createElement('step'); pitchEl.appendChild(stepEl) }
  stepEl.textContent = pitch.step

  let octEl = pitchEl.querySelector('octave')
  if (!octEl) { octEl = doc.createElement('octave'); pitchEl.appendChild(octEl) }
  octEl.textContent = String(pitch.octave)

  const existingAlter = pitchEl.querySelector('alter')
  if (pitch.alter !== undefined && pitch.alter !== 0) {
    if (!existingAlter) {
      const alterEl = doc.createElement('alter')
      alterEl.textContent = String(pitch.alter)
      pitchEl.insertBefore(alterEl, octEl)
    } else {
      existingAlter.textContent = String(pitch.alter)
    }
  } else if (existingAlter) {
    existingAlter.parentNode!.removeChild(existingAlter)
  }

  return serializeXml(doc)
}

export function setNoteDuration(
  xml: string, barIndex: number, noteIndex: number,
  type: string, durationValue: number
): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml
  const notes = getNotes(m)
  const note = notes[noteIndex]
  if (!note) return xml

  let typeEl = note.querySelector('type')
  if (!typeEl) { typeEl = doc.createElement('type'); note.appendChild(typeEl) }
  typeEl.textContent = type

  let durEl = note.querySelector('duration')
  if (!durEl) { durEl = doc.createElement('duration'); note.appendChild(durEl) }
  durEl.textContent = String(durationValue)

  return serializeXml(doc)
}

export function addAccidental(
  xml: string, barIndex: number, noteIndex: number,
  accidental: 'sharp' | 'flat' | 'natural'
): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml
  const notes = getNotes(m)
  const note = notes[noteIndex]
  if (!note) return xml

  // Add/update accidental element
  let accEl = note.querySelector('accidental')
  if (!accEl) { accEl = doc.createElement('accidental'); note.appendChild(accEl) }
  accEl.textContent = accidental

  // Update pitch alter
  const pitchEl = note.querySelector('pitch')
  if (pitchEl) {
    const alterValue = accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0
    let alterEl = pitchEl.querySelector('alter')
    if (alterValue !== 0) {
      if (!alterEl) {
        alterEl = doc.createElement('alter')
        const octEl = pitchEl.querySelector('octave')
        pitchEl.insertBefore(alterEl, octEl)
      }
      alterEl.textContent = String(alterValue)
    } else if (alterEl) {
      alterEl.parentNode!.removeChild(alterEl)
    }
  }

  return serializeXml(doc)
}

export function toggleTie(xml: string, barIndex: number, noteIndex: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml
  const notes = getNotes(m)
  const note = notes[noteIndex]
  if (!note) return xml

  const existingTie = note.querySelector('tie')
  if (existingTie) {
    // Remove all ties and notations/tied
    note.querySelectorAll('tie').forEach((t) => t.parentNode!.removeChild(t))
    const tied = note.querySelector('notations > tied')
    if (tied) {
      const notations = tied.parentNode as Element
      notations.removeChild(tied)
      if (!notations.hasChildNodes()) notations.parentNode!.removeChild(notations)
    }
  } else {
    const tie = doc.createElement('tie')
    tie.setAttribute('type', 'start')
    note.appendChild(tie)

    let notations = note.querySelector('notations')
    if (!notations) { notations = doc.createElement('notations'); note.appendChild(notations) }
    const tied = doc.createElement('tied')
    tied.setAttribute('type', 'start')
    notations.appendChild(tied)
  }

  return serializeXml(doc)
}

export function toggleRest(xml: string, barIndex: number, noteIndex: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml
  const notes = getNotes(m)
  const note = notes[noteIndex]
  if (!note) return xml

  const isRest = !!note.querySelector('rest')

  if (isRest) {
    // Convert rest to note (default C4)
    const restEl = note.querySelector('rest')
    if (restEl) restEl.parentNode!.removeChild(restEl)
    const pitchEl = doc.createElement('pitch')
    const stepEl = doc.createElement('step')
    stepEl.textContent = 'C'
    const octEl = doc.createElement('octave')
    octEl.textContent = '4'
    pitchEl.appendChild(stepEl)
    pitchEl.appendChild(octEl)
    note.insertBefore(pitchEl, note.firstChild)
  } else {
    // Convert note to rest
    const pitchEl = note.querySelector('pitch')
    if (pitchEl) pitchEl.parentNode!.removeChild(pitchEl)
    // Remove accidentals, ties, notations
    note.querySelectorAll('accidental, tie, notations').forEach((el) => el.parentNode!.removeChild(el))
    const restEl = doc.createElement('rest')
    note.insertBefore(restEl, note.firstChild)
  }

  return serializeXml(doc)
}

export function transposeBars(xml: string, barIndices: number[], semitones: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)

  for (const idx of barIndices) {
    const m = measures[idx]
    if (!m) continue
    const notes = getNotes(m)
    for (const note of notes) {
      const pitchEl = note.querySelector('pitch')
      if (!pitchEl) continue // skip rests
      const step = pitchEl.querySelector('step')!.textContent!
      const octave = parseInt(pitchEl.querySelector('octave')!.textContent!, 10)
      const alterEl = pitchEl.querySelector('alter')
      const alter = alterEl ? parseInt(alterEl.textContent!, 10) : 0

      const midi = pitchToMidi({ step, octave, alter })
      const newPitch = midiToPitch(midi + semitones)

      pitchEl.querySelector('step')!.textContent = newPitch.step
      pitchEl.querySelector('octave')!.textContent = String(newPitch.octave)

      if (newPitch.alter !== undefined && newPitch.alter !== 0) {
        if (!alterEl) {
          const el = doc.createElement('alter')
          el.textContent = String(newPitch.alter)
          pitchEl.insertBefore(el, pitchEl.querySelector('octave'))
        } else {
          alterEl.textContent = String(newPitch.alter)
        }
      } else if (alterEl) {
        alterEl.parentNode!.removeChild(alterEl)
      }
    }
  }

  return serializeXml(doc)
}

export function copyBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const fragDoc = parser.parseFromString('<measures></measures>', 'application/xml')
  const root = fragDoc.documentElement

  for (const idx of [...barIndices].sort((a, b) => a - b)) {
    if (measures[idx]) {
      root.appendChild(fragDoc.importNode(measures[idx], true))
    }
  }

  return serializer.serializeToString(fragDoc)
}

export function pasteBars(xml: string, fragment: string, afterIndex: number): string {
  const doc = parseXml(xml)
  const fragDoc = parser.parseFromString(fragment, 'application/xml')
  const fragMeasures = Array.from(fragDoc.querySelectorAll('measure'))
  const measures = getMeasures(doc)
  const ref = measures[afterIndex]
  const parent = ref?.parentNode ?? doc.querySelector('part')!

  let insertionPoint: Node | null = ref?.nextSibling ?? null
  for (const fm of fragMeasures) {
    const imported = doc.importNode(fm, true)
    parent.insertBefore(imported, insertionPoint)
    insertionPoint = imported.nextSibling
  }

  renumberMeasures(doc)
  return serializeXml(doc)
}

export function duplicateBars(xml: string, barIndices: number[], insertAfter: number): string {
  const fragment = copyBars(xml, barIndices)
  return pasteBars(xml, fragment, insertAfter)
}

export function setLyric(xml: string, barIndex: number, noteIndex: number, syllable: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const notes = getNotes(measures[barIndex])
  const note = notes[noteIndex]
  if (!note) return xml

  // Remove existing lyric
  const existing = note.querySelector('lyric')
  if (existing) existing.parentNode!.removeChild(existing)

  const lyric = doc.createElement('lyric')
  lyric.setAttribute('number', '1')
  const syllabicEl = doc.createElement('syllabic')
  // Detect syllabic type from text
  if (syllable.endsWith('-')) {
    syllabicEl.textContent = 'begin'
  } else if (syllable.startsWith('-')) {
    syllabicEl.textContent = 'end'
  } else {
    syllabicEl.textContent = 'single'
  }
  lyric.appendChild(syllabicEl)
  const textEl = doc.createElement('text')
  textEl.textContent = syllable.replace(/^-|-$/g, '')
  lyric.appendChild(textEl)
  note.appendChild(lyric)

  return serializeXml(doc)
}

export function setAnnotation(xml: string, barIndex: number, text: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const m = measures[barIndex]
  if (!m) return xml

  const direction = doc.createElement('direction')
  direction.setAttribute('placement', 'above')
  const dirType = doc.createElement('direction-type')
  const words = doc.createElement('words')
  words.textContent = text
  dirType.appendChild(words)
  direction.appendChild(dirType)

  // Insert before first note
  const firstNote = m.querySelector('note')
  if (firstNote) {
    m.insertBefore(direction, firstNote)
  } else {
    m.appendChild(direction)
  }

  return serializeXml(doc)
}

export interface NoteOnset {
  barIndex: number
  noteIndex: number
  onsetTime: number  // seconds
  duration: number   // seconds
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
