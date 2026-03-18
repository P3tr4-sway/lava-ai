import type { StreamEvent, ToolDefinition } from '@lava/shared'

export interface NormalizedMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
}

export interface LLMProvider {
  stream(
    messages: NormalizedMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void>
}
