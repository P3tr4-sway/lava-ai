export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = '#' | 'b' | 'n' | ''
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'
export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'

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
