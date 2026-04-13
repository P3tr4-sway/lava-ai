/**
 * Selection-level commands: BulkTranspose, BulkShiftString, DeleteSelection,
 * BulkSetDuration, CopySelection, PasteSelection.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { BeatNode, DurationNode } from '../ast/types'
import { insertAt, updateVoice } from './helpers'
import { InsertBeat } from './beatCommands'
import { CompositeCommand } from '../history/History'

// ---------------------------------------------------------------------------
// BulkTranspose
// ---------------------------------------------------------------------------

/** A reference to a single beat within the score. */
export interface BeatRef {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
}

export class BulkTranspose implements Command {
  readonly type = 'BulkTranspose'
  readonly label = 'Transpose'

  constructor(
    private readonly beats: BeatRef[],
    /** Number of frets to shift (positive = up, negative = down) */
    private readonly delta: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    let score = ctx.score
    const affectedBarIds = new Set<string>()

    for (const ref of this.beats) {
      score = updateVoice(score, ref.trackId, ref.barId, ref.voiceId, (voice) => ({
        ...voice,
        beats: voice.beats.map((beat) => {
          if (beat.id !== ref.beatId) return beat
          return {
            ...beat,
            notes: beat.notes.map((note) => ({
              ...note,
              fret: Math.max(0, note.fret + this.delta),
            })),
          }
        }),
      }))
      affectedBarIds.add(ref.barId)
    }

    return { score, affectedBarIds: [...affectedBarIds] }
  }

  invert(_ctx: CommandContext): Command {
    return new BulkTranspose(this.beats, -this.delta)
  }

  serialize(): Json {
    return {
      type: this.type,
      beats: this.beats as unknown as Json,
      delta: this.delta,
    }
  }

  affectedBarIds(): string[] {
    return [...new Set(this.beats.map((b) => b.barId))]
  }
}

// ---------------------------------------------------------------------------
// BulkShiftString
// ---------------------------------------------------------------------------

export class BulkShiftString implements Command {
  readonly type = 'BulkShiftString'
  readonly label = 'Shift string'

  constructor(
    private readonly beats: BeatRef[],
    /** Number of strings to shift (+1 = toward higher-numbered string) */
    private readonly delta: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    let score = ctx.score
    const affectedBarIds = new Set<string>()

    for (const ref of this.beats) {
      score = updateVoice(score, ref.trackId, ref.barId, ref.voiceId, (voice) => ({
        ...voice,
        beats: voice.beats.map((beat) => {
          if (beat.id !== ref.beatId) return beat
          return {
            ...beat,
            notes: beat.notes.map((note) => ({
              ...note,
              string: Math.max(1, note.string + this.delta),
            })),
          }
        }),
      }))
      affectedBarIds.add(ref.barId)
    }

    return { score, affectedBarIds: [...affectedBarIds] }
  }

  invert(_ctx: CommandContext): Command {
    return new BulkShiftString(this.beats, -this.delta)
  }

  serialize(): Json {
    return {
      type: this.type,
      beats: this.beats as unknown as Json,
      delta: this.delta,
    }
  }

  affectedBarIds(): string[] {
    return [...new Set(this.beats.map((b) => b.barId))]
  }
}

// ---------------------------------------------------------------------------
// DeleteSelection
// ---------------------------------------------------------------------------

/** Captures a beat and its index for undo. */
interface DeletedBeat {
  ref: BeatRef
  beat: BeatNode
  index: number
}

export class DeleteSelection implements Command {
  readonly type = 'DeleteSelection'
  readonly label = 'Delete selection'

  private _deleted: DeletedBeat[] = []

  constructor(private readonly beats: BeatRef[]) {}

  execute(ctx: CommandContext): CommandResult {
    let score = ctx.score
    const affectedBarIds = new Set<string>()
    this._deleted = []

    // Group by voice key
    const grouped = groupByVoice(this.beats)

    for (const [key, refs] of grouped) {
      const parts = key.split('|')
      const trackId = parts[0]
      const barId = parts[1]
      const voiceId = parts[2]

      // Collect indices in descending order so removal doesn't shift later indices
      const voiceBeats = getVoiceBeats(score, trackId, barId, voiceId)
      if (!voiceBeats) continue

      const toDelete: Array<{ idx: number; ref: BeatRef }> = []
      for (const ref of refs) {
        const idx = voiceBeats.findIndex((b) => b.id === ref.beatId)
        if (idx !== -1) toDelete.push({ idx, ref })
      }
      toDelete.sort((a, b) => b.idx - a.idx) // descending

      for (const { idx, ref } of toDelete) {
        const beats = getVoiceBeats(score, trackId, barId, voiceId)
        if (!beats || idx >= beats.length) continue
        this._deleted.push({ ref, beat: beats[idx], index: idx })
        score = updateVoice(score, trackId, barId, voiceId, (voice) => ({
          ...voice,
          beats: voice.beats.filter((b) => b.id !== ref.beatId),
        }))
        affectedBarIds.add(barId)
      }
    }

    return { score, affectedBarIds: [...affectedBarIds] }
  }

