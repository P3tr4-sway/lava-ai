import type {
  CommandResult,
  GuitarPlacement,
  KeySignature,
  NoteValue,
  PlacementPolicy,
  ScoreCommand,
  ScoreCommandPatch,
  ScoreDocument,
  ScoreHarmony,
  ScoreMeasureMeta,
  ScoreNoteEvent,
  ScorePitch,
  ScoreTrack,
  TechniqueSet,
  TimeSignature,
} from '@lava/shared'
import { STANDARD_TUNING, fretToMidi, midiToFret, midiToPitch, pitchToMidi } from '@/lib/pitchUtils'

const parser = new DOMParser()
const serializer = new XMLSerializer()

const KEY_FROM_FIFTHS: Record<number, KeySignature> = {
  [-7]: { key: 'Cb', mode: 'major' },
  [-6]: { key: 'Gb', mode: 'major' },
  [-5]: { key: 'Db', mode: 'major' },
  [-4]: { key: 'Ab', mode: 'major' },
  [-3]: { key: 'Eb', mode: 'major' },
  [-2]: { key: 'Bb', mode: 'major' },
  [-1]: { key: 'F', mode: 'major' },
  [0]: { key: 'C', mode: 'major' },
  [1]: { key: 'G', mode: 'major' },
  [2]: { key: 'D', mode: 'major' },
  [3]: { key: 'A', mode: 'major' },
  [4]: { key: 'E', mode: 'major' },
  [5]: { key: 'B', mode: 'major' },
  [6]: { key: 'F#', mode: 'major' },
  [7]: { key: 'C#', mode: 'major' },
}

const FIFTHS_FROM_KEY: Record<string, number> = {
  Cb: -7,
  Gb: -6,
  Db: -5,
  Ab: -4,
  Eb: -3,
  Bb: -2,
  F: -1,
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
}

const NOTE_TYPE_TO_DIVISOR: Record<NoteValue, number> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  sixteenth: 16,
}

const DEFAULT_POLICY: PlacementPolicy = {
  preferMinimalMovement: true,
  preferStringContinuity: true,
  maxFret: 18,
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function cloneScoreDocument(document: ScoreDocument): ScoreDocument {
  return structuredClone(document)
}

export function createEmptyScoreDocument(): ScoreDocument {
  return {
    id: createId('score'),
    title: 'Untitled Sheet',
    tempo: 120,
    meter: { numerator: 4, denominator: 4 },
    keySignature: { key: 'C', mode: 'major' },
    divisions: 4,
    layoutMode: 'systems',
    measures: [
      {
        id: createId('measure'),
        index: 0,
        harmony: [],
        annotations: [],
        chordDiagramPlacement: 'hidden',
      },
    ],
    tracks: [
      {
        id: createId('track'),
        name: 'Guitar',
        instrument: 'guitar',
        clef: 'treble',
        tuning: [...STANDARD_TUNING],
        capo: 0,
        notes: [],
      },
    ],
    sourceXml: null,
    lastExportedXml: null,
  }
}

function parseXml(xml: string): Document {
  const doc = parser.parseFromString(xml, 'application/xml')
  const error = doc.querySelector('parsererror')
  if (error) {
    throw new Error(`MusicXML parse error: ${error.textContent ?? 'unknown error'}`)
  }
  return doc
}

function getMeasureElements(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('part > measure'))
}

function getText(el: Element | null | undefined, selector: string): string | null {
  return el?.querySelector(selector)?.textContent?.trim() ?? null
}

function noteTypeToDivisions(type: NoteValue, divisions: number): number {
  const divisor = NOTE_TYPE_TO_DIVISOR[type] ?? 4
  return Math.max(1, Math.round((divisions * 4) / divisor))
}

function divisionsToNoteType(durationDivisions: number, divisions: number): NoteValue {
  const ratio = durationDivisions / Math.max(divisions, 1)
  if (ratio >= 4) return 'whole'
  if (ratio >= 2) return 'half'
  if (ratio >= 1) return 'quarter'
  if (ratio >= 0.5) return 'eighth'
  return 'sixteenth'
}

function buildHarmonySymbol(harmony: Element): string {
  const rootStep = getText(harmony, 'root-step') ?? 'C'
  const rootAlter = parseInt(getText(harmony, 'root-alter') ?? '0', 10)
  const kind = getText(harmony, 'kind') ?? 'major'
  const accidental = rootAlter > 0 ? '#' : rootAlter < 0 ? 'b' : ''
  const kindMap: Record<string, string> = {
    major: '',
    minor: 'm',
    dominant: '7',
    'major-seventh': 'maj7',
    'minor-seventh': 'm7',
    diminished: 'dim',
    'diminished-seventh': 'dim7',
    augmented: 'aug',
    'suspended-second': 'sus2',
    'suspended-fourth': 'sus4',
    'major-sixth': '6',
    'minor-sixth': 'm6',
    'dominant-ninth': '9',
    'major-ninth': 'maj9',
    'minor-ninth': 'm9',
    power: '5',
  }
  return `${rootStep}${accidental}${kindMap[kind] ?? ''}`
}

