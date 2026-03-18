import type { ToolDefinition } from '@lava/shared'

export const navigateToSpaceTool: ToolDefinition = {
  name: 'navigate_to_space',
  description: 'Navigate the user to a specific space in the LAVA platform',
  parameters: [
    {
      name: 'space',
      type: 'string',
      description: 'The space to navigate to',
      required: true,
      enum: ['learn', 'jam', 'create', 'tools', 'projects'],
    },
    {
      name: 'reason',
      type: 'string',
      description: 'Brief explanation of why we are navigating there',
      required: false,
    },
  ],
}
