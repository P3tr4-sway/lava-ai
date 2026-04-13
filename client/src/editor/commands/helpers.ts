/**
 * Pure immutable AST helper functions.
 *
 * All functions return new objects without mutating the originals.
 * Uses plain spread rather than immer to keep the dependency surface minimal.
 */

import type {
  ScoreNode,
  TrackNode,
  BarNode,
  VoiceNode,
  BeatNode,
  NoteNode,
} from '../ast/types'

// ---------------------------------------------------------------------------
// Find helpers
// ---------------------------------------------------------------------------

export function findTrack(
  score: ScoreNode,
  trackId: string,
): TrackNode | undefined {
  return score.tracks.find((t) => t.id === trackId)
}

export function findBar(
  track: TrackNode,
  barId: string,
): BarNode | undefined {
  for (const staff of track.staves) {
    const bar = staff.bars.find((b) => b.id === barId)
    if (bar) return bar
  }
  return undefined
}

export function findVoice(
  bar: BarNode,
  voiceId: string,
): VoiceNode | undefined {
  return bar.voices.find((v) => v.id === voiceId)
}

export function findBeat(
  voice: VoiceNode,
  beatId: string,
): BeatNode | undefined {
  return voice.beats.find((b) => b.id === beatId)
}

export function findNote(
  beat: BeatNode,
  noteId: string,
): NoteNode | undefined {
  return beat.notes.find((n) => n.id === noteId)
}

// ---------------------------------------------------------------------------
// Update helpers — immutable tree-path updates
// ---------------------------------------------------------------------------

export function updateTrack(
  score: ScoreNode,
  trackId: string,
  fn: (track: TrackNode) => TrackNode,
): ScoreNode {
  return {
    ...score,
    tracks: score.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
  }
}

/**
 * Update a bar inside any staff of a given track.
 */
export function updateBar(
  score: ScoreNode,
  trackId: string,
  barId: string,
  fn: (bar: BarNode) => BarNode,
): ScoreNode {
  return updateTrack(score, trackId, (track) => ({
    ...track,
    staves: track.staves.map((staff) => ({
      ...staff,
      bars: staff.bars.map((bar) => (bar.id === barId ? fn(bar) : bar)),
    })),
  }))
}

export function updateVoice(
  score: ScoreNode,
  trackId: string,
  barId: string,
  voiceId: string,
  fn: (voice: VoiceNode) => VoiceNode,
): ScoreNode {
  return updateBar(score, trackId, barId, (bar) => ({
    ...bar,
    voices: bar.voices.map((v) => (v.id === voiceId ? fn(v) : v)),
  }))
}

export function updateBeat(
  score: ScoreNode,
  trackId: string,
  barId: string,
  voiceId: string,
  beatId: string,
  fn: (beat: BeatNode) => BeatNode,
): ScoreNode {
  return updateVoice(score, trackId, barId, voiceId, (voice) => ({
    ...voice,
    beats: voice.beats.map((b) => (b.id === beatId ? fn(b) : b)),
  }))
}

export function updateNote(
  score: ScoreNode,
  trackId: string,
  barId: string,
  voiceId: string,
  beatId: string,
  noteId: string,
  fn: (note: NoteNode) => NoteNode,
): ScoreNode {
  return updateBeat(score, trackId, barId, voiceId, beatId, (beat) => ({
    ...beat,
    notes: beat.notes.map((n) => (n.id === noteId ? fn(n) : n)),
  }))
}

// ---------------------------------------------------------------------------
// Insert / delete helpers
// ---------------------------------------------------------------------------

/** Insert `item` at `index` in `arr` (splice-like, immutable). */
export function insertAt<T>(arr: readonly T[], index: number, item: T): T[] {
  const clamped = Math.max(0, Math.min(arr.length, index))
  return [...arr.slice(0, clamped), item, ...arr.slice(clamped)]
}

/** Remove the item at `index` from `arr` (immutable). */
export function removeAt<T>(arr: readonly T[], index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}
