import type { AgentMessage, SpaceContext, StreamEvent, ToolCall } from '@lava/shared'
import { createProvider } from './providers/ProviderFactory.js'
import { ConversationManager } from './ConversationManager.js'
import { createToolRegistry, ToolExecutor } from './tools/index.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { buildContextPrompt } from './prompts/context.js'
import type { LLMProvider, NormalizedMessage } from './providers/types.js'
import { logger } from '../utils/logger.js'
import { SCORE_PATCH_TOOL_NAMES } from './tools/definitions/scoreEdit.tool.js'

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

          if (isValidMusicXml(musicXml)) {
            onEvent({
              type: 'version_created',
              versionPayload: {
                versionId: parsed.versionId,
                name: parsed.name,
                musicXml,
                changeSummary: parsed.changeSummary,
              },
            })
          } else {
            logger.warn('[AgentOrchestrator] create_version: invalid MusicXML output, skipping version')
            onEvent({
              type: 'error',
              error: "The arrangement couldn't be generated — please try rephrasing your request.",
            })
          }
        } catch (err) {
          logger.warn({ err }, '[AgentOrchestrator] create_version SSE: malformed tool result JSON')
          onEvent({
            type: 'error',
            error: "The arrangement couldn't be generated — please try rephrasing your request.",
          })
        }
      }

      // ── Granular score editing tools → score_patch SSE ──
      if (SCORE_PATCH_TOOL_NAMES.has(toolCall.name) && !result.isError) {
        onEvent({
          type: 'score_patch',
          patch: toolCallToPatch(toolCall),
        })
      }

      // ── end_edit_session → score_patch_session_end SSE ──
      if (toolCall.name === 'end_edit_session' && !result.isError) {
        try {
          const parsed = JSON.parse(result.content) as {
            versionId: string
            name: string
            changeSummary: string[]
          }
          onEvent({
            type: 'score_patch_session_end',
            patchSessionEndPayload: {
              versionId: parsed.versionId,
              name: parsed.name,
              changeSummary: parsed.changeSummary,
            },
          })
        } catch (err) {
          logger.warn({ err }, '[AgentOrchestrator] end_edit_session SSE: malformed tool result JSON')
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
  // Skip follow-up if all tools are granular score edits (not end_edit_session)
  if (toolResults.every((result) => SCORE_PATCH_TOOL_NAMES.has(result.name))) return false
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

function isValidMusicXml(xml: string): boolean {
  if (!xml || xml.trim().length === 0) return false
  if (!xml.includes('<score-partwise')) return false
  if (!xml.includes('</score-partwise>')) return false
  if (!xml.includes('<measure')) return false
  return true
}

/** Map tool name + input to a ScorePatch with the correct `op` field. */
function toolCallToPatch(toolCall: ToolCall): import('@lava/shared').ScorePatch {
  const TOOL_TO_OP: Record<string, import('@lava/shared').ScorePatchOp> = {
    edit_note_pitch: 'setNotePitch',
    edit_note_duration: 'setNoteDuration',
    edit_chord: 'setChord',
    edit_key_signature: 'setKeySig',
    edit_time_signature: 'setTimeSig',
    add_bars: 'addBars',
    delete_bars: 'deleteBars',
    transpose_bars: 'transposeBars',
    add_accidental: 'addAccidental',
    toggle_rest: 'toggleRest',
    toggle_tie: 'toggleTie',
    set_annotation: 'setAnnotation',
    set_lyric: 'setLyric',
  }
  const op = TOOL_TO_OP[toolCall.name]
  if (!op) throw new Error(`No patch op mapping for tool: ${toolCall.name}`)
  return { op, ...toolCall.input }
}
