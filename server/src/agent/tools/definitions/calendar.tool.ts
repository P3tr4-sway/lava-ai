import type { ToolDefinition } from '@lava/shared'

export const createPracticePlanTool: ToolDefinition = {
  name: 'create_practice_plan',
  description:
    'Creates a structured practice plan for learning a song. Generate a sessionsJson parameter containing an array of daily practice sessions, each with subtasks and time estimates. Adapt the detail level to the song complexity.',
  parameters: [
    {
      name: 'songTitle',
      type: 'string',
      description: 'The song title to practice',
      required: true,
    },
    {
      name: 'songId',
      type: 'string',
      description: 'The song/project ID if the user is viewing a known song',
      required: false,
    },
    {
      name: 'goalDescription',
      type: 'string',
      description: 'A one-line goal, e.g. "Learn to play Autumn Leaves in 7 days"',
      required: true,
    },
    {
      name: 'durationDays',
      type: 'number',
      description: 'Number of days the plan spans (1-30, default 7)',
      required: false,
      default: 7,
    },
    {
      name: 'minutesPerDay',
      type: 'number',
      description: 'Approximate minutes per session (10-120, default 30)',
      required: false,
      default: 30,
    },
    {
      name: 'skillLevel',
      type: 'string',
      description: 'Player skill level',
      required: false,
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    {
      name: 'focusAreas',
      type: 'string',
      description: 'Comma-separated focus areas, e.g. "chords,rhythm,melody"',
      required: false,
    },
    {
      name: 'sessionsJson',
      type: 'string',
      description:
        'JSON string: array of objects with { title: string, totalMinutes: number, timeOfDay?: "morning"|"afternoon"|"evening", subtasks: [{ title: string, durationMinutes: number }] }. One object per day.',
      required: true,
    },
  ],
}
