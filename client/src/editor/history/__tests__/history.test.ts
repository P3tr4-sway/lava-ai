/**
 * History + Command round-trip tests.
 *
 * Uses the same vitest node environment as the AST tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { ScoreNode, TrackNode, StaffNode, BarNode, VoiceNode, BeatNode, NoteNode, MetaNode } from '../../ast/types'
import type { CommandContext } from '../../commands/Command'
import { History, CompositeCommand, MAX_STACK_DEPTH, MERGE_WINDOW_MS } from '../History'
import {
  InsertNote,
  DeleteNote,
  SetFret,
  SetString,
} from '../../commands/noteCommands'
import {
  InsertBeat,
  DeleteBeat,
  SetDuration,
  ToggleDot,
  SetTuplet,
  SetRest,
} from '../../commands/beatCommands'
import {
  InsertBar,
  DeleteBar,
  SetTimeSignature,
  SetKeySignature,
  SetBarTempo,
  SetRepeat,
} from '../../commands/barCommands'
import {
  InsertTrack,
  DeleteTrack,
  SetTuning,
  SetCapo,
  RenameTrack,
} from '../../commands/trackCommands'
import {
  SetHammerOn,
  SetPullOff,
  SetSlide,
  SetBend,
  SetVibrato,
  SetHarmonic,
  SetTie,
  SetGhost,
  SetDeadNote,
  SetTap,
  SetPalmMute,
  SetLetRing,
  SetAccent,
  SetStroke,
} from '../../commands/techniqueCommands'
import {
  BulkTranspose,
  BulkShiftString,
  DeleteSelection,
  BulkSetDuration,
  CopySelection,
  PasteSelection,
} from '../../commands/selectionCommands'
import { SetMeta } from '../../commands/metaCommands'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let idCounter = 0
function makeId(): string {
  return `id-${++idCounter}`
}

function resetIdCounter() {
  idCounter = 0
}

function makeNote(overrides: Partial<NoteNode> = {}): NoteNode {
  return { id: makeId(), string: 1, fret: 5, ...overrides }
}

function makeBeat(overrides: Partial<BeatNode> = {}): BeatNode {
  return {
    id: makeId(),
    duration: { value: 4, dots: 0 },
    notes: [],
    ...overrides,
  }
}

function makeVoice(beats: BeatNode[] = []): VoiceNode {
  return { id: makeId(), beats }
}

function makeBar(voices: VoiceNode[] = []): BarNode {
  return { id: makeId(), voices }
}

function makeStaff(bars: BarNode[] = []): StaffNode {
  return {
    id: makeId(),
    bars,
  }
}

function makeTrack(staves: StaffNode[] = []): TrackNode {
  return {
    id: makeId(),
    name: 'Guitar',
    instrument: 25,
    tuning: [40, 45, 50, 55, 59, 64],
    capo: 0,
    chordDefs: [],
    staves,
  }
}

function makeMeta(): MetaNode {
  return { title: 'Test', tempo: 120 }
}

function makeScore(): ScoreNode {
  // One track, one staff, one bar, one voice, one beat with one note
  const note = makeNote()
  const beat = makeBeat({ notes: [note] })
  const voice = makeVoice([beat])
  const bar = makeBar([voice])
  const staff = makeStaff([bar])
  const track = makeTrack([staff])
  return { id: makeId(), meta: makeMeta(), tracks: [track] }
}

/** Extract IDs from a fresh score for use in commands. */
function ids(score: ScoreNode) {
  const track = score.tracks[0]
  const staff = track.staves[0]
  const bar = staff.bars[0]
  const voice = bar.voices[0]
  const beat = voice.beats[0]
  const note = beat.notes[0]
  return {
    trackId: track.id,
    staffIndex: 0,
    barId: bar.id,
    voiceId: voice.id,
    beatId: beat.id,
    noteId: note.id,
  }
}

function makeCtx(score: ScoreNode): CommandContext {
  return { score, generateId: makeId }
}

