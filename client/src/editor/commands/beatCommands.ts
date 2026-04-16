/**
 * Beat-level commands: InsertBeat, DeleteBeat, SetDuration, ToggleDot,
 * SetTuplet, SetRest.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { BeatNode, DurationNode, Duration } from '../ast/types'
import { insertAt, removeAt, updateVoice } from './helpers'
import {
  durationToUnits,
  voiceUsedUnits,
  barCapacityUnits,
  getEffectiveTimeSig,
  findBarPosition,
} from '../ast/barFill'

// ---------------------------------------------------------------------------
// Shared payload
// ---------------------------------------------------------------------------

interface BeatLocation {
  trackId: string
  barId: string
  voiceId: string
}

// ---------------------------------------------------------------------------
// InsertBeat
// ---------------------------------------------------------------------------

export class InsertBeat implements Command {
  readonly type = 'InsertBeat'
  readonly label = 'Insert beat'

  constructor(
    private readonly loc: BeatLocation,
    private readonly beat: BeatNode,
    private readonly index: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId } = this.loc

    // Capacity guard: refuse to insert a beat that would overflow the bar.
    // commitFret already manages capacity for note entry; this guard protects
    // all other callers (bulk operations, paste, etc.).
    const pos = findBarPosition(ctx.score, barId)
    if (pos) {
      const timeSig = getEffectiveTimeSig(ctx.score, pos.trackIndex, pos.barIndex)
      const cap = barCapacityUnits(timeSig)
      const track = ctx.score.tracks.find((t) => t.id === trackId)
      const bar = track?.staves[0]?.bars.find((b) => b.id === barId)
      const voice = bar?.voices.find((v) => v.id === voiceId)
      if (voice && voiceUsedUnits(voice) + durationToUnits(this.beat.duration) > cap) {
        return { score: ctx.score, affectedBarIds: [] }
      }
    }

    const score = updateVoice(ctx.score, trackId, barId, voiceId, (voice) => ({
      ...voice,
      beats: insertAt(voice.beats, this.index, this.beat),
    }))
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new DeleteBeat(this.loc, this.beat.id)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      beat: this.beat as unknown as Json,
      index: this.index,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// DeleteBeat
// ---------------------------------------------------------------------------

export class DeleteBeat implements Command {
  readonly type = 'DeleteBeat'
  readonly label = 'Delete beat'

  private _deletedBeat: BeatNode | undefined
  private _deletedIndex: number = 0

  constructor(
    private readonly loc: BeatLocation,
    private readonly beatId: string,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId } = this.loc
    let idx = -1
    let deleted: BeatNode | undefined

    const track = ctx.score.tracks.find((t) => t.id === trackId)
    if (track) {
      for (const staff of track.staves) {
        const bar = staff.bars.find((b) => b.id === barId)
        if (bar) {
          const voice = bar.voices.find((v) => v.id === voiceId)
          if (voice) {
            idx = voice.beats.findIndex((b) => b.id === this.beatId)
            deleted = voice.beats[idx]
          }
        }
      }
    }

    if (idx === -1 || !deleted) {
      return { score: ctx.score, affectedBarIds: [] }
    }

    this._deletedBeat = deleted
    this._deletedIndex = idx

    const score = updateVoice(ctx.score, trackId, barId, voiceId, (voice) => ({
      ...voice,
      beats: removeAt(voice.beats, idx),
    }))
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    if (this._deletedBeat) {
      return new InsertBeat(this.loc, this._deletedBeat, this._deletedIndex)
    }
    const defaultBeat: BeatNode = {
      id: this.beatId,
      duration: { value: 4, dots: 0 },
      notes: [],
    }
    return new InsertBeat(this.loc, defaultBeat, 0)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, beatId: this.beatId }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// SetDuration
// ---------------------------------------------------------------------------

export class SetDuration implements Command {
  readonly type = 'SetDuration'
  readonly label = 'Set duration'

  constructor(
    private readonly loc: BeatLocation & { beatId: string },
    private readonly duration: DurationNode,
    private readonly oldDuration: DurationNode,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId } = this.loc
    const score = updateVoice(ctx.score, trackId, barId, voiceId, (voice) => ({
      ...voice,
      beats: voice.beats.map((b) =>
        b.id === beatId ? { ...b, duration: this.duration } : b,
      ),
    }))
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetDuration(this.loc, this.oldDuration, this.duration)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      duration: this.duration as unknown as Json,
      oldDuration: this.oldDuration as unknown as Json,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }

  merge(next: Command): Command | null {
    if (
      next instanceof SetDuration &&
      next.loc.beatId === this.loc.beatId
    ) {
      return new SetDuration(this.loc, next.duration, this.oldDuration)
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// ToggleDot
// ---------------------------------------------------------------------------

const DOT_CYCLE: Array<0 | 1 | 2> = [0, 1, 2]

export class ToggleDot implements Command {
  readonly type = 'ToggleDot'
  readonly label = 'Toggle dot'

  constructor(
    private readonly loc: BeatLocation & { beatId: string },
    /** +1 = forward cycle, -1 = reverse (for invert) */
    private readonly step: 1 | -1 = 1,
  ) {}

  private nextDots(current: 0 | 1 | 2): 0 | 1 | 2 {
    if (this.step === 1) {
      return DOT_CYCLE[(DOT_CYCLE.indexOf(current) + 1) % 3]
    }
    return DOT_CYCLE[(DOT_CYCLE.indexOf(current) + 2) % 3]
  }

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId } = this.loc
    const score = updateVoice(ctx.score, trackId, barId, voiceId, (voice) => ({
      ...voice,
      beats: voice.beats.map((b) =>
        b.id === beatId
          ? {
              ...b,
              duration: {
                ...b.duration,
                dots: this.nextDots(b.duration.dots),
              },
            }
          : b,
      ),
    }))
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    const invertedStep: 1 | -1 = this.step === 1 ? -1 : 1
    return new ToggleDot(this.loc, invertedStep)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, step: this.step }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// SetTuplet