function parseTechniqueSet(noteEl: Element): TechniqueSet {
  const notations = noteEl.querySelector('notations')
  if (!notations) return {}
  const techniques: TechniqueSet = {}
  if (notations.querySelector('technical > bend')) techniques.bend = true
  if (notations.querySelector('technical > hammer-on')) techniques.hammerOn = true
  if (notations.querySelector('technical > pull-off')) techniques.pullOff = true
  if (notations.querySelector('articulations > strong-accent')) techniques.palmMute = true
  if (notations.querySelector('technical > harmonic')) techniques.harmonic = true
  if (notations.querySelector('ornaments > wavy-line')) techniques.vibrato = true
  if (notations.querySelector('slide[type="up"], glissando[type="up"]')) techniques.slide = 'up'
  if (notations.querySelector('slide[type="down"], glissando[type="down"]')) techniques.slide = 'down'
  return techniques
}

function parsePitch(noteEl: Element): ScorePitch | null {
  const pitchEl = noteEl.querySelector('pitch')
  if (!pitchEl) return null
  const step = getText(pitchEl, 'step')
  const octave = parseInt(getText(pitchEl, 'octave') ?? '4', 10)
  const alter = parseInt(getText(pitchEl, 'alter') ?? '0', 10)
  if (!step) return null
  return {
    step: step as ScorePitch['step'],
    octave,
    alter: alter || undefined,
  }
}

function parseTuning(measure: Element): number[] {
  const tuningEls = Array.from(measure.querySelectorAll('staff-details staff-tuning'))
  if (tuningEls.length === 0) return [...STANDARD_TUNING]
  const sorted = tuningEls
    .map((el) => {
      const line = parseInt(el.getAttribute('line') ?? '0', 10)
      const step = getText(el, 'tuning-step')
      const octave = parseInt(getText(el, 'tuning-octave') ?? '4', 10)
      const alter = parseInt(getText(el, 'tuning-alter') ?? '0', 10)
      if (!step) return null
      return {
        line,
        midi: pitchToMidi({ step, octave, alter: alter || undefined }),
      }
    })
    .filter(Boolean) as Array<{ line: number; midi: number }>

  if (sorted.length === 0) return [...STANDARD_TUNING]
  sorted.sort((a, b) => a.line - b.line)
  return sorted.map((entry) => entry.midi)
}

function parseMeasureMeta(
  measureEl: Element,
  index: number,
  fallbackMeter: TimeSignature,
  fallbackKey: KeySignature,
): ScoreMeasureMeta {
  const beats = parseInt(getText(measureEl, 'attributes > time > beats') ?? `${fallbackMeter.numerator}`, 10)
  const beatType = parseInt(getText(measureEl, 'attributes > time > beat-type') ?? `${fallbackMeter.denominator}`, 10)
  const fifths = parseInt(getText(measureEl, 'attributes > key > fifths') ?? `${FIFTHS_FROM_KEY[fallbackKey.key] ?? 0}`, 10)
  const mode = (getText(measureEl, 'attributes > key > mode') ?? fallbackKey.mode) as KeySignature['mode']
  const tempo = parseFloat(measureEl.querySelector('sound')?.getAttribute('tempo') ?? '')
  const harmony = Array.from(measureEl.querySelectorAll(':scope > harmony')).map<ScoreHarmony>((el, harmonyIndex) => {
    const offset = parseInt(getText(el, 'offset') ?? '0', 10)
    const divisions = Math.max(1, parseInt(getText(measureEl, 'attributes > divisions') ?? '4', 10))
    return {
      id: createId(`harmony-${index}-${harmonyIndex}`),
      beat: offset / divisions,
      symbol: buildHarmonySymbol(el),
    }
  })

  const annotations = Array.from(measureEl.querySelectorAll(':scope > direction direction-type words'))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)

  return {
    id: createId(`measure-${index}`),
    index,
    timeSignature: { numerator: beats, denominator: beatType },
    keySignature: {
      ...(KEY_FROM_FIFTHS[fifths] ?? fallbackKey),
      mode,
    },
    tempo: Number.isFinite(tempo) ? tempo : undefined,
    harmony,
    annotations,
    chordDiagramPlacement: 'hidden',
  }
}

function createMeasureMeta(index: number): ScoreMeasureMeta {
  return {
    id: createId(`measure-${index}`),
    index,
    harmony: [],
    annotations: [],
    chordDiagramPlacement: 'hidden',
  }
}