// ---------------------------------------------------------------------------
// History behaviour
// ---------------------------------------------------------------------------

describe('History', () => {
  let history: History

  beforeEach(() => {
    history = new History()
    resetIdCounter()
  })

  it('push + undo + redo restores state', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const cmd = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      7,
      5,
    )

    const afterExecute = history.push(cmd, ctx)
    const note1 = afterExecute.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]
    expect(note1.fret).toBe(7)

    const afterUndo = history.undo({ ...ctx, score: afterExecute.score })
    expect(afterUndo).not.toBeNull()
    const note2 = afterUndo!.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]
    expect(note2.fret).toBe(5)

    const afterRedo = history.redo({ ...ctx, score: afterUndo!.score })
    expect(afterRedo).not.toBeNull()
    const note3 = afterRedo!.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]
    expect(note3.fret).toBe(7)
  })

  it('undo when stack is empty returns null', () => {
    const score = makeScore()
    const result = history.undo(makeCtx(score))
    expect(result).toBeNull()
  })

  it('redo after new push clears redo stack', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const cmd1 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      7,
      5,
    )
    const r1 = history.push(cmd1, ctx)
    history.undo({ ...ctx, score: r1.score })
    expect(history.canRedo()).toBe(true)

    // Now push a NEW command — should clear redo stack
    const cmd2 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      9,
      5,
    )
    history.push(cmd2, ctx)
    expect(history.canRedo()).toBe(false)
  })

  it('stack depth limit: push 501 commands, oldest is dropped', () => {
    const score = makeScore()
    const i = ids(score)
    let ctx = makeCtx(score)

    // Use SetMeta (which also has merge support but different patch keys each time
    // would still merge). Use SetBarTempo instead — it has no merge() so every
    // push lands as a separate entry, ensuring we hit the depth limit.
    for (let n = 0; n < MAX_STACK_DEPTH + 1; n++) {
      const cmd = new SetBarTempo(i.trackId, i.barId, 60 + n, 60 + n - 1)
      const result = history.push(cmd, ctx)
      ctx = makeCtx(result.score)
    }

    expect(history.getUndoStackDepth()).toBe(MAX_STACK_DEPTH)
  })

  it('merge: two consecutive SetFret commands within 500ms are merged', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    // Use fake timers so we can control Date.now
    const basetime = 1000000
    vi.spyOn(Date, 'now').mockReturnValue(basetime)

    const cmd1 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      7,
      5,
    )
    const r1 = history.push(cmd1, ctx)
    expect(history.getUndoStackDepth()).toBe(1)

    // Still within merge window
    vi.spyOn(Date, 'now').mockReturnValue(basetime + MERGE_WINDOW_MS - 1)

    const cmd2 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      9,
      7,
    )
    history.push(cmd2, { ...ctx, score: r1.score })

    // Should still be 1 entry (merged)
    expect(history.getUndoStackDepth()).toBe(1)

    vi.restoreAllMocks()
  })

  it('no merge when outside merge window', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const basetime = 1000000
    vi.spyOn(Date, 'now').mockReturnValue(basetime)

    const cmd1 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      7,
      5,
    )
    const r1 = history.push(cmd1, ctx)

    // Outside merge window
    vi.spyOn(Date, 'now').mockReturnValue(basetime + MERGE_WINDOW_MS + 1)

    const cmd2 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      9,
      7,
    )
    history.push(cmd2, { ...ctx, score: r1.score })

    expect(history.getUndoStackDepth()).toBe(2)
    vi.restoreAllMocks()
  })

  it('canUndo and canRedo reflect stack state', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)

    const cmd = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      7,
      5,
    )
    const r = history.push(cmd, ctx)
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)

    history.undo({ ...ctx, score: r.score })
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(true)

    history.clear()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CompositeCommand
// ---------------------------------------------------------------------------

