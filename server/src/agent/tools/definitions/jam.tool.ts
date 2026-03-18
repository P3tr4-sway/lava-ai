import type { ToolDefinition } from '@lava/shared'

export const startJamTool: ToolDefinition = {
  name: 'start_jam',
  description: 'Initialize a jam session with a given tempo and key',
  parameters: [
    { name: 'bpm', type: 'number', description: 'Tempo in BPM (40–240)', required: false },
    { name: 'key', type: 'string', description: 'Musical key (e.g. C, F#, Bb)', required: false },
    {
      name: 'scale',
      type: 'string',
      description: 'Scale type',
      required: false,
      enum: ['major', 'minor', 'dorian', 'mixolydian', 'pentatonic', 'blues'],
    },
  ],
}

export const setTempoTool: ToolDefinition = {
  name: 'set_tempo',
  description: 'Set the tempo of the current session',
  parameters: [
    { name: 'bpm', type: 'number', description: 'Tempo in BPM', required: true },
  ],
}

export const setKeyTool: ToolDefinition = {
  name: 'set_key',
  description: 'Set the musical key of the current session',
  parameters: [
    { name: 'key', type: 'string', description: 'Musical key', required: true },
  ],
}
