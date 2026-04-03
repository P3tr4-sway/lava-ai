export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = '#' | 'b' | 'n' | ''
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'
export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
export type PlacementConfidence = 'explicit' | 'derived' | 'low'
export type RenderLayoutMode = 'systems'
export type TechniqueSlide = 'up' | 'down' | 'shift'
export type BarlineType = 'single' | 'double' | 'final' | 'dashed' | 'dotted'
export type RepeatMarker = 'dc-al-fine' | 'ds-al-coda' | 'segno' | 'fine' | 'coda'
export type Dynamic = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff'

export interface TimeSignature {
  numerator: number
  denominator: number
}

export interface KeySignature {
  key: string
  mode: 'major' | 'minor'
}

export interface Note {
  id: string
  pitch: NoteName
  octave: number
  accidental: Accidental
  duration: NoteValue
  dots: number
  startBeat: number
  tied?: boolean
}

export interface Measure {
  id: string
  index: number
  timeSignature?: TimeSignature
  keySignature?: KeySignature
  notes: Note[]
  tempo?: number
}

export interface Part {
  id: string
  name: string
  instrument: string
  clef: Clef
  measures: Measure[]
}

export interface Score {
  id: string
  title: string
  composer?: string
  tempo: number
  timeSignature: TimeSignature
  keySignature: KeySignature
  parts: Part[]
  createdAt: number
}

export interface GuitarPlacement {
  string: number
  fret: number
  confidence: PlacementConfidence
}

// --- Technique discriminated union (replaces TechniqueSet) ---

export type Technique =
  | { type: 'bend'; style: 'full' | 'half' | 'pre-bend' | 'bend-release'; semitones: number }
  | { type: 'slide'; style: 'shift' | 'legato' | 'in-above' | 'in-below' | 'out-up' | 'out-down' }
  | { type: 'hammerOn' }
  | { type: 'pullOff' }
  | { type: 'tap' }
  | { type: 'tremoloPicking'; speed: 'eighth' | 'sixteenth' | 'thirtySecond' }
  | { type: 'tremoloBar'; semitones: number }
  | { type: 'letRing' }
  | { type: 'ghostNote' }
  | { type: 'deadNote' }
  | { type: 'palmMute' }
  | { type: 'harmonic'; style: 'natural' | 'pinch' | 'tap' | 'artificial' }
  | { type: 'vibrato'; style: 'normal' | 'wide' }
  | { type: 'pickStroke'; direction: 'up' | 'down' }
  | { type: 'arpeggio'; direction: 'up' | 'down' }
  | { type: 'accent'; style: 'normal' | 'heavy' }
  | { type: 'staccato' }
  | { type: 'tenuto' }
  | { type: 'fadeIn' }

/** @deprecated Use Technique[] instead */
export interface TechniqueSet {
  bend?: boolean
  slide?: boolean
  hammerOn?: boolean
  pullOff?: boolean
  palmMute?: boolean
  harmonic?: boolean
  vibrato?: boolean
  accent?: boolean
  staccato?: boolean
  tenuto?: boolean
}

export interface ScorePitch {
  step: NoteName
  octave: number
  alter?: number
}

export interface ScoreHarmony {
  id: string
  beat: number
  symbol: string
}

export interface ScoreNoteEvent {
  id: string
  measureIndex: number
  voice: number
  beat: number
  durationDivisions: number
  durationType: NoteValue
  dots: number
  isRest: boolean
  pitch: ScorePitch | null
  placement: GuitarPlacement | null
  techniques: Technique[]
  tuplet?: { actual: number; normal: number }
  lyric?: string
  tieStart?: boolean
  tieStop?: boolean
  slurStart?: boolean
  dynamic?: Dynamic
  displayHints?: {
    staffVisible?: boolean
    tabVisible?: boolean
    stemDirection?: 'up' | 'down'
  }
}

export interface ScoreClipboard {
  notes: ScoreNoteEvent[]
  measures: ScoreMeasureMeta[]
  sourceMeasureCount: number
}

export interface ScoreMeasureMeta {
  id: string
  index: number
  timeSignature?: TimeSignature
  keySignature?: KeySignature
  tempo?: number
  harmony: ScoreHarmony[]
  annotations: string[]
  sectionLabel?: string
  chordDiagramPlacement?: 'hidden' | 'top' | 'bottom' | 'both'
  barlineType?: BarlineType
  isRepeatStart?: boolean
  isRepeatEnd?: boolean
  repeatMarker?: RepeatMarker
}

