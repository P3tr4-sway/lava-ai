import { navigateToSpaceTool, openSearchResultsTool } from './navigation.tool.js'
import { createProjectTool, listProjectsTool, loadProjectTool } from './project.tool.js'
import { startTranscriptionTool, getTranscriptionStatusTool } from './transcription.tool.js'
import { addTrackTool, aiComposeTool } from './create.tool.js'
import { uploadAudioTool, processAudioTool } from './audio.tool.js'
import { createVersionTool } from './version.tool.js'
import type { ToolDefinition } from '@lava/shared'

export const ALL_TOOLS: ToolDefinition[] = [
  navigateToSpaceTool,
  openSearchResultsTool,
  createProjectTool,
  listProjectsTool,
  loadProjectTool,
  startTranscriptionTool,
  getTranscriptionStatusTool,
  addTrackTool,
  aiComposeTool,
  uploadAudioTool,
  processAudioTool,
  createVersionTool,
]
