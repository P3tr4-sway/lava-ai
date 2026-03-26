import type { ToolDefinition } from '@lava/shared'

export const coachMessageTool: ToolDefinition = {
  name: 'coach_message',
  description:
    'Send a structured coaching message with optional UI highlights and user choice chips. Use this for all onboarding and coaching messages instead of plain text.',
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The message text. Concise, plain speech. No markdown.',
      required: true,
    },
    {
      name: 'subtype',
      type: 'string',
      description: 'Message type: onboarding (flow steps), highlight (UI tour with pulse), coachingTip (practice tips).',
      required: true,
      enum: ['onboarding', 'highlight', 'coachingTip'],
    },
    {
      name: 'targetId',
      type: 'string',
      description:
        'UI element to highlight with a pulse animation. Only used when subtype is highlight.',
      required: false,
      enum: ['chord-grid', 'daw-panel', 'metadata-bar'],
    },
    {
      name: 'chipsJson',
      type: 'string',
      description:
        'JSON array of choice chips. Each chip: { "label": "Got it", "value": "got_it", "action": "advance" }. Actions: advance (next onboarding step), expand (show more detail), set_style (set coaching style), create_plan (trigger practice plan), navigate (go to route).',
      required: false,
    },
  ],
}
