import type { ToolDefinition } from '@lava/shared'

export const addTrackTool: ToolDefinition = {
  name: 'add_track',
  description: 'Add a new track to the current composition in the Create space',
  parameters: [
    { name: 'name', type: 'string', description: 'Track name', required: true },
    {
      name: 'type',
      type: 'string',
      description: 'Track type',
      required: true,
      enum: ['audio', 'midi', 'instrument', 'bus'],
    },
  ],
}

export const aiComposeTool: ToolDefinition = {
  name: 'ai_compose',
  description: 'Generate musical ideas or a composition using AI',
  parameters: [
    { name: 'prompt', type: 'string', description: 'Description of what to compose', required: true },
    { name: 'key', type: 'string', description: 'Musical key', required: false },
    { name: 'bpm', type: 'number', description: 'Tempo', required: false },
    { name: 'bars', type: 'number', description: 'Number of bars to generate', required: false },
  ],
}
