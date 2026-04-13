/**
 * Command interface — the base contract for all editor commands.
 *
 * Commands are pure value objects: no side effects, no global state.
 * All AST mutations flow through CommandContext.score.
 */

import type { ScoreNode } from '../ast/types'

// ---------------------------------------------------------------------------
// JSON-serializable value (opaque)
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json }

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface CommandResult {
  /** The new score after execution */
  score: ScoreNode
  /** Bar IDs whose rendering needs to be invalidated */
  affectedBarIds: string[]
}

export interface CommandContext {
  score: ScoreNode
  /** nanoid wrapper — produces a new unique ID */
  generateId: () => string
}

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

export interface Command {
  /** Discriminator — used for merge decisions and serialisation */
  readonly type: string
  /** Human-readable label shown in the undo/redo menu */
  readonly label: string

  /** Apply this command to the given context, returning the new state */
  execute(ctx: CommandContext): CommandResult

  /**
   * Return a command that undoes this one.
   * ctx is the *current* context (before this command was applied).
   * The inverse must capture enough state to restore the previous score.
   */
  invert(ctx: CommandContext): Command

  /** JSON-safe representation for persistence / debugging */
  serialize(): Json

  /** Bar IDs affected by this command (used for cache invalidation) */
  affectedBarIds(): string[]

  /**
   * Optional: try to merge `next` into this command.
   * Return the merged command, or null if merging is not possible.
   * Only called when both commands have the same `type` and were pushed
   * within MERGE_WINDOW_MS of each other.
   */
  merge?(next: Command): Command | null
}
