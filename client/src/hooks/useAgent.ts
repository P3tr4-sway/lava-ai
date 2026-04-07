import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useProjectStore } from '@/stores/projectStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useVersionStore } from '@/stores/versionStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import { agentService } from '@/services/agentService'
import { projectService } from '@/services/projectService'
import { applyPatch } from '@/lib/applyPatch'
import { parseMusicXmlToScoreDocument } from '@/lib/scoreDocument'
import type { AgentMessage, StreamEvent, MessageChip, ArrangementId, Version } from '@lava/shared'
import { SPACE_ROUTES } from '@lava/shared'
import { toAgentWorkspaceRoute, type AgentWorkspacePreview } from '@/utils/agentWorkspace'

function getOutboundMessages(messages: AgentMessage[]) {
  return messages.filter((message) => !message.localOnly)
}

function getProjectRoute(space: unknown, projectId: unknown) {
  const id = String(projectId ?? '')
  if (!id) return '/songs'

  // All project types now open at /pack/:id
  if (space === 'create' || space === 'learn') return `/pack/${id}`
  return '/songs'
}

function buildWorkspacePreview(route: string, title: string, description: string, action: string): AgentWorkspacePreview {
  return {
    route: toAgentWorkspaceRoute(route),
    title,
    description,
    action,
    updatedAt: Date.now(),
  }
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function deriveVersionNameFromPrompt(prompt: string, fallback?: string) {
  const normalized = prompt.trim().toLowerCase()
  if (!normalized) return fallback ?? 'New Version'

  const rules: Array<{ match: RegExp; name: string }> = [
    { match: /fingerstyle|fingerpicking/, name: 'Fingerstyle Version' },
    { match: /open chord/, name: 'Open Chords Version' },
    { match: /transpose/, name: 'Transposed Version' },
    { match: /blues/, name: 'Blues Version' },
    { match: /fresh cover|cover/, name: 'Fresh Cover Version' },
    { match: /simplify rhythm|rhythm/, name: 'Rhythm Simplified' },
    { match: /more teachable|easier to teach|easier|simpler/, name: 'Simplified Version' },
    { match: /solo section|guitar solo|solo/, name: 'Solo Section Version' },
    { match: /strumming/, name: 'New Strumming Version' },
    { match: /fills|embellishments/, name: 'Fills Version' },
    { match: /change chords|alternative chords|open chords/, name: 'Chord Rewrite' },
  ]

  const matched = rules.find((rule) => rule.match.test(normalized))
  if (matched) return matched.name

  const cleaned = normalized
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b(make|create|turn|rewrite|change|use|add|suggest|give|this|song|version|section|bars?|into|for|of|the|a|an|my|me)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const keyword = cleaned.split(' ').slice(0, 3).join(' ').trim()
  if (!keyword) return fallback ?? 'New Version'

  return `${toTitleCase(keyword)} Version`
}

export function useAgent() {
  const navigate = useNavigate()
  const {
    addMessage,
    appendStreamDelta,
    startToolCall,
    completeToolCall,
    setStreaming,
    finalizeStream,
    setWorkspacePreview,
  } = useAgentStore()

  const isHomeAgentMode = () => {
    const { currentSpace, homeMode } = useAgentStore.getState().spaceContext
    return currentSpace === 'home' && homeMode === 'agent'
  }

  const persistVersion = (version: Version, changeSummary?: string[]) => {
    const projectId = useAgentStore.getState().spaceContext.projectId
      ?? useProjectStore.getState().activeProject?.id
    if (!projectId) return

    void projectService.createVersion(projectId, {
      ...version,
      changeSummary,
    }).catch((error) => {
      console.error('[useAgent] Failed to persist version:', error)
    })
  }

  const getLatestUserPrompt = () => {
    const messages = useAgentStore.getState().messages
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    return latestUserMessage?.content?.trim() ?? ''
  }

  const handleToolResult = (resultContent: string) => {
    try {
      const result = JSON.parse(resultContent)

      if (result.action === 'navigate' && result.space) {
        const route = SPACE_ROUTES[result.space as keyof typeof SPACE_ROUTES]
        if (route) {
          if (isHomeAgentMode()) {
            const title = String(result.space).charAt(0).toUpperCase() + String(result.space).slice(1)
            setWorkspacePreview(
              buildWorkspacePreview(
                route,
                title,
                `Agent switched to ${title.toLowerCase()}.`,
                'navigate',
              ),
            )
          } else {
            navigate(route)
          }
        }
      }

      if (result.action === 'open_search_results' && result.query) {
        const route = `/search?q=${encodeURIComponent(String(result.query))}`
        const selectedSong = [result.songTitle, result.artist]
          .map((value: unknown) => String(value ?? '').trim())
          .filter(Boolean)
          .join(' · ')
        const reason = String(result.selectionReason ?? '').trim()
        if (isHomeAgentMode()) {
          setWorkspacePreview(
            buildWorkspacePreview(
              route,
              'Songs',
              selectedSong
                ? reason
                  ? `Picked "${selectedSong}" because ${reason}.`
                  : `Showing the selected recommendation: "${selectedSong}".`
                : `Showing search results for "${String(result.query)}".`,
              'open_search_results',
            ),
          )
        } else {
          navigate(route)
        }
      }

      if (result.id && result.space) {
        const route = getProjectRoute(result.space, result.id)
        if (isHomeAgentMode()) {
          setWorkspacePreview(
            buildWorkspacePreview(
              route,
              String(result.name ?? 'Project'),
              `Opened ${String(result.name ?? 'project')} in ${String(result.space)}.`,
              'open_project',
            ),
          )
        } else {
          navigate(route)
        }
      }

      if (result.projectId && result.space) {
        const route = getProjectRoute(result.space, result.projectId)
        if (isHomeAgentMode()) {
          setWorkspacePreview(
            buildWorkspacePreview(
              route,
              String(result.name ?? 'Project'),
              `Opened ${String(result.name ?? 'project')} in ${String(result.space)}.`,
              'open_project',
            ),
          )
        } else {
          navigate(route)
        }
      }
    } catch {
      // not a JSON result, ignore
    }
  }

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'text_delta':
        if (event.delta) appendStreamDelta(event.delta)
        break
      case 'tool_start':
        if (event.toolCall) startToolCall(event.toolCall)
        break
      case 'tool_result':
        if (event.toolResult) {
          completeToolCall(event.toolResult)
          handleToolResult(event.toolResult.content)
        }
        break
      case 'message_stop':
        // If a patch session is still open when the stream ends normally, roll back
        // (this means end_edit_session was never received)
        if (useVersionStore.getState().isPatchSession) {
          useVersionStore.getState().rollbackPatchSession()
          console.warn('[useAgent] Stream ended with open patch session — rolling back')
        }
        finalizeStream()
        break
      case 'version_created': {
        const payload = event.versionPayload
        if (payload) {
          const prompt = getLatestUserPrompt()
          const derivedName = deriveVersionNameFromPrompt(prompt, payload.name)
          const version: Version = {
            id: payload.versionId,
            name: derivedName,
            source: 'ai-transform',
            musicXml: payload.musicXml,
            scoreSnapshot: payload.scoreSnapshot ?? parseMusicXmlToScoreDocument(payload.musicXml),
            createdAt: Date.now(),
            prompt,
          }
          useVersionStore.getState().addVersion(version)
          persistVersion(version, payload.changeSummary)
          useVersionStore.getState().startPreview(payload.versionId)
          useAgentStore.getState().addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            subtype: 'versionCreated',
            versionAction: {
              versionId: payload.versionId,
              name: derivedName,
              changeSummary: payload.changeSummary,
            },
            createdAt: Date.now(),
          })
        }
        break
      }
      case 'score_patch': {
        const patch = event.patch
        if (patch) {
          // Start a patch session on the first patch in a turn
          const versionState = useVersionStore.getState()
          if (!versionState.isPatchSession) {
            versionState.startPatchSession()
          }
          // Apply the patch to the current score XML
          const currentXml = useLeadSheetStore.getState().musicXml
          if (currentXml) {
            try {
              const newXml = applyPatch(currentXml, patch)
              useLeadSheetStore.getState().setMusicXml(newXml)
              useScoreDocumentStore.getState().loadFromMusicXml(newXml)
            } catch (err) {
              console.error('[score_patch] Failed to apply patch:', err)
            }
          }
        }
        break
      }
      case 'score_command_patch': {
        const commandPatch = event.commandPatch
        if (commandPatch) {
          const versionState = useVersionStore.getState()
          if (!versionState.isPatchSession) {
            versionState.startPatchSession()
          }
          useScoreDocumentStore.getState().applyCommandPatch(commandPatch, false)
        }
        break
      }
      case 'score_patch_session_end': {
        const payload = event.patchSessionEndPayload
        if (payload) {
          const prompt = getLatestUserPrompt()
          const derivedName = deriveVersionNameFromPrompt(prompt, payload.name)
          useVersionStore.getState().endPatchSession(
            payload.versionId,
            derivedName,
            payload.changeSummary,
          )
          useVersionStore.getState().updateVersion(payload.versionId, { prompt, name: derivedName })
          const version = useVersionStore.getState().versions.find((entry) => entry.id === payload.versionId)
          if (version) {
            persistVersion(version, payload.changeSummary)
          }
          // Add a synthetic message showing the version card (same as version_created)
          useAgentStore.getState().addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            subtype: 'versionCreated',
            versionAction: {
              versionId: payload.versionId,
              name: derivedName,
              changeSummary: payload.changeSummary,
            },
            createdAt: Date.now(),
          })
        }
        break
      }
      case 'error':
        // Rollback any active patch session on stream error
        if (useVersionStore.getState().isPatchSession) {
          useVersionStore.getState().rollbackPatchSession()
        }
        finalizeStream()
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: event.error || 'Sorry, I encountered an error. Please try again.',
          createdAt: Date.now(),
        })
        break
    }
  }

  const sendMessage = async (content: string) => {
    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now(),
    }
    addMessage(userMsg)

    setStreaming(true)

    try {
      const allMessages = getOutboundMessages([...useAgentStore.getState().messages])

      await agentService.streamChat(allMessages, useAgentStore.getState().spaceContext, handleStreamEvent)
    } catch (err) {
      // Rollback any active patch session on network error
      if (useVersionStore.getState().isPatchSession) {
        useVersionStore.getState().rollbackPatchSession()
      }
      finalizeStream()
      const errorMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: Date.now(),
      }
      addMessage(errorMsg)
    }
  }

  const sendHiddenMessage = async (content: string) => {
    const hiddenMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now(),
      hidden: true,
    }
    addMessage(hiddenMsg)
    setStreaming(true)
    try {
      await agentService.streamChat(
        getOutboundMessages([...useAgentStore.getState().messages]),
        useAgentStore.getState().spaceContext,
        handleStreamEvent,
      )
    } catch {
      // Rollback any active patch session on network error
      if (useVersionStore.getState().isPatchSession) {
        useVersionStore.getState().rollbackPatchSession()
      }
      finalizeStream()
    }
  }

  const handleChipClick = (chip: MessageChip) => {
    if (chip.action === 'select_arrangement') {
      useLeadSheetStore.getState().selectArrangement(chip.value as ArrangementId)
      return
    }

    if (chip.action === 'set_score_view' && ['lead_sheet', 'staff', 'tab'].includes(chip.value)) {
      useLeadSheetStore.getState().setScoreView(chip.value as 'lead_sheet' | 'staff' | 'tab')
      return
    }

    sendMessage(chip.value)
  }

  return {
    sendMessage,
    sendHiddenMessage,
    handleChipClick,
  }
}
