import { navigateToSpaceTool } from './navigation.tool.js'
import { createProjectTool, listProjectsTool, loadProjectTool } from './project.tool.js'
import { startJamTool, setTempoTool, setKeyTool } from './jam.tool.js'
import { startTranscriptionTool, getTranscriptionStatusTool } from './transcription.tool.js'
import { addTrackTool, aiComposeTool } from './create.tool.js'
import { uploadAudioTool, processAudioTool } from './audio.tool.js'
import type { ToolDefinition } from '@lava/shared'

export const ALL_TOOLS: ToolDefinition[] = [
  navigateToSpaceTool,
  createProjectTool,
  listProjectsTool,
  loadProjectTool,
  startJamTool,
  setTempoTool,
  setKeyTool,
  startTranscriptionTool,
  getTranscriptionStatusTool,
  addTrackTool,
  aiComposeTool,
  uploadAudioTool,
  processAudioTool,
]
