/**
 * AlphaTex AST — TypeScript type definitions.
 *
 * Every node has a stable `id: string` generated via nanoid.
 * No `any` — strict TypeScript throughout.
 *
 * Source: https://alphatab.net/docs/alphatex/ (v1.8.1)
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Whole=1, Half=2, Quarter=4, Eighth=8, Sixteenth=16, 32nd=32, 64th=64 */
export type Duration = 1 | 2 | 4 | 8 | 16 | 32 | 64

/** Dynamic marking values */
export type DynamicsValue = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff'

/** Slide types matching alphaTex note keywords */
export type SlideType =
  | 'legato'       // sl
  | 'shift'        // ss
  | 'intoFromBelow' // sib
  | 'intoFromAbove' // sia
  | 'outUp'        // sou
  | 'outDown'      // sod
  | 'pickSlideUp'  // psu
  | 'pickSlideDown' // psd

/** Harmonic types */
export type HarmonicType =
  | 'natural'      // nh
  | 'artificial'   // ah <fret>
  | 'tap'          // th <fret>
  | 'pinch'        // ph
  | 'semi'         // sh
  | 'feedback'     // fh

/** Accent types */
export type AccentType = 'normal' | 'heavy' | 'tenuto'

/** Stroke / pick stroke direction */
export type StrokeType = 'up' | 'down'

/** Vibrato intensity */
export type VibratoType = 'slight' | 'wide'

/** Ornament types */
export type OrnamentType = 'turn' | 'iturn' | 'umordent' | 'lmordent'

/** Clef types */
export type ClefType = 'G2' | 'F4' | 'C3' | 'C4' | 'treble' | 'bass' | 'neutral' | 'piano'

/** Triplet feel */
export type TripletFeel =
  | 'none'
  | 'triplet16th'
  | 'triplet8th'
  | 'dotted16th'
  | 'dotted8th'
  | 'scottish16th'
  | 'scottish8th'

/** Jump/navigation markers */
export type JumpType = 'Fine' | 'Segno' | 'Coda' | 'DaCapo' | 'DaCapoAlFine' | 'DaCapoAlCoda' | 'DalSegno' | 'DalSegnoAlFine' | 'DalSegnoAlCoda' | 'DoubleCoda' | 'DoubleSegno'

/** Simile type */
export type SimileType = 'simple' | 'firstOfDouble' | 'secondOfDouble'

/** Grace note type */
export type GraceType = 'before' | 'beat' | 'bendGrace'

// ---------------------------------------------------------------------------
// Structural helpers
// ---------------------------------------------------------------------------

/**
 * A bend/whammy-bar control point.
 * position: 0–60 (timeline, 30 = middle of note)
 * value: 0–12 (quarter-tones; 4 = 1 semitone, 8 = 1 whole tone)
 */
export interface BendPoint {
  position: number
  value: number
}

/** Trill effect on a note */
export interface TrillNode {
  fret: number
  duration: Duration
}

/** Chord diagram definition (from \chord staff metadata) */
export interface ChordDefNode {
  id: string
  name: string
  /** Fret positions per string, -1 = muted */
  strings: number[]
  firstFret?: number
  barre?: number
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

export interface DurationNode {
  value: Duration
  /** Number of augmentation dots (0, 1, or 2) */
  dots: 0 | 1 | 2
  /** Tuplet, e.g. triplet = {numerator:3, denominator:2} */
  tuplet?: { numerator: number; denominator: number }
}

// ---------------------------------------------------------------------------
// Note
// ---------------------------------------------------------------------------

export interface NoteNode {
  id: string
  /** 1-indexed string number (1 = lowest/thickest string) */
  string: number
  /** Fret number 0..24+ */
  fret: number

  // --- Connectivity ---
  tie?: boolean          // t or - : tied to previous note
  hammerOrPull?: boolean // h : hammer-on or pull-off (context determines which)
  leftHandTap?: boolean  // lht

  // --- Slides (at most one) ---
  slide?: SlideType

  // --- Bends ---
  bend?: BendPoint[]    // b (values)  — auto-spread
  bendExact?: BendPoint[] // be (valueAndOffset) — exact placement

  // --- Harmonics ---
  harmonic?: HarmonicType
  /** Harmonic fret (for artificial/tap harmonics) */
  harmonicFret?: number

  // --- Vibrato (note-level) ---
  vibrato?: VibratoType // v = slight, vw = wide

  // --- Articulation / notation ---
  ghost?: boolean       // g
  dead?: boolean        // x
  palmMute?: boolean    // pm
  letRing?: boolean     // lr
  staccato?: boolean    // st
  accent?: AccentType   // ac = normal, hac = heavy, ten = tenuto
  hidden?: boolean      // hide

  // --- Ornaments ---
  ornament?: OrnamentType

  // --- Trill ---
  trill?: TrillNode     // tr <fret> <duration>

  // --- Fingering ---
  leftFinger?: number   // lf <finger>
  rightFinger?: number  // rf <finger>

  // --- Slur ---
  slur?: number         // slur <id>

