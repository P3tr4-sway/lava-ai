export type Role = 'user' | 'assistant' | 'tool'

export interface AgentMessage {
  id: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  createdAt: number
  subtype?: 'chat' | 'onboarding' | 'highlight' | 'coachingTip'
  targetId?: string
  chips?: MessageChip[]
  hidden?: boolean
}

export interface MessageChip {
  label: string
  value: string
  action?: 'advance' | 'expand' | 'set_style' | 'create_plan' | 'navigate'
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError?: boolean
}

export type SpaceType = 'learn' | 'jam' | 'create' | 'tools' | 'library' | 'projects'

export interface SpaceContext {
  currentSpace: SpaceType
  projectId?: string
  projectName?: string
  coachContext?: CoachContext
}

export type CoachingStyle = 'passive' | 'active' | 'checkpoint'

export interface CoachContext {
  songTitle: string
  artist?: string
  key: string
  tempo: number
  timeSignature: string
  sectionCount: number
  sectionLabels: string[]
  chordSummary: string
  userSkillLevel?: string
  songSkillAssessment?: string
  coachingStyle: CoachingStyle
  visitTier: 'first' | 'new_song' | 'revisit'
  practiceProgress?: {
    totalSessions: number
    completedSessions: number
    lastSessionTitle?: string
    nextSessionTitle?: string
  }
}

export type StreamEventType =
  | 'text_delta'
  | 'tool_start'
  | 'tool_result'
  | 'message_start'
  | 'message_stop'
  | 'error'

export interface StreamEvent {
  type: StreamEventType
  delta?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  error?: string
}