function choosePlacement(
  midi: number,
  tuning: number[],
  capo: number,
  previous: GuitarPlacement | null,
  policy: PlacementPolicy = DEFAULT_POLICY,
): GuitarPlacement | null {
  const effectiveTuning = tuning.map((value) => value + capo)
  const candidates = midiToFret(midi, effectiveTuning).filter((candidate) => candidate.fret <= policy.maxFret)
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const prevDistanceA = previous ? Math.abs(previous.fret - a.fret) + Math.abs(previous.string - a.string) : 0
    const prevDistanceB = previous ? Math.abs(previous.fret - b.fret) + Math.abs(previous.string - b.string) : 0
    if (policy.preferMinimalMovement && prevDistanceA !== prevDistanceB) return prevDistanceA - prevDistanceB
    if (policy.preferStringContinuity && previous && a.string !== b.string) {
      return Math.abs(previous.string - a.string) - Math.abs(previous.string - b.string)
    }
    return a.fret - b.fret
  })

  const best = candidates[0]
  return {
    string: best.string,
    fret: best.fret,
    confidence: previous ? 'derived' : 'low',
  }
}

export function assignGuitarPlacement(document: ScoreDocument, policy: PlacementPolicy = DEFAULT_POLICY): ScoreDocument {
  const next = cloneScoreDocument(document)
  const track = next.tracks[0]
  if (!track) return next

  let previous: GuitarPlacement | null = null
  track.notes = track.notes.map((note) => {
    if (note.isRest || !note.pitch) return note
    if (note.placement) {
      previous = note.placement
      return note
    }
    const midi = pitchToMidi(note.pitch)
    const placement = choosePlacement(midi, track.tuning, track.capo, previous, policy)
    if (placement) previous = placement
    return {
      ...note,
      placement,
    }
  })
  next.lastExportedXml = exportScoreDocumentToMusicXml(next)
  return next
}

