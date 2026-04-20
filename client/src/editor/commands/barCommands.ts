/**
 * Bar-level commands: InsertBar, DeleteBar, ClearBar, SetTimeSignature,
 * SetKeySignature, SetBarTempo, SetRepeat.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { BarNode, VoiceNode, RepeatMarker, JumpType } from '../ast/types'
import { insertAt, removeAt, updateBar, updateTrack } from './helpers'
import {
  makeBarBeats,
  getEffectiveTimeSig,
  findBarPosition,
  barCapacityUnits,
  durationToUnits,
  splitIntoRests,
} from '../ast/barFill'

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
// ClearBar — replaces all beats in a bar with rests (keeps bar structure)
// ---------------------------------------------------------------------------

export class ClearBar implements Command {
  readonly type = 'ClearBar'
  readonly label = 'Clear bar'

  private _originalVoices: VoiceNode[] | undefined

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const track = ctx.score.tracks.find((t) => t.id === this.trackId)
    if (!track) return { score: ctx.score, affectedBarIds: [] }
    const bar = track.staves.flatMap((s) => s.bars).find((b) => b.id === this.barId)
    if (!bar) return { score: ctx.score, affectedBarIds: [] }

    this._originalVoices = bar.voices

    // Use the effective time signature so ClearBar always produces the
    // correct number of beats (e.g. 6 eighth rests for 6/8, not 1 quarter).
    const pos = findBarPosition(ctx.score, this.barId)
    const timeSig = pos
      ? getEffectiveTimeSig(ctx.score, pos.trackIndex, pos.barIndex)
      : { numerator: 4, denominator: 4 }

    const score = updateBar(ctx.score, this.trackId, this.barId, (b) => ({
      ...b,
      voices: b.voices.map((v) => ({
        ...v,
        beats: makeBarBeats(timeSig, ctx.generateId),
      })),
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new RestoreBarVoices(this.trackId, this.barId, this._originalVoices ?? [])
  }

  serialize(): Json {
    return { type: this.type, trackId: this.trackId, barId: this.barId }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}

// Private — used only as ClearBar.invert()
class RestoreBarVoices implements Command {
  readonly type = 'RestoreBarVoices'
  readonly label = 'Restore bar'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly voices: VoiceNode[],
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBar(ctx.score, this.trackId, this.barId, (b) => ({
      ...b,
      voices: this.voices,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new ClearBar(this.trackId, this.barId)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      voices: this.voices as unknown as Json,
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

  // Snapshot of voices before rebalancing — used by invert() to restore exactly.
  private _savedVoices: VoiceNode[] | undefined

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly timeSignature: { numerator: number; denominator: number } | undefined,
    private readonly oldTimeSignature: { numerator: number; denominator: number } | undefined,
    // When provided (undo path), restore these voices directly without rebalancing.
    private readonly _voicesToRestore?: VoiceNode[],
  ) {}

  execute(ctx: CommandContext): CommandResult {
    // Undo path: restore exact pre-change voices alongside the old time signature.
    if (this._voicesToRestore !== undefined) {
      const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
        ...bar,
        timeSignature: this.timeSignature,
        voices: this._voicesToRestore!,
      }))
      return { score, affectedBarIds: [this.barId] }
    }

    // Forward path: rebalance voices to fit the new time signature.
    const pos = findBarPosition(ctx.score, this.barId)

    // Determine the new capacity. When clearing the bar's explicit ts (undefined),
    // inherit from predecessor bars — same logic as getEffectiveTimeSig but skips
    // the current bar so it doesn't read its own (about-to-be-removed) value.
    let tsForCapacity: { numerator: number; denominator: number }
    if (this.timeSignature) {
      tsForCapacity = this.timeSignature
    } else {
      const bars = pos
        ? (ctx.score.tracks.find((t) => t.id === this.trackId)?.staves[0]?.bars ?? [])
        : []
      const barIdx = pos?.barIndex ?? 0
      tsForCapacity = { numerator: 4, denominator: 4 }
      for (let i = barIdx - 1; i >= 0; i--) {
        const ts = bars[i]?.timeSignature
        if (ts) { tsForCapacity = ts; break }
      }
    }

    const newCap = barCapacityUnits(tsForCapacity)

    let savedVoices: VoiceNode[] | undefined
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => {
      savedVoices = bar.voices
      return {
        ...bar,
        timeSignature: this.timeSignature,
        voices: bar.voices.map((v) => rebalanceVoiceToCapacity(v, newCap, ctx.generateId)),
      }
    })
    this._savedVoices = savedVoices

    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetTimeSignature(
      this.trackId,
      this.barId,
      this.oldTimeSignature,
      this.timeSignature,
      this._savedVoices,
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
// SetJump — D.S. / D.C. / Fine / Coda / Segno markers
// ---------------------------------------------------------------------------

export class SetJump implements Command {
  readonly type = 'SetJump'
  readonly label = 'Set jump'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly jump: JumpType | undefined,
    private readonly oldJump: JumpType | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      jump: this.jump,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetJump(this.trackId, this.barId, this.oldJump, this.jump)
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      jump: this.jump ?? null,
      oldJump: this.oldJump ?? null,
    }
  }

  affectedBarIds(): string[] { return [this.barId] }
}

// ---------------------------------------------------------------------------
// SetAlternateEnding — \ae (1 2 3)
// ---------------------------------------------------------------------------

export class SetAlternateEnding implements Command {
  readonly type = 'SetAlternateEnding'
  readonly label = 'Set alternate ending'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly alternateEnding: number[] | undefined,
    private readonly oldAlternateEnding: number[] | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      alternateEnding: this.alternateEnding,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetAlternateEnding(
      this.trackId,
      this.barId,
      this.oldAlternateEnding,
      this.alternateEnding,
    )
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      alternateEnding: (this.alternateEnding as unknown as Json) ?? null,
      oldAlternateEnding: (this.oldAlternateEnding as unknown as Json) ?? null,
    }
  }

  affectedBarIds(): string[] { return [this.barId] }
}

// ---------------------------------------------------------------------------
// SetSection — section name and optional marker symbol
// ---------------------------------------------------------------------------

export class SetSection implements Command {
  readonly type = 'SetSection'
  readonly label = 'Set section'

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly section: string | undefined,
    private readonly marker: string | undefined,
    private readonly oldSection: string | undefined,
    private readonly oldMarker: string | undefined,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBarInTrack(ctx, this.trackId, this.barId, (bar) => ({
      ...bar,
      section: this.section,
      sectionMarker: this.marker,
    }))
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetSection(
      this.trackId,
      this.barId,
      this.oldSection,
      this.oldMarker,
      this.section,
      this.marker,
    )
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      section: this.section ?? null,
      marker: this.marker ?? null,
      oldSection: this.oldSection ?? null,
      oldMarker: this.oldMarker ?? null,
    }
  }

  affectedBarIds(): string[] { return [this.barId] }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Rebalance a voice's beats to exactly fill `newCap` 64th-note units.
 *
 * Overflow: remove whole beats from the end until used ≤ newCap.
 * Underflow: pad with canonical rest beats (binary decomposition).
 *
 * Called by SetTimeSignature to keep every bar valid after a metre change.
 */
function rebalanceVoiceToCapacity(
  voice: VoiceNode,
  newCap: number,
  generateId: () => string,
): VoiceNode {
  const beats = [...voice.beats]
  let used = beats.reduce((s, b) => s + durationToUnits(b.duration), 0)

  // Trim overflow from the end
  while (used > newCap && beats.length > 0) {
    used -= durationToUnits(beats[beats.length - 1].duration)
    beats.pop()
  }

  // Pad underflow with canonical rests
  if (used < newCap) {
    const restDurs = splitIntoRests(0, newCap - used)
    for (const dur of restDurs) {
      beats.push({
        id: generateId(),
        duration: { value: dur, dots: 0 as const },
        notes: [],
        rest: true as const,
      })
    }
  }

  return { ...voice, beats }
}

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