describe('CompositeCommand', () => {
  beforeEach(() => resetIdCounter())

  it('executes sub-commands in order', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const cmd1 = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      7,
      5,
    )
    const cmd2 = new SetString(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      3,
      1,
    )
    const composite = new CompositeCommand([cmd1, cmd2], 'Combo')
    const result = composite.execute(ctx)
    const note = result.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]
    expect(note.fret).toBe(7)
    expect(note.string).toBe(3)
  })

  it('invert reverses and inverts each sub-command', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const cmd = new CompositeCommand(
      [
        new SetFret(
          { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
          7,
          5,
        ),
      ],
      'Test',
    )
    const r1 = cmd.execute(ctx)
    const inv = cmd.invert(ctx)
    const r2 = inv.execute({ ...ctx, score: r1.score })
    const note = r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0]
    expect(note.fret).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Note commands
// ---------------------------------------------------------------------------

describe('InsertNote / DeleteNote round-trip', () => {
  beforeEach(() => resetIdCounter())

  it('InsertNote adds note, DeleteNote restores it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const newNote = makeNote({ fret: 12, string: 2 })
    const insert = new InsertNote(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      newNote,
      1,
    )
    const r1 = insert.execute(ctx)
    const beat1 = r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    expect(beat1.notes).toHaveLength(2)
    expect(beat1.notes[1].fret).toBe(12)

    // Undo via invert
    const deleteCmd = insert.invert(ctx)
    const r2 = deleteCmd.execute({ ...ctx, score: r1.score })
    const beat2 = r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    expect(beat2.notes).toHaveLength(1)
  })

  it('DeleteNote removes note; invert re-inserts it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const del = new DeleteNote(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      i.noteId,
    )
    const r1 = del.execute(ctx)
    const beat1 = r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    expect(beat1.notes).toHaveLength(0)

    const ins = del.invert({ ...ctx, score: r1.score })
    const r2 = ins.execute({ ...ctx, score: r1.score })
    const beat2 = r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    expect(beat2.notes).toHaveLength(1)
    expect(beat2.notes[0].id).toBe(i.noteId)
  })

  it('InsertNote at index 0 prepends', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const newNote = makeNote({ fret: 3, string: 1 })
    const insert = new InsertNote(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      newNote,
      0,
    )
    const r = insert.execute(ctx)
    const beat = r.score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    expect(beat.notes[0].fret).toBe(3)
    expect(beat.notes[1].id).toBe(i.noteId)
  })
})

// ---------------------------------------------------------------------------
// SetFret
// ---------------------------------------------------------------------------

describe('SetFret', () => {
  beforeEach(() => resetIdCounter())

  it('execute changes fret', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      9,
      5,
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(9)
  })

  it('invert restores old fret', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetFret(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      9,
      5,
    )
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(5)
  })

  it('merge produces single command with original oldFret and latest fret', () => {
    const score = makeScore()
    const i = ids(score)
    const loc = { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId }

    const cmd1 = new SetFret(loc, 7, 5)
    const cmd2 = new SetFret(loc, 9, 7)
    const merged = cmd1.merge!(cmd2)
    expect(merged).not.toBeNull()

    const r = merged!.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(9)

    // Invert of merged should restore to 5
    const inv = merged!.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// SetString
// ---------------------------------------------------------------------------

describe('SetString', () => {
  beforeEach(() => resetIdCounter())

  it('execute changes string', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetString(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      3,
      1,
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].string).toBe(3)
  })

  it('invert restores old string', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetString(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId, noteId: i.noteId },
      3,
      1,
    )
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].string).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Beat commands
// ---------------------------------------------------------------------------

