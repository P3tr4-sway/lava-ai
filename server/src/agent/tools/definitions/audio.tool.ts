import type { ToolDefinition } from '@lava/shared'

export const uploadAudioTool: ToolDefinition = {
  name: 'upload_audio',
  description: 'Reference an audio file that was uploaded by the user',
  parameters: [
    {
      name: 'audioFileId',
      type: 'string',
      description: 'ID of the uploaded audio file',
      required: true,
    },
  ],
}

export const processAudioTool: ToolDefinition = {
  name: 'process_audio',
  description: 'Apply audio processing or effects to a file',
  parameters: [
    { name: 'audioFileId', type: 'string', description: 'ID of the audio file', required: true },
    { name: 'operation', type: 'string', description: 'Operation to apply', required: true },
  ],
}
