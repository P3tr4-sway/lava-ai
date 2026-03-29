// Finger positions: -1 = muted, 0 = open, 1-12 = fret number
// Array index 0 = low E (6th string), index 5 = high E (1st string)
export interface ChordVoicing {
  name: string
  frets: [number, number, number, number, number, number]
  baseFret: number // 1 for open position chords
}

export const CHORD_VOICINGS: Record<string, ChordVoicing> = {
  'C':    { name: 'C',    frets: [-1, 3, 2, 0, 1, 0], baseFret: 1 },
  'D':    { name: 'D',    frets: [-1, -1, 0, 2, 3, 2], baseFret: 1 },
  'E':    { name: 'E',    frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
  'F':    { name: 'F',    frets: [1, 3, 3, 2, 1, 1], baseFret: 1 },
  'G':    { name: 'G',    frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
  'A':    { name: 'A',    frets: [-1, 0, 2, 2, 2, 0], baseFret: 1 },
  'B':    { name: 'B',    frets: [-1, 2, 4, 4, 4, 2], baseFret: 1 },
  'Am':   { name: 'Am',   frets: [-1, 0, 2, 2, 1, 0], baseFret: 1 },
  'Bm':   { name: 'Bm',   frets: [-1, 2, 4, 4, 3, 2], baseFret: 1 },
  'Cm':   { name: 'Cm',   frets: [-1, 3, 5, 5, 4, 3], baseFret: 1 },
  'Dm':   { name: 'Dm',   frets: [-1, -1, 0, 2, 3, 1], baseFret: 1 },
  'Em':   { name: 'Em',   frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
  'Fm':   { name: 'Fm',   frets: [1, 3, 3, 1, 1, 1], baseFret: 1 },
  'Gm':   { name: 'Gm',   frets: [3, 5, 5, 3, 3, 3], baseFret: 1 },
  'A7':   { name: 'A7',   frets: [-1, 0, 2, 0, 2, 0], baseFret: 1 },
  'B7':   { name: 'B7',   frets: [-1, 2, 1, 2, 0, 2], baseFret: 1 },
  'C7':   { name: 'C7',   frets: [-1, 3, 2, 3, 1, 0], baseFret: 1 },
  'D7':   { name: 'D7',   frets: [-1, -1, 0, 2, 1, 2], baseFret: 1 },
  'E7':   { name: 'E7',   frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  'G7':   { name: 'G7',   frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  'Am7':  { name: 'Am7',  frets: [-1, 0, 2, 0, 1, 0], baseFret: 1 },
  'Dm7':  { name: 'Dm7',  frets: [-1, -1, 0, 2, 1, 1], baseFret: 1 },
  'Em7':  { name: 'Em7',  frets: [0, 2, 0, 0, 0, 0], baseFret: 1 },
  'Cmaj7': { name: 'Cmaj7', frets: [-1, 3, 2, 0, 0, 0], baseFret: 1 },
  'Fmaj7': { name: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], baseFret: 1 },
  'Gmaj7': { name: 'Gmaj7', frets: [3, 2, 0, 0, 0, 2], baseFret: 1 },
}
