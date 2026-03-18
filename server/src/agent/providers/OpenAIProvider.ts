import OpenAI from 'openai'
import type { LLMProvider, NormalizedMessage } from './types.js'
import type { StreamEvent, ToolCall, ToolDefinition } from '@lava/shared'
import { config } from '../../config/index.js'

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey })
  }

  async stream(
    messages: NormalizedMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> {
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const oaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            t.parameters.map((p) => [
              p.name,
              { type: p.type, description: p.description, ...(p.enum ? { enum: p.enum } : {}) },
            ]),
          ),
          required: t.parameters.filter((p) => p.required).map((p) => p.name),
        },
      },
    }))

    const stream = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: oaiMessages,
      tools: oaiTools,
      stream: true,
    })

    const toolCalls = new Map<number, ToolCall>()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        onEvent({ type: 'text_delta', delta: delta.content })
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls.has(tc.index)) {
            const call: ToolCall = { id: tc.id ?? '', name: tc.function?.name ?? '', input: {} }
            toolCalls.set(tc.index, call)
            onEvent({ type: 'tool_start', toolCall: call })
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        onEvent({ type: 'message_stop' })
      }
    }
  }
}
