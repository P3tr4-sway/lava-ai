import type { VersionAction } from './version.js'

export type Role = 'user' | 'assistant' | 'tool'

export interface AgentMessage {
  id: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  createdAt: number
  subtype?: 'chat' | 'onboarding' | 'highlight' | 'coachingTip' | 'practiceStatus' | 'practiceNudge' | 'practiceSummary' | 'versionCreated'
  targetId?: string
  chips?: MessageChip[]
  hidden?: boolean
  localOnly?: boolean
  toneAction?: ToneAction
  versionAction?: VersionAction
}

export interface MessageChip {
  label: string
  value: string
  action?: 'advance' | 'expand' | 'set_style' | 'create_plan' | 'navigate' | 'select_arrangement' | 'set_score_view'
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

export interface ToneKnobValue {
  id: string
  label: string
  value: number
}

export interface ToneChainSlotSnapshot {
  id: string
  pedalId: string | null
}

export interface ToneProjectSnapshot {
  selectedPreset: string
  selectedSlotId: string
  activeCategory: string
  chain: ToneChainSlotSnapshot[]
  pedalKnobs: Record<string, ToneKnobValue[]>
}

export interface ToneContext {
  selectedPreset: string
  selectedPresetName: string
  selectedSlotId: string
  selectedPedalId?: string | null
  selectedPedalName?: string | null
  activeCategory: string
  chainSummary: string[]
  knobSummary: string[]
}

export interface ToneAction {
  kind: 'preview'
  prompt: string
  summary: string
  changes: string[]
  before: ToneProjectSnapshot
  after: ToneProjectSnapshot
  state?: 'pending' | 'applied'
}

export type SpaceType = 'home' | 'learn' | 'jam' | 'tone' | 'create' | 'tools' | 'library' | 'projects'
export type HomeMode = 'discovery' | 'agent'

export interface EditorContext {
  musicXml: string
  scoreSummary: string
  selectedBars?: number[]
}

export interface SpaceContext {
  currentSpace: SpaceType
  homeMode?: HomeMode
  projectId?: string
  projectName?: string
  coachContext?: CoachContext
  toneContext?: ToneContext
  editorContext?: EditorContext
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

export interface VersionCreatedPayload {
  versionId: string
  name: string
  musicXml: string
  changeSummary: string[]
}

export type ScorePatchOp =
  | 'setNotePitch'
  | 'setNoteDuration'
  | 'setChord'
  | 'setKeySig'
  | 'setTimeSig'
  | 'addBars'
  | 'deleteBars'
  | 'transposeBars'
  | 'addAccidental'
  | 'toggleRest'
  | 'toggleTie'
  | 'setAnnotation'
  | 'setLyric'

export interface ScorePatch {
  op: ScorePatchOp
  [key: string]: unknown
}

export interface ScorePatchSessionEndPayload {
  versionId: string
  name: string
  changeSummary: string[]
}

export type StreamEventType =
  | 'text_delta'
  | 'tool_start'
  | 'tool_result'
  | 'message_start'
  | 'message_stop'
  | 'error'
  | 'version_created'
  | 'score_patch'
  | 'score_patch_session_end'

export interface StreamEvent {
  type: StreamEventType
  delta?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  error?: string
  versionPayload?: VersionCreatedPayload
  patch?: ScorePatch
  patchSessionEndPayload?: ScorePatchSessionEndPayload
}
