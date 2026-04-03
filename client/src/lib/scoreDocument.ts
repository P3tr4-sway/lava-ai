import type {
  GuitarPlacement,
  KeySignature,
  NoteValue,
  PlacementPolicy,
  ScoreDocument,
  ScoreHarmony,
  ScoreMeasureMeta,
  ScoreNoteEvent,
  ScorePitch,
  Technique,
  TimeSignature,
} from '@lava/shared'
import { STANDARD_TUNING, midiToPitch, pitchToMidi } from '@/lib/pitchUtils'
import {
  choosePlacement,
  createId,
  createMeasureMeta,
  DEFAULT_PLACEMENT_POLICY,
  divisionsToNoteType,
  noteTypeToDivisions,
  resolvePitchFromPlacement as resolvePitchFromPlacementHelper,
} from '@/spaces/pack/editor-core/helpers'
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

function parseTechniques(noteEl: Element): Technique[] {
  const techniques: Technique[] = []
  const notations = noteEl.querySelector('notations')
  if (!notations) return techniques

  // Technical
  const technical = notations.querySelector('technical')
  if (technical) {
    if (technical.querySelector('bend')) {
      const alter = parseFloat(technical.querySelector('bend > bend-alter')?.textContent ?? '2')
      if (alter < 0) {
        techniques.push({ type: 'tremoloBar', semitones: Math.abs(alter) })
      } else {
        techniques.push({ type: 'bend', style: 'full', semitones: alter })
      }
    }
    if (technical.querySelector('slide')) techniques.push({ type: 'slide', style: 'shift' })
    if (technical.querySelector('hammer-on')) techniques.push({ type: 'hammerOn' })
    if (technical.querySelector('pull-off')) techniques.push({ type: 'pullOff' })
    if (technical.querySelector('tap')) techniques.push({ type: 'tap' })
    if (technical.querySelector('harmonic')) {
      const style = technical.querySelector('harmonic > artificial') ? 'artificial' : 'natural'
      techniques.push({ type: 'harmonic', style: style as 'natural' | 'artificial' })
    }
    if (technical.querySelector('let-ring')) techniques.push({ type: 'letRing' })
    if (technical.querySelector('palm-mute')) techniques.push({ type: 'palmMute' })
  }

  // Ornaments
  const ornaments = notations.querySelector('ornaments')
  if (ornaments) {
    const tremolo = ornaments.querySelector('tremolo')
    if (tremolo) {
      const val = parseInt(tremolo.textContent ?? '2', 10)
      const speed = val >= 3 ? 'thirtySecond' : val >= 2 ? 'sixteenth' : 'eighth'
      techniques.push({ type: 'tremoloPicking', speed: speed as 'thirtySecond' | 'sixteenth' | 'eighth' })
    }
    if (ornaments.querySelector('wavy-line')) techniques.push({ type: 'vibrato', style: 'normal' })
  }

  // Articulations
  const articulations = notations.querySelector('articulations')
  if (articulations) {
    if (articulations.querySelector('strong-accent')) techniques.push({ type: 'accent', style: 'heavy' })
    else if (articulations.querySelector('accent')) techniques.push({ type: 'accent', style: 'normal' })
    if (articulations.querySelector('staccato')) techniques.push({ type: 'staccato' })
    if (articulations.querySelector('tenuto')) techniques.push({ type: 'tenuto' })
  }

  // Arpeggiate
  const arp = notations.querySelector('arpeggiate')
  if (arp) {
    const direction = (arp.getAttribute('direction') ?? 'up') as 'up' | 'down'
    techniques.push({ type: 'arpeggio', direction })
  }

  // Notehead
  const notehead = noteEl.querySelector('notehead')
  if (notehead) {
    if (notehead.textContent === 'x') techniques.push({ type: 'deadNote' })
    else if (notehead.getAttribute('parentheses') === 'yes') techniques.push({ type: 'ghostNote' })
  }

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


export function assignGuitarPlacement(document: ScoreDocument, policy: PlacementPolicy = DEFAULT_PLACEMENT_POLICY): ScoreDocument {
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

      // Tuplet
      const timeMod = noteEl.querySelector('time-modification')
      const tuplet = timeMod ? {
        actual: parseInt(timeMod.querySelector('actual-notes')?.textContent ?? '3', 10),
        normal: parseInt(timeMod.querySelector('normal-notes')?.textContent ?? '2', 10),
      } : undefined

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
        techniques: parseTechniques(noteEl),
        tuplet,
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

function renderNote(note: ScoreNoteEvent): string {
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

  // Dots
  for (let dot = 0; dot < note.dots; dot += 1) lines.push('<dot/>')

  // Tuplet time-modification
  if (note.tuplet) {
    lines.push('<time-modification>')
    lines.push(`<actual-notes>${note.tuplet.actual}</actual-notes>`)
    lines.push(`<normal-notes>${note.tuplet.normal}</normal-notes>`)
    lines.push('</time-modification>')
  }

  // Ties (as elements on the note)
  if (note.tieStart) lines.push('<tie type="start"/>')
  if (note.tieStop) lines.push('<tie type="stop"/>')

  // Notehead for ghost/dead notes
  const ghostNote = note.techniques.find((t) => t.type === 'ghostNote')
  const deadNote = note.techniques.find((t) => t.type === 'deadNote')
  if (deadNote) {
    lines.push('<notehead>x</notehead>')
  } else if (ghostNote) {
    lines.push('<notehead parentheses="yes">normal</notehead>')
  }

  // Lyric
  if (note.lyric) {
    lines.push(`<lyric><syllabic>single</syllabic><text>${xmlEscape(note.lyric)}</text></lyric>`)
  }

  // Notations block
  const hasNotations = note.tieStart || note.tieStop || note.tuplet || note.slurStart || note.placement || note.techniques.length > 0
  if (hasNotations) {
    lines.push('<notations>')

    if (note.tieStart) lines.push('<tied type="start"/>')
    if (note.tieStop) lines.push('<tied type="stop"/>')
    if (note.tuplet) lines.push('<tuplet type="start" bracket="yes"/>')
    if (note.slurStart) lines.push('<slur type="start"/>')

    // Ornaments
    const ornamentLines: string[] = []
    for (const t of note.techniques) {
      if (t.type === 'tremoloPicking') {
        const val = t.speed === 'thirtySecond' ? 3 : t.speed === 'sixteenth' ? 2 : 1
        ornamentLines.push(`<tremolo>${val}</tremolo>`)
      }
      if (t.type === 'vibrato') ornamentLines.push('<wavy-line type="start"/>')
    }
    if (ornamentLines.length) {
      lines.push('<ornaments>')
      lines.push(...ornamentLines)
      lines.push('</ornaments>')
    }

    // Technical
    const technicalLines: string[] = []
    if (note.placement) {
      technicalLines.push(`<string>${note.placement.string}</string>`)
      technicalLines.push(`<fret>${note.placement.fret}</fret>`)
    }
    for (const t of note.techniques) {
      if (t.type === 'bend') technicalLines.push(`<bend><bend-alter>${t.semitones}</bend-alter></bend>`)
      if (t.type === 'tremoloBar') technicalLines.push(`<bend><bend-alter>${-t.semitones}</bend-alter></bend>`)
      if (t.type === 'slide') technicalLines.push('<slide type="start"/>')
      if (t.type === 'hammerOn') technicalLines.push('<hammer-on type="start">H</hammer-on>')
      if (t.type === 'pullOff') technicalLines.push('<pull-off type="start">P</pull-off>')
      if (t.type === 'tap') technicalLines.push('<tap/>')
      if (t.type === 'harmonic') technicalLines.push(t.style === 'natural' ? '<harmonic><natural/></harmonic>' : '<harmonic><artificial/></harmonic>')
      if (t.type === 'letRing') technicalLines.push('<let-ring/>')
      if (t.type === 'palmMute') technicalLines.push('<palm-mute/>')
    }
    if (technicalLines.length) {
      lines.push('<technical>')
      lines.push(...technicalLines)
      lines.push('</technical>')
    }

    // Articulations
    const articulationLines: string[] = []
    for (const t of note.techniques) {
      if (t.type === 'accent') articulationLines.push(t.style === 'heavy' ? '<strong-accent/>' : '<accent/>')
      if (t.type === 'staccato') articulationLines.push('<staccato/>')
      if (t.type === 'tenuto') articulationLines.push('<tenuto/>')
    }
    if (articulationLines.length) {
      lines.push('<articulations>')
      lines.push(...articulationLines)
      lines.push('</articulations>')
    }

    // Arpeggiate
    const arp = note.techniques.find((t) => t.type === 'arpeggio')
    if (arp && arp.type === 'arpeggio') lines.push(`<arpeggiate direction="${arp.direction}"/>`)

    lines.push('</notations>')
  }

  lines.push('</note>')
  return lines.join('')
}

function renderNoteDynamic(note: ScoreNoteEvent): string {
  if (!note.dynamic) return ''
  return `<direction placement="below"><direction-type><dynamics><${note.dynamic}/></dynamics></direction-type></direction>`
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
    if (measure.isRepeatStart) {
      lines.push('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>')
    }
    measure.harmony.forEach((harmony) => lines.push(renderHarmony(harmony, document.divisions)))
    measure.annotations.forEach((annotation) => {
      lines.push(`<direction placement="above"><direction-type><words>${xmlEscape(annotation)}</words></direction-type></direction>`)
    })
    if (measure.repeatMarker) {
      const markerText: Record<string, string> = {
        'dc-al-fine': 'D.C. al Fine',
        'ds-al-coda': 'D.S. al Coda',
        segno: '\u{1D10B}',
        fine: 'Fine',
        coda: '\u{1D10C}',
      }
      const text = markerText[measure.repeatMarker]
      if (text) lines.push(`<direction placement="above"><direction-type><words>${xmlEscape(text)}</words></direction-type></direction>`)
    }
    const notes = (notesByMeasure.get(index) ?? []).sort((a, b) => a.beat - b.beat)
    notes.forEach((note) => {
      lines.push(renderNoteDynamic(note))
      lines.push(renderNote(note))
    })
    if (notes.length === 0) {
      lines.push(`<note><rest/><duration>${document.divisions * currentMeter.numerator}</duration><voice>1</voice><type>whole</type></note>`)
    }
    if (measure.isRepeatEnd) {
      lines.push('<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>')
    } else if (measure.barlineType && measure.barlineType !== 'single') {
      const barStyleMap: Record<string, string> = {
        double: 'light-light',
        final: 'light-heavy',
        dashed: 'dashed',
        dotted: 'dotted',
      }
      const barStyle = barStyleMap[measure.barlineType]
      if (barStyle) lines.push(`<barline location="right"><bar-style>${barStyle}</bar-style></barline>`)
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


// Command handling has moved to editor-core/commandRouter.ts
// This file retains: document creation, MusicXML import/export, and utility functions.
