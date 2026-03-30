import type { ScorePatch } from '@lava/shared'
import {
  setNotePitch,
  setNoteDuration,
  setChord,
  setKeySig,
  setTimeSig,
  addBars,
  deleteBars,
  transposeBars,
  addAccidental,
  toggleRest,
  toggleTie,
  setAnnotation,
  setLyric,
} from '@/lib/musicXmlEngine'

/** Duration type → divisions value mapping (assumes divisions=1 from the engine). */
const DURATION_MAP: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
}

/**
 * Apply a single ScorePatch to a MusicXML string, returning the modified XML.
 * Each `op` maps directly to a `musicXmlEngine` function.
 */
export function applyPatch(xml: string, patch: ScorePatch): string {
  switch (patch.op) {
    case 'setNotePitch':
      return setNotePitch(xml, patch.barIndex as number, patch.noteIndex as number, {
        step: patch.step as string,
        octave: patch.octave as number,
        alter: patch.alter as number | undefined,
      })

    case 'setNoteDuration': {
      const durType = patch.type as string
      const durValue = DURATION_MAP[durType] ?? 1
      return setNoteDuration(xml, patch.barIndex as number, patch.noteIndex as number, durType, durValue)
    }

    case 'setChord':
      return setChord(xml, patch.barIndex as number, patch.beat as number, patch.chordSymbol as string)

    case 'setKeySig':
      return setKeySig(xml, patch.fromBar as number, patch.key as string)

    case 'setTimeSig':
      return setTimeSig(xml, patch.fromBar as number, patch.beats as number, patch.beatType as number)

    case 'addBars':
      return addBars(xml, patch.afterIndex as number, patch.count as number)

    case 'deleteBars':
      return deleteBars(xml, patch.barIndices as number[])

    case 'transposeBars':
      return transposeBars(xml, patch.barIndices as number[], patch.semitones as number)

    case 'addAccidental':
      return addAccidental(
        xml,
        patch.barIndex as number,
        patch.noteIndex as number,
        patch.type as 'sharp' | 'flat' | 'natural',
      )

    case 'toggleRest':
      return toggleRest(xml, patch.barIndex as number, patch.noteIndex as number)

    case 'toggleTie':
      return toggleTie(xml, patch.barIndex as number, patch.noteIndex as number)

    case 'setAnnotation':
      return setAnnotation(xml, patch.barIndex as number, patch.text as string)

    case 'setLyric':
      return setLyric(xml, patch.barIndex as number, patch.noteIndex as number, patch.syllable as string)

    default:
      console.warn(`[applyPatch] Unknown op: ${patch.op}`)
      return xml
  }
}