  /** Non-fatal parse errors accumulated on this node */
  _parseErrors?: string[]
}

// ---------------------------------------------------------------------------
// Beat
// ---------------------------------------------------------------------------

export interface BeatNode {
  id: string
  duration: DurationNode
  notes: NoteNode[]

  /** True if this beat is a rest */
  rest?: boolean

  // --- Beat-level vibrato ---
  vibrato?: VibratoType

  // --- Pick / stroke ---
  pickStroke?: StrokeType  // su = up, sd = down

  // --- Dynamics ---
  dynamics?: DynamicsValue

  // --- Fade effects ---
  fadeIn?: boolean   // f
  fadeOut?: boolean  // fo
  volumeSwell?: boolean // vs

  // --- Bass techniques ---
  slap?: boolean  // s
  pop?: boolean   // p
  tap?: boolean   // tt

  // --- Crescendo ---
  crescendo?: boolean   // cre
  decrescendo?: boolean // dec

  // --- Whammy bar ---
  whammy?: BendPoint[]      // tb (auto-spread)
  whammyExact?: BendPoint[] // tbe (exact)

  // --- Tremolo picking ---
  tremoloPickingDuration?: Duration // tp <duration>

  // --- Annotations ---
  text?: string  // txt "..."
  lyrics?: string // lyrics "..."
  chord?: string  // ch "name" — chord annotation name

  // --- Tempo change on this beat ---
  tempoChange?: number
  tempoLabel?: string

  // --- Grace note ---
  graceNote?: GraceType

  // --- Arpeggio / brush ---
  arpeggioUp?: boolean   // au
  arpeggioDown?: boolean // ad
  brushUp?: boolean      // bu
  brushDown?: boolean    // bd

  // --- Legato ---
  legatoOrigin?: boolean // legatoOrigin

  // --- Dead slap ---
  deadSlap?: boolean  // ds

  // --- Fermata ---
  fermata?: { type: 'short' | 'medium' | 'long'; length: number }

  // --- Ottava ---
  ottava?: number  // ot <value>

  /** How many times this beat is repeated (beat multiplier: `* N`) */
  repeat?: number

  /** Non-fatal parse errors accumulated on this beat */
  _parseErrors?: string[]
}

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

export interface VoiceNode {
  id: string
  beats: BeatNode[]
}

// ---------------------------------------------------------------------------
// Bar
// ---------------------------------------------------------------------------

export interface RepeatMarker {
  start?: boolean  // \ro
  end?: boolean    // \rc
  count?: number   // \rc <count>
}

export interface BarNode {
  id: string
  voices: VoiceNode[]

  // --- Structural overrides ---
  timeSignature?: { numerator: number; denominator: number }
  keySignature?: string   // e.g. "F#", "Bb", "Aminor", "C"
  tempo?: number
  tempoLabel?: string
  clef?: ClefType
  tripletFeel?: TripletFeel

  // --- Section / navigation ---
  section?: string        // \section "text"
  sectionMarker?: string  // \section "marker" "text" → the marker symbol
  jump?: JumpType         // \jump DaCapo etc.
  simile?: SimileType

  // --- Repeat ---
  repeat?: RepeatMarker

  // --- Alternate ending ---
  alternateEnding?: number[] // \ae (1 2 3)

  // --- Special bars ---
  anacrusis?: boolean   // \ac
  freeTime?: boolean    // \ft

  /** Non-fatal parse errors accumulated on this bar */
  _parseErrors?: string[]
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export interface StaffNode {
  id: string
  showScore?: boolean  // { score }
  showTabs?: boolean   // { tabs }
  showSlash?: boolean  // { slash }
  showNumbered?: boolean // { numbered }
  bars: BarNode[]
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

export interface TrackNode {
  id: string
  name: string
  shortName?: string
  color?: string          // "#RRGGBB"
  solo?: boolean
  mute?: boolean
  volume?: number         // 0-16
  balance?: number        // 0-16 (8 = center)

  /** MIDI program number 0-127 */
  instrument: number

  /** MIDI pitches for each string, low-to-high, e.g. [40,45,50,55,59,64] = standard E */
  tuning: number[]

  /** Capo fret (0 = none) */
  capo: number

  /** Semitones of display-only transposition */
  displayTranspose?: number

  /** Semitones of full transposition */
  transpose?: number

  /** Chord diagram definitions for this track */
  chordDefs: ChordDefNode[]

  staves: StaffNode[]
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export interface MetaNode {
  title?: string
  subtitle?: string
  artist?: string
  album?: string
  words?: string
  music?: string
  copyright?: string
  tab?: string

  /** Global tempo in BPM (default 120) */
  tempo: number
  tempoLabel?: string
}

// ---------------------------------------------------------------------------
// Score (root node)
// ---------------------------------------------------------------------------

export interface ScoreNode {
  id: string
  meta: MetaNode
  tracks: TrackNode[]
}

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

export interface ParseError {
  message: string
  line: number
  col: number
}

export interface ParseResult {
  score: ScoreNode
  errors: ParseError[]
}
