import type { AgentMessage, SpaceContext, StreamEvent, ToolCall } from '@lava/shared'
import { createProvider } from './providers/ProviderFactory.js'
import { ConversationManager } from './ConversationManager.js'
import { createToolRegistry, ToolExecutor } from './tools/index.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { buildContextPrompt } from './prompts/context.js'
import type { LLMProvider, NormalizedMessage } from './providers/types.js'
import { logger } from '../utils/logger.js'

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
    let streamedAssistantText = ''
    const completedToolResults: Array<{ name: string; content: string; isError?: boolean }> = []

    await this.provider.stream(normalizedMessages, tools, systemPrompt, (event) => {
      // Forward text and tool_start events to client
      onEvent(event)

      if (event.type === 'text_delta' && event.delta) {
        streamedAssistantText += event.delta
      }

      if (event.type === 'tool_start' && event.toolCall) {
        pendingToolCalls.push(event.toolCall)
      }
    })

    for (const toolCall of pendingToolCalls) {
      const result = await this.toolExecutor.execute(toolCall)
      onEvent({ type: 'tool_result', toolResult: result })

      if (toolCall.name === 'create_version' && !result.isError) {
        try {
          const parsed = JSON.parse(result.content) as {
            versionId: string
            name: string
            changeSummary: string[]
          }
          // musicXml is read from the original tool call input — not from the
          // handler result — so it is never echoed into the LLM's context window.
          const musicXml = String(toolCall.input?.['musicXml'] ?? '')
          onEvent({
            type: 'version_created',
            versionPayload: {
              versionId: parsed.versionId,
              name: parsed.name,
              musicXml,
              changeSummary: parsed.changeSummary,
            },
          })
        } catch (err) {
          logger.warn({ err }, '[AgentOrchestrator] create_version SSE: malformed tool result JSON')
        }
      }

      completedToolResults.push({
        name: toolCall.name,
        content: result.content,
        isError: result.isError,
      })
    }

    if (shouldSendToolFollowUp(spaceContext, completedToolResults)) {
      const followUpMessages = buildFollowUpMessages(
        normalizedMessages,
        streamedAssistantText,
        completedToolResults,
        spaceContext,
      )

      await this.provider.stream(followUpMessages, [], systemPrompt, onEvent)
    }
  }
}

function shouldSendToolFollowUp(
  spaceContext: SpaceContext,
  toolResults: Array<{ name: string; content: string; isError?: boolean }>,
) {
  if (toolResults.length === 0) return false
  if (spaceContext.coachContext) return false
  if (toolResults.some((result) => result.name === 'coach_message')) return false
  return true
}

function buildFollowUpMessages(
  messages: NormalizedMessage[],
  streamedAssistantText: string,
  toolResults: Array<{ name: string; content: string; isError?: boolean }>,
  spaceContext: SpaceContext,
): NormalizedMessage[] {
  const nextMessages = [...messages]
  const trimmedAssistantText = streamedAssistantText.trim()

  if (trimmedAssistantText) {
    nextMessages.push({ role: 'assistant', content: trimmedAssistantText })
  }

  nextMessages.push({
    role: 'user',
    content: buildToolFollowUpPrompt(toolResults, spaceContext),
  })

  return nextMessages
}

function buildToolFollowUpPrompt(
  toolResults: Array<{ name: string; content: string; isError?: boolean }>,
  spaceContext: SpaceContext,
) {
  const resultLines = toolResults.map((result) => {
    const parsed = parseToolResultContent(result.content)
    return JSON.stringify({
      tool: result.name,
      isError: Boolean(result.isError),
      parsed,
      raw: result.content,
    })
  })

  const isHomeAgent = spaceContext.currentSpace === 'home' && spaceContext.homeMode === 'agent'
  const hasSearchResult = toolResults.some((result) => result.name === 'open_search_results')

  if (isHomeAgent && hasSearchResult) {
    return [
      'Tool results are ready.',
      ...resultLines,
      'Now send the user one short natural follow-up message.',
      'Acknowledge the specific recommendation, say why it fits in plain language, and end with one concrete next step.',
      'Good examples of next steps are asking whether they want to try it, open it, or turn it into a chord chart.',
      'Keep it to 1-2 short sentences and do not mention tools or JSON.',
    ].join('\n')
  }

  return [
    'Tool results are ready.',
    ...resultLines,
    'Now send the user one short, helpful follow-up message about what changed and the best next step.',
    'Keep it concise, action-oriented, and do not mention tools or JSON.',
  ].join('\n')
}

function parseToolResultContent(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}
