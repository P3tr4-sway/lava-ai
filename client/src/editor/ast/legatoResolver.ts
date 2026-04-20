/**
 * Legato-connector resolution — for techniques that draw an arc/line from the
 * current note into the NEXT note on the same string:
 *   - hammer-on / pull-off  (note.hammerOrPull)
 *   - legato slide          (note.slide = 'legato')
 *   - shift slide           (note.slide = 'shift')
 *
 * These differ from tie in that:
 *   - they do NOT require same pitch (typically require different fret)
 *   - the flag lives on the SOURCE note (not the destination) — so the
 *     resolver's job is only to answer "does the outgoing arc have a valid
 *     landing target?" before we write the flag.
 *
 * Self-contained decorative slides (`intoFromBelow`, `intoFromAbove`,
 * `outUp`, `outDown`, pick slides) do NOT need this resolver — they are
 * purely note-local and never fail.
 *
 * Ref: Sibelius §2.28 Slurs (hammer-on/pull-off notated as slur between
 * different pitches); guitar_notation_rules §Common Guitar Technique Notation.
 */

import type { BarNode, BeatNode, NoteNode, ScoreNode, VoiceNode } from './types'

export interface LegatoTargetLocation {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
  noteId: string
}

export interface LegatoTarget {
  /** Destination note the arc lands on. */
  destLoc: LegatoTargetLocation
  dest: NoteNode
  /** Which bar index the destination lives in. */
  destBarIndex: number
}

export type LegatoResolution =
  | { ok: true; target: LegatoTarget }
  | {
      ok: false
      reason: 'no-source' | 'no-next-beat' | 'rest' | 'no-same-string-note'
      message: string
    }

function findNextBeat(
  ast: ScoreNode,
  trackIndex: number,
  barIndex: number,
  voiceIndex: number,
  beatIndex: number,
): { bar: BarNode; voice: VoiceNode; beat: BeatNode; barIndex: number } | null {
  const track = ast.tracks[trackIndex]
  const staff = track?.staves[0]
  if (!staff) return null

  const currentBar = staff.bars[barIndex]
  const currentVoice = currentBar?.voices[voiceIndex]
  const sameBarNext = currentVoice?.beats[beatIndex + 1]
  if (currentBar && currentVoice && sameBarNext) {
    return { bar: currentBar, voice: currentVoice, beat: sameBarNext, barIndex }
  }

  for (let bi = barIndex + 1; bi < staff.bars.length; bi++) {
    const bar = staff.bars[bi]
    const voice = bar.voices[voiceIndex]
    const firstBeat = voice?.beats[0]
    if (bar && voice && firstBeat) {
      return { bar, voice, beat: firstBeat, barIndex: bi }
    }
  }
  return null
}

/**
 * Resolve the connecting-technique landing note for a source note identified
 * by cursor indices + string. Success requires a non-rest next beat with a
 * note on the SAME string (fret may differ or be equal — caller decides).
 */
export function resolveLegatoTarget(
  ast: ScoreNode,
  trackIndex: number,
  barIndex: number,
  voiceIndex: number,
  beatIndex: number,
  stringIndex: number,
): LegatoResolution {
  const track = ast.tracks[trackIndex]
  const bar = track?.staves[0]?.bars[barIndex]
  const voice = bar?.voices[voiceIndex]
  const beat = voice?.beats[beatIndex]
  const src = beat?.notes.find((n) => n.string === stringIndex)
  if (!track || !bar || !voice || !beat || !src) {
    return { ok: false, reason: 'no-source', message: 'Select a note first.' }
  }

  const next = findNextBeat(ast, trackIndex, barIndex, voiceIndex, beatIndex)
  if (!next) {
    return {
      ok: false,
      reason: 'no-next-beat',
      message: 'This technique needs a following note — add a beat/bar first.',
    }
  }

  if (next.beat.rest) {
    return {
      ok: false,
      reason: 'rest',
      message: 'Cannot connect into a rest.',
    }
  }

  const dest = next.beat.notes.find((n) => n.string === src.string)
  if (!dest) {
    return {
      ok: false,
      reason: 'no-same-string-note',
      message: `Needs a note on string ${src.string} in the next beat.`,
    }
  }

  return {
    ok: true,
    target: {
      destLoc: {
        trackId: track.id,
        barId: next.bar.id,
        voiceId: next.voice.id,
        beatId: next.beat.id,
        noteId: dest.id,
      },
      dest,
      destBarIndex: next.barIndex,
    },
  }
}
