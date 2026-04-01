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
      enum: ['home', 'learn', 'jam', 'create', 'tools', 'library', 'projects'],
    },
    {
      name: 'reason',
      type: 'string',
      description: 'Brief explanation of why we are navigating there',
      required: false,
    },
  ],
}

export const openSearchResultsTool: ToolDefinition = {
  name: 'open_search_results',
  description: 'Open the search results page. For recommendation requests, first choose one specific song and pass that exact song title plus artist instead of a broad genre or skill query.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query to run. When recommending one song, this should be that exact song title plus artist.',
      required: true,
    },
    {
      name: 'songTitle',
      type: 'string',
      description: 'Optional structured song title. Use this when you picked a specific recommendation.',
      required: false,
    },
    {
      name: 'artist',
      type: 'string',
      description: 'Optional structured artist name paired with songTitle.',
      required: false,
    },
    {
      name: 'selectionReason',
      type: 'string',
      description: 'Optional brief reason this specific song fits the request.',
      required: false,
    },
  ],
}
