export type Role = 'user' | 'assistant' | 'tool'

export interface AgentMessage {
  id: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  createdAt: number
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

export type SpaceType = 'learn' | 'jam' | 'create' | 'tools' | 'projects'

export interface SpaceContext {
  currentSpace: SpaceType
  projectId?: string
  projectName?: string
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
