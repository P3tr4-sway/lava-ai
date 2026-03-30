import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useProjectStore } from '@/stores/projectStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useVersionStore } from '@/stores/versionStore'
import { agentService } from '@/services/agentService'
import type { AgentMessage, StreamEvent, MessageChip, ArrangementId } from '@lava/shared'
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
        finalizeStream()
        break
      case 'version_created': {
        const payload = event.versionPayload
        if (payload) {
          useVersionStore.getState().addVersion({
            id: payload.versionId,
            name: payload.name,
            source: 'ai-transform',
            musicXml: payload.musicXml,
            createdAt: Date.now(),
          })
          useVersionStore.getState().startPreview(payload.versionId)
          useAgentStore.getState().addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            subtype: 'versionCreated',
            versionAction: {
              versionId: payload.versionId,
              name: payload.name,
              changeSummary: payload.changeSummary,
            },
            createdAt: Date.now(),
          })
        }
        break
      }
      case 'error':
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
