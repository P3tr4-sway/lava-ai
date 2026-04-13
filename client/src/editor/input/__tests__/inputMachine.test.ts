/**
 * InputMachine unit tests using XState v5 createActor.
 *
 * XState v5 notes:
 *   - createActor(machine).start() to create and start an actor
 *   - actor.send(event) to dispatch events
 *   - actor.getSnapshot().value → current state name (string)
 *   - actor.getSnapshot().context → machine context
 *   - actor.stop() on cleanup
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createActor } from 'xstate'
import { inputMachine } from '../InputMachine'
import type { Actor } from 'xstate'
import type { InputMachine } from '../InputMachine'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type InputActor = Actor<InputMachine>

function makeActor(): InputActor {
  const actor = createActor(inputMachine)
  actor.start()
  return actor
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('inputMachine', () => {
  let actor: InputActor

  afterEach(() => {
    actor?.stop()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('starts in idle state', () => {
    actor = makeActor()
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('starts with null pendingDigit', () => {
    actor = makeActor()
    expect(actor.getSnapshot().context.pendingDigit).toBeNull()
  })

  // -------------------------------------------------------------------------
  // idle → inserting
  // -------------------------------------------------------------------------

  it('ENTER_INSERT transitions idle → inserting', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('MOUSE_DOWN transitions idle → inserting', () => {
    actor = makeActor()
    actor.send({
      type: 'MOUSE_DOWN',
      hit: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringIndex: 1 },
    })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  // -------------------------------------------------------------------------
  // inserting → idle
  // -------------------------------------------------------------------------

  it('ESCAPE transitions inserting → idle', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'ESCAPE' })
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('ESCAPE clears pendingDigit', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DIGIT', digit: 1 })
    expect(actor.getSnapshot().context.pendingDigit).toBe(1)
    actor.send({ type: 'ESCAPE' })
    expect(actor.getSnapshot().context.pendingDigit).toBeNull()
  })

  // -------------------------------------------------------------------------
  // DIGIT in inserting
  // -------------------------------------------------------------------------

  it('DIGIT stores pendingDigit in inserting state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DIGIT', digit: 5 })
    expect(actor.getSnapshot().context.pendingDigit).toBe(5)
  })

  it('DIGIT does not change state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DIGIT', digit: 3 })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  // -------------------------------------------------------------------------
  // PENDING_DIGIT_TIMEOUT
  // -------------------------------------------------------------------------

  it('PENDING_DIGIT_TIMEOUT clears pendingDigit', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DIGIT', digit: 1 })
    expect(actor.getSnapshot().context.pendingDigit).toBe(1)

    actor.send({ type: 'PENDING_DIGIT_TIMEOUT' })
    expect(actor.getSnapshot().context.pendingDigit).toBeNull()
  })

  it('PENDING_DIGIT_TIMEOUT does not change state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DIGIT', digit: 1 })
    actor.send({ type: 'PENDING_DIGIT_TIMEOUT' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  // -------------------------------------------------------------------------
  // Global events (UNDO / REDO) — accepted in any state without changing it
  // -------------------------------------------------------------------------

  it('UNDO does not change state when idle', () => {
    actor = makeActor()
    actor.send({ type: 'UNDO' })
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('UNDO does not change state when inserting', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'UNDO' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('REDO does not change state when inserting', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'REDO' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  // -------------------------------------------------------------------------
  // idle → selecting
  // -------------------------------------------------------------------------

  it('SHIFT_MOUSE_DOWN transitions idle → selecting', () => {
    actor = makeActor()
    actor.send({
      type: 'SHIFT_MOUSE_DOWN',
      hit: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringIndex: 1 },
    })
    expect(actor.getSnapshot().value).toBe('selecting')
  })

  // -------------------------------------------------------------------------
  // selecting transitions
  // -------------------------------------------------------------------------

  it('MOUSE_UP transitions selecting → inserting', () => {
    actor = makeActor()
    actor.send({
      type: 'SHIFT_MOUSE_DOWN',
      hit: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringIndex: 1 },
    })
    actor.send({ type: 'MOUSE_UP' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('ESCAPE transitions selecting → idle', () => {
    actor = makeActor()
    actor.send({
      type: 'SHIFT_MOUSE_DOWN',
      hit: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 0, stringIndex: 1 },
    })
    actor.send({ type: 'ESCAPE' })
    expect(actor.getSnapshot().value).toBe('idle')
  })

  // -------------------------------------------------------------------------
  // DURATION / TECHNIQUE / etc — stay in inserting state
  // -------------------------------------------------------------------------

  it('DURATION stays in inserting state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DURATION', value: 4 })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('TECHNIQUE stays in inserting state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'TECHNIQUE', name: 'hammerOn' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('TOGGLE_DOT stays in inserting state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'TOGGLE_DOT' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('DELETE_NOTE stays in inserting state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DELETE_NOTE' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  it('DELETE_BEAT stays in inserting state', () => {
    actor = makeActor()
    actor.send({ type: 'ENTER_INSERT' })
    actor.send({ type: 'DELETE_BEAT' })
    expect(actor.getSnapshot().value).toBe('inserting')
  })

  // -------------------------------------------------------------------------
  // Sequential state machine walks
  // -------------------------------------------------------------------------

  it('full round-trip: idle → inserting → selecting → idle', () => {
    actor = makeActor()

    actor.send({ type: 'ENTER_INSERT' })
    expect(actor.getSnapshot().value).toBe('inserting')

    actor.send({
      type: 'SHIFT_MOUSE_DOWN',
      hit: { trackIndex: 0, barIndex: 0, voiceIndex: 0, beatIndex: 1, stringIndex: 2 },
    })
    expect(actor.getSnapshot().value).toBe('selecting')

    actor.send({ type: 'ESCAPE' })
    expect(actor.getSnapshot().value).toBe('idle')
  })
})