describe('InsertBeat / DeleteBeat', () => {
  beforeEach(() => resetIdCounter())

  it('InsertBeat adds beat; invert removes it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const newBeat = makeBeat()
    const insert = new InsertBeat(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId },
      newBeat,
      1,
    )
    const r1 = insert.execute(ctx)
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(2)

    const del = insert.invert(ctx)
    const r2 = del.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(1)
  })

  it('DeleteBeat removes beat; invert re-inserts it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const del = new DeleteBeat(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId },
      i.beatId,
    )
    const r1 = del.execute(ctx)
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(0)

    const ins = del.invert({ ...ctx, score: r1.score })
    const r2 = ins.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(1)
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].id).toBe(i.beatId)
  })

  it('DeleteBeat returns empty result when beat not found', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)
    const del = new DeleteBeat(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId },
      'nonexistent',
    )
    const r = del.execute(ctx)
    expect(r.affectedBarIds).toHaveLength(0)
  })
})

describe('SetDuration', () => {
  beforeEach(() => resetIdCounter())

  it('execute changes duration', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetDuration(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      { value: 8, dots: 0 },
      { value: 4, dots: 0 },
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.value).toBe(8)
  })

  it('invert restores old duration', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetDuration(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      { value: 8, dots: 0 },
      { value: 4, dots: 0 },
    )
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.value).toBe(4)
  })
})

describe('ToggleDot', () => {
  beforeEach(() => resetIdCounter())

  it('cycles dots 0 → 1 → 2 → 0', () => {
    const score = makeScore()
    const i = ids(score)

    const loc = { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }

    let s = score
    const toggle = () => {
      const cmd = new ToggleDot(loc, 1)
      const r = cmd.execute(makeCtx(s))
      s = r.score
      return s.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.dots
    }

    expect(toggle()).toBe(1)
    expect(toggle()).toBe(2)
    expect(toggle()).toBe(0)
  })

  it('invert cycles in reverse (1 → 0)', () => {
    const score = makeScore()
    const i = ids(score)
    const loc = { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }

    const fwd = new ToggleDot(loc, 1)
    const r1 = fwd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.dots).toBe(1)

    const inv = fwd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.dots).toBe(0)
  })

  it('full 0→1→2→0 cycle and back', () => {
    const score = makeScore()
    const i = ids(score)
    const loc = { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }

    let s = score
    for (let n = 0; n < 3; n++) {
      const r = new ToggleDot(loc, 1).execute(makeCtx(s))
      s = r.score
    }
    // Should be back to 0
    expect(s.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.dots).toBe(0)
  })
})

describe('SetTuplet', () => {
  beforeEach(() => resetIdCounter())

  it('execute sets tuplet', () => {
    const score = makeScore()
    const i = ids(score)
    const tuplet = { numerator: 3, denominator: 2 }
    const cmd = new SetTuplet(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      tuplet,
      undefined,
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.tuplet).toEqual(tuplet)
  })

  it('invert clears tuplet', () => {
    const score = makeScore()
    const i = ids(score)
    const tuplet = { numerator: 3, denominator: 2 }
    const cmd = new SetTuplet(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      tuplet,
      undefined,
    )
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.tuplet).toBeUndefined()
  })

  it('SetTuplet serialize includes tuplet', () => {
    const score = makeScore()
    const i = ids(score)
    const tuplet = { numerator: 5, denominator: 4 }
    const cmd = new SetTuplet(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      tuplet,
      undefined,
    )
    const json = cmd.serialize() as Record<string, unknown>
    expect(json.type).toBe('SetTuplet')
  })
})

describe('SetRest', () => {
  beforeEach(() => resetIdCounter())

  it('execute marks beat as rest', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetRest(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      true,
      false,
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].rest).toBe(true)
  })

  it('invert removes rest', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetRest(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId },
      true,
      false,
    )
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].rest).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bar commands
// ---------------------------------------------------------------------------

describe('InsertBar / DeleteBar', () => {
  beforeEach(() => resetIdCounter())

  it('InsertBar adds bar; invert removes it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const newBar = makeBar()
    const insert = new InsertBar(i.trackId, 0, newBar, 1)
    const r1 = insert.execute(ctx)
    expect(r1.score.tracks[0].staves[0].bars).toHaveLength(2)

    const del = insert.invert(ctx)
    const r2 = del.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks[0].staves[0].bars).toHaveLength(1)
  })

  it('DeleteBar removes bar; invert restores it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const del = new DeleteBar(i.trackId, 0, i.barId)
    const r1 = del.execute(ctx)
    expect(r1.score.tracks[0].staves[0].bars).toHaveLength(0)

    const ins = del.invert(ctx)
    const r2 = ins.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks[0].staves[0].bars).toHaveLength(1)
    expect(r2.score.tracks[0].staves[0].bars[0].id).toBe(i.barId)
  })
})

