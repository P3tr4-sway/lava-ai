export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export type Key = (typeof KEYS)[number]

export const SCALES = ['major', 'minor', 'dorian', 'mixolydian', 'pentatonic', 'blues'] as const
export type Scale = (typeof SCALES)[number]

export const TIME_SIGNATURES = [
  { numerator: 4, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 5, denominator: 4 },
  { numerator: 7, denominator: 8 },
] as const

export const NOTE_VALUES = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] as const