export function parseMusicXmlToScoreDocument(xml: string): ScoreDocument {
  const doc = parseXml(xml)
  const measureEls = getMeasureElements(doc)
  const firstMeasure = measureEls[0]
  const divisions = Math.max(1, parseInt(getText(firstMeasure, 'attributes > divisions') ?? '4', 10))
  const title = getText(doc.documentElement, 'work > work-title')
    ?? getText(doc.documentElement, 'movement-title')
    ?? 'Untitled Sheet'
  const composer = getText(doc.documentElement, 'identification > creator[type="composer"]') ?? undefined
  const meter: TimeSignature = {
    numerator: parseInt(getText(firstMeasure, 'attributes > time > beats') ?? '4', 10),
    denominator: parseInt(getText(firstMeasure, 'attributes > time > beat-type') ?? '4', 10),
  }
  const fifths = parseInt(getText(firstMeasure, 'attributes > key > fifths') ?? '0', 10)
  const mode = (getText(firstMeasure, 'attributes > key > mode') ?? 'major') as KeySignature['mode']
  const keySignature: KeySignature = {
    ...(KEY_FROM_FIFTHS[fifths] ?? { key: 'C', mode: 'major' }),
    mode,
  }
  const tempo = parseFloat(firstMeasure?.querySelector('sound')?.getAttribute('tempo') ?? '') || 120
  const tuning = parseTuning(firstMeasure ?? doc.documentElement)
  const capo = parseInt(getText(firstMeasure, 'attributes > staff-details > capo') ?? '0', 10)

  const measures: ScoreMeasureMeta[] = []
  const notes: ScoreNoteEvent[] = []

  measureEls.forEach((measureEl, measureIndex) => {
    const measureMeta = parseMeasureMeta(measureEl, measureIndex, meter, keySignature)
    measures.push(measureMeta)

    let currentDivisions = 0
    let noteOrdinal = 0
    Array.from(measureEl.querySelectorAll(':scope > note')).forEach((noteEl) => {
      const isChordTone = noteEl.querySelector('chord') !== null
      const durationDivisions = parseInt(getText(noteEl, 'duration') ?? `${divisions}`, 10)
      const durationType = (getText(noteEl, 'type') ?? divisionsToNoteType(durationDivisions, divisions)) as NoteValue
      const pitch = parsePitch(noteEl)
      const stringValue = parseInt(getText(noteEl, 'notations > technical > string') ?? '0', 10)
      const fretValue = parseInt(getText(noteEl, 'notations > technical > fret') ?? '-1', 10)
      const placement = stringValue > 0 && fretValue >= 0
        ? {
            string: stringValue,
            fret: fretValue,
            confidence: 'explicit' as const,
          }
        : null

      const note: ScoreNoteEvent = {
        id: createId(`note-${measureIndex}-${noteOrdinal}`),
        measureIndex,
        voice: parseInt(getText(noteEl, 'voice') ?? '1', 10),
        beat: currentDivisions / divisions,
        durationDivisions,
        durationType,
        dots: noteEl.querySelectorAll('dot').length,
        isRest: noteEl.querySelector('rest') !== null,
        pitch,
        placement,
        techniques: parseTechniqueSet(noteEl),
        lyric: getText(noteEl, 'lyric > text') ?? undefined,
        tieStart: noteEl.querySelector('tie[type="start"]') !== null,
        tieStop: noteEl.querySelector('tie[type="stop"]') !== null,
        displayHints: {
          staffVisible: true,
          tabVisible: true,
        },
      }
      notes.push(note)
      noteOrdinal += 1
      if (!isChordTone) currentDivisions += durationDivisions
    })
  })

  const scoreDocument: ScoreDocument = {
    id: createId('score'),
    title,
    composer,
    tempo,
    meter,
    keySignature,
    divisions,
    layoutMode: 'systems',
    measures,
    tracks: [
      {
        id: createId('track'),
        name: 'Guitar',
        instrument: 'guitar',
        clef: 'treble',
        tuning,
        capo,
        notes,
      },
    ],
    sourceXml: xml,
    lastExportedXml: xml,
  }

  return assignGuitarPlacement(scoreDocument)
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHarmony(harmony: ScoreHarmony, divisions: number): string {
  const symbol = harmony.symbol
  const rootStep = symbol[0]?.toUpperCase() ?? 'C'
  const accidentalChar = symbol[1] === '#' || symbol[1] === 'b' ? symbol[1] : ''
  const suffix = accidentalChar ? symbol.slice(2) : symbol.slice(1)
  const kindMap: Record<string, string> = {
    '': 'major',
    m: 'minor',
    '7': 'dominant',
    maj7: 'major-seventh',
    m7: 'minor-seventh',
    dim: 'diminished',
    dim7: 'diminished-seventh',
    aug: 'augmented',
    sus2: 'suspended-second',
    sus4: 'suspended-fourth',
    '6': 'major-sixth',
    m6: 'minor-sixth',
    '9': 'dominant-ninth',
    maj9: 'major-ninth',
    m9: 'minor-ninth',
    '5': 'power',
  }
  return [
    '<harmony>',
    '<root>',
    `<root-step>${rootStep}</root-step>`,
    accidentalChar ? `<root-alter>${accidentalChar === '#' ? 1 : -1}</root-alter>` : '',
    '</root>',
    `<kind>${kindMap[suffix] ?? 'major'}</kind>`,
    harmony.beat > 0 ? `<offset>${Math.round(harmony.beat * divisions)}</offset>` : '',
    '</harmony>',
  ].join('')
}

function renderNote(note: ScoreNoteEvent, track: ScoreTrack): string {
  const lines: string[] = ['<note>']
  if (note.isRest || !note.pitch) {
    lines.push('<rest/>')
  } else {
    lines.push('<pitch>')
    lines.push(`<step>${note.pitch.step}</step>`)
    if (note.pitch.alter) lines.push(`<alter>${note.pitch.alter}</alter>`)
    lines.push(`<octave>${note.pitch.octave}</octave>`)
    lines.push('</pitch>')
  }
  lines.push(`<duration>${note.durationDivisions}</duration>`)
  lines.push(`<voice>${note.voice}</voice>`)
  lines.push(`<type>${note.durationType}</type>`)
  for (let dot = 0; dot < note.dots; dot += 1) lines.push('<dot/>')
  if (note.tieStart) lines.push('<tie type="start"/>')
  if (note.tieStop) lines.push('<tie type="stop"/>')
  if (note.lyric) {
    lines.push(`<lyric><text>${xmlEscape(note.lyric)}</text></lyric>`)
  }
  if (note.placement || note.tieStart || note.tieStop || Object.keys(note.techniques).length > 0) {
    lines.push('<notations>')
    if (note.tieStart) lines.push('<tied type="start"/>')
    if (note.tieStop) lines.push('<tied type="stop"/>')
    if (note.placement || Object.keys(note.techniques).length > 0) {
      lines.push('<technical>')
      if (note.placement) {
        lines.push(`<string>${note.placement.string}</string>`)
        lines.push(`<fret>${note.placement.fret}</fret>`)
      }
      if (note.techniques.bend) lines.push('<bend><bend-alter>1</bend-alter></bend>')
      if (note.techniques.hammerOn) lines.push('<hammer-on type="start">H</hammer-on>')
      if (note.techniques.pullOff) lines.push('<pull-off type="start">P</pull-off>')
      if (note.techniques.harmonic) lines.push('<harmonic><natural/></harmonic>')
      lines.push('</technical>')
    }
    if (note.techniques.slide) lines.push(`<slide type="${note.techniques.slide === 'down' ? 'down' : 'up'}"/>`)
    if (note.techniques.vibrato) lines.push('<ornaments><wavy-line type="start"/></ornaments>')
    if (note.techniques.palmMute) lines.push('<articulations><strong-accent type="up"/></articulations>')
    lines.push('</notations>')
  }
  lines.push('</note>')
  return lines.join('')
}

export function exportScoreDocumentToMusicXml(document: ScoreDocument): string {
  const track = document.tracks[0]
  if (!track) return createEmptyScoreDocument().lastExportedXml ?? ''
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<score-partwise version="3.1">',
    '<work>',
    `<work-title>${xmlEscape(document.title)}</work-title>`,
    '</work>',
    document.composer
      ? `<identification><creator type="composer">${xmlEscape(document.composer)}</creator></identification>`
      : '',
    '<part-list>',
    `<score-part id="${track.id}"><part-name>${xmlEscape(track.name)}</part-name></score-part>`,
    '</part-list>',
    `<part id="${track.id}">`,
  ]

  const notesByMeasure = new Map<number, ScoreNoteEvent[]>()
  track.notes.forEach((note) => {
    const measureNotes = notesByMeasure.get(note.measureIndex) ?? []
    measureNotes.push(note)
    notesByMeasure.set(note.measureIndex, measureNotes)
  })

  document.measures.forEach((measure, index) => {
    const currentMeter = measure.timeSignature ?? document.meter
    const currentKey = measure.keySignature ?? document.keySignature
    lines.push(`<measure number="${index + 1}">`)
    if (index === 0 || measure.timeSignature || measure.keySignature) {
      lines.push('<attributes>')
      lines.push(`<divisions>${document.divisions}</divisions>`)
      lines.push('<key>')
      lines.push(`<fifths>${FIFTHS_FROM_KEY[currentKey.key] ?? 0}</fifths>`)
      lines.push(`<mode>${currentKey.mode}</mode>`)
      lines.push('</key>')
      lines.push('<time>')
      lines.push(`<beats>${currentMeter.numerator}</beats>`)
      lines.push(`<beat-type>${currentMeter.denominator}</beat-type>`)
      lines.push('</time>')
      lines.push('<clef><sign>G</sign><line>2</line></clef>')
      lines.push('<staff-details>')
      lines.push('<staff-lines>6</staff-lines>')
      track.tuning.forEach((midi, tuningIndex) => {
        const pitch = midiToPitch(midi)
        lines.push(`<staff-tuning line="${tuningIndex + 1}">`)
        lines.push(`<tuning-step>${pitch.step}</tuning-step>`)
        if (pitch.alter) lines.push(`<tuning-alter>${pitch.alter}</tuning-alter>`)
        lines.push(`<tuning-octave>${pitch.octave}</tuning-octave>`)
        lines.push('</staff-tuning>')
      })
      if (track.capo > 0) lines.push(`<capo>${track.capo}</capo>`)
      lines.push('</staff-details>')
      lines.push('</attributes>')
    }
    if (measure.tempo ?? (index === 0 ? document.tempo : undefined)) {
      lines.push(`<direction placement="above"><direction-type><words>Tempo</words></direction-type><sound tempo="${measure.tempo ?? document.tempo}"/></direction>`)
    }
    measure.harmony.forEach((harmony) => lines.push(renderHarmony(harmony, document.divisions)))
    measure.annotations.forEach((annotation) => {
      lines.push(`<direction placement="above"><direction-type><words>${xmlEscape(annotation)}</words></direction-type></direction>`)
    })
    const notes = (notesByMeasure.get(index) ?? []).sort((a, b) => a.beat - b.beat)
    notes.forEach((note) => lines.push(renderNote(note, track)))
    if (notes.length === 0) {
      lines.push(`<note><rest/><duration>${document.divisions * currentMeter.numerator}</duration><voice>1</voice><type>whole</type></note>`)
    }
    lines.push('</measure>')
  })
  lines.push('</part>')
  lines.push('</score-partwise>')
  return lines.filter(Boolean).join('')
}

