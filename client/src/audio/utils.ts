export function secondsToMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 0.0001))
}

export function noteToFrequency(note: string, octave: number): number {
  const noteMap: Record<string, number> = {
    C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
    'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
  }
  const semitone = noteMap[note] ?? 0
  return 440 * Math.pow(2, (semitone - 9 + (octave - 4) * 12) / 12)
}
