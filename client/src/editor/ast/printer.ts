/**
 * AlphaTex printer — converts a ScoreNode back to an alphaTex string.
 *
 * Invariant: parse(print(ast)) ≡ ast (structurally identical, whitespace OK).
 * Deterministic: same input always produces same output.
 *
 * Source: https://alphatab.net/docs/alphatex/ (v1.8.1)
 */

import type {
  BarNode,
  BeatNode,
  BendPoint,
  ChordDefNode,
  Duration,
  DurationNode,
  MetaNode,
  NoteNode,
  ScoreNode,
  StaffNode,
  TrackNode,
  VoiceNode,
} from './types'
import { barCapacityUnits, durationToUnits, splitIntoRests, UNITS_PER_WHOLE } from './barFill'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function q(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function printBendPoints(points: BendPoint[]): string {
  const vals = points.map(p => String(p.value)).join(' ')
  return `(${vals})`
}

function printDuration(d: DurationNode): string {
  let result = ''
  if (d.dots === 1) result += ' d'
  if (d.dots === 2) result += ' dd'
  if (d.tuplet) {
    const { numerator, denominator } = d.tuplet
    if (denominator === 2) {
      result += ` tu ${numerator}`
    } else {
      result += ` tu (${numerator} ${denominator})`
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// MetaNode
// ---------------------------------------------------------------------------

function printMeta(meta: MetaNode): string {
  const lines: string[] = []
  if (meta.title) lines.push(`\\title ${q(meta.title)}`)
  if (meta.subtitle) lines.push(`\\subtitle ${q(meta.subtitle)}`)
  if (meta.artist) lines.push(`\\artist ${q(meta.artist)}`)
  if (meta.album) lines.push(`\\album ${q(meta.album)}`)
  if (meta.words) lines.push(`\\words ${q(meta.words)}`)
  if (meta.music) lines.push(`\\music ${q(meta.music)}`)
  if (meta.copyright) lines.push(`\\copyright ${q(meta.copyright)}`)
  if (meta.tab) lines.push(`\\tab ${q(meta.tab)}`)
  if (meta.tempo !== 120 || meta.tempoLabel) {
    if (meta.tempoLabel) {
      lines.push(`\\tempo (${meta.tempo} ${q(meta.tempoLabel)})`)
    } else {
      lines.push(`\\tempo ${meta.tempo}`)
    }
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// NoteNode
// ---------------------------------------------------------------------------

function printNoteEffects(note: NoteNode, options?: { omitDeadShorthand?: boolean }): string {
  const parts: string[] = []

  if (note.hammerOrPull) parts.push('h')
  if (note.leftHandTap) parts.push('lht')
  if (note.tie) parts.push('t')

  if (note.slide) {
    const slideMap: Record<string, string> = {
      legato: 'sl',
      shift: 'ss',
      intoFromBelow: 'sib',
      intoFromAbove: 'sia',
      outUp: 'sou',
      outDown: 'sod',
      pickSlideUp: 'psu',
      pickSlideDown: 'psd',
    }
    parts.push(slideMap[note.slide] ?? note.slide)
  }

  if (note.bend && note.bend.length > 0) parts.push(`b ${printBendPoints(note.bend)}`)
  if (note.bendExact && note.bendExact.length > 0) parts.push(`be ${printBendPoints(note.bendExact)}`)

  if (note.vibrato === 'slight') parts.push('v')
  if (note.vibrato === 'wide') parts.push('vw')

  if (note.harmonic) {
    switch (note.harmonic) {
      case 'natural': parts.push('nh'); break
      case 'artificial': parts.push(note.harmonicFret !== undefined ? `ah ${note.harmonicFret}` : 'ah'); break
      case 'tap': parts.push(note.harmonicFret !== undefined ? `th ${note.harmonicFret}` : 'th'); break
      case 'pinch': parts.push('ph'); break
      case 'semi': parts.push('sh'); break
      case 'feedback': parts.push('fh'); break
    }
  }

  if (note.ghost) parts.push('g')
  if (note.dead && !options?.omitDeadShorthand) parts.push('x')
  if (note.palmMute) parts.push('pm')
  if (note.letRing) parts.push('lr')
  if (note.staccato) parts.push('st')

  if (note.accent) {
    switch (note.accent) {
      case 'normal': parts.push('ac'); break
      case 'heavy': parts.push('hac'); break
      case 'tenuto': parts.push('ten'); break
    }
  }

  if (note.ornament) parts.push(note.ornament)

  if (note.trill) {
    parts.push(`tr ${note.trill.fret} ${note.trill.duration}`)
  }

  if (note.leftFinger !== undefined) parts.push(`lf ${note.leftFinger}`)
  if (note.rightFinger !== undefined) parts.push(`rf ${note.rightFinger}`)
  if (note.slur !== undefined) parts.push(`slur ${note.slur}`)
  if (note.hidden) parts.push('hide')

  return parts.length > 0 ? ` {${parts.join(' ')}}` : ''
}

function printNote(note: NoteNode): string {
  const usesDeadNoteShorthand = note.dead === true && note.fret === 0
  const head = usesDeadNoteShorthand ? `x.${note.string}` : `${note.fret}.${note.string}`
  return `${head}${printNoteEffects(note, { omitDeadShorthand: usesDeadNoteShorthand })}`
}

// ---------------------------------------------------------------------------
// BeatNode
// ---------------------------------------------------------------------------

function printBeatContent(beat: BeatNode): string {
  if (beat.rest) return 'r'

  if (beat.notes.length === 0) return 'r'

  if (beat.notes.length === 1) {
    return printNote(beat.notes[0])
  }

  // Chord
  const noteStrs = beat.notes.map((note) => printNote(note)).join(' ')
  return `(${noteStrs})`
}

function printBeatEffects(beat: BeatNode): string {
  const parts: string[] = []

  if (beat.vibrato === 'slight') parts.push('v')
  if (beat.vibrato === 'wide') parts.push('vw')
  if (beat.duration.dots === 1) parts.push('d')
  if (beat.duration.dots === 2) parts.push('dd')
  if (beat.duration.tuplet) {
    const { numerator, denominator } = beat.duration.tuplet
    if (denominator === 2) {
      parts.push(`tu ${numerator}`)
    } else {
      parts.push(`tu (${numerator} ${denominator})`)
    }
  }

  if (beat.fadeIn) parts.push('f')
  if (beat.fadeOut) parts.push('fo')
  if (beat.volumeSwell) parts.push('vs')
  if (beat.slap) parts.push('s')
  if (beat.pop) parts.push('p')
  if (beat.tap) parts.push('tt')
  if (beat.pickStroke === 'up') parts.push('su')
  if (beat.pickStroke === 'down') parts.push('sd')
  if (beat.crescendo) parts.push('cre')
  if (beat.decrescendo) parts.push('dec')
  if (beat.dynamics) parts.push(`dy ${beat.dynamics}`)
  if (beat.text) parts.push(`txt ${q(beat.text)}`)
  if (beat.lyrics) parts.push(`lyrics ${q(beat.lyrics)}`)
  if (beat.chord) parts.push(`ch ${q(beat.chord)}`)
  if (beat.tempoChange !== undefined) {
    if (beat.tempoLabel) {
      parts.push(`tempo (${beat.tempoChange} ${q(beat.tempoLabel)})`)
    } else {
      parts.push(`tempo ${beat.tempoChange}`)
    }
  }
  if (beat.whammy && beat.whammy.length > 0) parts.push(`tb ${printBendPoints(beat.whammy)}`)
  if (beat.whammyExact && beat.whammyExact.length > 0) parts.push(`tbe ${printBendPoints(beat.whammyExact)}`)
  if (beat.tremoloPickingDuration) parts.push(`tp ${beat.tremoloPickingDuration}`)
  if (beat.graceNote) parts.push(`gr ${beat.graceNote}`)
  if (beat.arpeggioUp) parts.push('au')
  if (beat.arpeggioDown) parts.push('ad')
  if (beat.brushUp) parts.push('bu')
  if (beat.brushDown) parts.push('bd')
  if (beat.legatoOrigin) parts.push('legatoOrigin')
  if (beat.deadSlap) parts.push('ds')
  if (beat.fermata) parts.push(`fermata (${beat.fermata.type} ${beat.fermata.length})`)
  if (beat.ottava !== undefined) parts.push(`ot ${beat.ottava}`)

  return parts.length > 0 ? ` {${parts.join(' ')}}` : ''
}

function printBeat(beat: BeatNode, prevDuration: DurationNode): [string, DurationNode] {
  const parts: string[] = []
  const newDuration = beat.duration

  // Emit duration prefix if changed
  if (newDuration.value !== prevDuration.value) {
    parts.push(`:${newDuration.value}`)
  }

  // Content
  parts.push(printBeatContent(beat))

  // Beat effects (includes dots and tuplets)
  const effects = printBeatEffects(beat)
  if (effects) {
    // Append effects to the last content part
    const last = parts.pop()!
    parts.push(last + effects)
  }

  // Repeat
  if (beat.repeat && beat.repeat > 1) {
    const last = parts.pop()!
    parts.push(`${last} * ${beat.repeat}`)
  }

  return [parts.join(' '), newDuration]
}

// ---------------------------------------------------------------------------
// VoiceNode
// ---------------------------------------------------------------------------

/**
 * Print a voice's beats. `initialPrevDuration` must reflect AlphaTex's sticky
 * duration at the start of this bar (i.e. the final duration from the previous
 * bar) so we emit `:N` prefixes only when the duration actually changes.
 * Returns the final duration so `printStaff` can thread it to the next bar.
 */
function printVoice(
  voice: VoiceNode,
  initialPrevDuration: DurationNode = { value: 4, dots: 0 },
): [string, DurationNode] {
  let prevDuration: DurationNode = initialPrevDuration
  const beatStrs: string[] = []

  for (const beat of voice.beats) {
    const [str, newDur] = printBeat(beat, prevDuration)
    beatStrs.push(str)
    prevDuration = { value: newDur.value, dots: 0 } // dots don't carry over
  }

  return [beatStrs.join(' '), prevDuration]
}

// ---------------------------------------------------------------------------
// BarNode
// ---------------------------------------------------------------------------

function printBarMeta(bar: BarNode): string {
  const parts: string[] = []

  if (bar.timeSignature) {
    const { numerator, denominator } = bar.timeSignature
    parts.push(`\\ts ${numerator} ${denominator}`)
  }
  if (bar.keySignature) {
    parts.push(`\\ks ${bar.keySignature}`)
  }
  if (bar.tempo !== undefined) {
    if (bar.tempoLabel) {
      parts.push(`\\tempo (${bar.tempo} ${q(bar.tempoLabel)})`)
    } else {
      parts.push(`\\tempo ${bar.tempo}`)
    }
  }
  if (bar.clef) parts.push(`\\clef ${bar.clef}`)
  if (bar.tripletFeel) parts.push(`\\tf ${bar.tripletFeel}`)
  if (bar.anacrusis) parts.push('\\ac')
  if (bar.freeTime) parts.push('\\ft')

  if (bar.section) {
    if (bar.sectionMarker) {
      parts.push(`\\section ${q(bar.sectionMarker)} ${q(bar.section)}`)
    } else {
      parts.push(`\\section ${q(bar.section)}`)
    }
  }

  if (bar.jump) parts.push(`\\jump ${bar.jump}`)
  if (bar.simile) parts.push(`\\simile ${bar.simile}`)

  if (bar.repeat?.start) parts.push('\\ro')

  if (bar.alternateEnding && bar.alternateEnding.length > 0) {
    parts.push(`\\ae (${bar.alternateEnding.join(' ')})`)
  }

  return parts.length > 0 ? parts.join(' ') + ' ' : ''
}

/**
 * Emit enough rest beats to exactly fill `timeSig`'s bar capacity. Prefers a
 * single dotted/simple rest (so AlphaTab renders a centered bar-rest glyph);
 * falls back to a binary decomposition for odd meters.
 *
 * Returns the beat text and the final sticky DurationNode.
 */
function emitBarRest(
  timeSig: { numerator: number; denominator: number },
  prevDuration: DurationNode,
): [string, DurationNode] {
  const capacity = barCapacityUnits(timeSig)
  const candidates: DurationNode[] = [
    { value: 1, dots: 1 },
    { value: 1, dots: 0 },
    { value: 2, dots: 1 },
    { value: 2, dots: 0 },
    { value: 4, dots: 1 },
    { value: 4, dots: 0 },
  ]
  for (const dur of candidates) {
    if (durationToUnits(dur) === capacity) {
      const parts: string[] = []
      if (dur.value !== prevDuration.value) parts.push(`:${dur.value}`)
      const dotSuffix = dur.dots === 1 ? ' {d}' : dur.dots === 2 ? ' {dd}' : ''
      parts.push('r' + dotSuffix)
      return [parts.join(' '), { value: dur.value, dots: 0 }]
    }
  }

  // Fallback for odd meters (5/4, 7/8, 9/8, …)
  const durs: Duration[] = splitIntoRests(UNITS_PER_WHOLE, capacity)
  const beatStrs: string[] = []
  let prev = prevDuration
  for (const durValue of durs) {
    const parts: string[] = []
    if (durValue !== prev.value) parts.push(`:${durValue}`)
    parts.push('r')
    beatStrs.push(parts.join(' '))
    prev = { value: durValue, dots: 0 }
  }
  return [beatStrs.join(' '), prev]
}

/**
 * Print a single voice within a bar, including meta and repeat-close suffix.
 * Used both by the single-voice fast path and the multi-voice staff emitter.
 */
function printBarVoice(
  bar: BarNode,
  voice: VoiceNode | undefined,
  prevDuration: DurationNode,
  options: {
    includeMeta: boolean
    includeRepeatClose: boolean
    timeSig: { numerator: number; denominator: number }
  },
): [string, DurationNode] {
  const meta = options.includeMeta ? printBarMeta(bar) : ''

  if (!voice || voice.beats.length === 0) {
    // Emit a bar-filling rest so AlphaTab renders a centered bar-rest glyph
    // instead of a single quarter rest at the start of the bar.
    const [restStr, endDuration] = emitBarRest(options.timeSig, prevDuration)
    let result = meta + restStr
    if (options.includeRepeatClose && bar.repeat?.end) {
      const count = bar.repeat.count ?? 2
      result += ` \\rc ${count}`
    }
    return [result, endDuration]
  }

  const [voiceStr, endDuration] = printVoice(voice, prevDuration)
  let result = meta + voiceStr

  if (options.includeRepeatClose && bar.repeat?.end) {
    const count = bar.repeat.count ?? 2
    result += ` \\rc ${count}`
  }

  return [result, endDuration]
}

function printBar(
  bar: BarNode,
  prevDuration: DurationNode = { value: 4, dots: 0 },
  timeSig: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 },
): [string, DurationNode] {
  return printBarVoice(bar, bar.voices[0], prevDuration, {
    includeMeta: true,
    includeRepeatClose: true,
    timeSig,
  })
}

// ---------------------------------------------------------------------------
// StaffNode
// ---------------------------------------------------------------------------

/**
 * Print all bars, threading the AlphaTex sticky duration across bar separators
 * so each bar emits `:N` only when the duration actually changes from the
 * previous bar's final beat. Without this, an unedited bar after an edited one
 * would inherit the wrong duration (e.g. an eighth-rest bar becoming half-length).
 */
function printStaff(staff: StaffNode): string {
  const maxVoices = staff.bars.reduce((m, b) => Math.max(m, b.voices.length), 1)

  // Pre-compute effective time signature per bar by walking forward, inheriting
  // the latest explicit `timeSignature` from earlier bars. Needed so bars
  // without an explicit TS still emit correct bar-filling rests for empty voices.
  const effectiveTimeSigs: { numerator: number; denominator: number }[] = []
  let currentTs: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 }
  for (const bar of staff.bars) {
    if (bar.timeSignature) currentTs = bar.timeSignature
    effectiveTimeSigs.push(currentTs)
  }

  // Fast path: all bars are single-voice — emit the flat form, no \voice tags.
  if (maxVoices <= 1) {
    const barStrs: string[] = []
    let prevDuration: DurationNode = { value: 4, dots: 0 }
    for (let i = 0; i < staff.bars.length; i++) {
      const bar = staff.bars[i]
      const [barStr, endDuration] = printBar(bar, prevDuration, effectiveTimeSigs[i])
      barStrs.push(barStr)
      prevDuration = endDuration
    }
    return barStrs.join(' | ')
  }

  // Multi-voice: emit one `\voice` block per voice index, with all bars for
  // that voice separated by `|`. Bar meta (ts, ks, tempo, section, etc.) is
  // only written on voice 0 to avoid duplicated attributes. Repeat-close is
  // likewise written only on voice 0.
  //
  // AlphaTab threads the sticky `:N` duration ACROSS `\voice` blocks within
  // a staff — it does NOT reset per-block. So we thread `globalPrevDuration`
  // from each voice's final state into the next voice's initial state, which
  // causes `printBeat` to correctly emit an explicit duration prefix on the
  // next voice's first beat whenever that beat's duration differs from the
  // previous voice's final sticky value (e.g. V1 ending with a whole rest
  // and V2 starting with a quarter note must emit `:4`).
  const blocks: string[] = []
  let globalPrevDuration: DurationNode = { value: 4, dots: 0 }
  for (let vi = 0; vi < maxVoices; vi++) {
    const barStrs: string[] = []
    let prevDuration: DurationNode = globalPrevDuration
    for (let i = 0; i < staff.bars.length; i++) {
      const bar = staff.bars[i]
      const voice = bar.voices[vi]
      const [barStr, endDuration] = printBarVoice(bar, voice, prevDuration, {
        includeMeta: vi === 0,
        includeRepeatClose: vi === 0,
        timeSig: effectiveTimeSigs[i],
      })
      barStrs.push(barStr)
      prevDuration = endDuration
    }
    blocks.push(`\\voice\n${barStrs.join(' | ')}`)
    globalPrevDuration = prevDuration
  }
  return blocks.join('\n')
}

// ---------------------------------------------------------------------------
// TrackNode
// ---------------------------------------------------------------------------

function printTrackMeta(track: TrackNode): string {
  const lines: string[] = []

  // Tuning — must be wrapped in parentheses to avoid alphaTab parsing
  // subsequent tokens (like rests `r`) as extra tuning values (AT301 warning).
  if (track.tuning.length > 0) {
    const noteNames = track.tuning.map(midiToNoteName).join(' ')
    lines.push(`\\tuning (${noteNames})`)
  }

  // Capo
  if (track.capo > 0) {
    lines.push(`\\capo ${track.capo}`)
  }

  // Chord definitions
  for (const chord of track.chordDefs) {
    lines.push(printChordDef(chord))
  }

  // Transpose
  if (track.displayTranspose !== undefined) lines.push(`\\displayTranspose ${track.displayTranspose}`)
  if (track.transpose !== undefined) lines.push(`\\transpose ${track.transpose}`)

  return lines.length > 0 ? lines.join('\n') + '\n' : ''
}

function printChordDef(chord: ChordDefNode): string {
  const strNums = chord.strings.join(' ')
  return `\\chord ${q(chord.name)} (${strNums})`
}

function printTrackHeader(track: TrackNode): string {
  const parts: string[] = [`\\track ${q(track.name)}`]
  if (track.shortName) parts[0] += ` ${q(track.shortName)}`

  const props: string[] = []
  if (track.color) props.push(`color ${q(track.color)}`)
  if (track.solo) props.push('solo')
  if (track.mute) props.push('mute')
  if (track.volume !== undefined) props.push(`volume ${track.volume}`)
  if (track.balance !== undefined) props.push(`balance ${track.balance}`)
  if (track.instrument !== 25) props.push(`instrument ${track.instrument}`)

  if (props.length > 0) {
    parts[0] += ` {${props.join(' ')}}`
  }

  return parts[0]
}

function printTrack(track: TrackNode, isFirst: boolean): string {
  const lines: string[] = []

  if (!isFirst || track.name !== 'Track 1' || track.shortName || track.color) {
    lines.push(printTrackHeader(track))
  }

  lines.push(printTrackMeta(track))

  for (const staff of track.staves) {
    lines.push(printStaff(staff))
  }

  return lines.filter(l => l.trim()).join('\n')
}

// ---------------------------------------------------------------------------
// MIDI pitch → note name
// ---------------------------------------------------------------------------

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const name = PITCH_NAMES[midi % 12]
  return `${name}${octave}`
}

// ---------------------------------------------------------------------------
// ScoreNode → alphaTex string
// ---------------------------------------------------------------------------

export function print(score: ScoreNode): string {
  const parts: string[] = []

  // Metadata section
  const metaStr = printMeta(score.meta)
  if (metaStr) parts.push(metaStr)

  // Separator
  parts.push('.')

  // Tracks
  for (let i = 0; i < score.tracks.length; i++) {
    parts.push(printTrack(score.tracks[i], i === 0))
  }

  return parts.filter(p => p.trim()).join('\n') + '\n'
}
