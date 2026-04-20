/**
 * Tie resolution — Sibelius rule: pressing "tie" on note A links A into the
 * NEXT same-pitch note in the same voice. May cross a bar line. Never ties
 * into a rest. This module is pure (no React) so both the toolbar and the
 * keyboard shortcut dispatcher can share it.
 *
 * Ref: docs/sibelius §2.32 Ties; guitar_notation_rules §"tie endpoints have
 * matching pitch" (hard constraint).
 */

import type { BarNode, BeatNode, NoteNode, ScoreNode, VoiceNode } from './types'

export interface TieTargetLocation {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
  noteId: string
}

export interface TieTarget {
  /** Destination note whose `tie` flag should be toggled. */
  destLoc: TieTargetLocation
  /** The destination note (read-only view). */
  dest: NoteNode
  /** Which bar index (into staff.bars) the destination lives in. */
  destBarIndex: number
}

export type TieResolution =
  | { ok: true; target: TieTarget }
  | { ok: false; reason: 'no-source' | 'no-next-beat' | 'rest' | 'pitch-mismatch'; message: string }

/**
 * Walk forward through the voice to find the first beat that follows the
 * source position. Returns null at end-of-track.
 */
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

  // 1) Same bar, next beat in same voice.
  const currentBar = staff.bars[barIndex]
  const currentVoice = currentBar?.voices[voiceIndex]
  const sameBarNext = currentVoice?.beats[beatIndex + 1]
  if (currentBar && currentVoice && sameBarNext) {
    return { bar: currentBar, voice: currentVoice, beat: sameBarNext, barIndex }
  }

  // 2) Walk forward through subsequent bars, take first beat of matching voice.
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
 * Resolve the tie target for a source note identified by cursor indices plus
 * string number. Returns ok/error with a human-readable message suitable for
 * a toast.
 */
export function resolveTieTarget(
  ast: ScoreNode,
  trackIndex: number,
  barIndex: number,
  voiceIndex: number,
  beatIndex: number,
  stringIndex: number,
): TieResolution {
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
      message: 'Tie needs a following note — add a beat/bar first.',
    }
  }

  if (next.beat.rest) {
    return { ok: false, reason: 'rest', message: 'Tie cannot connect to a rest.' }
  }

  const dest = next.beat.notes.find((n) => n.string === src.string && n.fret === src.fret)
  if (!dest) {
    return {
      ok: false,
      reason: 'pitch-mismatch',
      message: `Tie requires the next note on string ${src.string} fret ${src.fret}.`,
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