describe('SetTimeSignature', () => {
  beforeEach(() => resetIdCounter())

  it('execute sets time signature', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetTimeSignature(i.trackId, i.barId, { numerator: 3, denominator: 4 }, undefined)
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].timeSignature).toEqual({ numerator: 3, denominator: 4 })
  })

  it('invert restores old time signature', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetTimeSignature(i.trackId, i.barId, { numerator: 3, denominator: 4 }, undefined)
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].timeSignature).toBeUndefined()
  })

  it('serialize returns correct type', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetTimeSignature(i.trackId, i.barId, { numerator: 6, denominator: 8 }, undefined)
    const json = cmd.serialize() as Record<string, unknown>
    expect(json.type).toBe('SetTimeSignature')
  })
})

describe('SetKeySignature', () => {
  beforeEach(() => resetIdCounter())

  it('execute and invert', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetKeySignature(i.trackId, i.barId, 'F#', undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].keySignature).toBe('F#')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].keySignature).toBeUndefined()
  })
})

describe('SetBarTempo', () => {
  beforeEach(() => resetIdCounter())

  it('execute and invert', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetBarTempo(i.trackId, i.barId, 140, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].tempo).toBe(140)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].tempo).toBeUndefined()
  })
})

describe('SetRepeat', () => {
  beforeEach(() => resetIdCounter())

  it('execute sets repeat start', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetRepeat(i.trackId, i.barId, { start: true }, undefined)
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].repeat).toEqual({ start: true })
  })

  it('invert clears repeat', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetRepeat(i.trackId, i.barId, { start: true }, undefined)
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].repeat).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Track commands
// ---------------------------------------------------------------------------

describe('InsertTrack / DeleteTrack', () => {
  beforeEach(() => resetIdCounter())

  it('InsertTrack adds track; invert removes it', () => {
    const score = makeScore()
    const ctx = makeCtx(score)

    const newTrack = makeTrack([makeStaff()])
    const insert = new InsertTrack(newTrack, 1)
    const r1 = insert.execute(ctx)
    expect(r1.score.tracks).toHaveLength(2)

    const del = insert.invert(ctx)
    const r2 = del.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks).toHaveLength(1)
  })

  it('DeleteTrack removes track; invert restores it', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const del = new DeleteTrack(i.trackId)
    const r1 = del.execute(ctx)
    expect(r1.score.tracks).toHaveLength(0)

    const ins = del.invert(ctx)
    const r2 = ins.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks).toHaveLength(1)
    expect(r2.score.tracks[0].id).toBe(i.trackId)
  })
})

describe('SetTuning', () => {
  beforeEach(() => resetIdCounter())

  it('execute and invert', () => {
    const score = makeScore()
    const i = ids(score)
    const dropD: number[] = [38, 45, 50, 55, 59, 64]
    const cmd = new SetTuning(i.trackId, dropD, [40, 45, 50, 55, 59, 64])
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].tuning).toEqual(dropD)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].tuning).toEqual([40, 45, 50, 55, 59, 64])
  })
})

describe('SetCapo', () => {
  beforeEach(() => resetIdCounter())

  it('execute and invert', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new SetCapo(i.trackId, 2, 0)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].capo).toBe(2)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].capo).toBe(0)
  })
})

describe('RenameTrack', () => {
  beforeEach(() => resetIdCounter())

  it('execute and invert', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new RenameTrack(i.trackId, 'Bass', 'Guitar')
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].name).toBe('Bass')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].name).toBe('Guitar')
  })
})