export interface ScoreTrack {
  id: string
  name: string
  instrument: string
  clef: Clef
  tuning: number[]
  capo: number
  notes: ScoreNoteEvent[]
}

export interface ScoreDocument {
  id: string
  title: string
  composer?: string
  tempo: number
  meter: TimeSignature
  keySignature: KeySignature
  divisions: number
  layoutMode: RenderLayoutMode
  measures: ScoreMeasureMeta[]
  tracks: ScoreTrack[]
  sourceXml?: string | null
  lastExportedXml?: string | null
}

export type ScoreSnapshot = ScoreDocument

export interface EditorCursor {
  trackId: string
  noteId: string | null
  measureIndex: number
  beat?: number
  string?: number
}

export interface EditorSelection {
  measureRange: [number, number] | null
  noteIds: string[]
  cursor: EditorCursor | null
}

export type ScoreCommand =
  | { type: 'insertNote'; trackId: string; measureIndex: number; beat: number; note?: Partial<ScoreNoteEvent> }
  | { type: 'insertNoteAtCaret'; trackId: string; measureIndex: number; beat: number; string: number; fret: number; durationType?: NoteValue }
  | { type: 'insertRestAtCaret'; trackId: string; measureIndex: number; beat: number; durationType?: NoteValue }
  | { type: 'deleteNote'; trackId: string; noteId: string }
  | { type: 'moveCursor'; direction: 'left' | 'right' | 'up' | 'down'; extend?: boolean }
  | { type: 'moveNoteToBeat'; trackId: string; noteId: string; measureIndex: number; beat: number; string?: number }
  | { type: 'setDuration'; trackId: string; noteId: string; durationType: NoteValue; durationDivisions: number }
  | { type: 'setPitch'; trackId: string; noteId: string; pitch: ScorePitch | null }
  | { type: 'setStringFret'; trackId: string; noteId: string; string: number; fret: number }
  | { type: 'splitNote'; trackId: string; noteId: string; leftDurationDivisions: number }
  | { type: 'mergeWithNext'; trackId: string; noteId: string }
  | { type: 'toggleRest'; trackId: string; noteId: string }
  | { type: 'toggleTie'; trackId: string; noteId: string }
  | { type: 'transposeSelection'; trackId: string; noteIds?: string[]; measureRange?: [number, number] | null; semitones: number }
  | { type: 'setTuning'; trackId: string; tuning: number[] }
  | { type: 'setCapo'; trackId: string; capo: number }
  | { type: 'setMeasureRange'; start: number; end: number }
  | { type: 'selectNotes'; noteIds: string[]; additive?: boolean }
  | { type: 'setChordSymbol'; measureIndex: number; beat: number; symbol: string }
  | { type: 'setAnnotation'; measureIndex: number; text: string }
  | { type: 'setSectionLabel'; startMeasureIndex: number; endMeasureIndex: number; label: string }
  | { type: 'setChordDiagramPlacement'; measureIndex: number; placement: 'hidden' | 'top' | 'bottom' | 'both' }
  | { type: 'deleteMeasureRange'; start: number; end: number }
  | { type: 'addMeasureBefore'; beforeIndex: number; count: number }
  | { type: 'addMeasureAfter'; afterIndex: number; count: number }
  | { type: 'changeTuning'; trackId: string; tuning: number[] }
  | { type: 'simplifyFingering'; trackId: string; measureRange?: [number, number] | null }
  | { type: 'reharmonizeSelection'; measureRange?: [number, number] | null; chords: Array<{ beat: number; symbol: string }> }
  | { type: 'addTechnique'; noteId: string; technique: Technique }
  | { type: 'removeTechnique'; noteId: string; techniqueType: Technique['type'] }
  | { type: 'toggleSlur'; trackId: string; noteId: string }
  | { type: 'setKeySignature'; key: string; mode: 'major' | 'minor' }
  | { type: 'setTimeSignature'; numerator: number; denominator: number }
  | { type: 'setTempo'; bpm: number }
  | { type: 'setTrackClef'; trackId: string; clef: Clef }
  | { type: 'setBarlineType'; measureIndex: number; barlineType: BarlineType | null }
  | { type: 'setRepeat'; measureIndex: number; repeatType: 'start' | 'end'; enabled: boolean }
  | { type: 'setRepeatMarker'; measureIndex: number; marker: RepeatMarker | null }
  | { type: 'setNoteDynamic'; trackId: string; noteId: string; dynamic: Dynamic | null }
  | { type: 'toggleDot'; noteId: string }
  | { type: 'toggleTuplet'; noteId: string; actual: number; normal: number }
  | { type: 'setLyric'; noteId: string; text: string }
  | { type: 'pasteSelection'; targetTrackId: string; targetMeasureIndex: number; targetBeat: number; clipboard: ScoreClipboard }
  | { type: 'setMeasureTimeSignature'; measureIndex: number; timeSignature: TimeSignature }
  | { type: 'setMeasureKeySignature'; measureIndex: number; keySignature: KeySignature }

