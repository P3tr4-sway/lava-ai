/**
 * Bar-level commands: InsertBar, DeleteBar, SetTimeSignature,
 * SetKeySignature, SetBarTempo, SetRepeat.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { BarNode, RepeatMarker } from '../ast/types'
import { insertAt, removeAt, updateTrack } from './helpers'

// ---------------------------------------------------------------------------
// InsertBar
// ---------------------------------------------------------------------------

export class InsertBar implements Command {
  readonly type = 'InsertBar'
  readonly label = 'Insert bar'

  constructor(
    private readonly trackId: string,
    private readonly staffIndex: number,
    private readonly bar: BarNode,
    private readonly index: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateTrack(ctx.score, this.trackId, (track) => ({
      ...track,
      staves: track.staves.map((staff, si) =>
        si === this.staffIndex
          ? { ...staff, bars: insertAt(staff.bars, this.index, this.bar) }
          : staff,
      ),
    }))
    return { score, affectedBarIds: [this.bar.id] }
  }

  invert(_ctx: CommandContext): Command {
    return new DeleteBar(this.trackId, this.staffIndex, this.bar.id)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      staffIndex: this.staffIndex,
      bar: this.bar as unknown as Json,
      index: this.index,
    }
  }

  affectedBarIds(): string[] {
    return [this.bar.id]
  }
}

// ---------------------------------------------------------------------------
// DeleteBar
// ---------------------------------------------------------------------------

export class DeleteBar implements Command {
  readonly type = 'DeleteBar'
  readonly label = 'Delete bar'

  private _deletedBar: BarNode | undefined
  private _deletedIndex: number = 0

  constructor(
    private readonly trackId: string,
    private readonly staffIndex: number,
    private readonly barId: string,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const track = ctx.score.tracks.find((t) => t.id === this.trackId)
    if (!track) return { score: ctx.score, affectedBarIds: [] }
    const staff = track.staves[this.staffIndex]
    if (!staff) return { score: ctx.score, affectedBarIds: [] }

    const idx = staff.bars.findIndex((b) => b.id === this.barId)
    if (idx === -1) return { score: ctx.score, affectedBarIds: [] }

    this._deletedBar = staff.bars[idx]
    this._deletedIndex = idx

    const score = updateTrack(ctx.score, this.trackId, (t) => ({
      ...t,
      staves: t.staves.map((s, si) =>
        si === this.staffIndex
          ? { ...s, bars: removeAt(s.bars, idx) }
          : s,
      ),
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    if (this._deletedBar) {
      return new InsertBar(
        this.trackId,
        this.staffIndex,
        this._deletedBar,
        this._deletedIndex,
      )
    }
    // Fallback: empty bar
    const emptyBar: BarNode = {
      id: this.barId,
      voices: [],
    }
    return new InsertBar(this.trackId, this.staffIndex, emptyBar, 0)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      staffIndex: this.staffIndex,
      barId: this.barId,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}

// ---------------------------------------------------------------------------
// SetTimeSignature
// ---------------------------------------------------------------------------

export class SetTimeSignature implements Command {
  readonly type = 'SetTimeSignature'
  readonly label = 'Set time signature'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly timeSignature: { numerator: number; denominator: number } | undefined,
    private readonly oldTimeSignature: { numerator: number; denominator: number } | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      timeSignature: this.timeSignature,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTimeSignature(
      this.trackId,
      this.barId,
      this.oldTimeSignature,
      this.timeSignature,
    )
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      timeSignature: this.timeSignature ?? null,
      oldTimeSignature: this.oldTimeSignature ?? null,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}

// ---------------------------------------------------------------------------
// SetKeySignature
// ---------------------------------------------------------------------------

export class SetKeySignature implements Command {
  readonly type = 'SetKeySignature'
  readonly label = 'Set key signature'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly keySignature: string | undefined,
    private readonly oldKeySignature: string | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      keySignature: this.keySignature,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetKeySignature(
      this.trackId,
      this.barId,
      this.oldKeySignature,
      this.keySignature,
    )
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      keySignature: this.keySignature ?? null,
      oldKeySignature: this.oldKeySignature ?? null,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}

// ---------------------------------------------------------------------------
// SetBarTempo
// ---------------------------------------------------------------------------

export class SetBarTempo implements Command {
  readonly type = 'SetBarTempo'
  readonly label = 'Set bar tempo'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly tempo: number | undefined,
    private readonly oldTempo: number | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      tempo: this.tempo,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetBarTempo(this.trackId, this.barId, this.oldTempo, this.tempo)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      tempo: this.tempo ?? null,
      oldTempo: this.oldTempo ?? null,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}

// ---------------------------------------------------------------------------
// SetRepeat
// ---------------------------------------------------------------------------

export class SetRepeat implements Command {
  readonly type = 'SetRepeat'
  readonly label = 'Set repeat'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly repeat: RepeatMarker | undefined,
    private readonly oldRepeat: RepeatMarker | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      repeat: this.repeat,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetRepeat(this.trackId, this.barId, this.oldRepeat, this.repeat)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      repeat: (this.repeat as unknown as Json) ?? null,
      oldRepeat: (this.oldRepeat as unknown as Json) ?? null,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function updateBarInTrack(
  ctx: CommandContext,
  trackId: string,
  barId: string,
  fn: (bar: BarNode) => BarNode,
): import('../ast/types').ScoreNode {
  return updateTrack(ctx.score, trackId, (track) => ({
    ...track,
    staves: track.staves.map((staff) => ({
      ...staff,
      bars: staff.bars.map((bar) => (bar.id === barId ? fn(bar) : bar)),
    })),
  }))
}
