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

  /** Project id this AST belongs to — used to detect stale ASTs across navigations */
  astProjectId: string | null

  // Undo/redo — holds the History instance
  history: History

  // Current editor selection / cursor
  selection: Selection | null

  // Input state
  currentDuration: DurationNode
  isInsertMode: boolean

  /** Index of the currently active track in the AST's tracks array. */
  activeTrackIndex: number

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Replace the AST (e.g. on initial load). Does NOT push to undo stack. */
  setAst: (ast: ScoreNode, projectId?: string | null) => void

  /**
   * Reset the store for a new project — clears AST, history, and selection.
   * Must be called when navigating to a different pack so stale ASTs are
   * never re-used for the wrong project.
   */
  resetForProject: (projectId: string | null) => void

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

  /** Switch the active track. Resets cursor to bar 0 of the new track. */
  setActiveTrackIndex: (index: number) => void
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
  astProjectId: null,
  history: new History(),
  selection: null,
  currentDuration: DEFAULT_DURATION,
  isInsertMode: false,
  activeTrackIndex: 0,

  // -------------------------------------------------------------------------
  // setAst
  // -------------------------------------------------------------------------
  setAst: (ast, projectId) =>
    projectId !== undefined
      ? set({ ast, astProjectId: projectId, activeTrackIndex: 0 })
      : set({ ast, activeTrackIndex: 0 }),

  // -------------------------------------------------------------------------
  // resetForProject
  // -------------------------------------------------------------------------
  resetForProject: (projectId) =>
    set({ ast: null, astProjectId: projectId, history: new History(), selection: null, activeTrackIndex: 0 }),

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

  setActiveTrackIndex: (index) => {
    const { ast, selection } = get()
    if (!ast) return
    const clamped = Math.max(0, Math.min(ast.tracks.length - 1, index))
    let updatedSelection = selection
    if (selection) {
      updatedSelection = {
        kind: 'caret',
        cursor: {
          trackIndex: clamped,
          barIndex: 0,
          voiceIndex: 0,
          beatIndex: 0,
          stringIndex: 1,
        },
      }
    }
    set({ activeTrackIndex: clamped, selection: updatedSelection })
  },
}))

// Dev-only debugging — expose store getter on window so we can inspect the AST
// without reaching through React fibers.  Does nothing in production builds.
if (typeof window !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  ;(window as unknown as { __tabStore?: typeof useTabEditorStore }).__tabStore = useTabEditorStore
}