// ---------------------------------------------------------------------------
// Technique commands
// ---------------------------------------------------------------------------

describe('Technique commands', () => {
  beforeEach(() => resetIdCounter())

  function noteLoc(score: ScoreNode) {
    const i = ids(score)
    return {
      trackId: i.trackId,
      barId: i.barId,
      voiceId: i.voiceId,
      beatId: i.beatId,
      noteId: i.noteId,
    }
  }

  function beatLoc(score: ScoreNode) {
    const i = ids(score)
    return {
      trackId: i.trackId,
      barId: i.barId,
      voiceId: i.voiceId,
      beatId: i.beatId,
    }
  }

  it('SetHammerOn execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetHammerOn(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].hammerOrPull).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].hammerOrPull).toBeUndefined()
  })

  it('SetPullOff execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetPullOff(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].hammerOrPull).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].hammerOrPull).toBeUndefined()
  })

  it('SetSlide execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetSlide(loc, 'legato', undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].slide).toBe('legato')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].slide).toBeUndefined()
  })

  it('SetBend execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const bend = [{ position: 0, value: 4 }, { position: 30, value: 8 }]
    const cmd = new SetBend(loc, bend, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].bend).toEqual(bend)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].bend).toBeUndefined()
  })

  it('SetVibrato execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetVibrato(loc, 'slight', undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].vibrato).toBe('slight')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].vibrato).toBeUndefined()
  })

  it('SetHarmonic execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetHarmonic(loc, 'natural', undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].harmonic).toBe('natural')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].harmonic).toBeUndefined()
  })

  it('SetTie execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetTie(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].tie).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].tie).toBeUndefined()
  })

  it('SetGhost execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetGhost(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].ghost).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].ghost).toBeUndefined()
  })

  it('SetDeadNote execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetDeadNote(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].dead).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].dead).toBeUndefined()
  })

  it('SetTap execute / invert', () => {
    const score = makeScore()
    const loc = noteLoc(score)
    const cmd = new SetTap(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].tap).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].tap).toBeUndefined()
  })

  it('SetPalmMute execute / invert', () => {
    const score = makeScore()
    const loc = beatLoc(score)
    const cmd = new SetPalmMute(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].palmMute).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].palmMute).toBeUndefined()
  })

  it('SetLetRing execute / invert', () => {
    const score = makeScore()
    const loc = beatLoc(score)
    const cmd = new SetLetRing(loc, true, undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].letRing).toBe(true)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].letRing).toBeUndefined()
  })

  it('SetAccent execute / invert', () => {
    const score = makeScore()
    const loc = beatLoc(score)
    const cmd = new SetAccent(loc, 'heavy', undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].accent).toBe('heavy')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].accent).toBeUndefined()
  })

  it('SetStroke execute / invert', () => {
    const score = makeScore()
    const loc = beatLoc(score)
    const cmd = new SetStroke(loc, 'down', undefined)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].pickStroke).toBe('down')

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].pickStroke).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Selection commands
// ---------------------------------------------------------------------------

describe('BulkTranspose', () => {
  beforeEach(() => resetIdCounter())

  it('execute shifts frets up', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new BulkTranspose(
      [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }],
      2,
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(7)
  })

  it('invert shifts frets back down', () => {
    const score = makeScore()
    const i = ids(score)
    const refs = [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }]
    const cmd = new BulkTranspose(refs, 2)
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(5)
  })

  it('does not go below fret 0', () => {
    const score = makeScore()
    const i = ids(score)
    const cmd = new BulkTranspose(
      [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }],
      -100,
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(0)
  })
})

describe('BulkShiftString', () => {
  beforeEach(() => resetIdCounter())

  it('execute and invert', () => {
    const score = makeScore()
    const i = ids(score)
    const refs = [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }]
    const cmd = new BulkShiftString(refs, 1)
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].string).toBe(2)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].string).toBe(1)
  })
})