export function buildScoreDigest(document: ScoreDocument): string {
  const track = document.tracks[0]
  const tuning = track?.tuning.map((midi) => {
    const pitch = midiToPitch(midi)
    return `${pitch.step}${pitch.alter === 1 ? '#' : pitch.alter === -1 ? 'b' : ''}${pitch.octave}`
  }).join(' ')
  const chordLine = document.measures
    .slice(0, 8)
    .map((measure) => {
      const chords = measure.harmony.map((entry) => entry.symbol).join(' / ') || '—'
      return `Bar ${measure.index + 1}: ${chords}`
    })
    .join(' | ')
  return [
    `Key: ${document.keySignature.key} ${document.keySignature.mode}`,
    `Tempo: ${document.tempo} BPM`,
    `Time: ${document.meter.numerator}/${document.meter.denominator}`,
    `${document.measures.length} bars`,
    tuning ? `Tuning: ${tuning}` : '',
    track ? `Capo: ${track.capo}` : '',
    chordLine ? `Chords: ${chordLine}` : '',
  ].filter(Boolean).join(' | ')
}

function updateTrackNotes(track: ScoreTrack, updater: (notes: ScoreNoteEvent[]) => ScoreNoteEvent[]): ScoreTrack {
  return {
    ...track,
    notes: updater(track.notes).sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat),
  }
}

