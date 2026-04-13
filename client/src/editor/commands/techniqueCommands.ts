/**
 * Technique commands — toggle or set expressive techniques on NoteNode /
 * BeatNode fields.
 *
 * Pattern: every command stores (loc, value, oldValue). Invert swaps them.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { SlideType, BendPoint, VibratoType, HarmonicType, AccentType, StrokeType, DynamicsValue } from '../ast/types'
import { updateBeat, updateVoice } from './helpers'

// ---------------------------------------------------------------------------
// Shared location types
// ---------------------------------------------------------------------------

interface NoteLocation {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
  noteId: string
}

interface BeatOnlyLocation {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
}

// ---------------------------------------------------------------------------
// Generic factory helpers (reduces boilerplate)
// ---------------------------------------------------------------------------

function updateNoteField<K extends keyof import('../ast/types').NoteNode>(
  ctx: CommandContext,
  loc: NoteLocation,
  field: K,
  value: import('../ast/types').NoteNode[K],
): import('../ast/types').ScoreNode {
  return updateBeat(
    ctx.score,
    loc.trackId,
    loc.barId,
    loc.voiceId,
    loc.beatId,
    (beat) => ({
      ...beat,
      notes: beat.notes.map((n) =>
        n.id === loc.noteId ? { ...n, [field]: value } : n,
      ),
    }),
  )
}

function updateBeatField<K extends keyof import('../ast/types').BeatNode>(
  ctx: CommandContext,
  loc: BeatOnlyLocation,
  field: K,
  value: import('../ast/types').BeatNode[K],
): import('../ast/types').ScoreNode {
  return updateVoice(
    ctx.score,
    loc.trackId,
    loc.barId,
    loc.voiceId,
    (voice) => ({
      ...voice,
      beats: voice.beats.map((b) =>
        b.id === loc.beatId ? { ...b, [field]: value } : b,
      ),
    }),
  )
}

// ---------------------------------------------------------------------------
// SetHammerOn
// ---------------------------------------------------------------------------

export class SetHammerOn implements Command {
  readonly type = 'SetHammerOn'
  readonly label = 'Set hammer-on / pull-off'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'hammerOrPull', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetHammerOn(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetPullOff — alias pointing at same field (hammerOrPull is context-dependent)
// ---------------------------------------------------------------------------

export class SetPullOff implements Command {
  readonly type = 'SetPullOff'
  readonly label = 'Set pull-off'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'hammerOrPull', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetPullOff(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetSlide
// ---------------------------------------------------------------------------

export class SetSlide implements Command {
  readonly type = 'SetSlide'
  readonly label = 'Set slide'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: SlideType | undefined,
    private readonly oldValue: SlideType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'slide', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetSlide(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetBend
// ---------------------------------------------------------------------------

export class SetBend implements Command {
  readonly type = 'SetBend'
  readonly label = 'Set bend'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: BendPoint[] | undefined,
    private readonly oldValue: BendPoint[] | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'bend', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetBend(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      value: (this.value as unknown as Json) ?? null,
      oldValue: (this.oldValue as unknown as Json) ?? null,
    }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetVibrato
// ---------------------------------------------------------------------------

export class SetVibrato implements Command {
  readonly type = 'SetVibrato'
  readonly label = 'Set vibrato'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: VibratoType | undefined,
    private readonly oldValue: VibratoType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'vibrato', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetVibrato(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetHarmonic
// ---------------------------------------------------------------------------

export class SetHarmonic implements Command {
  readonly type = 'SetHarmonic'
  readonly label = 'Set harmonic'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: HarmonicType | undefined,
    private readonly oldValue: HarmonicType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'harmonic', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetHarmonic(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetTie
// ---------------------------------------------------------------------------

export class SetTie implements Command {
  readonly type = 'SetTie'
  readonly label = 'Set tie'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'tie', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTie(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetGhost
// ---------------------------------------------------------------------------

export class SetGhost implements Command {
  readonly type = 'SetGhost'
  readonly label = 'Set ghost note'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'ghost', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetGhost(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetDeadNote
// ---------------------------------------------------------------------------

export class SetDeadNote implements Command {
  readonly type = 'SetDeadNote'
  readonly label = 'Set dead note'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'dead', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetDeadNote(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetTap
// ---------------------------------------------------------------------------

export class SetTap implements Command {
  readonly type = 'SetTap'
  readonly label = 'Set tap'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    // tap lives on BeatNode in the AST types
    const score = updateBeatField(ctx, this.loc, 'tap', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTap(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetPalmMute (beat-level)
// ---------------------------------------------------------------------------

export class SetPalmMute implements Command {
  readonly type = 'SetPalmMute'
  readonly label = 'Set palm mute'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    // palmMute is on NoteNode; apply to all notes in the beat as a beat-level effect
    const score = updateBeat(
      ctx.score,
      this.loc.trackId,
      this.loc.barId,
      this.loc.voiceId,
      this.loc.beatId,
      (beat) => ({
        ...beat,
        notes: beat.notes.map((n) => ({ ...n, palmMute: this.value })),
      }),
    )
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetPalmMute(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetLetRing (beat-level)
// ---------------------------------------------------------------------------

export class SetLetRing implements Command {
  readonly type = 'SetLetRing'
  readonly label = 'Set let ring'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeat(
      ctx.score,
      this.loc.trackId,
      this.loc.barId,
      this.loc.voiceId,
      this.loc.beatId,
      (beat) => ({
        ...beat,
        notes: beat.notes.map((n) => ({ ...n, letRing: this.value })),
      }),
    )
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetLetRing(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetAccent (beat-level)
// ---------------------------------------------------------------------------

export class SetAccent implements Command {
  readonly type = 'SetAccent'
  readonly label = 'Set accent'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: AccentType | undefined,
    private readonly oldValue: AccentType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeat(
      ctx.score,
      this.loc.trackId,
      this.loc.barId,
      this.loc.voiceId,
      this.loc.beatId,
      (beat) => ({
        ...beat,
        notes: beat.notes.map((n) => ({ ...n, accent: this.value })),
      }),
    )
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetAccent(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetStroke (beat-level)
// ---------------------------------------------------------------------------

export class SetStroke implements Command {
  readonly type = 'SetStroke'
  readonly label = 'Set pick stroke'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: StrokeType | undefined,
    private readonly oldValue: StrokeType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'pickStroke', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetStroke(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetDynamics (beat-level)
// ---------------------------------------------------------------------------

export class SetDynamics implements Command {
  readonly type = 'SetDynamics'
  readonly label = 'Set dynamics'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: DynamicsValue | undefined,
    private readonly oldValue: DynamicsValue | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'dynamics', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetDynamics(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}
