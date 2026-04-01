export interface Pitch {
  step: string // 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
  octave: number
  alter?: number // -1 flat, 0 natural, 1 sharp
}

export interface FretPosition {
  string: number // 1-6, 1 = highest (high E)
  fret: number   // 0-12
}

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

const DIATONIC_STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

// Standard guitar tuning: string 1 (high E) to string 6 (low E), as MIDI numbers
export const STANDARD_TUNING: readonly number[] = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_TO_SEMITONE[p.step] + (p.alter ?? 0)
}

export function midiToPitch(midi: number, preferFlats = false): Pitch {
  const octave = Math.floor(midi / 12) - 1
  const semitone = midi % 12
  // Natural notes
  for (const [step, semi] of Object.entries(STEP_TO_SEMITONE)) {
    if (semi === semitone) return { step, octave, alter: 0 }
  }
  // Accidentals — sharp or flat depending on preference
  if (preferFlats) {
    // Find the note above with flat
    for (const [step, semi] of Object.entries(STEP_TO_SEMITONE)) {
      if (semi === semitone + 1) return { step, octave, alter: -1 }
    }
  } else {
    // Find the note below with sharp
    for (const [step, semi] of Object.entries(STEP_TO_SEMITONE)) {
      if (semi === semitone - 1) return { step, octave, alter: 1 }
    }
  }
  throw new Error(`midiToPitch: unreachable semitone ${semitone}`)
}

export function stepDiatonic(p: Pitch, steps: number): Pitch {
  const idx = DIATONIC_STEPS.indexOf(p.step)
  const newIdx = idx + steps
  const octaveShift = Math.floor(newIdx / 7)
  const wrappedIdx = ((newIdx % 7) + 7) % 7
  return {
    step: DIATONIC_STEPS[wrappedIdx],
    octave: p.octave + octaveShift,
    alter: 0,
  }
}

export function midiToFret(midi: number, tuning: readonly number[]): FretPosition[] {
  const positions: FretPosition[] = []
  for (let s = 0; s < tuning.length; s++) {
    const fret = midi - tuning[s]
    if (fret >= 0 && fret <= 12) {
      positions.push({ string: s + 1, fret })
    }
  }
  return positions
}

export function fretToMidi(string: number, fret: number, tuning: readonly number[]): number {
  if (string < 1 || string > tuning.length) {
    throw new RangeError(`fretToMidi: string ${string} out of range (1-${tuning.length})`)
  }
  return tuning[string - 1] + fret
}