export interface CommandResult {
  document: ScoreDocument
  warnings: string[]
}

export interface PlacementPolicy {
  preferMinimalMovement: boolean
  preferStringContinuity: boolean
  maxFret: number
}

export interface ScoreCommandPatch {
  commands: ScoreCommand[]
  warnings?: string[]
}

export type ScorePatchOp =
  | 'setNotePitch'
  | 'setNoteDuration'
  | 'setChord'
  | 'setKeySig'
  | 'setTimeSig'
  | 'addBars'
  | 'deleteBars'
  | 'transposeBars'
  | 'addAccidental'
  | 'toggleRest'
  | 'toggleTie'
  | 'setAnnotation'
  | 'setLyric'

export interface ScorePatch {
  op: ScorePatchOp
  [key: string]: unknown
}

export type LeadSheetSectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom'

export interface LeadSheetMeasure {
  id: string
  chords: string[]
  barline?: 'single' | 'double' | 'repeat-start' | 'repeat-end'
}

export interface LeadSheetSection {
  id: string
  label: string
  type: LeadSheetSectionType
  measures: LeadSheetMeasure[]
}

export type ArrangementId =
  | 'original'
  | 'simplified'
  | 'sing_play'
  | 'solo_focus'
  | 'low_position'
  | 'capo'

export type ArrangementDifficulty = 'Easy' | 'Medium' | 'Hard'

export interface PlayableArrangement {
  id: ArrangementId
  label: string
  subtitle: string
  difficulty: ArrangementDifficulty
  bestFor: string
  concertKey: string
  displayKey: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  capoFret?: number
  fretRange?: string
  changeSummary: string[]
  focusBars?: string[]
  recommended?: boolean
  recommendedReason?: string
  format: 'lead_sheet'
  scoreSnapshot?: ScoreSnapshot
}

export interface AnalysisScore {
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  duration: number
  title?: string
  videoId?: string
  arrangements?: PlayableArrangement[]
  defaultArrangementId?: ArrangementId
}

export const ARRANGEMENT_ORDER: ArrangementId[] = [
  'original',
  'simplified',
  'sing_play',
  'solo_focus',
  'low_position',
  'capo',
]

export const ARRANGEMENT_COPY: Record<
ArrangementId,
{
  label: string
  subtitle: string
  difficulty: ArrangementDifficulty
  bestFor: string
}
> = {
  original: {
    label: 'Original',
    subtitle: 'Closest to the song.',
    difficulty: 'Hard',
    bestFor: 'Full song',
  },
  simplified: {
    label: 'Simplified',
    subtitle: 'Fewer hard changes.',
    difficulty: 'Easy',
    bestFor: 'Easy start',
  },
  sing_play: {
    label: 'Sing & Play',
    subtitle: 'Built for vocals and rhythm.',
    difficulty: 'Easy',
    bestFor: 'Vocals',
  },
  solo_focus: {
    label: 'Solo Focus',
    subtitle: 'Main hooks first.',
    difficulty: 'Medium',
    bestFor: 'Hooks',
  },
  low_position: {
    label: 'Low Position',
    subtitle: 'Lower frets only.',
    difficulty: 'Medium',
    bestFor: 'Lower frets',
  },
  capo: {
    label: 'Capo',
    subtitle: 'Easier shapes, same feel.',
    difficulty: 'Easy',
    bestFor: 'Easy shapes',
  },
}
