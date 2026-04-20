/**
 * Technique commands — toggle or set expressive techniques on NoteNode /
 * BeatNode fields.
 *
 * Pattern: every command stores (loc, value, oldValue). Invert swaps them.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { SlideType, BendPoint, VibratoType, HarmonicType, AccentType, StrokeType, DynamicsValue, OrnamentType, TrillNode, Duration } from '../ast/types'
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

// ---------------------------------------------------------------------------
// SetStaccato
// ---------------------------------------------------------------------------

export class SetStaccato implements Command {
  readonly type = 'SetStaccato'
  readonly label = 'Set staccato'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'staccato', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetStaccato(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetSlur
// ---------------------------------------------------------------------------

export class SetSlur implements Command {
  readonly type = 'SetSlur'
  readonly label = 'Set slur'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: number | undefined,
    private readonly oldValue: number | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'slur', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetSlur(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetTrill
// ---------------------------------------------------------------------------

export class SetTrill implements Command {
  readonly type = 'SetTrill'
  readonly label = 'Set trill'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: TrillNode | undefined,
    private readonly oldValue: TrillNode | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'trill', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTrill(this.loc, this.oldValue, this.value)
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
// SetOrnament
// ---------------------------------------------------------------------------

export class SetOrnament implements Command {
  readonly type = 'SetOrnament'
  readonly label = 'Set ornament'

  constructor(
    private readonly loc: NoteLocation,
    private readonly value: OrnamentType | undefined,
    private readonly oldValue: OrnamentType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateNoteField(ctx, this.loc, 'ornament', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetOrnament(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetCrescendo (beat-level)
// ---------------------------------------------------------------------------

export class SetCrescendo implements Command {
  readonly type = 'SetCrescendo'
  readonly label = 'Set crescendo'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'crescendo', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetCrescendo(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetDecrescendo (beat-level)
// ---------------------------------------------------------------------------

export class SetDecrescendo implements Command {
  readonly type = 'SetDecrescendo'
  readonly label = 'Set decrescendo'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: boolean | undefined,
    private readonly oldValue: boolean | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'decrescendo', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetDecrescendo(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetArpeggio (beat-level) — 'up' | 'down' | undefined, mutually exclusive
// ---------------------------------------------------------------------------

export class SetArpeggio implements Command {
  readonly type = 'SetArpeggio'
  readonly label = 'Set arpeggio'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: 'up' | 'down' | undefined,
    private readonly oldValue: 'up' | 'down' | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateVoice(
      ctx.score,
      this.loc.trackId,
      this.loc.barId,
      this.loc.voiceId,
      (voice) => ({
        ...voice,
        beats: voice.beats.map((b) =>
          b.id === this.loc.beatId
            ? { ...b, arpeggioUp: this.value === 'up' || undefined, arpeggioDown: this.value === 'down' || undefined }
            : b,
        ),
      }),
    )
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetArpeggio(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetBrush (beat-level) — 'up' | 'down' | undefined, mutually exclusive
// ---------------------------------------------------------------------------

export class SetBrush implements Command {
  readonly type = 'SetBrush'
  readonly label = 'Set brush stroke'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: 'up' | 'down' | undefined,
    private readonly oldValue: 'up' | 'down' | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateVoice(
      ctx.score,
      this.loc.trackId,
      this.loc.barId,
      this.loc.voiceId,
      (voice) => ({
        ...voice,
        beats: voice.beats.map((b) =>
          b.id === this.loc.beatId
            ? { ...b, brushUp: this.value === 'up' || undefined, brushDown: this.value === 'down' || undefined }
            : b,
        ),
      }),
    )
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetBrush(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetFade (beat-level) — 'in' | 'out' | 'swell' | undefined
// ---------------------------------------------------------------------------

export type FadeType = 'in' | 'out' | 'swell'

export class SetFade implements Command {
  readonly type = 'SetFade'
  readonly label = 'Set fade'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: FadeType | undefined,
    private readonly oldValue: FadeType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateVoice(
      ctx.score,
      this.loc.trackId,
      this.loc.barId,
      this.loc.voiceId,
      (voice) => ({
        ...voice,
        beats: voice.beats.map((b) =>
          b.id === this.loc.beatId
            ? {
                ...b,
                fadeIn: this.value === 'in' || undefined,
                fadeOut: this.value === 'out' || undefined,
                volumeSwell: this.value === 'swell' || undefined,
              }
            : b,
        ),
      }),
    )
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetFade(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetTremoloPicking (beat-level)
// ---------------------------------------------------------------------------

export class SetTremoloPicking implements Command {
  readonly type = 'SetTremoloPicking'
  readonly label = 'Set tremolo picking'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: Duration | undefined,
    private readonly oldValue: Duration | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'tremoloPickingDuration', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTremoloPicking(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}

// ---------------------------------------------------------------------------
// SetFermata (beat-level)
// ---------------------------------------------------------------------------

export type FermataValue = { type: 'short' | 'medium' | 'long'; length: number }

export class SetFermata implements Command {
  readonly type = 'SetFermata'
  readonly label = 'Set fermata'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: FermataValue | undefined,
    private readonly oldValue: FermataValue | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'fermata', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetFermata(this.loc, this.oldValue, this.value)
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
// SetWhammy (beat-level) — whammy-bar control points, shares BendPoint shape
// ---------------------------------------------------------------------------

export class SetWhammy implements Command {
  readonly type = 'SetWhammy'
  readonly label = 'Set whammy bar'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: BendPoint[] | undefined,
    private readonly oldValue: BendPoint[] | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'whammy', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetWhammy(this.loc, this.oldValue, this.value)
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
// SetChord (beat-level) — chord annotation name, e.g. "Cm7"
// ---------------------------------------------------------------------------

export class SetChord implements Command {
  readonly type = 'SetChord'
  readonly label = 'Set chord name'

  constructor(
    private readonly loc: BeatOnlyLocation,
    private readonly value: string | undefined,
    private readonly oldValue: string | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBeatField(ctx, this.loc, 'chord', this.value)
    return { score, affectedBarIds: [this.loc.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetChord(this.loc, this.oldValue, this.value)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, value: this.value ?? null, oldValue: this.oldValue ?? null }
  }

  affectedBarIds(): string[] { return [this.loc.barId] }
}