// ---------------------------------------------------------------------------

export class SetTuplet implements Command {
  readonly type = 'SetTuplet'
  readonly label = 'Set tuplet'

  constructor(
    private readonly loc: BeatLocation & { beatId: string },
    private readonly tuplet: { numerator: number; denominator: number } | undefined,
    private readonly oldTuplet: { numerator: number; denominator: number } | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId } = this.loc
    const score = updateVoice(ctx.score, trackId, barId, voiceId, (voice) => ({
      ...voice,
      beats: voice.beats.map((b) =>
        b.id === beatId
          ? { ...b, duration: { ...b.duration, tuplet: this.tuplet } }
          : b,
      ),
    }))
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTuplet(this.loc, this.oldTuplet, this.tuplet)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      tuplet: this.tuplet ?? null,
      oldTuplet: this.oldTuplet ?? null,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// SetRest
// ---------------------------------------------------------------------------

export class SetRest implements Command {
  readonly type = 'SetRest'
  readonly label = 'Set rest'

  constructor(
    private readonly loc: BeatLocation & { beatId: string },
    private readonly rest: boolean,
    private readonly oldRest: boolean,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId } = this.loc
    const score = updateVoice(ctx.score, trackId, barId, voiceId, (voice) => ({
      ...voice,
      beats: voice.beats.map((b) =>
        b.id === beatId ? { ...b, rest: this.rest } : b,
      ),
    }))
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetRest(this.loc, this.oldRest, this.rest)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      rest: this.rest,
      oldRest: this.oldRest,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// Helpers used by other command files
// ---------------------------------------------------------------------------

export function makeBeatLoc(
  trackId: string,
  barId: string,
  voiceId: string,
  beatId: string,
): BeatLocation & { beatId: string } {
  return { trackId, barId, voiceId, beatId }
}

/** Convenience: find beat current duration in score (used for invert before execute) */
export function currentBeatDuration(
  ctx: CommandContext,
  trackId: string,
  barId: string,
  voiceId: string,
  beatId: string,
): DurationNode {
  const track = ctx.score.tracks.find((t) => t.id === trackId)
  if (track) {
    for (const staff of track.staves) {
      const bar = staff.bars.find((b) => b.id === barId)
      if (bar) {
        const voice = bar.voices.find((v) => v.id === voiceId)
        if (voice) {
          const beat = voice.beats.find((b) => b.id === beatId)
          if (beat) return beat.duration
        }
      }
    }
  }
  const def: Duration = 4
  return { value: def, dots: 0 }
}
