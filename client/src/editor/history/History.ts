/**
 * History — undo/redo stack with merge and depth-limit support.
 */

import type { Command, CommandContext, CommandResult } from '../commands/Command'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_STACK_DEPTH = 500
export const MERGE_WINDOW_MS = 500

// ---------------------------------------------------------------------------
// CompositeCommand
// ---------------------------------------------------------------------------

/**
 * Holds an ordered list of sub-commands and executes them in sequence.
 * Invert reverses the list and inverts each element.
 */
export class CompositeCommand implements Command {
  readonly type = 'CompositeCommand'

  constructor(
    private readonly commands: Command[],
    readonly label: string = 'Multi-step command',
  ) {}

  execute(ctx: CommandContext): CommandResult {
    let current = ctx.score
    const allAffected = new Set<string>()

    for (const cmd of this.commands) {
      const result = cmd.execute({ ...ctx, score: current })
      current = result.score
      for (const id of result.affectedBarIds) allAffected.add(id)
    }

    return { score: current, affectedBarIds: [...allAffected] }
  }

  invert(ctx: CommandContext): Command {
    // Execute forward first to capture state, then build inverses in reverse
    // We invert in reverse order
    const reversed = [...this.commands].reverse().map((cmd) => cmd.invert(ctx))
    return new CompositeCommand(reversed, `Undo: ${this.label}`)
  }

  serialize(): import('../commands/Command').Json {
    return {
      type: this.type,
      label: this.label,
      commands: this.commands.map((c) => c.serialize()),
    }
  }

  affectedBarIds(): string[] {
    const all = new Set<string>()
    for (const cmd of this.commands) {
      for (const id of cmd.affectedBarIds()) all.add(id)
    }
    return [...all]
  }

  getCommands(): Command[] {
    return this.commands
  }
}

// ---------------------------------------------------------------------------
// Timestamped stack entry
// ---------------------------------------------------------------------------

interface StackEntry {
  command: Command
  timestamp: number
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export class History {
  private undoStack: StackEntry[] = []
  private redoStack: StackEntry[] = []

  /**
   * Execute a command and push it onto the undo stack.
   *
   * If the previous command on the stack has the same `type`, was pushed
   * within MERGE_WINDOW_MS, and implements `merge()`, the two commands are
   * merged into one entry.
   */
  push(cmd: Command, ctx: CommandContext): CommandResult {
    const result = cmd.execute(ctx)
    const now = Date.now()

    // Attempt merge with the top of the undo stack
    const top = this.undoStack[this.undoStack.length - 1]
    if (
      top &&
      top.command.type === cmd.type &&
      now - top.timestamp < MERGE_WINDOW_MS &&
      typeof top.command.merge === 'function'
    ) {
      const merged = top.command.merge(cmd)
      if (merged !== null) {
        this.undoStack[this.undoStack.length - 1] = {
          command: merged,
          timestamp: now,
        }
        // Clear redo on any new edit
        this.redoStack = []
        return result
      }
    }

    // No merge — push normally
    this.undoStack.push({ command: cmd, timestamp: now })

    // Enforce depth limit
    if (this.undoStack.length > MAX_STACK_DEPTH) {
      this.undoStack.shift()
    }

    // Clear redo stack on any new edit
    this.redoStack = []

    return result
  }

  /**
   * Undo the last command.
   * Returns the CommandResult (with the restored score), or null if nothing
   * to undo.
   */
  undo(ctx: CommandContext): CommandResult | null {
    const entry = this.undoStack.pop()
    if (!entry) return null

    const inverse = entry.command.invert(ctx)
    const result = inverse.execute(ctx)

    this.redoStack.push({ command: entry.command, timestamp: Date.now() })
    return result
  }

  /**
   * Redo the last undone command.
   * Returns null if nothing to redo.
   */
  redo(ctx: CommandContext): CommandResult | null {
    const entry = this.redoStack.pop()
    if (!entry) return null

    const result = entry.command.execute(ctx)
    this.undoStack.push({ command: entry.command, timestamp: Date.now() })
    return result
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  /** Exposed for testing. */
  getUndoStackDepth(): number {
    return this.undoStack.length
  }

  getRedoStackDepth(): number {
    return this.redoStack.length
  }
}
