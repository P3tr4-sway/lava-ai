import { useLocation, useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useJamStore } from '@/stores/jamStore'
import { useProjectStore } from '@/stores/projectStore'
import { useCoachStore } from '@/stores'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useToneStore } from '@/stores/toneStore'
import { agentService } from '@/services/agentService'
import type { AgentMessage, StreamEvent, MessageChip, CoachingStyle, ArrangementId } from '@lava/shared'
import { SPACE_ROUTES } from '@lava/shared'
import { buildToneAssistantReply } from '@/spaces/jam/toneAssistant'
import { toAgentWorkspaceRoute, type AgentWorkspacePreview } from '@/utils/agentWorkspace'

const VALID_STYLES: CoachingStyle[] = ['passive', 'active', 'checkpoint']

function getOutboundMessages(messages: AgentMessage[]) {
  return messages.filter((message) => !message.localOnly)
}

function getProjectRoute(space: unknown, projectId: unknown) {
  const id = String(projectId ?? '')
  if (!id) return '/projects'

  if (space === 'create') return `/editor/${id}`
  if (space === 'learn') return `/play/${id}`
  if (space === 'tone') return `/tools/new?projectId=${id}`
  if (space === 'jam' || space === 'tools') return `/tools/${id}`
  return '/projects'
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
  const location = useLocation()
  const {
    setActiveThread,
    addMessage,
    appendStreamDelta,
    startToolCall,
    completeToolCall,
    setStreaming,
    finalizeStream,
    setCoachHighlightTarget,
    updateMessage,
    setSpaceContext,
    setWorkspacePreview,
  } = useAgentStore()

  const isHomeAgentMode = () => {
    const { currentSpace, homeMode } = useAgentStore.getState().spaceContext
    return currentSpace === 'home' && homeMode === 'agent'
  }

  const ensureToneProject = async () => {
    const toneState = useToneStore.getState()
    const spaceContext = useAgentStore.getState().spaceContext
    if (spaceContext.currentSpace !== 'tone') return null

    const project = await toneState.ensureProject()
    const threadId = `tone:${project.id}`
    setActiveThread(threadId)
    setSpaceContext({
      ...spaceContext,
      currentSpace: 'tone',
      projectId: project.id,
      projectName: project.name,
    })
    useProjectStore.getState().loadProjects().catch(() => {})

    const nextSearch = new URLSearchParams(location.search)
    nextSearch.set('projectId', project.id)
    navigate(
      {
        pathname: '/tools/new',
        search: `?${nextSearch.toString()}`,
      },
      { replace: true, state: location.state },
    )

    return project
  }

  const sendToneMessage = async (content: string, { hidden = false } = {}) => {
    const spaceContext = useAgentStore.getState().spaceContext
    if (spaceContext.currentSpace !== 'tone') return

    await ensureToneProject()

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now(),
      hidden,
    }
    addMessage(userMsg)
    setStreaming(true)

    await Promise.resolve()

    const toneState = useToneStore.getState()
    const assistantMsg = buildToneAssistantReply(content, {
      selectedPreset: toneState.selectedPreset,
      selectedSlotId: toneState.selectedSlotId,
      activeCategory: toneState.activeCategory,
      chain: toneState.chain,
      pedalKnobs: toneState.pedalKnobs,
    }, useAgentStore.getState().messages)

    addMessage(assistantMsg)
    setStreaming(false)
  }

  const handleToolResult = (resultContent: string) => {
    try {
      const result = JSON.parse(resultContent)

      if (result.action === 'navigate' && result.space) {
        const route = SPACE_ROUTES[result.space as keyof typeof SPACE_ROUTES]
        if (route) {
          if (isHomeAgentMode()) {
            const title = result.space === 'tools' || result.space === 'jam'
              ? 'Tools'
              : result.space === 'learn'
                ? 'Songs'
                : String(result.space).charAt(0).toUpperCase() + String(result.space).slice(1)
            setWorkspacePreview(
              buildWorkspacePreview(
                result.space === 'learn' ? '/?tab=songs' : route,
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

      if (result.action === 'practice_plan' && result.plan) {
        useCalendarStore.getState().setActivePlanPreview(result.plan)
      }

      if (result.action === 'start_jam') {
        useJamStore.getState().setSession({
          id: crypto.randomUUID(),
          projectId: 'agent-home-session',
          bpm: Number(result.bpm ?? 120),
          key: String(result.key ?? 'C'),
          scale: String(result.scale ?? 'major'),
          activeLoops: [],
          startedAt: Date.now(),
        })
        if (isHomeAgentMode()) {
          setWorkspacePreview(
            buildWorkspacePreview(
              '/?tab=tools',
              'Tools',
              `Jam session ready in ${String(result.key ?? 'C')} at ${Number(result.bpm ?? 120)} BPM.`,
              'start_jam',
            ),
          )
        } else {
          navigate('/?tab=tools')
        }
      }

      if (result.action === 'set_tempo') {
        const state = useJamStore.getState()
        const current = state.session
        state.setSession({
          id: current?.id ?? crypto.randomUUID(),
          projectId: current?.projectId ?? 'agent-home-session',
          bpm: Number(result.bpm ?? current?.bpm ?? 120),
          key: current?.key ?? 'C',
          scale: current?.scale ?? 'major',
          activeLoops: current?.activeLoops ?? [],
          backingTrackId: current?.backingTrackId,
          startedAt: current?.startedAt ?? Date.now(),
        })
        if (isHomeAgentMode()) {
          setWorkspacePreview(
            buildWorkspacePreview(
              '/?tab=tools',
              'Tools',
              `Tempo updated to ${Number(result.bpm ?? current?.bpm ?? 120)} BPM.`,
              'set_tempo',
            ),
          )
        }
      }

      if (result.action === 'set_key') {
        const state = useJamStore.getState()
        const current = state.session
        state.setSession({
          id: current?.id ?? crypto.randomUUID(),
          projectId: current?.projectId ?? 'agent-home-session',
          bpm: current?.bpm ?? 120,
          key: String(result.key ?? current?.key ?? 'C'),
          scale: current?.scale ?? 'major',
          activeLoops: current?.activeLoops ?? [],
          backingTrackId: current?.backingTrackId,
          startedAt: current?.startedAt ?? Date.now(),
        })
        if (isHomeAgentMode()) {
          setWorkspacePreview(
            buildWorkspacePreview(
              '/?tab=tools',
              'Tools',
              `Key updated to ${String(result.key ?? current?.key ?? 'C')}.`,
              'set_key',
            ),
          )
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

      if (result.action === 'coach_message') {
        const coachMsg: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.content,
          createdAt: Date.now(),
          subtype: result.subtype,
          targetId: result.targetId,
          chips: result.chips,
        }
        addMessage(coachMsg)

        if (result.subtype === 'highlight' && result.targetId) {
          setCoachHighlightTarget(result.targetId)
          setTimeout(() => setCoachHighlightTarget(null), 1500)
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
    if (useAgentStore.getState().spaceContext.currentSpace === 'tone') {
      await sendToneMessage(content)
      return
    }

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
    if (useAgentStore.getState().spaceContext.currentSpace === 'tone') {
      await sendToneMessage(content, { hidden: true })
      return
    }

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

    if (chip.action === 'set_style' && VALID_STYLES.includes(chip.value as CoachingStyle)) {
      useCoachStore.getState().setCoachingStyle(chip.value as CoachingStyle)
    }
    sendMessage(chip.value)
  }

  const applyToneAction = (messageId: string) => {
    const message = useAgentStore.getState().messages.find((item) => item.id === messageId)
    const action = message?.toneAction
    if (!action) return

    useToneStore.getState().applySnapshot(action.after)
    updateMessage(messageId, (current) => ({
      ...current,
      toneAction: current.toneAction ? { ...current.toneAction, state: 'applied' } : current.toneAction,
    }))
  }

  const undoToneAction = (messageId: string) => {
    const message = useAgentStore.getState().messages.find((item) => item.id === messageId)
    const action = message?.toneAction
    if (!action) return

    useToneStore.getState().applySnapshot(action.before)
    updateMessage(messageId, (current) => ({
      ...current,
      toneAction: current.toneAction ? { ...current.toneAction, state: 'pending' } : current.toneAction,
    }))
  }

  const retryToneAction = async (messageId: string) => {
    const message = useAgentStore.getState().messages.find((item) => item.id === messageId)
    const action = message?.toneAction
    if (!action) return
    await sendToneMessage(action.prompt, { hidden: true })
  }

  return {
    sendMessage,
    sendHiddenMessage,
    handleChipClick,
    applyToneAction,
    undoToneAction,
    retryToneAction,
  }
}
