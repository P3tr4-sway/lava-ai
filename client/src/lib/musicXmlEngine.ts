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
  } else if ((rest.startsWith('b') && rest !== 'b') || rest.startsWith('♭')) {
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

  // Remove existing harmony at same offset
  const existing = m.querySelectorAll('harmony')
  existing.forEach((h) => {
    const offset = h.querySelector('offset')
    const hBeat = offset ? Math.floor(parseInt(offset.textContent || '0', 10)) : 0
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
    const { divisions } = getTimeInfo(doc)
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
