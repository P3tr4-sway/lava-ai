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
import { createActor } from 'xstate'
import { inputMachine } from '../editor/input/InputMachine'
import type { InputEvent, HitResult } from '../editor/input/InputMachine'
import { SelectionModel } from '../editor/selection/SelectionModel'
import { useTabEditorStore } from '../stores/tabEditorStore'
import { useAudioStore } from '../stores/audioStore'
import type { Cursor } from '../editor/selection/SelectionModel'
import type { ScoreNode } from '../editor/ast/types'

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
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabEditorInput({
  onUndo,
  onRedo,
  onPlay,
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
  // commitFret — apply a fully-resolved fret number via SetFret command
  // -------------------------------------------------------------------------
  const commitFret = useCallback((fret: number) => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveNoteIds(ast, cursor)
    if (!ids) return

    // Capture old fret for invertibility
    const track = ast.tracks[cursor.trackIndex]
    const bar = track?.staves[0]?.bars[cursor.barIndex]
    const voice = bar?.voices[cursor.voiceIndex]
    const beat = voice?.beats[cursor.beatIndex]
    const note = beat?.notes.find((n) => n.string === cursor.stringIndex)
    const oldFret = note?.fret ?? 0

    import('../editor/commands').then(({ SetFret }) => {
      const cmd = new SetFret(
        { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId, noteId: ids.noteId },
        fret,
        oldFret,
      )
      useTabEditorStore.getState().applyCommand(cmd)
    })
  }, [])

  // -------------------------------------------------------------------------
  // handleDigit — two-digit fret logic
  // -------------------------------------------------------------------------
  const handleDigit = useCallback(
    (digit: number) => {
      const snapshot = actorRef.current.getSnapshot()
      const { pendingDigit } = snapshot.context

      if (pendingDigit !== null) {
        // Second digit — combine into fret number (e.g. 1 × 10 + 2 = 12)
        const fret = pendingDigit * 10 + digit
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current)
          pendingTimerRef.current = null
        }
        send({ type: 'PENDING_DIGIT_TIMEOUT' }) // clears context
        commitFret(fret)
      } else {
        // First digit — store and start timer
        send({ type: 'DIGIT', digit })
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null
          send({ type: 'PENDING_DIGIT_TIMEOUT' })
          // Commit single digit as fret on timeout
          commitFret(digit)
        }, PENDING_DIGIT_TIMEOUT_MS)
      }
    },
    [send, commitFret],
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

  const applyToggleDot = useCallback(() => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

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
          cmd = new cmds.SetHammerOn(noteLoc, true, undefined)
          break
        case 'pullOff':
          cmd = new cmds.SetPullOff(noteLoc, true, undefined)
          break
        case 'slide':
          cmd = new cmds.SetSlide(noteLoc, 'legato', undefined)
          break
        case 'vibrato':
          cmd = new cmds.SetVibrato(noteLoc, 'slight', undefined)
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

    import('../editor/commands').then(({ DeleteNote }) => {
      // NoteLocation in noteCommands has { trackId, barId, voiceId, beatId }
      const cmd = new DeleteNote(
        { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId },
        ids.noteId,
      )
      useTabEditorStore.getState().applyCommand(cmd)
    })
  }, [])

  const applyDeleteBeat = useCallback(() => {
    const ast = useTabEditorStore.getState().ast
    if (!ast) return
    const cursor = selectionRef.current.cursor
    const ids = resolveIds(ast, cursor)
    if (!ids) return

    import('../editor/commands').then(({ DeleteBeat }) => {
      // BeatLocation = { trackId, barId, voiceId }; beatId is the second arg
      const cmd = new DeleteBeat(
        { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId },
        ids.beatId,
      )
      useTabEditorStore.getState().applyCommand(cmd)
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

      // --- Escape ---
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' })
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

      // Techniques
      const techMap: Record<string, string> = {
        h: 'hammerOn',
        p: 'pullOff',
        s: 'slide',
        b: 'bend',
        v: 'vibrato',
      }
      const tech = techMap[e.key.toLowerCase()]
      if (tech) {
        e.preventDefault()
        send({ type: 'TECHNIQUE', name: tech })
        applyTechnique(tech)
        return
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

      // Digits 0-9
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleDigit(Number(e.key))
        return
      }
    },
    [
      send,
      handleDigit,
      onUndo,
      onRedo,
      onPlay,
      updateCursorFromArrow,
      applyDuration,
      applyToggleDot,
      applyTechnique,
      applyDeleteNote,
      applyDeleteBeat,
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
  // Beat-click handler (called by useAlphaTabBridge)
  // -------------------------------------------------------------------------
  const handleBeatClick = useCallback(
    (hit: HitResult) => {
      const model = selectionRef.current
      model.setFromHitPosition(hit)
      useTabEditorStore.getState().setSelection(model.selection)
      useTabEditorStore.getState().setInsertMode(true)
      send({ type: 'ENTER_INSERT' })
    },
    [send],
  )

  return {
    machineState,
    send,
    handleBeatClick,
    selectionRef,
  }
}