describe('DeleteSelection', () => {
  beforeEach(() => resetIdCounter())

  it('removes beats and invert re-inserts them', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const refs = [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }]
    const cmd = new DeleteSelection(refs)
    const r1 = cmd.execute(ctx)
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(0)

    const inv = cmd.invert({ ...ctx, score: r1.score })
    const r2 = inv.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(1)
  })
})

describe('BulkSetDuration', () => {
  beforeEach(() => resetIdCounter())

  it('execute changes durations; invert restores them', () => {
    const score = makeScore()
    const i = ids(score)
    const ref = { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }

    const cmd = new BulkSetDuration([
      { ref, duration: { value: 8, dots: 0 }, oldDuration: { value: 4, dots: 0 } },
    ])
    const r1 = cmd.execute(makeCtx(score))
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.value).toBe(8)

    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats[0].duration.value).toBe(4)
  })
})

describe('CopySelection', () => {
  beforeEach(() => resetIdCounter())

  it('execute does not mutate score', () => {
    const score = makeScore()
    const i = ids(score)
    const beat = score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    const cmd = new CopySelection(
      [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }],
      [beat],
    )
    const r = cmd.execute(makeCtx(score))
    expect(r.score).toBe(score) // same reference — no mutation
    expect(cmd.getCopiedBeats()).toHaveLength(1)
  })

  it('invert returns self (no-op)', () => {
    const score = makeScore()
    const i = ids(score)
    const beat = score.tracks[0].staves[0].bars[0].voices[0].beats[0]
    const cmd = new CopySelection(
      [{ trackId: i.trackId, barId: i.barId, voiceId: i.voiceId, beatId: i.beatId }],
      [beat],
    )
    expect(cmd.invert(makeCtx(score))).toBe(cmd)
  })
})

describe('PasteSelection', () => {
  beforeEach(() => resetIdCounter())

  it('execute inserts beats; invert removes them', () => {
    const score = makeScore()
    const i = ids(score)
    const ctx = makeCtx(score)

    const templateBeat = makeBeat()
    const newId = makeId()

    const paste = new PasteSelection(
      { trackId: i.trackId, barId: i.barId, voiceId: i.voiceId },
      1,
      [templateBeat],
      [newId],
    )
    const r1 = paste.execute(ctx)
    expect(r1.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(2)

    const inv = paste.invert({ ...ctx, score: r1.score })
    const r2 = inv.execute({ ...ctx, score: r1.score })
    expect(r2.score.tracks[0].staves[0].bars[0].voices[0].beats).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// SetMeta
// ---------------------------------------------------------------------------

describe('SetMeta', () => {
  beforeEach(() => resetIdCounter())

  it('execute patches meta fields', () => {
    const score = makeScore()
    const cmd = new SetMeta({ title: 'New Title', tempo: 140 }, { title: 'Test', tempo: 120 })
    const r = cmd.execute(makeCtx(score))
    expect(r.score.meta.title).toBe('New Title')
    expect(r.score.meta.tempo).toBe(140)
  })

  it('invert restores old meta', () => {
    const score = makeScore()
    const cmd = new SetMeta({ title: 'New Title' }, { title: 'Test' })
    const r1 = cmd.execute(makeCtx(score))
    const inv = cmd.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r1.score))
    expect(r2.score.meta.title).toBe('Test')
  })

  it('merge combines patches', () => {
    const cmd1 = new SetMeta({ title: 'A' }, { title: 'Original' })
    const cmd2 = new SetMeta({ title: 'B', tempo: 99 }, { title: 'A' })
    const merged = cmd1.merge!(cmd2)
    expect(merged).not.toBeNull()

    const score = makeScore()
    const r = merged!.execute(makeCtx(score))
    expect(r.score.meta.title).toBe('B')
    expect(r.score.meta.tempo).toBe(99)

    // Undo should go back to original
    const inv = merged!.invert(makeCtx(score))
    const r2 = inv.execute(makeCtx(r.score))
    expect(r2.score.meta.title).toBe('Original')
  })
})
