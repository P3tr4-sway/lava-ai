import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, NormalizedMessage } from './types.js'
import type { StreamEvent, ToolCall, ToolDefinition } from '@lava/shared'
import { config } from '../../config/index.js'

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey })
  }

  async stream(
    messages: NormalizedMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> {
    const anthropicMessages = messages.map((m) => ({
      role: m.role === 'tool' ? ('user' as const) : (m.role as 'user' | 'assistant'),
      content: m.content,
    }))

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {}),
              ...(p.type === 'array' && p.items ? { items: p.items } : {}),
            },
          ]),
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    }))

    const stream = await this.client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
    })

    // Track in-progress tool-use blocks by content-block index so we can
    // accumulate the streamed input_json_delta fragments before emitting.
    const pendingToolBlocks = new Map<number, { toolCall: ToolCall; inputJson: string }>()

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          const toolCall: ToolCall = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          }
          pendingToolBlocks.set(event.index, { toolCall, inputJson: '' })
          // Don't emit tool_start yet — input arrives via input_json_delta
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          onEvent({ type: 'text_delta', delta: event.delta.text })
        } else if (event.delta.type === 'input_json_delta') {
          const block = pendingToolBlocks.get(event.index)
          if (block) {
            block.inputJson += event.delta.partial_json
          }
        }
      } else if (event.type === 'content_block_stop') {
        const block = pendingToolBlocks.get(event.index)
        if (block) {
          // Parse the fully-accumulated JSON and emit with complete input
          try {
            block.toolCall.input = JSON.parse(block.inputJson) as Record<string, unknown>
          } catch {
            block.toolCall.input = {}
          }
          onEvent({ type: 'tool_start', toolCall: block.toolCall })
          pendingToolBlocks.delete(event.index)
        }
      } else if (event.type === 'message_stop') {
        onEvent({ type: 'message_stop' })
      }
    }
  }
}
