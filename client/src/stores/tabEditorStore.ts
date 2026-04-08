/**
 * tabEditorStore — Zustand store for the alphaTex guitar tab editor.
 *
 * Separate from the existing editorStore.ts (which drives the MusicXML
 * lead-sheet editor). This store owns:
 *   • The live AlphaTex AST (ScoreNode)
 *   • Undo/redo via the History class
 *   • Current selection
 *   • Input state (duration, insert mode)
 */

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { ScoreNode, DurationNode } from '../editor/ast/types'
import type { Selection } from '../editor/selection/SelectionModel'
import { History } from '../editor/history/History'
import type { Command, CommandContext, CommandResult } from '../editor/commands/Command'

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

interface TabEditorState {
  // Source of truth — the live AST
  ast: ScoreNode | null

  // Undo/redo — holds the History instance
  history: History

  // Current editor selection / cursor
  selection: Selection | null

  // Input state
  currentDuration: DurationNode
  isInsertMode: boolean

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Replace the AST (e.g. on initial load). Does NOT push to undo stack. */
  setAst: (ast: ScoreNode) => void

  /**
   * Execute a command, push it to the undo stack, and update the AST.
   * Silently ignores if ast is null.
   */
  applyCommand: (cmd: Command) => CommandResult | null

  /** Undo last command. Returns the CommandResult or null if nothing to undo. */
  undo: () => CommandResult | null

  /** Redo last undone command. Returns the CommandResult or null. */
  redo: () => CommandResult | null

  /** Set the active selection (cursor or range). */
  setSelection: (sel: Selection | null) => void

  /** Set the current note duration. */
  setDuration: (dur: DurationNode) => void

  /** Enter / exit insert mode. */
  setInsertMode: (on: boolean) => void
}

// ---------------------------------------------------------------------------
// Default duration
// ---------------------------------------------------------------------------

const DEFAULT_DURATION: DurationNode = {
  value: 4, // quarter
  dots: 0,
}

// ---------------------------------------------------------------------------
// generateId helper
// ---------------------------------------------------------------------------

function makeGenerateId(): () => string {
  return () => nanoid()
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTabEditorStore = create<TabEditorState>((set, get) => ({
  ast: null,
  history: new History(),
  selection: null,
  currentDuration: DEFAULT_DURATION,
  isInsertMode: false,

  // -------------------------------------------------------------------------
  // setAst
  // -------------------------------------------------------------------------
  setAst: (ast) => set({ ast }),

  // -------------------------------------------------------------------------
  // applyCommand
  // -------------------------------------------------------------------------
  applyCommand: (cmd) => {
    const { ast, history } = get()
    if (!ast) return null

    const ctx: CommandContext = {
      score: ast,
      generateId: makeGenerateId(),
    }

    const result = history.push(cmd, ctx)
    set({ ast: result.score })
    return result
  },

  // -------------------------------------------------------------------------
  // undo
  // -------------------------------------------------------------------------
  undo: () => {
    const { ast, history } = get()
    if (!ast) return null

    const ctx: CommandContext = {
      score: ast,
      generateId: makeGenerateId(),
    }

    const result = history.undo(ctx)
    if (result) {
      set({ ast: result.score })
    }
    return result
  },

  // -------------------------------------------------------------------------
  // redo
  // -------------------------------------------------------------------------
  redo: () => {
    const { ast, history } = get()
    if (!ast) return null

    const ctx: CommandContext = {
      score: ast,
      generateId: makeGenerateId(),
    }

    const result = history.redo(ctx)
    if (result) {
      set({ ast: result.score })
    }
    return result
  },

  // -------------------------------------------------------------------------
  // selection
  // -------------------------------------------------------------------------
  setSelection: (selection) => set({ selection }),

  // -------------------------------------------------------------------------
  // duration / insert mode
  // -------------------------------------------------------------------------
  setDuration: (dur) => set({ currentDuration: dur }),

  setInsertMode: (on) => set({ isInsertMode: on }),
}))
