/**
 * InputMachine — XState v5 state machine for the guitar tab editor.
 *
 * States: idle | inserting | selecting
 *
 * The machine ONLY tracks input mode and the pending two-digit fret buffer.
 * All AST mutations happen in the React hook (useTabEditorInput) that drives
 * this machine via the Actor API.
 *
 * XState v5 notes:
 *  - No `@xstate/react` — use createActor() from 'xstate' directly.
 *  - setup() is the idiomatic v5 API; createMachine() alone also works.
 *  - assign() is imported from 'xstate'.
 *  - actor.send() / actor.getSnapshot() replace the v4 service API.
 */

import { setup, assign } from 'xstate'
import type { Duration } from '../ast/types'

// ---------------------------------------------------------------------------
// Types exported so the hook and components can use them
// ---------------------------------------------------------------------------

export interface HitResult {
  trackIndex: number
  barIndex: number
  voiceIndex: number
  beatIndex: number
  stringIndex: number
}

export type InputEvent =
  | { type: 'ENTER_INSERT' }
  | { type: 'ESCAPE' }
  | { type: 'DIGIT'; digit: number }
  | { type: 'ARROW'; dir: 'left' | 'right' | 'up' | 'down' }
  | { type: 'DURATION'; value: Duration }
  | { type: 'TOGGLE_DOT' }
  | { type: 'TOGGLE_REST' }
  | { type: 'DELETE_NOTE' }
  | { type: 'DELETE_BEAT' }
  | { type: 'TECHNIQUE'; name: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'COPY' }
  | { type: 'PASTE' }
  | { type: 'CUT' }
  | { type: 'MOUSE_DOWN'; hit: HitResult }
  | { type: 'MOUSE_UP' }
  | { type: 'SHIFT_MOUSE_DOWN'; hit: HitResult }
  | { type: 'PENDING_DIGIT_TIMEOUT' }

// Machine context — only pending two-digit fret state lives here
export interface InputContext {
  /**
   * First digit of a two-digit fret (e.g. 1 for fret 12).
   * null means no pending digit.
   */
  pendingDigit: number | null
  /**
   * setTimeout handle so the hook can clear it on cleanup.
   * Stored as number (browser) or NodeJS.Timeout but typed as unknown
   * to remain environment-agnostic.
   */
  pendingTimer: ReturnType<typeof setTimeout> | null
}

// ---------------------------------------------------------------------------
// Machine definition
// ---------------------------------------------------------------------------

export const inputMachine = setup({
  types: {
    context: {} as InputContext,
    events: {} as InputEvent,
  },
  actions: {
    /**
     * Store the first digit of a potential two-digit fret.
     * The timer is NOT managed here — the hook sets it up after the
     * machine transitions so it can call actor.send().
     */
    storePendingDigit: assign({
      pendingDigit: ({ event }) => {
        if (event.type === 'DIGIT') return event.digit
        return null
      },
      pendingTimer: null,
    }),

    /** Clear any pending digit (timeout fired or second digit received). */
    clearPendingDigit: assign({
      pendingDigit: null,
      pendingTimer: null,
    }),
  },
  guards: {
    hasPendingDigit: ({ context }) => context.pendingDigit !== null,
  },
}).createMachine({
  id: 'tabEditorInput',
  initial: 'idle',

  context: {
    pendingDigit: null,
    pendingTimer: null,
  },

  // UNDO / REDO are global — available in every state
  on: {
    UNDO: {},   // handled by the hook via actor.on('UNDO'); no state change
    REDO: {},   // same
    COPY: {},
    PASTE: {},
    CUT: {},
  },

  states: {
    // -----------------------------------------------------------------
    // IDLE — score is focused but not in insert mode
    // -----------------------------------------------------------------
    idle: {
      on: {
        ENTER_INSERT: { target: 'inserting' },

        MOUSE_DOWN: { target: 'inserting' },

        SHIFT_MOUSE_DOWN: { target: 'selecting' },

        // Arrow navigation is allowed in idle (browse without editing)
        ARROW: {},
      },
    },

    // -----------------------------------------------------------------
    // INSERTING — user is actively entering notes
    // -----------------------------------------------------------------
    inserting: {
      on: {
        ESCAPE: {
          target: 'idle',
          actions: 'clearPendingDigit',
        },

        ENTER_INSERT: { target: 'inserting' }, // re-enters same state (no-op effect)

        MOUSE_DOWN: { target: 'inserting' }, // click elsewhere stays in insert mode

        SHIFT_MOUSE_DOWN: { target: 'selecting' },

        ARROW: {},      // hook reads snapshot and moves cursor

        DURATION: {},   // hook reads and dispatches SetDuration command

        TOGGLE_DOT: {}, // hook dispatches ToggleDot

        TOGGLE_REST: {}, // hook dispatches SetRest

        DELETE_NOTE: {}, // hook dispatches DeleteNote

        DELETE_BEAT: {}, // hook dispatches DeleteBeat

        TECHNIQUE: {},  // hook dispatches the appropriate technique command

        /**
         * DIGIT — two-digit fret handling:
         *   First digit  → store in context, start 500 ms timer in the hook.
         *   Second digit → hook detects hasPendingDigit and combines them.
         *   Timeout      → PENDING_DIGIT_TIMEOUT clears and commits first digit.
         */
        DIGIT: {
          actions: 'storePendingDigit',
        },

        PENDING_DIGIT_TIMEOUT: {
          actions: 'clearPendingDigit',
        },
      },
    },

    // -----------------------------------------------------------------
    // SELECTING — shift-click drag range selection
    // -----------------------------------------------------------------
    selecting: {
      on: {
        ESCAPE: {
          target: 'idle',
          actions: 'clearPendingDigit',
        },

        MOUSE_UP: { target: 'inserting' },

        ENTER_INSERT: { target: 'inserting' },

        ARROW: {},
      },
    },
  },
})

// ---------------------------------------------------------------------------
// Export machine type for use in hook
// ---------------------------------------------------------------------------

export type InputMachine = typeof inputMachine
