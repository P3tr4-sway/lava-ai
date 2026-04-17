/**
 * useTabEditorInput — React hook wiring XState inputMachine to DOM events.
 *
 * Responsibilities:
 *   1. Creates an XState v5 actor from inputMachine (no @xstate/react needed).
 *   2. Attaches a keydown listener to window when the editor is focused.
 *   3. Translates keydown events → machine events (send()).
 *   4. Reacts to machine state snapshots to dispatch Commands via
 *      useTabEditorStore.applyCommand().
 *   5. Handles two-digit fret logic (pending digit + 500 ms timer).
 *   6. Returns { machineState, send, handleBeatClick, selectionRef } for components.
 *
 * XState v5 notes:
 *   - createActor(machine).start() replaces v4 interpret(machine).start()
 *   - actor.subscribe(snapshot => ...) for state changes
 *   - actor.getSnapshot() for current state
 *   - actor.send(event) to dispatch events
 *   - snapshot.value is the state name string
 *   - snapshot.context is the context object
 *
 * Command API notes:
 *   - All commands use string IDs (trackId, barId, voiceId, beatId, noteId)
 *   - Helper: resolveIds() maps numeric cursor indices → string IDs
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { createActor } from 'xstate'
import { inputMachine } from '../editor/input/InputMachine'
import type { InputEvent, HitResult } from '../editor/input/InputMachine'
import { SelectionModel } from '../editor/selection/SelectionModel'
import { useTabEditorStore } from '../stores/tabEditorStore'
import { useAudioStore } from '../stores/audioStore'
import type { Cursor, BarSpan } from '../editor/selection/SelectionModel'
import type { HitPosition } from '../render/alphaTabBridge'
import type { HoverState } from './useTabEditorPlacement'
import type { BeatNode, NoteNode, ScoreNode, VoiceNode } from '../editor/ast/types'
import type { Command } from '../editor/commands'
import {
  durationToUnits,
  barCapacityUnits,
  getEffectiveTimeSig,
  splitIntoRests,
} from '../editor/ast/barFill'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PENDING_DIGIT_TIMEOUT_MS = 500

// ---------------------------------------------------------------------------
// Key → Duration map (Guitar Pro convention)
// ---------------------------------------------------------------------------

const KEY_TO_DURATION: Record<string, 1 | 2 | 4 | 8 | 16 | 32 | 64> = {
  q: 1,   // whole
  w: 2,   // half
  e: 4,   // quarter
  r: 8,   // eighth
  t: 16,  // sixteenth
  y: 32,  // 32nd
}

// ---------------------------------------------------------------------------
// ID-resolution helper
// ---------------------------------------------------------------------------

interface ResolvedIds {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
}

interface ResolvedNoteIds extends ResolvedIds {
  noteId: string
}

function resolveIds(
  ast: ScoreNode,
  cursor: Cursor,
): ResolvedIds | null {
  const track = ast.tracks[cursor.trackIndex]
  if (!track) return null
  const bar = track.staves[0]?.bars[cursor.barIndex]
  if (!bar) return null
  const voice = bar.voices[cursor.voiceIndex]
  if (!voice) return null
  const beat = voice.beats[cursor.beatIndex]
  if (!beat) return null
  return {
    trackId: track.id,
    barId: bar.id,
    voiceId: voice.id,
    beatId: beat.id,
  }
}

function resolveNoteIds(
  ast: ScoreNode,
  cursor: Cursor,
): ResolvedNoteIds | null {
  const ids = resolveIds(ast, cursor)
  if (!ids) return null
  const track = ast.tracks[cursor.trackIndex]!
  const bar = track.staves[0]?.bars[cursor.barIndex]!
  const voice = bar.voices[cursor.voiceIndex]!
  const beat = voice.beats[cursor.beatIndex]!
  const note = beat.notes.find((n) => n.string === cursor.stringIndex)
  if (!note) return null
  return { ...ids, noteId: note.id }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface UseTabEditorInputOptions {
  onUndo: () => void
  onRedo: () => void
  onPlay: () => void
  /**
   * Synchronous ref from useTabEditorPlacement — always up-to-date with the
   * latest hover position (updated in handleMouseMove, not during React render).
   */
  hoverStateRef?: React.RefObject<HoverState | null>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabEditorInput({
  onUndo,
  onRedo,
  onPlay,
  hoverStateRef,
}: UseTabEditorInputOptions) {
  // -------------------------------------------------------------------------
  // XState actor — stable ref so it doesn't recreate on render
  // -------------------------------------------------------------------------
  const actorRef = useRef(createActor(inputMachine))

  // Expose machine snapshot as React state so components can re-render
  const [machineState, setMachineState] = useState(
    () => actorRef.current.getSnapshot(),
  )

  // Pending digit timer
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hover-mode pending fret: set when user types digits while hovering but not
  // in insert mode. Committed to the score when the user clicks.
  const hoverPendingFretRef = useRef<number | null>(null)
  // Tracks whether the current insert mode was initiated via hover+digit (not click)
  const hoverTriggeredRef = useRef(false)
  const [hoverPendingFret, setHoverPendingFret] = useState<number | null>(null)

  // SelectionModel — lives in a ref; mutations reflected into the store
  const selectionRef = useRef(new SelectionModel())

  // -------------------------------------------------------------------------
  // Start actor on mount, stop on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    const actor = actorRef.current
    actor.start()

    const subscription = actor.subscribe((snapshot) => {
      setMachineState(snapshot)
    })

    return () => {
      subscription.unsubscribe()
      actor.stop()
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current)
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // send helper — typed wrapper around actor.send
  // -------------------------------------------------------------------------
  const send = useCallback((event: InputEvent) => {
    actorRef.current.send(event)
  }, [])

  // -------------------------------------------------------------------------
  // commitFret — set or insert a note at the cursor position with the given fret.
  //
  // Steps:
  //   1. Clear rest flag if beat.rest === true
  //   2. Apply currentDuration from the store if it differs from beat duration
  //   3. Update existing note's fret (SetFret) OR insert a new note (InsertNote)
  //
  // All steps are wrapped in a single CompositeCommand for atomic undo.
  // After dispatch the cursor advances one beat to the right automatically.
  // -------------------------------------------------------------------------
  const commitFret = useCallback((fret: number, exitAfterCommit?: boolean) => {
    const { ast, currentDuration } = useTabEditorStore.getState()
    if (!ast) return
    // Hard constraint: fret must be within [0, 24] (guitar_notation_rules §hard-constraints)
    // eslint-disable-next-line no-param-reassign
    fret = Math.max(0, Math.min(24, fret))
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    if (!beat) return

    const existingNote = beat.notes.find((n) => n.string === cursor.stringIndex)
    const wasRest = beat.rest  // capture before async: drives typewriter advance decision
    const loc = { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId }

    // --- Pre-compute bar capacity info (before the async import) ---
    const oldBeatUnits = durationToUnits(beat.duration)
    const newBeatUnits = durationToUnits(currentDuration)
    const oldBarTotal = voice.beats.reduce((sum: number, b) => sum + durationToUnits(b.duration), 0)
    const timeSig = getEffectiveTimeSig(ast, cursor.trackIndex, cursor.barIndex)
    const capacity = barCapacityUnits(timeSig)

    // Sibelius rule: when writing a note on an overwrite target (rest beat, or
    // replacing an existing note on the same string), absorb subsequent rests
    // so the new duration fits. Chord-adds (new string on a non-rest beat)
    // never absorb — the beat's duration stays fixed to keep chord-mates in sync.
    const isOverwrite = beat.rest || !!existingNote

    // Sibelius convention: chord-add on V1 with a different selected duration
    // can't share a beat (chord-mates must share a duration). Auto-switch to V2
    // and place the note at the matching rhythmic position so the user gets the
    // two-voice result they intended without pressing Alt+2 manually.
    const isChordAdd = !isOverwrite
    const durationMismatch =
      beat.duration.value !== currentDuration.value ||
      beat.duration.dots !== currentDuration.dots
    const existingV2 = bar?.voices[1]
    const v2IsAllRests =
      !existingV2 || existingV2.beats.every((b) => b.rest || b.notes.length === 0)
    const targetUnits = voice.beats
      .slice(0, cursor.beatIndex)
      .reduce((sum: number, b) => sum + durationToUnits(b.duration), 0)
    const trailingUnits = capacity - targetUnits - newBeatUnits
    const shouldAutoSwitchToV2 =
      isChordAdd &&
      durationMismatch &&
      cursor.voiceIndex === 0 &&
      v2IsAllRests &&
      targetUnits >= 0 &&
      trailingUnits >= 0

    if (shouldAutoSwitchToV2) {
      import('../editor/commands').then(({ AddVoice, RemoveVoice, CompositeCommand }) => {
        const newBeats: BeatNode[] = []
        if (targetUnits > 0) {
          for (const d of splitIntoRests(newBeatUnits, targetUnits).reverse()) {
            newBeats.push({
              id: nanoid(),
              duration: { value: d, dots: 0 },
              notes: [],
              rest: true,
            })
          }
        }
        const noteBeatIndex = newBeats.length
        newBeats.push({
          id: nanoid(),
          duration: currentDuration,
          notes: [{ id: nanoid(), string: cursor.stringIndex, fret }],
          rest: false,
        })
        if (trailingUnits > 0) {
          for (const d of splitIntoRests(newBeatUnits, trailingUnits)) {
            newBeats.push({
              id: nanoid(),
              duration: { value: d, dots: 0 },
              notes: [],
              rest: true,
            })
          }
        }

        const newVoice: VoiceNode = { id: nanoid(), beats: newBeats }
        const cmds: Command[] = []
        if (existingV2) {
          cmds.push(new RemoveVoice(ids.trackId, ids.barId, existingV2.id))
        }
        cmds.push(new AddVoice(ids.trackId, ids.barId, 1, newVoice))
        useTabEditorStore.getState().applyCommand(
          cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Write to Voice 2'),
        )

        // Move cursor onto the new V2 beat and clear any stale hint.
        const model = selectionRef.current
        model.setCursor({ ...cursor, voiceIndex: 1, beatIndex: noteBeatIndex })
        useTabEditorStore.getState().setSelection(model.selection)
        useTabEditorStore.getState().setVoiceHint(null)
      })
      return
    }

    if (isChordAdd && durationMismatch && cursor.voiceIndex === 0) {
      // V2 already has notes — we can't safely replace it, so fall back to
      // the textual hint and let the user resolve it manually.
      useTabEditorStore
        .getState()
        .setVoiceHint('Different duration on same beat — press Alt+2 to use Voice 2')
    }
    let slotUnits = capacity - (oldBarTotal - oldBeatUnits)  // immediate room
    const absorbedBeatIds: string[] = []
    if (isOverwrite && newBeatUnits > slotUnits) {
      for (let i = cursor.beatIndex + 1; i < voice.beats.length; i++) {
        const nb = voice.beats[i]
        if (!nb.rest) break
        slotUnits += durationToUnits(nb.duration)
        absorbedBeatIds.push(nb.id)
        if (slotUnits >= newBeatUnits) break
      }
    }

    const canChangeDuration = newBeatUnits <= slotUnits
    const effectiveNewBeatUnits = canChangeDuration ? newBeatUnits : oldBeatUnits
    const remaining = slotUnits - effectiveNewBeatUnits

    import('../editor/commands').then(({ SetFret, InsertNote, InsertBeat, DeleteBeat, SetRest, SetDuration, CompositeCommand }) => {
      const cmds: Command[] = []

      // Step 0: delete absorbed rest beats in reverse order so indices remain
      // stable for earlier beats.  These are the rests that were consumed to make
      // room for a note longer than its immediate slot (Sibelius absorption rule).
      for (let i = absorbedBeatIds.length - 1; i >= 0; i--) {
        cmds.push(new DeleteBeat(
          { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId },
          absorbedBeatIds[i],
        ))
      }

      // Step 1: clear rest
      if (beat.rest) {
        cmds.push(new SetRest(loc, false, true))
      }

      // Step 2: apply selected duration when it differs.
      // Overwriting a rest or replacing an existing note on the same string
      // adopts the keypad duration (Sibelius rewrite semantics — the current
      // duration is authoritative). Adding a chord tone on a different string
      // preserves beat.duration so chord-mates stay in sync.
      const durationChanged =
        beat.duration.value !== currentDuration.value ||
        beat.duration.dots !== currentDuration.dots
      if (durationChanged && isOverwrite && canChangeDuration) {
        cmds.push(new SetDuration(loc, currentDuration, beat.duration))
      }

      // Step 3: set fret on existing note or insert new note
      if (existingNote) {
        cmds.push(new SetFret({ ...loc, noteId: existingNote.id }, fret, existingNote.fret))
      } else {
        const newNote: NoteNode = { id: nanoid(), string: cursor.stringIndex, fret }
        cmds.push(new InsertNote(loc, newNote, beat.notes.length))
      }

      // Step 4: fill remaining beat-slot duration with canonical rest beats.
      //
      // When the entered note is shorter than the original beat slot, the leftover
      // duration is split into rests using the Binary Fill algorithm (small → large).
      // Example: 16th note in a quarter slot → insert [16th rest, 8th rest].
      //
      // InsertBeat at cursor.beatIndex + 1 + offset correctly pushes any existing
      // beats to the right, so this fills the gap regardless of position in the bar.
      // All inserted rests plus the note command are bundled into one CompositeCommand
      // so Undo removes everything at once.
      if (remaining > 0) {
        const restDurations = splitIntoRests(newBeatUnits, remaining)
        restDurations.forEach((durValue, offset) => {
          const restBeat: BeatNode = {
            id: nanoid(),
            duration: { value: durValue, dots: 0 },
            notes: [],
            rest: true,
          }
          cmds.push(new InsertBeat(
            { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId },
            restBeat,
            cursor.beatIndex + 1 + offset,   // insert in order: +1, +2, …
          ))
        })
      }

      useTabEditorStore.getState().applyCommand(
        cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Enter note'),
      )

      if (exitAfterCommit) {
        // Hover-triggered insert: note placed, now return to idle so the user
        // can hover elsewhere and type another digit without clicking first.
        useTabEditorStore.getState().setSelection(null)
        useTabEditorStore.getState().setInsertMode(false)
        actorRef.current.send({ type: 'ESCAPE' })
      } else {
        // Auto-advance cursor in typewriter mode ONLY when the note was placed
        // on a rest beat (rest → note transition).  When the beat already had a
        // note (chord add or fret update), keep the cursor so the user can
        // continue adding strings to the same beat without pressing ← first.
        if (wasRest) {
          const newAst = useTabEditorStore.getState().ast
          if (newAst) {
            const model = selectionRef.current
            const newCursor = model.moveRight(newAst)
            model.setCursor(newCursor)
            useTabEditorStore.getState().setSelection(model.selection)
          }
        }
      }
    })
  }, [])

  // -------------------------------------------------------------------------
  // handleDigit — two-digit fret logic
  //
  // Two modes depending on context:
  //   INSERT MODE  (isInserting)  — places a note; single digit auto-commits
  //                                  after 500 ms, second digit commits immediately.
  //   HOVER MODE   (!isInserting + hovering) — only updates the ghost preview.
  //                                  No note is placed until the user clicks.
  // -------------------------------------------------------------------------
  const handleDigit = useCallback(
    (digit: number) => {
      const snapshot = actorRef.current.getSnapshot()
      const { pendingDigit } = snapshot.context
      let isInsertingNow = snapshot.value === 'inserting'
      const hover = (hoverStateRef?.current ?? null) as HoverState | null
      // Hover-priority rule: if the user is hovering, snap the cursor to the
      // hovered position and (if needed) enter insert mode. The blue selection
      // rect is purely a visual reminder of the last cursor — hovering over a
      // different beat always overrides it, so a stale click position never
      // hijacks subsequent hover-driven note entry.
      //
      // Exception: when pendingDigit !== null we are mid-typing a multi-digit
      // fret (e.g. user pressed '1' and is about to press '2' for "12").
      // Re-snapping mid-typing would split the digits across two beats, so
      // keep the cursor anchored at the position where the first digit was
      // entered.
      if (hover && pendingDigit === null) {
        const model = selectionRef.current
        const currentVoiceIndex = model.cursor.voiceIndex
        const hit = hover.hit

        // Voice is a persistent mode set via V1/V2 buttons, Alt+1/Alt+2, or an
        // explicit beat click. Hover provides position only — if alphaTab's
        // hit-test landed on a different voice (e.g. V2's whole-bar rest
        // spanning the same horizontal region as V1 notes), snapping to that
        // voice would silently drop the user's selection, so map the hit back
        // into the current voice by rhythmic offset.
        if (hit.voiceIndex !== currentVoiceIndex) {
          const ast = useTabEditorStore.getState().ast
          const hoverBar = ast?.tracks[hit.trackIndex]?.staves[0]?.bars[hit.barIndex]
          const srcVoice = hoverBar?.voices[hit.voiceIndex]
          const dstVoice = hoverBar?.voices[currentVoiceIndex]
          if (srcVoice && dstVoice) {
            const srcOffset = srcVoice.beats
              .slice(0, hit.beatIndex)
              .reduce((sum, b) => sum + durationToUnits(b.duration), 0)
            let acc = 0
            let mappedBeatIndex = Math.max(0, dstVoice.beats.length - 1)
            for (let i = 0; i < dstVoice.beats.length; i++) {
              const u = durationToUnits(dstVoice.beats[i].duration)
              if (srcOffset >= acc && srcOffset < acc + u) {
                mappedBeatIndex = i
                break
              }
              acc += u
            }
            model.setFromHitPosition({
              ...hit,
              voiceIndex: currentVoiceIndex,
              beatIndex: mappedBeatIndex,
            })
          } else {
            // Target voice missing in the hovered bar — accept hover's voice.
            model.setFromHitPosition(hit)
          }
        } else {
          model.setFromHitPosition(hit)
        }
        useTabEditorStore.getState().setSelection(model.selection)
        if (!isInsertingNow) {
          useTabEditorStore.getState().setInsertMode(true)
          send({ type: 'ENTER_INSERT' })
          isInsertingNow = true
        }
        hoverTriggeredRef.current = true
      }

      const exitAfter = hoverTriggeredRef.current

      if (pendingDigit !== null) {
        // Second digit — combine (e.g. 1 → 12)
        const fret = pendingDigit * 10 + digit
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current)
          pendingTimerRef.current = null
        }
        send({ type: 'PENDING_DIGIT_TIMEOUT' }) // clears XState pendingDigit
        hoverPendingFretRef.current = null
        setHoverPendingFret(null)
        hoverTriggeredRef.current = false

        if (isInsertingNow) commitFret(fret, exitAfter)
      } else {
        // First digit — show preview and auto-commit after 500 ms
        send({ type: 'DIGIT', digit })

        if (isInsertingNow) {
          hoverPendingFretRef.current = digit
          setHoverPendingFret(digit)
          pendingTimerRef.current = setTimeout(() => {
            pendingTimerRef.current = null
            send({ type: 'PENDING_DIGIT_TIMEOUT' })
            hoverPendingFretRef.current = null
            setHoverPendingFret(null)
            const exitOnTimeout = hoverTriggeredRef.current
            hoverTriggeredRef.current = false
            commitFret(digit, exitOnTimeout)
          }, PENDING_DIGIT_TIMEOUT_MS)
        }
      }
    },
    [send, commitFret, hoverStateRef],
  )

  // -------------------------------------------------------------------------
  // Arrow cursor update
  // -------------------------------------------------------------------------
  const updateCursorFromArrow = useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      const ast = useTabEditorStore.getState().ast
      if (!ast) return

      const model = selectionRef.current
      let newCursor = model.cursor

      switch (dir) {
        case 'left':
          newCursor = model.moveLeft(ast)
          break
        case 'right':
          newCursor = model.moveRight(ast)
          break
        case 'up':
          newCursor = model.moveUp()
          break
        case 'down':
          newCursor = model.moveDown(ast)
          break
      }

      model.setCursor(newCursor)
      useTabEditorStore.getState().setSelection(model.selection)
    },
    [],
  )

  // -------------------------------------------------------------------------
  // Command dispatchers
  // -------------------------------------------------------------------------

  const applyDuration = useCallback((value: 1 | 2 | 4 | 8 | 16 | 32 | 64) => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    // Capture old duration for invertibility
    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    const oldDuration = beat?.duration ?? { value: 4 as const, dots: 0 as const }

    // Bar capacity guard — only apply if the new duration fits within the beat's room
    if (beat && voice) {
      const timeSig = getEffectiveTimeSig(ast, cursor.trackIndex, cursor.barIndex)
      const capacity = barCapacityUnits(timeSig)
      const oldBeatUnits = durationToUnits(oldDuration)
      const totalUsed = voice.beats.reduce((sum, b) => sum + durationToUnits(b.duration), 0)
      const room = capacity - (totalUsed - oldBeatUnits)
      if (durationToUnits({ value, dots: 0 }) > room) {
        useTabEditorStore.getState().setDuration({ value, dots: 0 })
        return
      }
    }

    import('../editor/commands').then(({ SetDuration }) => {
      const cmd = new SetDuration(
        { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId },
        { value, dots: 0 },
        oldDuration,
      )
      useTabEditorStore.getState().applyCommand(cmd)
    })

    useTabEditorStore.getState().setDuration({ value, dots: 0 })
  }, [])

  const applyRestBeat = useCallback(() => {
    const { ast, currentDuration } = useTabEditorStore.getState()
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    if (!beat || !voice) return

    // Bar capacity guard
    const timeSig = getEffectiveTimeSig(ast, cursor.trackIndex, cursor.barIndex)
    const capacity = barCapacityUnits(timeSig)
    const oldBeatUnits = durationToUnits(beat.duration)
    const newBeatUnits = durationToUnits(currentDuration)
    const totalUsed = voice.beats.reduce((sum, b) => sum + durationToUnits(b.duration), 0)
    const room = capacity - (totalUsed - oldBeatUnits)

    console.debug('[applyRestBeat]', {
      beatIndex: cursor.beatIndex,
      beatCount: voice.beats.length,
      beatDuration: beat.duration,
      currentDuration,
      beatIsRest: beat.rest,
      oldBeatUnits,
      newBeatUnits,
      totalUsed,
      capacity,
      room,
      wouldGuardBlock: newBeatUnits > room,
    })

    if (newBeatUnits > room) return

    // Pre-compute auto-fill info (mirrors commitFret)
    const remaining = room - newBeatUnits

    console.debug('[applyRestBeat] auto-fill check', { remaining })

    const loc = { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId }

    import('../editor/commands').then(({ DeleteNote, SetRest, SetDuration, InsertBeat, CompositeCommand }) => {
      const cmds: Command[] = []

      if (!beat.rest) {
        // Clear existing notes first so the beat data is consistent
        // (rest=true + non-empty notes would be an invalid state).
        for (const note of beat.notes) {
          cmds.push(new DeleteNote(loc, note.id))
        }
        cmds.push(new SetRest(loc, true, false))
        console.debug('[applyRestBeat] pushing DeleteNote×', beat.notes.length, '+ SetRest')
      }

      const durationChanged =
        beat.duration.value !== currentDuration.value ||
        beat.duration.dots !== currentDuration.dots
      if (durationChanged) {
        cmds.push(new SetDuration(loc, currentDuration, beat.duration))
        console.debug('[applyRestBeat] pushing SetDuration', beat.duration, '→', currentDuration)
      }

      // Auto-fill: when the new rest is shorter than the current beat slot,
      // insert canonical rest beats to fill the gap. InsertBeat at
      // cursor.beatIndex + 1 + offset pushes existing beats right, so this
      // works correctly regardless of position in the bar.
      if (remaining > 0) {
        const restDurations = splitIntoRests(newBeatUnits, remaining)
        console.debug('[applyRestBeat] auto-fill restDurations', restDurations)
        restDurations.forEach((durValue, offset) => {
          const restBeat: BeatNode = {
            id: nanoid(),
            duration: { value: durValue, dots: 0 },
            notes: [],
            rest: true,
          }
          cmds.push(new InsertBeat(
            { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId },
            restBeat,
            cursor.beatIndex + 1 + offset,
          ))
        })
      }

      console.debug('[applyRestBeat] total cmds', cmds.length, cmds.map(c => c.type ?? c.constructor.name))

      if (cmds.length > 0) {
        useTabEditorStore.getState().applyCommand(
          cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Insert rest'),
        )
      }

      // Always advance cursor after placing a rest (typewriter mode).
      // This mirrors commitFret's wasRest advance — whether the beat was already
      // a rest or just converted, pressing the rest key means "done with this
      // beat, move on."
      const newAst = useTabEditorStore.getState().ast
      if (newAst) {
        const model = selectionRef.current
        const newCursor = model.moveRight(newAst)
        model.setCursor(newCursor)
        useTabEditorStore.getState().setSelection(model.selection)
      }
    })
  }, [])

  const applyToggleDot = useCallback(() => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    // Bar capacity guard — reject dot addition if it would overflow the bar
    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    if (beat && voice) {
      const nextDots = ((beat.duration.dots + 1) % 3) as 0 | 1 | 2
      if (nextDots > 0) {  // only check when adding dots, not cycling back to 0
        const timeSig = getEffectiveTimeSig(ast, cursor.trackIndex, cursor.barIndex)
        const capacity = barCapacityUnits(timeSig)
        const oldBeatUnits = durationToUnits(beat.duration)
        const totalUsed = voice.beats.reduce((sum, b) => sum + durationToUnits(b.duration), 0)
        const room = capacity - (totalUsed - oldBeatUnits)
        if (durationToUnits({ value: beat.duration.value, dots: nextDots }) > room) return
      }
    }

    import('../editor/commands').then(({ ToggleDot }) => {
      const cmd = new ToggleDot({
        trackId: ids.trackId,
        barId: ids.barId,
        voiceId: ids.voiceId,
        beatId: ids.beatId,
      })
      useTabEditorStore.getState().applyCommand(cmd)
    })
  }, [])

  const applyTechnique = useCallback((name: string) => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveNoteIds(ast, cursor)
    if (!ids) return

    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    const note = beat?.notes.find((n) => n.string === cursor.stringIndex)

    const noteLoc = {
      trackId: ids.trackId,
      barId: ids.barId,
      voiceId: ids.voiceId,
      beatId: ids.beatId,
      noteId: ids.noteId,
    }

    import('../editor/commands').then((cmds) => {
      let cmd
      switch (name) {
        case 'hammerOn':
          cmd = new cmds.SetHammerOn(noteLoc, !note?.hammerOrPull || undefined, note?.hammerOrPull)
          break
        case 'pullOff':
          cmd = new cmds.SetPullOff(noteLoc, !note?.hammerOrPull || undefined, note?.hammerOrPull)
          break
        case 'slide':
          cmd = new cmds.SetSlide(noteLoc, note?.slide === 'legato' ? undefined : 'legato', note?.slide)
          break
        case 'vibrato': {
          // Cycle: none → slight → wide → none
          const next = note?.vibrato === undefined ? 'slight' : note.vibrato === 'slight' ? 'wide' : undefined
          cmd = new cmds.SetVibrato(noteLoc, next, note?.vibrato)
          break
        }
        case 'bend':
          // Cycle: none → half-step → whole-step → bend+release → none
          if (!note?.bend) {
            cmd = new cmds.SetBend(noteLoc, [{ position: 0, value: 0 }, { position: 6, value: 100 }, { position: 12, value: 100 }], undefined)
          } else {
            cmd = new cmds.SetBend(noteLoc, undefined, note.bend)
          }
          break
        case 'tie':
          cmd = new cmds.SetTie(noteLoc, !note?.tie || undefined, note?.tie)
          break
        case 'staccato':
          cmd = new cmds.SetStaccato(noteLoc, !note?.staccato || undefined, note?.staccato)
          break
        default:
          return
      }
      useTabEditorStore.getState().applyCommand(cmd)
    })
  }, [])

  const applyBeatTechnique = useCallback((name: string) => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    if (!beat) return

    const beatLoc = { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId }

    import('../editor/commands').then((cmds) => {
      let cmd
      switch (name) {
        case 'crescendo':
          cmd = new cmds.SetCrescendo(beatLoc, !beat.crescendo || undefined, beat.crescendo)
          break
        case 'decrescendo':
          cmd = new cmds.SetDecrescendo(beatLoc, !beat.decrescendo || undefined, beat.decrescendo)
          break
        case 'arpeggioUp': {
          const cur = beat.arpeggioUp ? 'up' : beat.arpeggioDown ? 'down' : undefined
          cmd = new cmds.SetArpeggio(beatLoc, cur === 'up' ? undefined : 'up', cur)
          break
        }
        case 'arpeggioDown': {
          const cur = beat.arpeggioUp ? 'up' : beat.arpeggioDown ? 'down' : undefined
          cmd = new cmds.SetArpeggio(beatLoc, cur === 'down' ? undefined : 'down', cur)
          break
        }
        case 'fermata':
          cmd = new cmds.SetFermata(beatLoc, beat.fermata ? undefined : { type: 'medium', length: 1 }, beat.fermata)
          break
        case 'tremoloPicking':
          cmd = new cmds.SetTremoloPicking(beatLoc, beat.tremoloPickingDuration === 16 ? undefined : 16, beat.tremoloPickingDuration)
          break
        default:
          return
      }
      useTabEditorStore.getState().applyCommand(cmd)
    })
  }, [])

  const applyDeleteNote = useCallback(() => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveNoteIds(ast, cursor)
    if (!ids) return

    // Peek at the beat to know if this is the last note.
    const beat = ast.tracks[cursor.trackIndex]
      ?.staves[0]?.bars[cursor.barIndex]
      ?.voices[cursor.voiceIndex]?.beats[cursor.beatIndex]
    if (!beat) return
    const isLastNote = beat.notes.length === 1

    const loc = { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId }

    import('../editor/commands').then(({ DeleteNote, SetRest, CompositeCommand }) => {
      const cmds: Command[] = [new DeleteNote(loc, ids.noteId)]
      if (isLastNote) {
        // Last note removed — convert beat to rest so the bar stays full.
        cmds.push(new SetRest(loc, true, false))
      }
      useTabEditorStore.getState().applyCommand(
        cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Delete note'),
      )
      // Stay in insert mode so the user can immediately enter the next note.
    })
  }, [])

  const applyDeleteBeat = useCallback(() => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    const beat = ast.tracks[cursor.trackIndex]
      ?.staves[0]?.bars[cursor.barIndex]
      ?.voices[cursor.voiceIndex]?.beats[cursor.beatIndex]
    if (!beat) return

    // Sibelius rule: Delete converts a note-beat to a rest of the same duration
    // rather than removing the beat (which would leave the bar underfilled).
    // If the beat is already a rest, this is a no-op.
    if (beat.rest) return

    const loc = { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId }

    import('../editor/commands').then(({ DeleteNote, SetRest, CompositeCommand }) => {
      const cmds: Command[] = []
      for (const note of beat.notes) {
        cmds.push(new DeleteNote(loc, note.id))
      }
      cmds.push(new SetRest(loc, true, false))
      useTabEditorStore.getState().applyCommand(
        cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Clear beat'),
      )
      // Stay in insert mode — cursor remains on the now-resting beat.
    })
  }, [])

  // -------------------------------------------------------------------------
  // switchToVoice — change cursor.voiceIndex, creating the voice in the current
  // bar if it doesn't yet exist. Sibelius-style Alt+1/Alt+2 voice switching.
  //
  // Rules:
  //   • Alt+1 always succeeds — voice 0 must always exist.
  //   • Alt+2 on a bar that has only voice 0 → apply AddVoice so V2 exists
  //     (default = bar rest), then move cursor to voiceIndex 1, beatIndex 0.
  //   • Alt+2 on a bar that already has voice 1 → just move the cursor.
  // -------------------------------------------------------------------------
  const switchToVoice = useCallback((targetVoiceIndex: 0 | 1) => {
    // User acted on the hint — clear it regardless of which voice they chose.
    useTabEditorStore.getState().setVoiceHint(null)
    const { ast, currentDuration } = useTabEditorStore.getState()
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    if (!track || !bar) return

    const currentVoice = bar.voices[cursor.voiceIndex]
    const targetVoice = bar.voices[targetVoiceIndex]
    const voiceExists = !!targetVoice

    // Source rhythmic offset (64th-note units from bar start to cursor.beatIndex).
    // Preserving this offset across the voice switch is what lets a V2 note land
    // stacked on its V1 counterpart instead of snapping to the bar's first beat.
    const srcOffset = currentVoice
      ? currentVoice.beats
          .slice(0, cursor.beatIndex)
          .reduce((sum, b) => sum + durationToUnits(b.duration), 0)
      : 0

    const timeSig = getEffectiveTimeSig(ast, cursor.trackIndex, cursor.barIndex)
    const capacity = barCapacityUnits(timeSig)
    const noteUnits = Math.max(1, durationToUnits(currentDuration))

    // Sibelius convention: when leaving V2 → V1, if the V2 being left has no
    // notes (all rests), remove it from this bar so the bar renders cleanly.
    const shouldRemoveLeftVoice =
      cursor.voiceIndex === 1 &&
      targetVoiceIndex === 0 &&
      !!currentVoice &&
      currentVoice.beats.every((b) => b.rest || b.notes.length === 0)

    // Does the target voice already have a beat boundary starting at srcOffset?
    const beatIndexAtOffset = (voice: VoiceNode, offset: number): number | null => {
      let acc = 0
      for (let i = 0; i < voice.beats.length; i++) {
        if (acc === offset) return i
        acc += durationToUnits(voice.beats[i].duration)
      }
      return null
    }

    // Build an all-rest voice whose beats split cleanly at srcOffset so the
    // cursor can land on a beat that starts exactly there.
    const buildAlignedRestVoice = (): VoiceNode => {
      const beats: BeatNode[] = []
      if (srcOffset > 0) {
        for (const d of splitIntoRests(noteUnits, srcOffset).reverse()) {
          beats.push({
            id: nanoid(),
            duration: { value: d, dots: 0 },
            notes: [],
            rest: true,
          })
        }
      }
      const postUnits = capacity - srcOffset
      if (postUnits > 0) {
        for (const d of splitIntoRests(noteUnits, postUnits)) {
          beats.push({
            id: nanoid(),
            duration: { value: d, dots: 0 },
            notes: [],
            rest: true,
          })
        }
      }
      return { id: nanoid(), beats }
    }

    const finishCursorMove = (overrideVoice?: VoiceNode) => {
      const freshAst = useTabEditorStore.getState().ast
      const freshBar = freshAst?.tracks[cursor.trackIndex]?.staves[0]?.bars[cursor.barIndex]
      const freshTargetVoice = overrideVoice ?? freshBar?.voices[targetVoiceIndex]
      let newBeatIndex = 0
      if (freshTargetVoice && freshTargetVoice.beats.length > 0) {
        const exact = beatIndexAtOffset(freshTargetVoice, srcOffset)
        newBeatIndex = exact ?? Math.min(cursor.beatIndex, freshTargetVoice.beats.length - 1)
      }
      const newCursor: Cursor = {
        ...cursor,
        voiceIndex: targetVoiceIndex,
        beatIndex: newBeatIndex,
      }
      selectionRef.current.setCursor(newCursor)
      useTabEditorStore.getState().setSelection(selectionRef.current.selection)
    }

    // Case 1 — leaving an empty V2 for V1. Remove V2, land on V1 at the
    // corresponding rhythmic offset.
    if (shouldRemoveLeftVoice && currentVoice) {
      import('../editor/commands').then(({ RemoveVoice }) => {
        useTabEditorStore.getState().applyCommand(
          new RemoveVoice(track.id, bar.id, currentVoice.id),
        )
        finishCursorMove()
      })
      return
    }

    // Case 2 — target voice doesn't exist. Create it pre-aligned so a beat
    // starts at srcOffset (otherwise the default whole-bar-rest would trap the
    // cursor at beatIndex 0).
    if (!voiceExists) {
      const newVoice = buildAlignedRestVoice()
      import('../editor/commands').then(({ AddVoice }) => {
        useTabEditorStore.getState().applyCommand(
          new AddVoice(track.id, bar.id, targetVoiceIndex, newVoice),
        )
        finishCursorMove(newVoice)
      })
      return
    }

    // Case 3 — target exists and already has a beat boundary at srcOffset.
    // No AST mutation needed; just move the cursor.
    if (beatIndexAtOffset(targetVoice!, srcOffset) !== null) {
      finishCursorMove()
      return
    }

    // Case 4 — target exists but has no beat boundary at srcOffset. When the
    // voice is all rests (typical: a fresh V2 created earlier as a single bar
    // rest), rebuild it aligned. When it has real notes, fall through — we
    // can't safely rewrite user content, so finishCursorMove clamps to the
    // nearest valid index.
    const targetIsAllRests = targetVoice!.beats.every(
      (b) => b.rest || b.notes.length === 0,
    )
    if (targetIsAllRests) {
      const newVoice = buildAlignedRestVoice()
      import('../editor/commands').then(({ AddVoice, RemoveVoice, CompositeCommand }) => {
        useTabEditorStore.getState().applyCommand(
          new CompositeCommand(
            [
              new RemoveVoice(track.id, bar.id, targetVoice!.id),
              new AddVoice(track.id, bar.id, targetVoiceIndex, newVoice),
            ],
            'Switch voice',
          ),
        )
        finishCursorMove(newVoice)
      })
      return
    }

    finishCursorMove()
  }, [])

  // -------------------------------------------------------------------------
  // handleClearBars — wipe all note content from the selected bar(s)
  // -------------------------------------------------------------------------
  const handleClearBars = useCallback(() => {
    const { ast } = useTabEditorStore.getState()
    if (!ast) return
    const sel = selectionRef.current.selection
    if (sel.kind !== 'bar') return

    const barLo = Math.min(sel.from.barIndex, sel.to.barIndex)
    const barHi = Math.max(sel.from.barIndex, sel.to.barIndex)
    const track = ast.tracks[sel.from.trackIndex]
    if (!track) return

    import('../editor/commands').then(({ ClearBar, CompositeCommand }) => {
      const cmds = []
      for (let barIdx = barLo; barIdx <= barHi; barIdx++) {
        const bar = track.staves[0]?.bars[barIdx]
        if (bar) cmds.push(new ClearBar(track.id, bar.id))
      }
      if (cmds.length === 0) return
      useTabEditorStore.getState().applyCommand(
        cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Clear bars'),
      )
    })
  }, [])

  // -------------------------------------------------------------------------
  // Keydown handler
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const stateValue = actorRef.current.getSnapshot().value as string
      const isInserting = stateValue === 'inserting'
      const isIdle = stateValue === 'idle'
      const isMeta = e.ctrlKey || e.metaKey

      // --- Global shortcuts (any state) ---
      if (isMeta && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        onUndo()
        return
      }
      if (
        isMeta &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault()
        onRedo()
        return
      }
      if (isMeta && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        send({ type: 'COPY' })
        return
      }
      if (isMeta && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        send({ type: 'PASTE' })
        return
      }
      if (isMeta && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        send({ type: 'CUT' })
        return
      }

      // --- Alt+1 / Alt+2 → voice switching (Sibelius convention) ---
      // Works in both idle and inserting modes. Alt+2 auto-creates V2 if missing.
      if (e.altKey && !isMeta && (e.key === '1' || e.key === '2')) {
        e.preventDefault()
        switchToVoice(e.key === '1' ? 0 : 1)
        return
      }

      // --- Escape ---
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' })
        // Also clear any hover-mode pending fret preview
        hoverPendingFretRef.current = null
        setHoverPendingFret(null)
        hoverTriggeredRef.current = false
        return
      }

      // --- Space → play/pause (not an AST mutation) ---
      if (e.key === ' ' && (isInserting || isIdle)) {
        e.preventDefault()
        onPlay()
        return
      }

      // --- Arrow keys ---
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        send({ type: 'ARROW', dir: 'left' })
        updateCursorFromArrow('left')
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        send({ type: 'ARROW', dir: 'right' })
        updateCursorFromArrow('right')
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        send({ type: 'ARROW', dir: 'up' })
        updateCursorFromArrow('up')
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        send({ type: 'ARROW', dir: 'down' })
        updateCursorFromArrow('down')
        return
      }

      // Digits 0-9 — available in insert mode OR when hovering (for fret preview)
      if (e.key >= '0' && e.key <= '9') {
        const isHovering = (hoverStateRef?.current ?? null) !== null
        if (isInserting || isHovering) {
          e.preventDefault()
          handleDigit(Number(e.key))
          return
        }
      }

      // --- Bar selection: Delete / Backspace clears bar contents ---
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = selectionRef.current.selection
        if (sel.kind === 'bar') {
          e.preventDefault()
          handleClearBars()
          return
        }
      }

      // --- Enter: enter insert mode at cursor (keyboard-only workflow) ---
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isIdle) {
          useTabEditorStore.getState().setInsertMode(true)
          send({ type: 'ENTER_INSERT' })
        }
        // When already inserting, Enter is a no-op (Escape exits).
        return
      }

      // --- Inserting-only shortcuts ---
      if (!isInserting) return

      // Duration keys
      const durValue = KEY_TO_DURATION[e.key.toLowerCase()]
      if (durValue !== undefined) {
        e.preventDefault()
        send({ type: 'DURATION', value: durValue })
        applyDuration(durValue)
        return
      }

      // Dot
      if (e.key === '.') {
        e.preventDefault()
        send({ type: 'TOGGLE_DOT' })
        applyToggleDot()
        return
      }

      // Rest (minus key)
      if (e.key === '-') {
        e.preventDefault()
        send({ type: 'TOGGLE_REST' })
        applyRestBeat()
        return
      }

      // Techniques — note-level (no modifier)
      const techMap: Record<string, string> = {
        h: 'hammerOn',
        p: 'pullOff',
        s: 'slide',
        b: 'bend',
        v: 'vibrato',
        i: 'tie',
        c: 'staccato',
      }
      const tech = !e.shiftKey && techMap[e.key.toLowerCase()]
      if (tech) {
        e.preventDefault()
        send({ type: 'TECHNIQUE', name: tech })
        applyTechnique(tech)
        return
      }

      // Beat-level technique shortcuts (Shift+key)
      if (e.shiftKey && !isMeta) {
        const beatTechMap: Record<string, string> = {
          '<': 'crescendo',
          ',': 'crescendo',    // comma = < on some keyboards
          '>': 'decrescendo',
          '.': 'decrescendo',  // period = > on some keyboards (conflicts with dot, but only in shift context)
          'a': 'arpeggioUp',
          'd': 'arpeggioDown',
          'f': 'fermata',
          't': 'tremoloPicking',
        }
        const beatTech = beatTechMap[e.key.toLowerCase()] ?? beatTechMap[e.key]
        if (beatTech) {
          e.preventDefault()
          applyBeatTechnique(beatTech)
          return
        }
      }

      // Delete / backspace
      if (e.key === 'Backspace') {
        e.preventDefault()
        send({ type: 'DELETE_NOTE' })
        applyDeleteNote()
        return
      }
      if (e.key === 'Delete') {
        e.preventDefault()
        send({ type: 'DELETE_BEAT' })
        applyDeleteBeat()
        return
      }
    },
    [
      send,
      handleDigit,
      handleClearBars,
      onUndo,
      onRedo,
      onPlay,
      updateCursorFromArrow,
      applyDuration,
      applyRestBeat,
      applyToggleDot,
      applyTechnique,
      applyBeatTechnique,
      applyDeleteNote,
      applyDeleteBeat,
      switchToVoice,
    ],
  )

  // -------------------------------------------------------------------------
  // Keydown listener attachment
  // -------------------------------------------------------------------------
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // -------------------------------------------------------------------------
  // Beat-click handler (called by useTabEditorPlacement.handleClick)
  //
  // Places the cursor at the clicked position and enters insert mode.
  // If a fret was previewed in hover mode (hoverPendingFretRef), it is
  // committed immediately so the workflow is: hover → type → click = place.
  // -------------------------------------------------------------------------
  const handleBeatClick = useCallback(
    (hit: HitResult) => {
      const model = selectionRef.current
      model.setFromHitPosition(hit)
      useTabEditorStore.getState().setSelection(model.selection)
      useTabEditorStore.getState().setInsertMode(true)
      send({ type: 'ENTER_INSERT' })
      hoverTriggeredRef.current = false // click-initiated insert — don't auto-exit

      // Commit hover-mode preview fret, if any
      const pendingHover = hoverPendingFretRef.current
      if (pendingHover !== null) {
        hoverPendingFretRef.current = null
        setHoverPendingFret(null)
        // Also clear any in-flight XState pendingDigit / timer
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current)
          pendingTimerRef.current = null
        }
        send({ type: 'PENDING_DIGIT_TIMEOUT' })
        commitFret(pendingHover)
      }
    },
    [send, commitFret],
  )

  // -------------------------------------------------------------------------
  // Bar-click handler — selects one bar or extends an existing bar selection
  // when shiftKey is true.
  // -------------------------------------------------------------------------
  const handleBarClick = useCallback(
    (hit: HitPosition, shiftKey: boolean) => {
      const model = selectionRef.current
      const span: BarSpan = { trackIndex: hit.trackIndex, barIndex: hit.barIndex }

      if (shiftKey && model.selection.kind === 'bar') {
        model.setBarRange(model.selection.from, span)
      } else {
        model.setBarRange(span, span)
      }

      useTabEditorStore.getState().setSelection(model.selection)
      // Exit insert mode — bar selection is a structural operation, not note entry
      useTabEditorStore.getState().setInsertMode(false)
      send({ type: 'ESCAPE' })
    },
    [send],
  )

  return {
    machineState,
    send,
    handleBeatClick,
    handleBarClick,
    selectionRef,
    hoverPendingFret,
    applyRestBeat,
    applyDuration,
    switchToVoice,
  }
}
