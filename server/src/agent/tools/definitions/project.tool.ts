import type { ToolDefinition } from '@lava/shared'

export const createProjectTool: ToolDefinition = {
  name: 'create_project',
  description: 'Create a new project in the specified space',
  parameters: [
    { name: 'name', type: 'string', description: 'Project name', required: true },
    {
      name: 'space',
      type: 'string',
      description: 'Space for the project',
      required: true,
      enum: ['learn', 'jam', 'create', 'tools'],
    },
    { name: 'description', type: 'string', description: 'Project description', required: false },
  ],
}

export const listProjectsTool: ToolDefinition = {
  name: 'list_projects',
  description: "List the user's saved projects",
  parameters: [
    {
      name: 'space',
      type: 'string',
      description: 'Filter by space (optional)',
      required: false,
      enum: ['learn', 'jam', 'create', 'tools'],
    },
  ],
}

export const loadProjectTool: ToolDefinition = {
  name: 'load_project',
  description: 'Open an existing project by ID',
  parameters: [
    { name: 'projectId', type: 'string', description: 'The project ID to load', required: true },
  ],
}