function resolvePitchFromPlacement(track: ScoreTrack, placement: GuitarPlacement): ScorePitch {
  const pitch = midiToPitch(fretToMidi(placement.string, placement.fret, track.tuning.map((value) => value + track.capo)))
  return {
    step: pitch.step as ScorePitch['step'],
    octave: pitch.octave,
    alter: pitch.alter,
  }
}

export function applyCommandToDocument(document: ScoreDocument, command: ScoreCommand): CommandResult {
  const next = cloneScoreDocument(document)
  const track = next.tracks[0]
  const warnings: string[] = []

  if (!track) return { document: next, warnings: ['No editable guitar track found.'] }

  const findNote = (noteId: string) => track.notes.find((note) => note.id === noteId)

  switch (command.type) {
    case 'insertNote': {
      const inferredPlacement = command.note?.placement ?? { string: 1, fret: 0, confidence: 'low' as const }
      const inferredPitch = command.note?.pitch ?? resolvePitchFromPlacement(track, inferredPlacement)
      const newNote: ScoreNoteEvent = {
        id: createId('note'),
        measureIndex: command.measureIndex,
        voice: 1,
        beat: command.beat,
        durationDivisions: command.note?.durationDivisions ?? noteTypeToDivisions(command.note?.durationType ?? 'quarter', next.divisions),
        durationType: command.note?.durationType ?? 'quarter',
        dots: command.note?.dots ?? 0,
        isRest: command.note?.isRest ?? false,
        pitch: inferredPitch,
        placement: inferredPlacement,
        techniques: command.note?.techniques ?? {},
        lyric: command.note?.lyric,
        tieStart: command.note?.tieStart,
        tieStop: command.note?.tieStop,
        displayHints: command.note?.displayHints ?? { staffVisible: true, tabVisible: true },
      }
      track.notes = [...track.notes, newNote].sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
      break
    }
    case 'insertNoteAtCaret': {
      if (command.measureIndex < 0 || command.measureIndex >= next.measures.length) {
        warnings.push(`Measure index ${command.measureIndex} is out of bounds.`)
        break
      }
      const existing = track.notes.find((note) =>
        note.measureIndex === command.measureIndex
        && Math.abs(note.beat - command.beat) < 0.02
        && note.placement?.string === command.string,
      )
      if (existing) {
        track.notes = track.notes.map((note) => note.id === existing.id
          ? {
              ...note,
              isRest: false,
              durationType: command.durationType ?? note.durationType,
              durationDivisions: noteTypeToDivisions(command.durationType ?? note.durationType, next.divisions),
              placement: {
                string: command.string,
                fret: command.fret,
                confidence: 'explicit',
              },
              pitch: resolvePitchFromPlacement(track, {
                string: command.string,
                fret: command.fret,
                confidence: 'explicit',
              }),
            }
          : note)
        break
      }
      const placement = {
        string: command.string,
        fret: command.fret,
        confidence: 'explicit' as const,
      }
      const durationType = command.durationType ?? 'quarter'
      const newNote: ScoreNoteEvent = {
        id: createId('note'),
        measureIndex: command.measureIndex,
        voice: 1,
        beat: command.beat,
        durationDivisions: noteTypeToDivisions(durationType, next.divisions),
        durationType,
        dots: 0,
        isRest: false,
        pitch: resolvePitchFromPlacement(track, placement),
        placement,
        techniques: {},
        displayHints: { staffVisible: true, tabVisible: true },
      }
      track.notes = [...track.notes, newNote].sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
      break
    }
    case 'insertRestAtCaret': {
      const durationType = command.durationType ?? 'quarter'
      const existing = track.notes.find((note) =>
        note.measureIndex === command.measureIndex && Math.abs(note.beat - command.beat) < 0.02,
      )
      if (existing) {
        track.notes = track.notes.map((note) => note.id === existing.id
          ? {
              ...note,
              isRest: true,
              durationType,
              durationDivisions: noteTypeToDivisions(durationType, next.divisions),
              placement: null,
              pitch: null,
            }
          : note)
        break
      }
      const newNote: ScoreNoteEvent = {
        id: createId('note'),
        measureIndex: command.measureIndex,
        voice: 1,
        beat: command.beat,
        durationDivisions: noteTypeToDivisions(durationType, next.divisions),
        durationType,
        dots: 0,
        isRest: true,
        pitch: null,
        placement: null,
        techniques: {},
        displayHints: { staffVisible: true, tabVisible: true },
      }
      track.notes = [...track.notes, newNote].sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
      break
    }
    case 'deleteNote':
      track.notes = track.notes.filter((note) => note.id !== command.noteId)
      break
    case 'moveNoteToBeat':
      track.notes = track.notes.map((note) => {
        if (note.id !== command.noteId) return note
        const nextString = command.string ?? note.placement?.string
        const nextPlacement = nextString && note.placement
          ? {
              ...note.placement,
              string: nextString,
            }
          : note.placement
        return {
          ...note,
          measureIndex: command.measureIndex,
          beat: command.beat,
          placement: nextPlacement,
        }
      }).sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
      break
    case 'setDuration':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? {
            ...note,
            durationType: command.durationType,
            durationDivisions: command.durationDivisions > 0
              ? command.durationDivisions
              : noteTypeToDivisions(command.durationType, next.divisions),
          }
        : note)
      break
    case 'setPitch':
      track.notes = track.notes.map((note) => {
        if (note.id !== command.noteId) return note
        const updated = { ...note, isRest: command.pitch === null, pitch: command.pitch }
        if (command.pitch) {
          const placement = choosePlacement(
            pitchToMidi(command.pitch),
            track.tuning,
            track.capo,
            note.placement,
          )
          updated.placement = placement
          if (!placement) warnings.push(`No playable placement found for ${command.pitch.step}${command.pitch.octave}.`)
        } else {
          updated.placement = null
        }
        return updated
      })
      break
    case 'setStringFret':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? {
            ...note,
            isRest: false,
            placement: {
              string: command.string,
              fret: command.fret,
              confidence: 'explicit',
            },
            pitch: resolvePitchFromPlacement(track, {
              string: command.string,
              fret: command.fret,
              confidence: 'explicit',
            }),
          }
        : note)
      break
    case 'splitNote': {
      const note = findNote(command.noteId)
      if (!note) break
      const rightDuration = Math.max(1, note.durationDivisions - command.leftDurationDivisions)
      track.notes = track.notes.flatMap((entry) => {
        if (entry.id !== command.noteId) return [entry]
        return [
          { ...entry, durationDivisions: command.leftDurationDivisions, durationType: divisionsToNoteType(command.leftDurationDivisions, next.divisions) },
          {
            ...entry,
            id: createId('note'),
            beat: entry.beat + command.leftDurationDivisions / next.divisions,
            durationDivisions: rightDuration,
            durationType: divisionsToNoteType(rightDuration, next.divisions),
          },
        ]
      })
      break
    }
    case 'mergeWithNext': {
      const ordered = track.notes
        .slice()
        .sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat)
      const index = ordered.findIndex((note) => note.id === command.noteId)
      const current = ordered[index]
      const nextNote = index >= 0 ? ordered[index + 1] : null
      if (!current || !nextNote) break
      if (current.measureIndex !== nextNote.measureIndex) break
      track.notes = ordered
        .filter((note) => note.id !== nextNote.id)
        .map((note) => note.id === current.id
          ? {
              ...note,
              durationDivisions: note.durationDivisions + nextNote.durationDivisions,
              durationType: divisionsToNoteType(note.durationDivisions + nextNote.durationDivisions, next.divisions),
            }
          : note)
      break
    }
    case 'toggleRest':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? {
            ...note,
            isRest: !note.isRest,
            placement: note.isRest ? (note.placement ?? { string: 1, fret: 0, confidence: 'low' }) : null,
            pitch: note.isRest ? (note.pitch ?? { step: 'E', octave: 4 }) : null,
          }
        : note)
      break
    case 'toggleTie':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? { ...note, tieStart: !note.tieStart }
        : note)
      break
    case 'toggleSlur':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? { ...note, slurStart: !note.slurStart }
        : note)
      break
    case 'transposeSelection': {
      const targetNotes = new Set(
        command.noteIds
          ?? track.notes
            .filter((note) => {
              if (!command.measureRange) return true
              return note.measureIndex >= command.measureRange[0] && note.measureIndex <= command.measureRange[1]
            })
            .map((note) => note.id),
      )
      track.notes = track.notes.map((note) => {
        if (!targetNotes.has(note.id) || !note.pitch) return note
        const nextPitchRaw = midiToPitch(pitchToMidi(note.pitch) + command.semitones)
        const nextPitch: ScorePitch = {
          step: nextPitchRaw.step as ScorePitch['step'],
          octave: nextPitchRaw.octave,
          alter: nextPitchRaw.alter,
        }
        const placement = choosePlacement(pitchToMidi(nextPitch), track.tuning, track.capo, note.placement)
        return {
          ...note,
          pitch: nextPitch,
          placement,
        }
      })
      break
    }
    case 'setTuning':
    case 'changeTuning':
      track.tuning = [...command.tuning]
      track.notes = track.notes.map((note) => {
        if (!note.pitch) return note
        const placement = choosePlacement(pitchToMidi(note.pitch), track.tuning, track.capo, note.placement)
        return { ...note, placement }
      })
      break
    case 'setCapo':
      track.capo = command.capo
      track.notes = track.notes.map((note) => {
        if (!note.pitch) return note
        const placement = choosePlacement(pitchToMidi(note.pitch), track.tuning, track.capo, note.placement)
        return { ...note, placement }
      })
      break
    case 'setChordSymbol': {
      const measure = next.measures[command.measureIndex]
      if (measure) {
        measure.harmony = [
          ...measure.harmony.filter((entry) => entry.beat !== command.beat),
          { id: createId('harmony'), beat: command.beat, symbol: command.symbol },
        ].sort((a, b) => a.beat - b.beat)
      }
      break
    }
    case 'setAnnotation': {
      const measure = next.measures[command.measureIndex]
      if (measure) {
        const text = command.text.trim()
        measure.annotations = text ? [text] : []
      }
      break
    }
    case 'setSectionLabel': {
      const label = command.label.trim()
      next.measures = next.measures.map((measure) => {
        if (measure.index < command.startMeasureIndex || measure.index > command.endMeasureIndex) return measure
        return {
          ...measure,
          sectionLabel: measure.index === command.startMeasureIndex && label ? label : undefined,
        }
      })
      break
    }
    case 'setChordDiagramPlacement': {
      const measure = next.measures[command.measureIndex]
      if (measure) {
        measure.chordDiagramPlacement = command.placement
      }
      break
    }
    case 'deleteMeasureRange': {
      const [start, end] = [command.start, command.end]
      const deleteCount = end - start + 1
      if (deleteCount >= next.measures.length) {
        next.measures = [createMeasureMeta(0)]
        track.notes = []
        break
      }
      next.measures = next.measures
        .filter((measure) => measure.index < start || measure.index > end)
        .map((measure, index) => ({ ...measure, index }))
      track.notes = track.notes
        .filter((note) => note.measureIndex < start || note.measureIndex > end)
        .map((note) => ({
          ...note,
          measureIndex: note.measureIndex > end ? note.measureIndex - deleteCount : note.measureIndex,
      }))
      break
    }
    case 'addMeasureBefore': {
      const newMeasures = Array.from({ length: command.count }, (_, idx) => createMeasureMeta(command.beforeIndex + idx))
      const prefix = next.measures.slice(0, command.beforeIndex)
      const suffix = next.measures.slice(command.beforeIndex).map((measure) => ({
        ...measure,
        index: measure.index + command.count,
      }))
      next.measures = [...prefix, ...newMeasures, ...suffix]
      track.notes = track.notes.map((note) => ({
        ...note,
        measureIndex: note.measureIndex >= command.beforeIndex ? note.measureIndex + command.count : note.measureIndex,
      }))
      break
    }
    case 'addMeasureAfter': {
      const newMeasures = Array.from({ length: command.count }, (_, idx) => createMeasureMeta(command.afterIndex + idx + 1))
      const prefix = next.measures.slice(0, command.afterIndex + 1)
      const suffix = next.measures.slice(command.afterIndex + 1).map((measure) => ({
        ...measure,
        index: measure.index + command.count,
      }))
      next.measures = [...prefix, ...newMeasures, ...suffix]
      track.notes = track.notes.map((note) => ({
        ...note,
        measureIndex: note.measureIndex > command.afterIndex ? note.measureIndex + command.count : note.measureIndex,
      }))
      break
    }
    case 'simplifyFingering':
      track.notes = track.notes.map((note) => {
        if (!note.pitch) return note
        const placement = choosePlacement(pitchToMidi(note.pitch), track.tuning, track.capo, null, DEFAULT_POLICY)
        return { ...note, placement }
      })
      break
    case 'reharmonizeSelection': {
      const [start, end] = command.measureRange ?? [0, next.measures.length - 1]
      for (let index = start; index <= end; index += 1) {
        const measure = next.measures[index]
        if (!measure) continue
        measure.harmony = command.chords.map((entry) => ({
          id: createId('harmony'),
          beat: entry.beat,
          symbol: entry.symbol,
        }))
      }
      break
    }
    case 'addTechnique':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? {
            ...note,
            techniques: {
              ...note.techniques,
              [command.technique]: command.value ?? true,
            },
          }
        : note)
      break
    case 'removeTechnique':
      track.notes = track.notes.map((note) => {
        if (note.id !== command.noteId) return note
        const techniques = { ...note.techniques }
        delete techniques[command.technique]
        return { ...note, techniques }
      })
      break
    case 'moveCursor':
    case 'selectNotes':
    case 'setMeasureRange':
      break
  }

  next.lastExportedXml = exportScoreDocumentToMusicXml(next)
  return { document: next, warnings }
}

export function applyCommandPatch(document: ScoreDocument, patch: ScoreCommandPatch): CommandResult {
  return patch.commands.reduce<CommandResult>(
    (result, command) => {
      const next = applyCommandToDocument(result.document, command)
      return {
        document: next.document,
        warnings: [...result.warnings, ...next.warnings],
      }
    },
    { document, warnings: patch.warnings ?? [] },
  )
}
