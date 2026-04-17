/**
 * Voice-level commands: AddVoice, RemoveVoice.
 *
 * Multi-voice support lets a single bar hold two independent rhythmic lines
 * (Sibelius V1/V2 semantics). V1 stems up, V2 stems down; each voice must
 * independently fill the bar's time signature.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { VoiceNode } from '../ast/types'
import { updateBar } from './helpers'
import {
  makeBarRestBeats,
  getEffectiveTimeSig,
  findBarPosition,
} from '../ast/barFill'

// ---------------------------------------------------------------------------
// AddVoice — inserts a new voice (default: bar rest) at the given index
// ---------------------------------------------------------------------------

export class AddVoice implements Command {
  readonly type = 'AddVoice'
  readonly label = 'Add voice'

  private _insertedVoiceId: string | undefined

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly voiceIndex: number,
    /** If omitted, a fresh voice filled with bar-rest beats is created. */
    private readonly voice?: VoiceNode,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const pos = findBarPosition(ctx.score, this.barId)
    const timeSig = pos
      ? getEffectiveTimeSig(ctx.score, pos.trackIndex, pos.barIndex)
      : { numerator: 4, denominator: 4 }

    const nextVoice: VoiceNode =
      this.voice ??
      {
        id: ctx.generateId(),
        beats: makeBarRestBeats(timeSig, ctx.generateId),
      }
    this._insertedVoiceId = nextVoice.id

    const score = updateBar(ctx.score, this.trackId, this.barId, (bar) => {
      const clamped = Math.max(0, Math.min(bar.voices.length, this.voiceIndex))
      return {
        ...bar,
        voices: [
          ...bar.voices.slice(0, clamped),
          nextVoice,
          ...bar.voices.slice(clamped),
        ],
      }
    })
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new RemoveVoice(this.trackId, this.barId, this._insertedVoiceId ?? '')
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      voiceIndex: this.voiceIndex,
      voice: (this.voice as unknown as Json) ?? null,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }

  insertedVoiceId(): string | undefined {
    return this._insertedVoiceId
  }
}

// ---------------------------------------------------------------------------
// RemoveVoice — removes the voice with the given id (captures it for undo)
// ---------------------------------------------------------------------------

export class RemoveVoice implements Command {
  readonly type = 'RemoveVoice'
  readonly label = 'Remove voice'

  private _removedVoice: VoiceNode | undefined
  private _removedIndex: number = 0

  constructor(
    private readonly trackId: string,
    private readonly barId: string,
    private readonly voiceId: string,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = updateBar(ctx.score, this.trackId, this.barId, (bar) => {
      const idx = bar.voices.findIndex((v) => v.id === this.voiceId)
      if (idx === -1) return bar
      this._removedVoice = bar.voices[idx]
      this._removedIndex = idx
      return {
        ...bar,
        voices: [...bar.voices.slice(0, idx), ...bar.voices.slice(idx + 1)],
      }
    })
    return { score, affectedBarIds: [this.barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new AddVoice(
      this.trackId,
      this.barId,
      this._removedIndex,
      this._removedVoice,
    )
  }

  serialize(): Json {
    return {
      type: this.type,
      trackId: this.trackId,
      barId: this.barId,
      voiceId: this.voiceId,
    }
  }

  affectedBarIds(): string[] {
    return [this.barId]
  }
}
