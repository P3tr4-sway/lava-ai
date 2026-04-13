/**
 * Meta commands: SetMeta — update fields on MetaNode.
 */

import type { Command, CommandContext, CommandResult, Json } from './Command'
import type { MetaNode } from '../ast/types'

// ---------------------------------------------------------------------------
// SetMeta
// ---------------------------------------------------------------------------

/** Partial update to MetaNode — only the provided keys are changed. */
export type MetaPatch = Partial<MetaNode>

export class SetMeta implements Command {
  readonly type = 'SetMeta'
  readonly label = 'Edit metadata'

  constructor(
    private readonly patch: MetaPatch,
    private readonly oldPatch: MetaPatch,
  ) {}

  execute(ctx: CommandContext): CommandResult {
    const score = {
      ...ctx.score,
      meta: { ...ctx.score.meta, ...this.patch },
    }
    return { score, affectedBarIds: [] }
  }

  invert(_ctx: CommandContext): Command {
    return new SetMeta(this.oldPatch, this.patch)
  }

  serialize(): Json {
    return {
      type: this.type,
      patch: this.patch as unknown as Json,
      oldPatch: this.oldPatch as unknown as Json,
    }
  }

  affectedBarIds(): string[] {
    return []
  }

  merge(next: Command): Command | null {
    if (next instanceof SetMeta) {
      // Merge by overlaying next.patch onto this.patch, preserving this.oldPatch
      return new SetMeta({ ...this.patch, ...next.patch }, this.oldPatch)
    }
    return null
  }
}