  invert(_ctx: CommandContext): Command {
    // Re-insert in original ascending-index order
    const sorted = [...this._deleted].sort((a, b) => a.index - b.index)
    const cmds: Command[] = sorted.map(
      ({ ref, beat, index }) =>
        new InsertBeat(
          { trackId: ref.trackId, barId: ref.barId, voiceId: ref.voiceId },
          beat,
          index,
        ),
    )
    return new CompositeCommand(cmds, 'Restore deleted beats')
  }

  serialize(): Json {
    return {
      type: this.type,
      beats: this.beats as unknown as Json,
    }
  }

  affectedBarIds(): string[] {
    return [...new Set(this.beats.map((b) => b.barId))]
  }
}

// ---------------------------------------------------------------------------
// BulkSetDuration
// ---------------------------------------------------------------------------

export interface BeatDurationEntry {
  ref: BeatRef
  duration: DurationNode
  oldDuration: DurationNode
}

export class BulkSetDuration implements Command {
  readonly type = 'BulkSetDuration'
  readonly label = 'Set duration'

  constructor(private readonly entries: BeatDurationEntry[]) {}

  execute(ctx: CommandContext): CommandResult {
    let score = ctx.score
    const affectedBarIds = new Set<string>()

    for (const { ref, duration } of this.entries) {
      score = updateVoice(score, ref.trackId, ref.barId, ref.voiceId, (voice) => ({
        ...voice,
        beats: voice.beats.map((b) =>
          b.id === ref.beatId ? { ...b, duration } : b,
        ),
      }))
      affectedBarIds.add(ref.barId)
    }

    return { score, affectedBarIds: [...affectedBarIds] }
  }

  invert(_ctx: CommandContext): Command {
    const inverted: BeatDurationEntry[] = this.entries.map(({ ref, duration, oldDuration }) => ({
      ref,
      duration: oldDuration,
      oldDuration: duration,
    }))
    return new BulkSetDuration(inverted)
  }

  serialize(): Json {
    return {
      type: this.type,
      entries: this.entries as unknown as Json,
    }
  }

  affectedBarIds(): string[] {
    return [...new Set(this.entries.map((e) => e.ref.barId))]
  }
}

// ---------------------------------------------------------------------------
// CopySelection — no AST mutation, writes clipboard only
// ---------------------------------------------------------------------------

export class CopySelection implements Command {
  readonly type = 'CopySelection'
  readonly label = 'Copy'

  private readonly copiedBeats: BeatNode[]

  constructor(
    private readonly beats: BeatRef[],
    copiedBeats: BeatNode[],
  ) {
    this.copiedBeats = copiedBeats
  }

  execute(ctx: CommandContext): CommandResult {
    // No AST mutation — clipboard is handled by the caller
    return { score: ctx.score, affectedBarIds: [] }
  }

  invert(_ctx: CommandContext): Command {
    // No undo needed — copy is idempotent
    return this
  }

  serialize(): Json {
    return {
      type: this.type,
      beats: this.beats as unknown as Json,
      copiedBeats: this.copiedBeats as unknown as Json,
    }
  }

  affectedBarIds(): string[] {
    return []
  }

  getCopiedBeats(): BeatNode[] {
    return this.copiedBeats
  }
}

// ---------------------------------------------------------------------------
// PasteSelection
// ---------------------------------------------------------------------------

export class PasteSelection implements Command {
  readonly type = 'PasteSelection'
  readonly label = 'Paste'

  private _insertedRefs: BeatRef[] = []

  constructor(
    private readonly targetLoc: { trackId: string; barId: string; voiceId: string },
    private readonly insertIndex: number,
    private readonly beats: BeatNode[],
    private readonly newIds: string[],
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId } = this.targetLoc
    this._insertedRefs = []

    let score = ctx.score
    for (let i = 0; i < this.beats.length; i++) {
      const beat = { ...this.beats[i], id: this.newIds[i] }
      const insertIdx = this.insertIndex + i
      score = updateVoice(score, trackId, barId, voiceId, (voice) => ({
        ...voice,
        beats: insertAt(voice.beats, insertIdx, beat),
      }))
      this._insertedRefs.push({ trackId, barId, voiceId, beatId: this.newIds[i] })
    }

    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new DeleteSelection(
      this._insertedRefs.length > 0 ? this._insertedRefs : [],
    )
  }

  serialize(): Json {
    return {
      type: this.type,
      targetLoc: this.targetLoc,
      insertIndex: this.insertIndex,
      beats: this.beats as unknown as Json,
      newIds: this.newIds,
    }
  }

  affectedBarIds(): string[] {
    return [this.targetLoc.barId]
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function groupByVoice(refs: BeatRef[]): Map<string, BeatRef[]> {
  const map = new Map<string, BeatRef[]>()
  for (const ref of refs) {
    const key = `${ref.trackId}|${ref.barId}|${ref.voiceId}`
    const list = map.get(key) ?? []
    list.push(ref)
    map.set(key, list)
  }
  return map
}

function getVoiceBeats(
  score: import('../ast/types').ScoreNode,
  trackId: string,
  barId: string,
  voiceId: string,
): BeatNode[] | undefined {
  const track = score.tracks.find((t) => t.id === trackId)
  if (!track) return undefined
  for (const staff of track.staves) {
    const bar = staff.bars.find((b) => b.id === barId)
    if (!bar) continue
    const voice = bar.voices.find((v) => v.id === voiceId)
    if (voice) return voice.beats
  }
  return undefined
}
