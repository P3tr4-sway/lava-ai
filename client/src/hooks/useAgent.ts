import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useCoachStore } from '@/stores'
import { agentService } from '@/services/agentService'
import type { AgentMessage, StreamEvent, MessageChip, CoachingStyle } from '@lava/shared'
import { SPACE_ROUTES } from '@lava/shared'
import type { PracticePlan } from '@/stores/calendarStore'

const VALID_STYLES: CoachingStyle[] = ['passive', 'active', 'checkpoint']

function makeMockPlan(content: string): PracticePlan {
  const songMatch = content.match(/(?:for|practice|learn)\s+(.+?)(?:\s+in\s+\d|\s*$)/i)
  const songTitle = songMatch?.[1]?.trim() || 'Autumn Leaves'
  const planId = crypto.randomUUID()
  const today = new Date()
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const sessionTemplates = [
    { title: 'Day 1: Intro & Chords', subtasks: ['Warm up', 'Learn chord shapes', 'Slow run-through'] },
    { title: 'Day 2: Melody & Rhythm', subtasks: ['Review Day 1', 'Learn melody line', 'Practice with rhythm'] },
    { title: 'Day 3: Connect sections', subtasks: ['Full run-through', 'Work on transitions', 'Record yourself'] },
  ]

  return {
    id: planId,
    songTitle,
    createdAt: Date.now(),
    goalDescription: `Learn to play ${songTitle} in 3 days`,
    sessions: sessionTemplates.map((tmpl, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return {
        id: crypto.randomUUID(),
        planId,
        date: toStr(d),
        title: tmpl.title,
        totalMinutes: 30,
        completed: false,
        subtasks: tmpl.subtasks.map((title, j) => ({
          id: crypto.randomUUID(),
          title,
          durationMinutes: j === 0 ? 5 : j === 1 ? 15 : 10,
          completed: false,
        })),
      }
    }),
  }
}

export function useAgent() {
  const navigate = useNavigate()
  const { addMessage, appendStreamDelta, setStreaming, finalizeStream, spaceContext, setCoachHighlightTarget } =
    useAgentStore()

  const handleToolResult = (resultContent: string) => {
    try {
      const result = JSON.parse(resultContent)
      if (result.action === 'navigate' && result.space) {
        const route = SPACE_ROUTES[result.space as keyof typeof SPACE_ROUTES]
        if (route) navigate(route)
      }
      if (result.action === 'practice_plan' && result.plan) {
        useCalendarStore.getState().setActivePlanPreview(result.plan)
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
      case 'tool_result':
        if (event.toolResult) handleToolResult(event.toolResult.content)
        break
      case 'message_stop':
        finalizeStream()
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

    // Mock: trigger practice plan dialog when message contains "plan"
    if (/\bplan\b/i.test(content)) {
      const mockPlan = makeMockPlan(content)
      useCalendarStore.getState().setActivePlanPreview(mockPlan)
      const replyMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Here's a 3-day practice plan for **${mockPlan.songTitle}**! Review the sessions and click "Add to Calendar" to save it.`,
        createdAt: Date.now(),
      }
      addMessage(replyMsg)
      return
    }

    setStreaming(true)

    try {
      const allMessages = [...useAgentStore.getState().messages]

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
        [...useAgentStore.getState().messages],
        useAgentStore.getState().spaceContext,
        handleStreamEvent,
      )
    } catch {
      finalizeStream()
    }
  }

  const handleChipClick = (chip: MessageChip) => {
    if (chip.action === 'set_style' && VALID_STYLES.includes(chip.value as CoachingStyle)) {
      useCoachStore.getState().setCoachingStyle(chip.value as CoachingStyle)
    }
    sendMessage(chip.value)
  }

  return { sendMessage, sendHiddenMessage, handleChipClick }
}
