import type { ToolDefinition } from '@lava/shared'

export const startTranscriptionTool: ToolDefinition = {
  name: 'start_transcription',
  description: 'Begin AI transcription of an uploaded audio file to sheet music',
  parameters: [
    {
      name: 'audioFileId',
      type: 'string',
      description: 'ID of the uploaded audio file',
      required: true,
    },
  ],
}

export const getTranscriptionStatusTool: ToolDefinition = {
  name: 'get_transcription_status',
  description: 'Check the status of an in-progress transcription',
  parameters: [
    {
      name: 'transcriptionId',
      type: 'string',
      description: 'ID of the transcription job',
      required: true,
    },
  ],
}
