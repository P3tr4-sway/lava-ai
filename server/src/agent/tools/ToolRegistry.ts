import type { ToolDefinition } from '@lava/shared'

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

export interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  register(definition: ToolDefinition, handler: ToolHandler) {
    this.tools.set(definition.name, { definition, handler })
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition)
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }
}
