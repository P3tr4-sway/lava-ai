/**
 * AlphaTex recursive-descent parser.
 *
 * Two-phase: Lexer (tokenize) → Parser (reduce token stream to AST).
 * All node IDs generated with nanoid().
 * Error recovery: invalid syntax emits a ParseError in the result and
 * continues — the parser never throws.
 *
 * Source: https://alphatab.net/docs/alphatex/ (v1.8.1)
 */

import { nanoid } from 'nanoid'
import type {
  AccentType,
  BarNode,
  BeatNode,
  BendPoint,
  ChordDefNode,
  ClefType,
  Duration,
  DurationNode,
  DynamicsValue,
  GraceType,
  HarmonicType,
  JumpType,
  MetaNode,
  NoteNode,
  OrnamentType,
  ParseError,
  ParseResult,
  RepeatMarker,
  ScoreNode,
  SimileType,
  SlideType,
  StaffNode,
  TrackNode,
  TripletFeel,
  VibratoType,
  VoiceNode,
} from './types'

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

export enum TT {
  EOF,
  Backslash,   // \
  Dot,         // .
  Pipe,        // |
  Colon,       // :
  LParen,      // (
  RParen,      // )
  LBrace,      // {
  RBrace,      // }
  Star,        // *
  Minus,       // -
  NumberInt,   // [0-9]+
  NumberFloat, // reserved but never emitted — alphaTex uses separate int+dot tokens
  String,      // "..." or '...'
  Ident,       // [a-zA-Z_][a-zA-Z0-9_#]*
  Hash,        // #
  NewLine,
}

export interface Token {
  type: TT
  value: string
  line: number
  col: number
}

export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1

  function peek(offset = 0): string {
    return src[i + offset] ?? ''
  }

  function advance(): string {
    const ch = src[i++]
    if (ch === '\n') { line++; col = 1 } else { col++ }
    return ch
  }

  function addToken(type: TT, value: string, l: number, c: number): void {
    tokens.push({ type, value, line: l, col: c })
  }

  while (i < src.length) {
    const l = line; const c = col
    const ch = peek()

    // Skip whitespace (not newlines)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance(); continue
    }

    // Newlines
    if (ch === '\n') {
      advance()
      addToken(TT.NewLine, '\n', l, c)
      continue
    }

    // Single-line comment
    if (ch === '/' && peek(1) === '/') {
      while (i < src.length && peek() !== '\n') advance()
      continue
    }

    // Multi-line comment
    if (ch === '/' && peek(1) === '*') {
      advance(); advance()
      while (i < src.length && !(peek() === '*' && peek(1) === '/')) advance()
      if (i < src.length) { advance(); advance() }
      continue
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch
      advance()
      let str = ''
      while (i < src.length && peek() !== quote) {
        if (peek() === '\\') {
          advance()
          const esc = advance()
          switch (esc) {
            case 'n': str += '\n'; break
            case 'r': str += '\r'; break
            case 't': str += '\t'; break
            case '"': str += '"'; break
            case "'": str += "'"; break
            case '\\': str += '\\'; break
            default: str += '\\' + esc
          }
        } else {
          str += advance()
        }
      }
      if (i < src.length) advance() // closing quote
      addToken(TT.String, str, l, c)
      continue
    }

    // Backslash
    if (ch === '\\') {
      advance()
      addToken(TT.Backslash, '\\', l, c)
      continue
    }

    // Pipe
    if (ch === '|') {
      advance()
      addToken(TT.Pipe, '|', l, c)
      continue
    }

    // Dot — only raw dot (not inside number)
    if (ch === '.') {
      advance()
      addToken(TT.Dot, '.', l, c)
      continue
    }

    // Colon
    if (ch === ':') {
      advance()
      addToken(TT.Colon, ':', l, c)
      continue
    }

    // Parens / braces
    if (ch === '(') { advance(); addToken(TT.LParen, '(', l, c); continue }
    if (ch === ')') { advance(); addToken(TT.RParen, ')', l, c); continue }
    if (ch === '{') { advance(); addToken(TT.LBrace, '{', l, c); continue }
    if (ch === '}') { advance(); addToken(TT.RBrace, '}', l, c); continue }
    if (ch === '*') { advance(); addToken(TT.Star, '*', l, c); continue }
    if (ch === '-') { advance(); addToken(TT.Minus, '-', l, c); continue }
    if (ch === '#') { advance(); addToken(TT.Hash, '#', l, c); continue }

    // Numbers  — always emit as integers; dots are always separate tokens in alphaTex.
    // alphaTex uses N.N as fret.string notation, never as a float literal.
    // Actual decimal parameters (e.g. tempo) appear as separate tokens too.
    if (ch >= '0' && ch <= '9') {
      let num = ''
      while (i < src.length && peek() >= '0' && peek() <= '9') num += advance()
      addToken(TT.NumberInt, num, l, c)
      continue
    }

    // Identifiers / keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = ''
      while (
        i < src.length &&
        ((peek() >= 'a' && peek() <= 'z') ||
          (peek() >= 'A' && peek() <= 'Z') ||
          (peek() >= '0' && peek() <= '9') ||
          peek() === '_')
      ) {
        ident += advance()
      }
      addToken(TT.Ident, ident, l, c)
      continue
    }

    // Unknown — skip
    advance()
  }

  addToken(TT.EOF, '', line, col)
  return tokens
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

// MIDI note name → pitch number (octave 4 reference)
const NOTE_NAMES: Record<string, number> = {
  C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71,
  c: 60, d: 62, e: 64, f: 65, g: 67, a: 69, b: 71,
}

const STANDARD_GUITAR_TUNING = [40, 45, 50, 55, 59, 64] // E2 A2 D3 G3 B3 E4

const VALID_DURATIONS = new Set<number>([1, 2, 4, 8, 16, 32, 64])

function isDuration(n: number): n is Duration {
  return VALID_DURATIONS.has(n)
}

