import type { AgentMessage, SpaceContext, StreamEvent, ToolCall } from '@lava/shared'
import { createProvider } from './providers/ProviderFactory.js'
import { ConversationManager } from './ConversationManager.js'
import { createToolRegistry, ToolExecutor } from './tools/index.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { buildContextPrompt } from './prompts/context.js'
import type { LLMProvider } from './providers/types.js'

export class AgentOrchestrator {
  private provider: LLMProvider
  private conversationManager: ConversationManager
  private toolExecutor: ToolExecutor
  private toolRegistry = createToolRegistry()

  constructor() {
    this.provider = createProvider()
    this.conversationManager = new ConversationManager()
    this.toolExecutor = new ToolExecutor(this.toolRegistry)
  }

  async run(
    messages: AgentMessage[],
    spaceContext: SpaceContext,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> {
    const systemPrompt = SYSTEM_PROMPT + buildContextPrompt(spaceContext)
    const normalizedMessages = this.conversationManager.normalize(messages)
    const tools = this.toolRegistry.getAll()

    const pendingToolCalls: ToolCall[] = []

    await this.provider.stream(normalizedMessages, tools, systemPrompt, async (event) => {
      // Forward text and tool_start events to client
      onEvent(event)

      if (event.type === 'tool_start' && event.toolCall) {
        pendingToolCalls.push(event.toolCall)
      }

      if (event.type === 'message_stop' && pendingToolCalls.length > 0) {
        // Execute all pending tool calls
        for (const toolCall of pendingToolCalls) {
          const result = await this.toolExecutor.execute(toolCall)
          onEvent({ type: 'tool_result', toolResult: result })
        }
        pendingToolCalls.length = 0
      }
    })
  }
}
