/**
 * Track-level commands: InsertTrack, DeleteTrack, SetTuning, SetCapo,
 * RenameTrack.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { TrackNode } from '../ast/types'
import { insertAt, removeAt } from './helpers'

// ---------------------------------------------------------------------------
// InsertTrack
// ---------------------------------------------------------------------------

export class InsertTrack implements Command {
  readonly type = 'InsertTrack'
  readonly label = 'Insert track'

  constructor(
    private readonly track: TrackNode,
    private readonly index: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = {
      ...ctx.score,
      tracks: insertAt(ctx.score.tracks, this.index, this.track),
    }
    const barIds = this.track.staves.flatMap((s) => s.bars.map((b) => b.id))
    return { score, affectedBarIds: barIds }
  }

  invert(_ctx: CommandContext): Command {
    return new DeleteTrack(this.track.id)
  }

  serialize(): Json {
    return {
      type: this.type,
      track: this.track as unknown as Json,
      index: this.index,
    }
  }

  affectedBarIds(): string[] {
    return this.track.staves.flatMap((s) => s.bars.map((b) => b.id))
  }
}

// ---------------------------------------------------------------------------
// DeleteTrack
// ---------------------------------------------------------------------------

export class DeleteTrack implements Command {
  readonly type = 'DeleteTrack'
  readonly label = 'Delete track'

  private _deletedTrack: TrackNode | undefined
  private _deletedIndex: number = 0

  constructor(private readonly trackId: string) {}

  execute(ctx: CommandContext): CommandResult {
    const idx = ctx.score.tracks.findIndex((t) => t.id === this.trackId)
    if (idx === -1) return { score: ctx.score, affectedBarIds: [] }

    this._deletedTrack = ctx.score.tracks[idx]
    this._deletedIndex = idx

    const barIds = this._deletedTrack.staves.flatMap((s) => s.bars.map((b) => b.id))
    const score = {
      ...ctx.score,
      tracks: removeAt(ctx.score.tracks, idx),
    }
    return { score, affectedBarIds: barIds }
  }

  invert(_ctx: CommandContext): Command {
    if (this._deletedTrack) {
      return new InsertTrack(this._deletedTrack, this._deletedIndex)
    }
    // Can't reconstruct — no-op
    const emptyTrack: TrackNode = {
      id: this.trackId,
      name: '',
      instrument: 25,
      tuning: [40, 45, 50, 55, 59, 64],
      capo: 0,
      chordDefs: [],
      staves: [],
    }
    return new InsertTrack(emptyTrack, 0)
  }

  serialize(): Json {
    return { type: this.type, trackId: this.trackId }
  }

  affectedBarIds(): string[] {
    return (
      this._deletedTrack?.staves.flatMap((s) => s.bars.map((b) => b.id)) ?? []
    )
  }
}

// ---------------------------------------------------------------------------
// SetTuning
// ---------------------------------------------------------------------------

export class SetTuning implements Command {
  readonly type = 'SetTuning'
  readonly label = 'Set tuning'

  constructor(
    private readonly trackId: string,
    private readonly tuning: number[],
    private readonly oldTuning: number[],
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = {
      ...ctx.score,
      tracks: ctx.score.tracks.map((t) =>
        t.id === this.trackId ? { ...t, tuning: this.tuning } : t,
      ),
    }
    return { score, affectedBarIds: [] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTuning(this.trackId, this.oldTuning, this.tuning)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      tuning: this.tuning,
      oldTuning: this.oldTuning,
    }
  }

  affectedBarIds(): string[] {
    return []
  }
}

// ---------------------------------------------------------------------------
// SetCapo
// ---------------------------------------------------------------------------

export class SetCapo implements Command {
  readonly type = 'SetCapo'
  readonly label = 'Set capo'

  constructor(
    private readonly trackId: string,
    private readonly capo: number,
    private readonly oldCapo: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = {
      ...ctx.score,
      tracks: ctx.score.tracks.map((t) =>
        t.id === this.trackId ? { ...t, capo: this.capo } : t,
      ),
    }
    return { score, affectedBarIds: [] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetCapo(this.trackId, this.oldCapo, this.capo)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      capo: this.capo,
      oldCapo: this.oldCapo,
    }
  }

  affectedBarIds(): string[] {
    return []
  }

  merge(next: Command): Command | null {
    if (next instanceof SetCapo && next.trackId === this.trackId) {
      return new SetCapo(this.trackId, next.capo, this.oldCapo)
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// RenameTrack
// ---------------------------------------------------------------------------

export class RenameTrack implements Command {
  readonly type = 'RenameTrack'
  readonly label = 'Rename track'

  constructor(
    private readonly trackId: string,
    private readonly name: string,
    private readonly oldName: string,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = {
      ...ctx.score,
      tracks: ctx.score.tracks.map((t) =>
        t.id === this.trackId ? { ...t, name: this.name } : t,
      ),
    }
    return { score, affectedBarIds: [] }
  }

  invert(_ctx: CommandContext): Command {
    return new RenameTrack(this.trackId, this.oldName, this.name)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      name: this.name,
      oldName: this.oldName,
    }
  }

  affectedBarIds(): string[] {
    return []
  }

  merge(next: Command): Command | null {
    if (next instanceof RenameTrack && next.trackId === this.trackId) {
      return new RenameTrack(this.trackId, next.name, this.oldName)
    }
    return null
  }
}