const DYNAMICS_SET = new Set<string>(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'])
function isDynamic(s: string): s is DynamicsValue {
  return DYNAMICS_SET.has(s)
}

function defaultDuration(): DurationNode {
  return { value: 4, dots: 0 }
}

export class Parser {
  private tokens: Token[]
  private pos = 0
  private errors: ParseError[] = []

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  // --- Token helpers ---

  private peek(offset = 0): Token {
    const idx = this.pos + offset
    return this.tokens[idx] ?? this.tokens[this.tokens.length - 1]
  }

  private advance(): Token {
    const t = this.tokens[this.pos]
    if (this.pos < this.tokens.length - 1) this.pos++
    return t
  }

  private check(type: TT, value?: string): boolean {
    const t = this.peek()
    if (t.type !== type) return false
    if (value !== undefined && t.value !== value) return false
    return true
  }

  private match(type: TT, value?: string): Token | null {
    if (this.check(type, value)) return this.advance()
    return null
  }

  private skipNewlines(): void {
    while (this.check(TT.NewLine)) this.advance()
  }

  private error(msg: string): void {
    const t = this.peek()
    this.errors.push({ message: msg, line: t.line, col: t.col })
  }

  // Check if upcoming token could be a valid fret number (not a metadata tag)
  private isNoteStart(): boolean {
    // Could be: <number> . <number>  OR  r  OR  ( OR  x  OR  -
    const t = this.peek()
    if (t.type === TT.NumberInt) return true
    if (t.type === TT.LParen) return true
    if (t.type === TT.Ident && (t.value === 'r' || t.value === 'x')) return true
    if (t.type === TT.Minus) return true // tie shorthand
    return false
  }

  // ---------------------------------------------------------------------------
  // Parse entry
  // ---------------------------------------------------------------------------

  parse(): ParseResult {
    this.skipNewlines()
    const meta = this.parseMeta()
    const tracks = this.parseTracks(meta)

    const score: ScoreNode = {
      id: nanoid(),
      meta,
      tracks,
    }

    return { score, errors: this.errors }
  }

  // ---------------------------------------------------------------------------
  // Meta section  (\title "X" \artist "Y" ... .)
  // ---------------------------------------------------------------------------

  private parseMeta(): MetaNode {
    const meta: MetaNode = { tempo: 120 }

    // Parse metadata lines until we hit '.' (score separator) or track content
    while (!this.check(TT.EOF)) {
      this.skipNewlines()

      // Standalone '.' marks end of metadata section
      if (this.check(TT.Dot)) {
        this.advance()
        break
      }

      // \tag value
      if (this.check(TT.Backslash)) {
        const saved = this.pos
        this.advance() // consume backslash
        const tag = this.match(TT.Ident)
        if (!tag) { this.pos = saved; break }

        switch (tag.value.toLowerCase()) {
          case 'title': meta.title = this.parseStringArg(); break
          case 'subtitle': meta.subtitle = this.parseStringArg(); break
          case 'artist': meta.artist = this.parseStringArg(); break
          case 'album': meta.album = this.parseStringArg(); break
          case 'words': meta.words = this.parseStringArg(); break
          case 'music': meta.music = this.parseStringArg(); break
          case 'copyright': meta.copyright = this.parseStringArg(); break
          case 'tab': meta.tab = this.parseStringArg(); break
          case 'tempo': {
            const bpm = this.parseNumberArg()
            if (bpm !== null) meta.tempo = bpm
            // optional label
            if (this.check(TT.String)) meta.tempoLabel = this.advance().value
            break
          }
          case 'track':
          case 'staff':
          case 'voice':
            // Reached structural section — push back and stop meta parsing
            this.pos = saved
            return meta
          default:
            // Unknown meta tag — skip to end of line
            this.skipToEndOfLine()
        }
      } else if (this.isNoteStart() || this.check(TT.Colon)) {
        // We've hit beat content without a '.' separator (v1.7+ allows this)
        break
      } else {
        // Skip unexpected tokens in metadata section
        this.advance()
      }
    }

    return meta
  }

  // ---------------------------------------------------------------------------
  // Track parsing
  // ---------------------------------------------------------------------------

  private parseTracks(meta: MetaNode): TrackNode[] {
    const tracks: TrackNode[] = []

    this.skipNewlines()

    // If there is no \track tag, create a default track
    if (!this.check(TT.Backslash) || !this.isTagAhead('track')) {
      if (!this.check(TT.EOF)) {
        const track = this.parseTrackContent(meta, 'Track 1')
        tracks.push(track)
      }
    }

    while (!this.check(TT.EOF)) {
      this.skipNewlines()
      if (this.check(TT.EOF)) break

      if (this.check(TT.Backslash) && this.isTagAhead('track')) {
        this.advance() // backslash
        this.advance() // 'track'
        const track = this.parseTrack(meta)
        tracks.push(track)
      } else {
        break
      }
    }

    return tracks
  }

  private isTagAhead(name: string, offset = 1): boolean {
    const t = this.peek(offset)
    return t.type === TT.Ident && t.value.toLowerCase() === name
  }

  private parseTrack(meta: MetaNode): TrackNode {
    // Optional name / shortName
    let name = 'Track'
    let shortName: string | undefined

    if (this.check(TT.String)) {
      name = this.advance().value
      if (this.check(TT.String)) shortName = this.advance().value
    }

    const track = this.parseTrackContent(meta, name)
    if (shortName) track.shortName = shortName

    return track
  }

  private parseTrackContent(meta: MetaNode, name: string): TrackNode {
    const track: TrackNode = {
      id: nanoid(),
      name,
      instrument: 25, // acoustic guitar (nylon) default
      tuning: [...STANDARD_GUITAR_TUNING],
      capo: 0,
      chordDefs: [],
      staves: [],
    }

    // Parse optional track-level properties in { }
    if (this.check(TT.LBrace)) {
      this.advance()
      while (!this.check(TT.RBrace) && !this.check(TT.EOF)) {
        this.skipNewlines()
        const prop = this.match(TT.Ident)
        if (!prop) { this.advance(); continue }
        this.parseTrackProperty(track, prop.value)
      }
      this.match(TT.RBrace)
    }

    // Parse staves / bars
    // May start with \staff or directly with bar content
    this.skipNewlines()

    if (this.check(TT.Backslash) && this.isTagAhead('staff')) {
      // Explicit staves
      while (this.check(TT.Backslash) && this.isTagAhead('staff') && !this.check(TT.EOF)) {
        this.advance() // backslash
        this.advance() // 'staff'
        const staff = this.parseStaff(track)
        track.staves.push(staff)
        this.skipNewlines()
      }
    } else if (!this.check(TT.EOF) && !this.isNextTrack()) {
      // Implicit single staff
      const staff = this.parseStaffContent(track)
      track.staves.push(staff)
    }

    return track
  }

  private isNextTrack(): boolean {
    return this.check(TT.Backslash) && this.isTagAhead('track')
  }

  private parseTrackProperty(track: TrackNode, prop: string): void {
    switch (prop.toLowerCase()) {
      case 'color': {
        const val = this.match(TT.String) ?? this.match(TT.Ident)
        if (val) track.color = val.value
        break
      }
      case 'instrument': {
        const val = this.match(TT.NumberInt) ?? this.match(TT.String) ?? this.match(TT.Ident)
        if (val) track.instrument = this.resolveMidiProgram(val.value)
        break
      }
      case 'solo': track.solo = true; this.match(TT.LParen); this.match(TT.RParen); break
      case 'mute': track.mute = true; this.match(TT.LParen); this.match(TT.RParen); break
      case 'volume': { const n = this.parseNumberArg(); if (n !== null) track.volume = n; break }
      case 'balance': { const n = this.parseNumberArg(); if (n !== null) track.balance = n; break }
      default: this.skipToEndOfProp()
    }
  }

  private resolveMidiProgram(val: string): number {
    const n = parseInt(val, 10)
    if (!isNaN(n)) return Math.max(0, Math.min(127, n))
    // Named lookup (simplified — real implementation would have full GM map)
    return 25
  }

  // ---------------------------------------------------------------------------
  // Staff
  // ---------------------------------------------------------------------------

  private parseStaff(track: TrackNode): StaffNode {
    const staff: StaffNode = {
      id: nanoid(),
      bars: [],
    }

    if (this.check(TT.LBrace)) {
      this.advance()
      while (!this.check(TT.RBrace) && !this.check(TT.EOF)) {
        this.skipNewlines()
        const prop = this.match(TT.Ident)
        if (!prop) { this.advance(); continue }
        switch (prop.value.toLowerCase()) {
          case 'score': staff.showScore = true; this.parseOptionalNumber(); break
          case 'tabs': staff.showTabs = true; break
          case 'slash': staff.showSlash = true; break
          case 'numbered': staff.showNumbered = true; break
          default: break
        }
      }
      this.match(TT.RBrace)
    }

    // Parse staff-level metadata and bars
    const staffBars = this.parseStaffContent(track)
    staff.showScore = staffBars.showScore ?? staff.showScore
    staff.showTabs = staffBars.showTabs ?? staff.showTabs
    staff.showSlash = staffBars.showSlash ?? staff.showSlash
    staff.bars = staffBars.bars

    return staff
  }

  private parseStaffContent(track: TrackNode): StaffNode {
    const staff: StaffNode = {
      id: nanoid(),
      bars: [],
    }

    // Parse staff-level metadata tags before bars
    this.parseStaffMeta(track, staff)

    // Parse voices/bars
    // Determine if we have explicit \voice tags
    this.skipNewlines()
    if (this.check(TT.Backslash) && this.isTagAhead('voice')) {
      const voiceBarsList: BeatNode[][] = []

      while (this.check(TT.Backslash) && this.isTagAhead('voice') && !this.check(TT.EOF)) {
        this.advance() // backslash
        this.advance() // 'voice'
        const voiceBeats = this.parseVoiceBeats()
        voiceBarsList.push(voiceBeats)
        this.skipNewlines()
      }

      // Merge voices into bars
      staff.bars = this.mergeVoicesToBars(voiceBarsList)
    } else {
      // Single voice
      const bars = this.parseBars()
      staff.bars = bars
    }

    return staff
  }

  private parseStaffMeta(track: TrackNode, _staff: StaffNode): void {
    // Parse \tuning, \capo, \chord, etc.
    while (this.check(TT.Backslash) && !this.check(TT.EOF)) {
      const metaTag = this.peek(1)
      if (!metaTag || metaTag.type !== TT.Ident) break

      const tag = metaTag.value.toLowerCase()
      if (['tuning', 'capo', 'chord', 'lyrics', 'displaytranspose', 'transpose'].includes(tag)) {
        this.advance() // backslash
        this.advance() // tag name

        switch (tag) {
          case 'tuning': this.parseTuning(track); break
          case 'capo': { const n = this.parseNumberArg(); if (n !== null) track.capo = n; break }
          case 'chord': this.parseChordDef(track); break
          case 'displaytranspose': { const n = this.parseNumberArg(); if (n !== null) track.displayTranspose = n; break }
          case 'transpose': { const n = this.parseNumberArg(); if (n !== null) track.transpose = n; break }
          case 'lyrics': this.skipToEndOfLine(); break
        }
        this.skipNewlines()
      } else {
        break
      }
    }
  }

  private parseTuning(track: TrackNode): void {
    // \tuning piano | \tuning none | \tuning E2 A2 D3 G3 B3 E4
    //   | \tuning (E2 A2 D3 G3 B3 E4)   ← parenthesized form (alphaTab v1.8.1+)
    const hasParen = this.check(TT.LParen)
    if (hasParen) this.advance()

    const first = this.peek()
    if (first.type === TT.Ident) {
      const val = first.value.toLowerCase()
      if (val === 'piano' || val === 'none' || val === 'voice') {
        this.advance()
        if (val === 'piano') {
          track.tuning = [] // piano = no tablature
        }
        if (hasParen && this.check(TT.RParen)) this.advance()
        return
      }
    }

    // Parse space-separated note names like E2, A2, D3 etc.
    const pitches: number[] = []
    while (true) {
      const t = this.peek()
      if (t.type === TT.Ident && NOTE_NAMES[t.value[0]] !== undefined) {
        const noteName = this.advance().value
        const pitch = this.parseNoteNameToPitch(noteName)
        if (pitch !== null) pitches.push(pitch)
      } else if (t.type === TT.NumberInt) {
        // Also accept raw MIDI numbers
        pitches.push(parseInt(this.advance().value, 10))
      } else {
        break
      }
    }

    if (hasParen && this.check(TT.RParen)) this.advance()
    if (pitches.length > 0) track.tuning = pitches
  }

  private parseNoteNameToPitch(name: string): number | null {
    // E.g. "E2", "A#3", "Bb4"
    const m = name.match(/^([A-Ga-g])([#b]?)(-?\d+)$/)
    if (!m) return null
    const base = NOTE_NAMES[m[1]] ?? 60
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
    const octave = parseInt(m[3], 10)
    // MIDI: C4 = 60, so C(octave) = 60 + (octave - 4) * 12
    return base + acc + (octave - 4) * 12
  }

  private parseChordDef(track: TrackNode): void {
    // \chord "Am" (0 0 2 2 1 0)  or  \chord "Am" (strings)
    const name = this.match(TT.String)
    if (!name) return

    const strings: number[] = []
    if (this.match(TT.LParen)) {
      while (!this.check(TT.RParen) && !this.check(TT.EOF)) {
        const n = this.match(TT.NumberInt) ?? this.match(TT.Minus)
        if (n) {
          strings.push(n.type === TT.Minus ? -1 : parseInt(n.value, 10))
        } else {
          this.advance()
        }
      }
      this.match(TT.RParen)
    }

    const chord: ChordDefNode = {
      id: nanoid(),
      name: name.value,
      strings,
    }
    track.chordDefs.push(chord)
  }

  // ---------------------------------------------------------------------------
  // Bars
  // ---------------------------------------------------------------------------

  private parseBars(): BarNode[] {
    const bars: BarNode[] = []
    let currentBarBeats: BeatNode[] = []
    let currentBarMeta: Partial<BarNode> = {}
    let lastDuration: DurationNode = defaultDuration()

    const finishBar = (): void => {
      const voice: VoiceNode = {
        id: nanoid(),
        beats: currentBarBeats,
      }
      const bar: BarNode = {
        id: nanoid(),
        voices: [voice],
        ...currentBarMeta,
      }
      bars.push(bar)
      currentBarBeats = []
      currentBarMeta = {}
    }

    while (!this.check(TT.EOF) && !this.isNextTrack() && !this.isNextStaff() && !this.isNextVoice()) {
      this.skipNewlines()

      if (this.check(TT.EOF) || this.isNextTrack() || this.isNextStaff() || this.isNextVoice()) break

      // Bar separator
      if (this.check(TT.Pipe)) {
        this.advance()
        finishBar()
        continue
      }

      // Bar-level metadata tag
      if (this.check(TT.Backslash)) {
        const tag = this.peek(1)
        if (tag.type === TT.Ident) {
          const tagVal = tag.value.toLowerCase()
          if (this.isBarMetaTag(tagVal)) {
            this.advance() // backslash
            this.advance() // tag name
            this.parseBarMeta(tagVal, currentBarMeta)
            continue
          }
        }
        // Unknown \tag — skip the entire directive, including its arguments.
        // AlphaTex has many directives we don't model (\beaming, \accidentals,
        // \ottava, …); their arg lists often contain '(' which would otherwise
        // be mis-parsed as a chord beat by parseBeat.  Consume the backslash
        // and everything up to the next newline, pipe, or backslash.
        this.advance() // backslash
        this.skipUnknownDirective()
        continue
      }

      // Duration prefix: :4, :8, etc.
      if (this.check(TT.Colon)) {
        this.advance()
        const n = this.match(TT.NumberInt)
        if (n) {
          const d = parseInt(n.value, 10)
          if (isDuration(d)) {
            lastDuration = { value: d, dots: 0 }
          } else {
            this.error(`Invalid duration: ${n.value}`)
          }
        }
        continue
      }

      // Beat
      if (this.isNoteStart()) {
        const beat = this.parseBeat(lastDuration)

        // Update lastDuration if this beat had an explicit duration suffix
        lastDuration = { value: beat.duration.value, dots: beat.duration.dots }

        // Handle beat repeat: beat * N
        const repeatCount = beat.repeat ?? 1
        for (let r = 0; r < repeatCount; r++) {
          currentBarBeats.push(r === 0 ? beat : { ...beat, id: nanoid(), repeat: undefined })
        }
        continue
      }

      // Unknown token — skip
      this.advance()
    }

    // Flush the last bar if it has beats (no trailing '|')
    if (currentBarBeats.length > 0 || Object.keys(currentBarMeta).length > 0) {
      finishBar()
    }

    return bars
  }

  private isBarMetaTag(tag: string): boolean {
    return [
      'ts', 'ks', 'tempo', 'section', 'ro', 'rc', 'ae',
      'clef', 'tf', 'ac', 'ft', 'jump', 'simile',
    ].includes(tag)
  }

  private isNextStaff(): boolean {
    return this.check(TT.Backslash) && this.isTagAhead('staff')
  }

  private isNextVoice(): boolean {
    return this.check(TT.Backslash) && this.isTagAhead('voice')
  }

  private parseBarMeta(tag: string, meta: Partial<BarNode>): void {
    switch (tag) {
      case 'ts': {
        // \ts 4 4  or  \ts common
        if (this.check(TT.Ident) && this.peek().value.toLowerCase() === 'common') {
          this.advance()
          meta.timeSignature = { numerator: 4, denominator: 4 }
        } else if (this.check(TT.LParen)) {
          this.advance()
          const num = this.match(TT.NumberInt)
          const den = this.match(TT.NumberInt)
          this.match(TT.RParen)
          if (num && den) meta.timeSignature = { numerator: parseInt(num.value, 10), denominator: parseInt(den.value, 10) }
        } else {
          const num = this.match(TT.NumberInt)
          const den = this.match(TT.NumberInt)
          if (num && den) meta.timeSignature = { numerator: parseInt(num.value, 10), denominator: parseInt(den.value, 10) }
        }
        break
      }
      case 'ks': {
        // \ks F#  or  \ks Cb  or  \ks Aminor
        const val = this.match(TT.Ident)
        if (val) {
          let ks = val.value
          // Might be followed by '#' or 'b' as separate token
          if (this.check(TT.Hash)) { ks += '#'; this.advance() }
          meta.keySignature = ks
        }
        break
      }
      case 'tempo': {
        let bpm: number | null = null
        let label: string | undefined
        if (this.check(TT.LParen)) {
          this.advance()
          const n = this.match(TT.NumberInt)
          if (n) bpm = parseInt(n.value, 10)
          if (this.check(TT.String)) label = this.advance().value
          // optional 'hide' ident
          this.match(TT.Ident)
          this.match(TT.RParen)
        } else {
          const n = this.match(TT.NumberInt)
          if (n) bpm = parseInt(n.value, 10)
          if (this.check(TT.String)) label = this.advance().value
        }
        if (bpm !== null) meta.tempo = bpm
        if (label) meta.tempoLabel = label
        break
      }
      case 'section': {
        const a = this.match(TT.String)
        if (a) {
          const b = this.match(TT.String)
          if (b) {
            meta.sectionMarker = a.value
            meta.section = b.value
          } else {
            meta.section = a.value
          }
        }
        break
      }
      case 'ro': {
        if (!meta.repeat) meta.repeat = {}
        meta.repeat.start = true
        break
      }
      case 'rc': {
        if (!meta.repeat) meta.repeat = {}
        meta.repeat.end = true
        const n = this.match(TT.NumberInt)
        if (n) meta.repeat.count = parseInt(n.value, 10)
        break
      }
      case 'ae': {
        const endings: number[] = []
        if (this.check(TT.LParen)) {
          this.advance()
          while (!this.check(TT.RParen) && !this.check(TT.EOF)) {
            const n = this.match(TT.NumberInt)
            if (n) endings.push(parseInt(n.value, 10))
            else this.advance()
          }
          this.match(TT.RParen)
        } else {
          const n = this.match(TT.NumberInt)
          if (n) endings.push(parseInt(n.value, 10))
        }
        meta.alternateEnding = endings
        break
      }
      case 'clef': {
        const c = this.match(TT.Ident)
        if (c) meta.clef = c.value as ClefType
        break
      }
      case 'tf': {
        const f = this.match(TT.Ident)
        if (f) meta.tripletFeel = f.value as TripletFeel
        break
      }
      case 'ac': meta.anacrusis = true; break
      case 'ft': meta.freeTime = true; break
      case 'jump': {
        const j = this.match(TT.Ident)
        if (j) meta.jump = j.value as JumpType
        break
      }
      case 'simile': {
        const s = this.match(TT.Ident)
        if (s) meta.simile = s.value as SimileType
        break
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Beat
  // ---------------------------------------------------------------------------

  private parseBeat(inheritDuration: DurationNode): BeatNode {
    const beat: BeatNode = {
      id: nanoid(),
      duration: { ...inheritDuration },
      notes: [],
    }

    // Tie shorthand '-'
    if (this.check(TT.Minus)) {
      this.advance()
      beat.rest = false
      // tie — creates a note with tie=true; we'll handle via a ghost note with tie
      // For now mark it as a tied rest placeholder
      beat._parseErrors = ['tie-shorthand: context-dependent, not expanded']
      return beat
    }

    // Rest
    if (this.check(TT.Ident) && this.peek().value === 'r') {
      this.advance()
      beat.rest = true
      // Optional duration suffix
      if (this.check(TT.Dot)) {
        const durSuffix = this.tryParseDurationSuffix()
        if (durSuffix !== null) beat.duration.value = durSuffix
      }
      this.parseBeatEffects(beat)
      this.parseBeatRepeat(beat)
      return beat
    }

    // Single note: <fret>.<string>
    if (this.check(TT.NumberInt)) {
      const note = this.parseSingleNote(beat)
      if (note) beat.notes.push(note)
    }

    // Chord: (<fret>.<string> <fret>.<string> ...)
    else if (this.check(TT.LParen)) {
      this.advance()
      while (!this.check(TT.RParen) && !this.check(TT.EOF)) {
        if (this.check(TT.NumberInt)) {
          const note = this.parseSingleNote(beat)
          if (note) beat.notes.push(note)
        } else {
          this.advance()
        }
      }
      this.match(TT.RParen)
    }

    // Beat-level duration suffix: .4 after the note(s)
    if (this.check(TT.Dot)) {
      const durSuffix = this.tryParseDurationSuffix()
      if (durSuffix !== null) beat.duration.value = durSuffix
    }

    // Beat effects in { }
    this.parseBeatEffects(beat)

    // Beat repeat: * N
    this.parseBeatRepeat(beat)

    return beat
  }

  private parseSingleNote(beat: BeatNode): NoteNode | null {
    // fret . string
    const fretTok = this.match(TT.NumberInt)
    if (!fretTok) return null

    if (!this.check(TT.Dot)) {
      this.error(`Expected '.' after fret number ${fretTok.value}`)
      return null
    }
    this.advance() // dot

    const stringTok = this.match(TT.NumberInt)
    if (!stringTok) {
      this.error('Expected string number after fret.')
      return null
    }

    // Optional note-level duration suffix: fret.string.duration (e.g. 14.1.2)
    if (this.check(TT.Dot)) {
      const durSuffix = this.tryParseDurationSuffix()
      if (durSuffix !== null) beat.duration.value = durSuffix
    }

    const note: NoteNode = {
      id: nanoid(),
      fret: parseInt(fretTok.value, 10),
      string: parseInt(stringTok.value, 10),
    }

    // Do NOT consume the { } block here.
    // The beat-level parseBeatEffects() will consume it and apply note-level
    // keywords to this note via applyNoteKeyword().

    return note
  }

  private tryParseDurationSuffix(): Duration | null {
    if (!this.check(TT.Dot)) return null
    const dotPos = this.pos
    this.advance() // consume dot
    const n = this.match(TT.NumberInt)
    if (!n) {
      this.pos = dotPos // rewind
      return null
    }
    const d = parseInt(n.value, 10)
    if (isDuration(d)) return d
    this.pos = dotPos // rewind
    return null
  }

  private parseNoteEffects(note: NoteNode): void {
    if (!this.match(TT.LBrace)) return

    while (!this.check(TT.RBrace) && !this.check(TT.EOF)) {
      this.skipNewlines()
      const kw = this.match(TT.Ident)
      if (!kw) { this.advance(); continue }

      switch (kw.value) {
        // Slide types
        case 'sl': note.slide = 'legato'; break
        case 'ss': note.slide = 'shift'; break
        case 'sib': note.slide = 'intoFromBelow'; break
        case 'sia': note.slide = 'intoFromAbove'; break
        case 'sou': note.slide = 'outUp'; break
        case 'sod': note.slide = 'outDown'; break
        case 'psu': note.slide = 'pickSlideUp'; break
        case 'psd': note.slide = 'pickSlideDown'; break

        // Hammer / pull
        case 'h': note.hammerOrPull = true; break
        case 'lht': note.leftHandTap = true; break

        // Bend
        case 'b': note.bend = this.parseBendPoints(); break
        case 'be': note.bendExact = this.parseBendPoints(); break

        // Vibrato
        case 'v': note.vibrato = 'slight'; break
        case 'vw': note.vibrato = 'wide'; break

        // Harmonics
        case 'nh': note.harmonic = 'natural'; break
        case 'ah': {
          note.harmonic = 'artificial'
          const f = this.parseOptionalNumber()
          if (f !== null) note.harmonicFret = f
          break
        }
        case 'th': {
          note.harmonic = 'tap'
          const f = this.parseOptionalNumber()
          if (f !== null) note.harmonicFret = f
          break
        }
        case 'ph': note.harmonic = 'pinch'; break
        case 'sh': note.harmonic = 'semi'; break
        case 'fh': note.harmonic = 'feedback' as HarmonicType; break

        // Articulation
        case 'g': note.ghost = true; break
        case 'x': note.dead = true; break
        case 'pm': note.palmMute = true; break
        case 'lr': note.letRing = true; break
        case 'st': note.staccato = true; break
        case 'ac': note.accent = 'normal' as AccentType; break
        case 'hac': note.accent = 'heavy' as AccentType; break
        case 'ten': note.accent = 'tenuto' as AccentType; break
        case 't': note.tie = true; break
        case 'hide': note.hidden = true; break

        // Ornaments
        case 'turn': note.ornament = 'turn' as OrnamentType; break
        case 'iturn': note.ornament = 'iturn' as OrnamentType; break
        case 'umordent': note.ornament = 'umordent' as OrnamentType; break
        case 'lmordent': note.ornament = 'lmordent' as OrnamentType; break

        // Trill
        case 'tr': {
          const fret = this.parseOptionalNumber()
          const dur = this.parseOptionalNumber()
          if (fret !== null) {
            note.trill = { fret, duration: (isDuration(dur ?? 16) ? (dur ?? 16) : 16) as Duration }
          }
          break
        }

        // Fingering
        case 'lf': { const f = this.parseOptionalNumber(); if (f !== null) note.leftFinger = f; break }
        case 'rf': { const f = this.parseOptionalNumber(); if (f !== null) note.rightFinger = f; break }

        // Slur
        case 'slur': { const id = this.parseOptionalNumber(); if (id !== null) note.slur = id; break }

        default:
          // Unknown note effect — skip value if present
          this.skipToEndOfProp()
      }
    }

    this.match(TT.RBrace)
  }

  private parseBeatEffects(beat: BeatNode): void {
    if (!this.check(TT.LBrace)) return
    this.advance()

    while (!this.check(TT.RBrace) && !this.check(TT.EOF)) {
      this.skipNewlines()
      const kw = this.match(TT.Ident)
      if (!kw) { this.advance(); continue }

      switch (kw.value) {
        // Vibrato
        case 'v': beat.vibrato = 'slight'; break
        case 'vw': beat.vibrato = 'wide'; break

        // Duration dots
        case 'd': beat.duration.dots = 1; break
        case 'dd': beat.duration.dots = 2; break

        // Tuplet: tu 3  or  tu (3 2)
        case 'tu': {
          if (this.check(TT.LParen)) {
            this.advance()
            const num = this.match(TT.NumberInt)
            const den = this.match(TT.NumberInt)
            this.match(TT.RParen)
            if (num) {
              beat.duration.tuplet = {
                numerator: parseInt(num.value, 10),
                denominator: den ? parseInt(den.value, 10) : 2,
              }
            }
          } else {
            const n = this.match(TT.NumberInt)
            if (n) beat.duration.tuplet = { numerator: parseInt(n.value, 10), denominator: 2 }
          }
          break
        }

        // Fade
        case 'f': beat.fadeIn = true; break
        case 'fo': beat.fadeOut = true; break
        case 'vs': beat.volumeSwell = true; break

        // Bass techniques
        case 's': beat.slap = true; break
        case 'p': beat.pop = true; break
        case 'tt': beat.tap = true; break

        // Pick stroke
        case 'su': beat.pickStroke = 'up'; break
        case 'sd': beat.pickStroke = 'down'; break

        // Crescendo
        case 'cre': beat.crescendo = true; break
        case 'dec': beat.decrescendo = true; break

        // Dynamics
        case 'dy': {
          const dyn = this.match(TT.Ident)
          if (dyn && isDynamic(dyn.value)) beat.dynamics = dyn.value
          break
        }

        // Text / lyrics / chord
        case 'txt': {
          const txt = this.match(TT.String) ?? this.match(TT.Ident)
          if (txt) beat.text = txt.value
          break
        }
        case 'lyrics': {
          if (this.check(TT.LParen)) {
            this.advance()
            const _line = this.match(TT.NumberInt)
            const txt = this.match(TT.String)
            this.match(TT.RParen)
            if (txt) beat.lyrics = txt.value
          } else {
            const txt = this.match(TT.String)
            if (txt) beat.lyrics = txt.value
          }
          break
        }
        case 'ch': {
          const name = this.match(TT.String) ?? this.match(TT.Ident)
          if (name) beat.chord = name.value
          break
        }

        // Tempo change
        case 'tempo': {
          const n = this.match(TT.NumberInt)
          if (n) beat.tempoChange = parseInt(n.value, 10)
          if (this.check(TT.String)) beat.tempoLabel = this.advance().value
          break
        }

        // Whammy bar
        case 'tb': beat.whammy = this.parseBendPoints(); break
        case 'tbe': beat.whammyExact = this.parseBendPoints(); break

        // Tremolo picking
        case 'tp': {
          const n = this.match(TT.NumberInt)
          if (n) {
            const d = parseInt(n.value, 10)
            beat.tremoloPickingDuration = isDuration(d) ? d : 8
          }
          break
        }

        // Grace
        case 'gr': {
          const t = this.match(TT.Ident)
          beat.graceNote = (t?.value as GraceType) ?? 'before'
          break
        }

        // Arpeggio / brush
        case 'au': beat.arpeggioUp = true; this.parseOptionalNumber(); break
        case 'ad': beat.arpeggioDown = true; this.parseOptionalNumber(); break
        case 'bu': beat.brushUp = true; this.parseOptionalNumber(); break
        case 'bd': beat.brushDown = true; this.parseOptionalNumber(); break

        // Legato
        case 'legatoOrigin': beat.legatoOrigin = true; break

        // Dead slap
        case 'ds': beat.deadSlap = true; break

        // Fermata
        case 'fermata': {
          if (this.check(TT.LParen)) {
            this.advance()
            const type = this.match(TT.Ident)
            const length = this.match(TT.NumberInt)
            this.match(TT.RParen)
            beat.fermata = {
              type: (type?.value as 'short' | 'medium' | 'long') ?? 'medium',
              length: length ? parseInt(length.value, 10) : 1,
            }
          } else {
            beat.fermata = { type: 'medium', length: 1 }
          }
          break
        }

        // Ottava
        case 'ot': { const n = this.parseOptionalNumber(); if (n !== null) beat.ottava = n; break }

        default:
          // Note-level keywords that sneak into beat braces (in practice alphaTex
          // allows mixing note and beat effects in one brace block for single-note beats)
          // We apply them to the first note if there is one.
          if (beat.notes.length > 0) {
            this.applyNoteKeyword(beat.notes[0], kw.value)
          } else {
            this.skipToEndOfProp()
          }
      }
    }

    this.match(TT.RBrace)
  }

  private applyNoteKeyword(note: NoteNode, kw: string): void {
    switch (kw) {
      // Slides
      case 'sl': note.slide = 'legato'; break
      case 'ss': note.slide = 'shift'; break
      case 'sib': note.slide = 'intoFromBelow'; break
      case 'sia': note.slide = 'intoFromAbove'; break
      case 'sou': note.slide = 'outUp'; break
      case 'sod': note.slide = 'outDown'; break
      case 'psu': note.slide = 'pickSlideUp'; break
      case 'psd': note.slide = 'pickSlideDown'; break
      // Hammer/tap
      case 'h': note.hammerOrPull = true; break
      case 'lht': note.leftHandTap = true; break
      // Bends
      case 'b': note.bend = this.parseBendPoints(); break
      case 'be': note.bendExact = this.parseBendPoints(); break
      // Vibrato
      case 'v': note.vibrato = 'slight'; break
      case 'vw': note.vibrato = 'wide'; break
      // Harmonics
      case 'nh': note.harmonic = 'natural'; break
      case 'ah': {
        note.harmonic = 'artificial'
        const f = this.parseOptionalNumber()
        if (f !== null) note.harmonicFret = f
        break
      }
      case 'th': {
        note.harmonic = 'tap'
        const f = this.parseOptionalNumber()
        if (f !== null) note.harmonicFret = f
        break
      }
      case 'ph': note.harmonic = 'pinch'; break
      case 'sh': note.harmonic = 'semi'; break
      case 'fh': note.harmonic = 'feedback' as import('./types').HarmonicType; break
      // Articulation
      case 'g': note.ghost = true; break
      case 'x': note.dead = true; break
      case 'pm': note.palmMute = true; break
      case 'lr': note.letRing = true; break
      case 'st': note.staccato = true; break
      case 'ac': note.accent = 'normal'; break
      case 'hac': note.accent = 'heavy'; break
      case 'ten': note.accent = 'tenuto'; break
      case 't': note.tie = true; break
      case 'hide': note.hidden = true; break
      // Ornaments
      case 'turn': note.ornament = 'turn'; break
      case 'iturn': note.ornament = 'iturn'; break
      case 'umordent': note.ornament = 'umordent'; break
      case 'lmordent': note.ornament = 'lmordent'; break
      // Trill
      case 'tr': {
        const fret = this.parseOptionalNumber()
        const dur = this.parseOptionalNumber()
        if (fret !== null) {
          note.trill = { fret, duration: (isDuration(dur ?? 16) ? (dur ?? 16) : 16) as import('./types').Duration }
        }
        break
      }
      // Fingering
      case 'lf': { const f = this.parseOptionalNumber(); if (f !== null) note.leftFinger = f; break }
      case 'rf': { const f = this.parseOptionalNumber(); if (f !== null) note.rightFinger = f; break }
      // Slur
      case 'slur': { const id = this.parseOptionalNumber(); if (id !== null) note.slur = id; break }
      default: this.skipToEndOfProp()
    }
  }

  private parseBendPoints(): BendPoint[] {
    const points: BendPoint[] = []

    if (this.check(TT.LParen)) {
      this.advance()
      // Collect all numbers — alternating position/value pairs
      const nums: number[] = []
      while (!this.check(TT.RParen) && !this.check(TT.EOF)) {
        const n = this.match(TT.NumberInt) ?? this.match(TT.NumberFloat)
        if (n) {
          nums.push(parseFloat(n.value))
        } else if (this.check(TT.Minus)) {
          this.advance()
          const n2 = this.match(TT.NumberInt) ?? this.match(TT.NumberFloat)
          if (n2) nums.push(-parseFloat(n2.value))
        } else {
          this.advance()
        }
      }
      this.match(TT.RParen)

      // alphaTex bend auto-spread: values are evenly spaced by default
      // Format: (v1 v2 v3 ...) — auto-positions, or (p1 v1 p2 v2 ...) for exact
      // We store as auto-spread: position = index / (count-1) * 60
      const n = nums.length
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const position = n === 1 ? 0 : Math.round((i / (n - 1)) * 60)
          points.push({ position, value: nums[i] })
        }
      }
    } else {
      // Single value without parens
      const n = this.match(TT.NumberInt)
      if (n) points.push({ position: 0, value: parseInt(n.value, 10) })
    }

    return points
  }

  private parseBeatRepeat(beat: BeatNode): void {
    if (this.match(TT.Star)) {
      const n = this.match(TT.NumberInt)
      if (n) beat.repeat = parseInt(n.value, 10)
    }
  }

  // ---------------------------------------------------------------------------
  // Voice beats (for explicit \voice parsing)
  // ---------------------------------------------------------------------------

  private parseVoiceBeats(): BeatNode[] {
    const bars = this.parseBars()
    const beats: BeatNode[] = []
    for (const bar of bars) {
      for (const voice of bar.voices) {
        beats.push(...voice.beats)
      }
    }
    return beats
  }

  private mergeVoicesToBars(voiceBarsList: BeatNode[][]): BarNode[] {
    // Simple merge: assume all voices have the same bar count
    // For multi-voice, we create VoiceNodes inside each BarNode
    // This is a simplified approach
    const maxBars = Math.max(...voiceBarsList.map(v => v.length))
    const bars: BarNode[] = []
    for (let i = 0; i < maxBars; i++) {
      const voices: VoiceNode[] = voiceBarsList.map(vb => ({
        id: nanoid(),
        beats: vb[i] !== undefined ? [vb[i]] : [],
      }))
      bars.push({ id: nanoid(), voices })
    }
    return bars
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private parseStringArg(): string {
    // Can be a quoted string or unquoted ident
    const s = this.match(TT.String) ?? this.match(TT.Ident)
    return s?.value ?? ''
  }

  private parseNumberArg(): number | null {
    // Optional parens
    const hadParen = !!this.match(TT.LParen)
    const sign = this.match(TT.Minus) ? -1 : 1
    const n = this.match(TT.NumberInt) ?? this.match(TT.NumberFloat)
    if (hadParen) this.match(TT.RParen)
    if (!n) return null
    return sign * parseFloat(n.value)
  }

  private parseOptionalNumber(): number | null {
    if (this.check(TT.LParen)) {
      this.advance()
      const n = this.match(TT.NumberInt) ?? this.match(TT.NumberFloat)
      this.match(TT.RParen)
      return n ? parseFloat(n.value) : null
    }
    const n = this.match(TT.NumberInt) ?? this.match(TT.NumberFloat)
    return n ? parseFloat(n.value) : null
  }

  private skipToEndOfLine(): void {
    while (!this.check(TT.EOF) && !this.check(TT.NewLine)) this.advance()
  }

  /**
   * Skip an unknown `\tag` directive and its arguments.
   *
   * Stops at the next significant bar-level token: newline, pipe, or another
   * backslash.  Balances any `(…)` or `{…}` groups encountered so that a `(`
   * inside the directive's args (e.g. `\beaming (8 2 2 2)`) is NOT left behind
   * to be mis-parsed as a chord beat.  The backslash itself is assumed already
   * consumed by the caller.
   */
  private skipUnknownDirective(): void {
    while (!this.check(TT.EOF) && !this.check(TT.NewLine) && !this.check(TT.Pipe) && !this.check(TT.Backslash)) {
      if (this.check(TT.LParen)) {
        let depth = 0
        do {
          if (this.check(TT.LParen)) depth++
          else if (this.check(TT.RParen)) depth--
          this.advance()
        } while (depth > 0 && !this.check(TT.EOF))
        continue
      }
      if (this.check(TT.LBrace)) {
        let depth = 0
        do {
          if (this.check(TT.LBrace)) depth++
          else if (this.check(TT.RBrace)) depth--
          this.advance()
        } while (depth > 0 && !this.check(TT.EOF))
        continue
      }
      this.advance()
    }
  }

  private skipToEndOfProp(): void {
    // Skip until we hit a keyword, '}', or end
    // In practice: skip next token which might be a value
    if (!this.check(TT.RBrace) && !this.check(TT.EOF) && !this.check(TT.NewLine)) {
      const t = this.peek()
      if (t.type === TT.Ident || t.type === TT.NumberInt || t.type === TT.String) {
        this.advance()
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parse(src: string): ParseResult {
  const tokens = tokenize(src)
  const parser = new Parser(tokens)
  return parser.parse()
}
