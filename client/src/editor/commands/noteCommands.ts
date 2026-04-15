/**
 * Note-level commands: InsertNote, DeleteNote, SetFret, SetString.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { NoteNode } from '../ast/types'
import { findBar, findBeat, findVoice, insertAt, removeAt, updateBeat } from './helpers'

// ---------------------------------------------------------------------------
// Shared payload types
// ---------------------------------------------------------------------------

interface NoteLocation {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
}

// ---------------------------------------------------------------------------
// InsertNote
// ---------------------------------------------------------------------------

export class InsertNote implements Command {
  readonly type = 'InsertNote'
  readonly label = 'Insert note'

  constructor(
    private readonly loc: NoteLocation,
    private readonly note: NoteNode,
    private readonly index: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId } = this.loc
    const score = updateBeat(
      ctx.score,
      trackId,
      barId,
      voiceId,
      beatId,
      (beat) => ({
        ...beat,
        notes: insertAt(beat.notes, this.index, this.note),
      }),
    )
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new DeleteNote(this.loc, this.note.id)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      note: this.note as unknown as Json,
      index: this.index,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// DeleteNote
// ---------------------------------------------------------------------------

export class DeleteNote implements Command {
  readonly type = 'DeleteNote'
  readonly label = 'Delete note'

  constructor(
    private readonly loc: NoteLocation,
    private readonly noteId: string,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId } = this.loc

    // Capture the note and its index before deleting
    const track = ctx.score.tracks.find((t) => t.id === trackId)
    let noteIndex = -1
    let deletedNote: NoteNode | undefined

    if (track) {
      for (const staff of track.staves) {
        const bar = staff.bars.find((b) => b.id === barId)
        if (bar) {
          const voice = bar.voices.find((v) => v.id === voiceId)
          if (voice) {
            const beat = voice.beats.find((b) => b.id === beatId)
            if (beat) {
              noteIndex = beat.notes.findIndex((n) => n.id === this.noteId)
              deletedNote = beat.notes[noteIndex]
            }
          }
        }
      }
    }

    if (noteIndex === -1 || !deletedNote) {
      return { score: ctx.score, affectedBarIds: [] }
    }

    // Store for invert
    this._deletedNote = deletedNote
    this._deletedIndex = noteIndex

    const score = updateBeat(
      ctx.score,
      trackId,
      barId,
      voiceId,
      beatId,
      (beat) => ({
        ...beat,
        notes: removeAt(beat.notes, noteIndex),
      }),
    )
    return { score, affectedBarIds: [barId] }
  }

  // Mutable state captured during execute for invert
  private _deletedNote: NoteNode | undefined
  private _deletedIndex: number = 0

  invert(ctx: CommandContext): Command {
    // If execute was called, use captured data; otherwise look it up
    if (this._deletedNote) {
      return new InsertNote(this.loc, this._deletedNote, this._deletedIndex)
    }
    // Fallback: find current state
    const { trackId, barId, voiceId, beatId } = this.loc
    const track = ctx.score.tracks.find((t) => t.id === trackId)
    if (track) {
      for (const staff of track.staves) {
        const bar = staff.bars.find((b) => b.id === barId)
        if (bar) {
          const voice = bar.voices.find((v) => v.id === voiceId)
          if (voice) {
            const beat = voice.beats.find((b) => b.id === beatId)
            if (beat) {
              const idx = beat.notes.findIndex((n) => n.id === this.noteId)
              if (idx !== -1) {
                return new InsertNote(this.loc, beat.notes[idx], idx)
              }
            }
          }
        }
      }
    }
    // Nothing to invert
    return new InsertNote(this.loc, { id: this.noteId, string: 1, fret: 0 }, 0)
  }

  serialize(): Json {
    return { type: this.type, ...this.loc, noteId: this.noteId }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }
}

// ---------------------------------------------------------------------------
// SetFret
// ---------------------------------------------------------------------------

export class SetFret implements Command {
  readonly type = 'SetFret'
  readonly label = 'Set fret'

  constructor(
    private readonly loc: NoteLocation & { noteId: string },
    private readonly fret: number,
    private readonly oldFret: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId, noteId } = this.loc
    const score = updateBeat(
      ctx.score,
      trackId,
      barId,
      voiceId,
      beatId,
      (beat) => ({
        ...beat,
        notes: beat.notes.map((n) =>
          n.id === noteId ? { ...n, fret: this.fret } : n,
        ),
      }),
    )
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetFret(this.loc, this.oldFret, this.fret)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      fret: this.fret,
      oldFret: this.oldFret,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }

  merge(next: Command): Command | null {
    if (
      next instanceof SetFret &&
      next.loc.noteId === this.loc.noteId &&
      next.loc.beatId === this.loc.beatId
    ) {
      // Keep oldest oldFret, newest fret
      return new SetFret(this.loc, next.fret, this.oldFret)
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// SetString
// ---------------------------------------------------------------------------

export class SetString implements Command {
  readonly type = 'SetString'
  readonly label = 'Set string'

  constructor(
    private readonly loc: NoteLocation & { noteId: string },
    private readonly string: number,
    private readonly oldString: number,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const { trackId, barId, voiceId, beatId, noteId } = this.loc
    const score = updateBeat(
      ctx.score,
      trackId,
      barId,
      voiceId,
      beatId,
      (beat) => ({
        ...beat,
        notes: beat.notes.map((n) =>
          n.id === noteId ? { ...n, string: this.string } : n,
        ),
      }),
    )
    return { score, affectedBarIds: [barId] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetString(this.loc, this.oldString, this.string)
  }

  serialize(): Json {
    return {
      type: this.type,
      ...this.loc,
      string: this.string,
      oldString: this.oldString,
    }
  }

  affectedBarIds(): string[] {
    return [this.loc.barId]
  }

  merge(next: Command): Command | null {
    if (
      next instanceof SetString &&
      next.loc.noteId === this.loc.noteId &&
      next.loc.beatId === this.loc.beatId
    ) {
      return new SetString(this.loc, next.string, this.oldString)
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Re-export helper for invert lookup
// ---------------------------------------------------------------------------

/** Find a note inside a score by location IDs. Returns undefined if not found. */
export function findNoteInScore(
  ctx: CommandContext,
  trackId: string,
  barId: string,
  voiceId: string,
  beatId: string,
  noteId: string,
): NoteNode | undefined {
  const track = ctx.score.tracks.find((t) => t.id === trackId)
  if (!track) return undefined
  for (const staff of track.staves) {
    const bar = staff.bars.find((b) => b.id === barId)
    if (!bar) continue
    const voice = findVoice(bar, voiceId)
    if (!voice) continue
    const beat = findBeat(voice, beatId)
    if (!beat) continue
    return findBar(track, barId) ? beat.notes.find((n) => n.id === noteId) : undefined
  }
  return undefined
}
