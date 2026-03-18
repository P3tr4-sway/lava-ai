import type { ToolCall, ToolResult } from '@lava/shared'
import type { ToolRegistry } from './ToolRegistry.js'
import { logger } from '../../utils/logger.js'

export class ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.registry.get(toolCall.name)

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
        isError: true,
      }
    }

    try {
      const result = await tool.handler(toolCall.input)
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
        isError: false,
      }
    } catch (err) {
      logger.error({ err, tool: toolCall.name }, 'Tool execution error')
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: String(err) }),
        isError: true,
      }
    }
  }
}
