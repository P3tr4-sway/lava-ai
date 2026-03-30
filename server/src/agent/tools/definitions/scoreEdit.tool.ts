import type { ToolDefinition } from '@lava/shared'

export const editNotePitchTool: ToolDefinition = {
  name: 'edit_note_pitch',
  description: 'Change the pitch of a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar (non-chord notes only)', required: true },
    { name: 'step', type: 'string', description: 'Note name: C, D, E, F, G, A, or B', required: true, enum: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
    { name: 'octave', type: 'number', description: 'Octave number (e.g. 4 for middle C)', required: true },
    { name: 'alter', type: 'number', description: 'Accidental: -1 for flat, 0 for natural, 1 for sharp. Omit for natural.', required: false },
  ],
}

export const editNoteDurationTool: ToolDefinition = {
  name: 'edit_note_duration',
  description: 'Change the duration of a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
    { name: 'type', type: 'string', description: 'Duration type', required: true, enum: ['whole', 'half', 'quarter', 'eighth', '16th'] },
  ],
}

export const editChordTool: ToolDefinition = {
  name: 'edit_chord',
  description: 'Set or change the chord symbol at a specific beat in a bar. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'beat', type: 'number', description: '0-based beat index within the bar', required: true },
    { name: 'chordSymbol', type: 'string', description: 'Chord symbol (e.g. "Am7", "Cmaj7", "F#m")', required: true },
  ],
}

export const editKeySigTool: ToolDefinition = {
  name: 'edit_key_signature',
  description: 'Change the key signature starting from a specific bar. The score re-renders live.',
  parameters: [
    { name: 'fromBar', type: 'number', description: '0-based bar index from which the new key applies', required: true },
    { name: 'key', type: 'string', description: 'Key name (e.g. "C", "G", "Bb", "F#")', required: true },
  ],
}

export const editTimeSigTool: ToolDefinition = {
  name: 'edit_time_signature',
  description: 'Change the time signature starting from a specific bar. The score re-renders live.',
  parameters: [
    { name: 'fromBar', type: 'number', description: '0-based bar index from which the new time signature applies', required: true },
    { name: 'beats', type: 'number', description: 'Number of beats per bar (e.g. 3, 4, 6)', required: true },
    { name: 'beatType', type: 'number', description: 'Beat unit (e.g. 4 for quarter note, 8 for eighth note)', required: true },
  ],
}

export const addBarsTool: ToolDefinition = {
  name: 'add_bars',
  description: 'Insert empty bars (whole rests) after a specific bar position. The score re-renders live.',
  parameters: [
    { name: 'afterIndex', type: 'number', description: '0-based bar index after which to insert. Use 0 to insert after the first bar.', required: true },
    { name: 'count', type: 'number', description: 'Number of bars to insert (1-8)', required: true },
  ],
}

export const deleteBarsTool: ToolDefinition = {
  name: 'delete_bars',
  description: 'Delete one or more bars from the score. The score re-renders live.',
  parameters: [
    { name: 'barIndices', type: 'array', description: 'Array of 0-based bar indices to delete', required: true, items: { type: 'number' } },
  ],
}

export const transposeBarsTool: ToolDefinition = {
  name: 'transpose_bars',
  description: 'Transpose all notes in specified bars by a number of semitones. The score re-renders live.',
  parameters: [
    { name: 'barIndices', type: 'array', description: 'Array of 0-based bar indices to transpose', required: true, items: { type: 'number' } },
    { name: 'semitones', type: 'number', description: 'Number of semitones to transpose (positive = up, negative = down)', required: true },
  ],
}

export const addAccidentalTool: ToolDefinition = {
  name: 'add_accidental',
  description: 'Add or change the accidental on a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
    { name: 'type', type: 'string', description: 'Accidental type', required: true, enum: ['sharp', 'flat', 'natural'] },
  ],
}

export const toggleRestTool: ToolDefinition = {
  name: 'toggle_rest',
  description: 'Toggle a note between a sounding note and a rest. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
  ],
}

export const toggleTieTool: ToolDefinition = {
  name: 'toggle_tie',
  description: 'Toggle a tie on a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
  ],
}

export const setAnnotationTool: ToolDefinition = {
  name: 'set_annotation',
  description: 'Add a text annotation (direction text) to a bar. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'text', type: 'string', description: 'Annotation text (e.g. "D.C. al Coda", "ritardando")', required: true },
  ],
}

export const setLyricTool: ToolDefinition = {
  name: 'set_lyric',
  description: 'Set a lyric syllable on a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
    { name: 'syllable', type: 'string', description: 'Lyric text for this note', required: true },
  ],
}

export const endEditSessionTool: ToolDefinition = {
  name: 'end_edit_session',
  description: 'Finalize the current editing session as a named version the user can Apply or Discard. Always call this after making granular edits.',
  parameters: [
    { name: 'name', type: 'string', description: 'Display name for the version (e.g. "Chord fix", "Transposed melody")', required: true },
    { name: 'changeSummary', type: 'array', description: '1-3 bullet points describing what changed', required: true, items: { type: 'string' } },
  ],
}

export const SCORE_EDIT_TOOLS: ToolDefinition[] = [
  editNotePitchTool,
  editNoteDurationTool,
  editChordTool,
  editKeySigTool,
  editTimeSigTool,
  addBarsTool,
  deleteBarsTool,
  transposeBarsTool,
  addAccidentalTool,
  toggleRestTool,
  toggleTieTool,
  setAnnotationTool,
  setLyricTool,
  endEditSessionTool,
]

/** Set of tool names that are granular score edit operations (not end_edit_session). */
export const SCORE_PATCH_TOOL_NAMES = new Set(
  SCORE_EDIT_TOOLS.filter((t) => t.name !== 'end_edit_session').map((t) => t.name),
)
