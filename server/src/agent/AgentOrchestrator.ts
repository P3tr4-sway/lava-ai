import type { AgentMessage, SpaceContext, StreamEvent, ToolCall } from '@lava/shared'
import { createProvider } from './providers/ProviderFactory.js'
import { ConversationManager } from './ConversationManager.js'
import { createToolRegistry, ToolExecutor } from './tools/index.js'
import { SYSTEM_PROMPT } from './prompts/system.js'
import { buildContextPrompt } from './prompts/context.js'
import type { LLMProvider, NormalizedMessage } from './providers/types.js'
import { logger } from '../utils/logger.js'
import { SCORE_COMMAND_TOOL_NAMES, SCORE_PATCH_TOOL_NAMES } from './tools/definitions/scoreEdit.tool.js'

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

      if (SCORE_COMMAND_TOOL_NAMES.has(toolCall.name) && !result.isError) {
        onEvent({
          type: 'score_command_patch',
          commandPatch: toolCallToCommandPatch(toolCall),
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

    // 兜底：模型有时会调用编辑工具但漏掉 end_edit_session。
    // 如果这里不补结束事件，前端会在 message_stop 时把整轮编辑回滚，看起来像“没有反应”。
    if (shouldAutoFinalizeEditSession(completedToolResults)) {
      onEvent({
        type: 'score_patch_session_end',
        patchSessionEndPayload: buildAutoPatchSessionEndPayload(completedToolResults),
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
  if (toolResults.every((result) => SCORE_PATCH_TOOL_NAMES.has(result.name) || SCORE_COMMAND_TOOL_NAMES.has(result.name))) return false
  return true
}

function shouldAutoFinalizeEditSession(
  toolResults: Array<{ name: string; content: string; isError?: boolean }>,
) {
  const hasSuccessfulScoreEdit = toolResults.some(
    (result) =>
      !result.isError &&
      (SCORE_PATCH_TOOL_NAMES.has(result.name) || SCORE_COMMAND_TOOL_NAMES.has(result.name)),
  )
  if (!hasSuccessfulScoreEdit) return false
  if (toolResults.some((result) => result.name === 'end_edit_session' && !result.isError)) return false
  if (toolResults.some((result) => result.name === 'create_version' && !result.isError)) return false
  return true
}

function buildAutoPatchSessionEndPayload(
  toolResults: Array<{ name: string; content: string; isError?: boolean }>,
): import('@lava/shared').ScorePatchSessionEndPayload {
  const successfulEdits = toolResults.filter(
    (result) =>
      !result.isError &&
      (SCORE_PATCH_TOOL_NAMES.has(result.name) || SCORE_COMMAND_TOOL_NAMES.has(result.name)),
  )
  const names = successfulEdits.map((result) => result.name)
  const summary = summarizeEditTools(names)

  return {
    versionId: crypto.randomUUID(),
    name: summary.name,
    changeSummary: summary.changeSummary,
  }
}

function summarizeEditTools(toolNames: string[]) {
  const uniqueNames = Array.from(new Set(toolNames))

  if (uniqueNames.length === 1) {
    const only = uniqueNames[0]
    switch (only) {
      case 'delete_bars':
        return {
          name: 'Deleted bars',
          changeSummary: ['Removed the requested bars from the score.'],
        }
      case 'edit_chord':
      case 'reharmonize_selection':
        return {
          name: 'Updated harmony',
          changeSummary: ['Adjusted the chord symbols in the requested section.'],
        }
      case 'transpose_bars':
      case 'transpose_selection':
        return {
          name: 'Transposed section',
          changeSummary: ['Transposed the requested notes or bars.'],
        }
      case 'set_string_fret':
      case 'simplify_fingering':
        return {
          name: 'Updated fingering',
          changeSummary: ['Changed the tablature fingering for the selected notes.'],
        }
      case 'insert_rest':
        return {
          name: 'Inserted rest',
          changeSummary: ['Added or replaced a rest at the requested beat.'],
        }
      case 'add_measure_before':
      case 'add_measure_after':
        return {
          name: 'Updated structure',
          changeSummary: ['Inserted the requested empty bar into the score.'],
        }
      case 'set_section_label':
        return {
          name: 'Labeled section',
          changeSummary: ['Added a section label to the selected bar range.'],
        }
      case 'set_chord_diagram_placement':
        return {
          name: 'Updated chord diagrams',
          changeSummary: ['Adjusted where the chord diagram appears around the tablature.'],
        }
    }
  }

  return {
    name: 'Score edits',
    changeSummary: [`Applied ${toolNames.length} edit${toolNames.length === 1 ? '' : 's'} to the current score.`],
  }
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

function toolCallToCommandPatch(toolCall: ToolCall): import('@lava/shared').ScoreCommandPatch {
  switch (toolCall.name) {
    case 'insert_note':
      return {
        commands: [{
          type: 'insertNote',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          measureIndex: Number(toolCall.input.measureIndex ?? 0),
          beat: Number(toolCall.input.beat ?? 0),
          note: {
            durationType: String(toolCall.input.durationType ?? 'quarter') as 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth',
            placement: {
              string: Number(toolCall.input.string ?? 1),
              fret: Number(toolCall.input.fret ?? 0),
              confidence: 'explicit',
            },
          },
        }],
      }
    case 'insert_rest':
      return {
        commands: [{
          type: 'insertRestAtCaret',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          measureIndex: Number(toolCall.input.measureIndex ?? 0),
          beat: Number(toolCall.input.beat ?? 0),
          durationType: String(toolCall.input.durationType ?? 'quarter') as 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth',
        }],
      }
    case 'delete_note':
      return {
        commands: (Array.isArray(toolCall.input.noteIds) ? toolCall.input.noteIds : []).map((noteId) => ({
          type: 'deleteNote',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          noteId: String(noteId),
        })),
      }
    case 'set_duration':
      return {
        commands: (Array.isArray(toolCall.input.noteIds) ? toolCall.input.noteIds : []).map((noteId) => ({
          type: 'setDuration',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          noteId: String(noteId),
          durationType: String(toolCall.input.durationType ?? 'quarter') as 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth',
          durationDivisions: 0,
        })),
      }
    case 'set_string_fret':
      return {
        commands: (Array.isArray(toolCall.input.noteIds) ? toolCall.input.noteIds : []).map((noteId) => ({
          type: 'setStringFret',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          noteId: String(noteId),
          string: Number(toolCall.input.string ?? 1),
          fret: Number(toolCall.input.fret ?? 0),
        })),
      }
    case 'add_measure_before':
      return {
        commands: [{
          type: 'addMeasureBefore',
          beforeIndex: Number(toolCall.input.beforeIndex ?? 0),
          count: Number(toolCall.input.count ?? 1),
        }],
      }
    case 'add_measure_after':
      return {
        commands: [{
          type: 'addMeasureAfter',
          afterIndex: Number(toolCall.input.afterIndex ?? 0),
          count: Number(toolCall.input.count ?? 1),
        }],
      }
    case 'set_section_label':
      return {
        commands: [{
          type: 'setSectionLabel',
          startMeasureIndex: Number(toolCall.input.startBar ?? 0),
          endMeasureIndex: Number(toolCall.input.endBar ?? 0),
          label: String(toolCall.input.label ?? ''),
        }],
      }
    case 'set_chord_diagram_placement':
      return {
        commands: [{
          type: 'setChordDiagramPlacement',
          measureIndex: Number(toolCall.input.barIndex ?? 0),
          placement: String(toolCall.input.placement ?? 'hidden') as 'hidden' | 'top' | 'bottom' | 'both',
        }],
      }
    case 'transpose_selection':
      return {
        commands: [{
          type: 'transposeSelection',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          noteIds: Array.isArray(toolCall.input.noteIds) ? toolCall.input.noteIds.map((id) => String(id)) : undefined,
          measureRange: typeof toolCall.input.startBar === 'number' && typeof toolCall.input.endBar === 'number'
            ? [Number(toolCall.input.startBar), Number(toolCall.input.endBar)]
            : null,
          semitones: Number(toolCall.input.semitones ?? 0),
        }],
      }
    case 'change_tuning':
      return {
        commands: [{
          type: 'changeTuning',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          tuning: Array.isArray(toolCall.input.tuning) ? toolCall.input.tuning.map((value) => Number(value)) : [],
        }],
      }
    case 'set_capo':
      return {
        commands: [{
          type: 'setCapo',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          capo: Number(toolCall.input.capo ?? 0),
        }],
      }
    case 'simplify_fingering':
      return {
        commands: [{
          type: 'simplifyFingering',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          measureRange: typeof toolCall.input.startBar === 'number' && typeof toolCall.input.endBar === 'number'
            ? [Number(toolCall.input.startBar), Number(toolCall.input.endBar)]
            : null,
        }],
      }
    case 'reharmonize_selection':
      return {
        commands: [{
          type: 'reharmonizeSelection',
          measureRange: [Number(toolCall.input.startBar ?? 0), Number(toolCall.input.endBar ?? 0)],
          chords: parseChordJson(toolCall.input.chordsJson),
        }],
      }
    case 'add_technique':
      return {
        commands: (Array.isArray(toolCall.input.noteIds) ? toolCall.input.noteIds : []).map((noteId) => ({
          type: 'addTechnique',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          noteId: String(noteId),
          technique: String(toolCall.input.technique) as 'bend' | 'slide' | 'hammerOn' | 'pullOff' | 'palmMute' | 'harmonic' | 'vibrato',
          value: normalizeTechniqueValue(toolCall.input.value),
        })),
      }
    case 'remove_technique':
      return {
        commands: (Array.isArray(toolCall.input.noteIds) ? toolCall.input.noteIds : []).map((noteId) => ({
          type: 'removeTechnique',
          trackId: String(toolCall.input.trackId ?? 'track-active'),
          noteId: String(noteId),
          technique: String(toolCall.input.technique) as 'bend' | 'slide' | 'hammerOn' | 'pullOff' | 'palmMute' | 'harmonic' | 'vibrato',
        })),
      }
    default:
      throw new Error(`No command patch mapping for tool: ${toolCall.name}`)
  }
}

function parseChordJson(chordsJson: unknown): Array<{ beat: number; symbol: string }> {
  try {
    const parsed = JSON.parse(String(chordsJson ?? '[]')) as Array<{ beat: unknown; symbol: unknown }>
    return parsed.map((entry) => ({
      beat: Number(entry.beat ?? 0),
      symbol: String(entry.symbol ?? ''),
    }))
  } catch {
    return []
  }
}

function normalizeTechniqueValue(value: unknown): boolean | 'up' | 'down' | 'shift' | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (value === 'up' || value === 'down' || value === 'shift') return value
  return true
}
