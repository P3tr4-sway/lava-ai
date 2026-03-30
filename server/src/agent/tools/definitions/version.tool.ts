import type { ToolDefinition } from '@lava/shared'

export const createVersionTool: ToolDefinition = {
  name: 'create_version',
  description:
    'Creates a new song version from a MusicXML document. Call this when you have generated or modified MusicXML and want to present it to the user as a new version of their song.',
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: 'Display name for the version (e.g. "Blues Arrangement")',
      required: true,
    },
    {
      name: 'musicXml',
      type: 'string',
      description: 'Full MusicXML document string',
      required: true,
    },
    {
      name: 'changeSummary',
      type: 'array',
      description:
        '1-3 bullet points describing what changed (e.g. ["Simplified chord voicings", "Added blues scale runs"])',
      required: true,
    },
  ],
}
