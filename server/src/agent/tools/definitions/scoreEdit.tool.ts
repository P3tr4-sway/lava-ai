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

export const insertNoteTool: ToolDefinition = {
  name: 'insert_note',
  description: 'Insert a guitar note into a specific bar and beat.',
  parameters: [
    { name: 'measureIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'beat', type: 'number', description: '0-based beat position inside the bar', required: true },
    { name: 'string', type: 'number', description: '1-6 guitar string number (1 = high E)', required: true },
    { name: 'fret', type: 'number', description: 'Fret number to write in the tablature', required: true },
    { name: 'durationType', type: 'string', description: 'Duration type', required: false, enum: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] },
  ],
}

export const insertRestTool: ToolDefinition = {
  name: 'insert_rest',
  description: 'Insert or replace a rest at a specific bar and beat.',
  parameters: [
    { name: 'measureIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'beat', type: 'number', description: '0-based beat position inside the bar', required: true },
    { name: 'durationType', type: 'string', description: 'Duration type', required: false, enum: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] },
  ],
}

export const addMeasureBeforeTool: ToolDefinition = {
  name: 'add_measure_before',
  description: 'Insert empty bars before a specific bar position.',
  parameters: [
    { name: 'beforeIndex', type: 'number', description: '0-based bar index before which to insert', required: true },
    { name: 'count', type: 'number', description: 'Number of bars to insert (1-8)', required: true },
  ],
}

export const addMeasureAfterTool: ToolDefinition = {
  name: 'add_measure_after',
  description: 'Insert empty bars after a specific bar position.',
  parameters: [
    { name: 'afterIndex', type: 'number', description: '0-based bar index after which to insert', required: true },
    { name: 'count', type: 'number', description: 'Number of bars to insert (1-8)', required: true },
  ],
}

export const setSectionLabelTool: ToolDefinition = {
  name: 'set_section_label',
  description: 'Assign a section label to the first bar of a selected bar range.',
  parameters: [
    { name: 'startBar', type: 'number', description: '0-based start bar', required: true },
    { name: 'endBar', type: 'number', description: '0-based end bar', required: true },
    { name: 'label', type: 'string', description: 'Section label text (e.g. Verse, Chorus, Bridge)', required: true },
  ],
}

export const setChordDiagramPlacementTool: ToolDefinition = {
  name: 'set_chord_diagram_placement',
  description: 'Control whether a bar shows chord diagrams above or below the tab.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'placement', type: 'string', description: 'Chord diagram placement mode', required: true, enum: ['hidden', 'top', 'bottom', 'both'] },
  ],
}

export const deleteNoteTool: ToolDefinition = {
  name: 'delete_note',
  description: 'Delete one or more selected notes from the guitar score.',
  parameters: [
    { name: 'noteIds', type: 'array', description: 'Stable note ids to delete', required: true, items: { type: 'string' } },
  ],
}

export const setDurationTool: ToolDefinition = {
  name: 'set_duration',
  description: 'Set the duration of one or more selected notes.',
  parameters: [
    { name: 'noteIds', type: 'array', description: 'Stable note ids to update', required: true, items: { type: 'string' } },
    { name: 'durationType', type: 'string', description: 'Duration type', required: true, enum: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] },
  ],
}

export const setStringFretTool: ToolDefinition = {
  name: 'set_string_fret',
  description: 'Set the tablature string/fret for one or more selected notes.',
  parameters: [
    { name: 'noteIds', type: 'array', description: 'Stable note ids to update', required: true, items: { type: 'string' } },
    { name: 'string', type: 'number', description: '1-6 guitar string number (1 = high E)', required: true },
    { name: 'fret', type: 'number', description: 'Fret number', required: true },
  ],
}

export const transposeSelectionTool: ToolDefinition = {
  name: 'transpose_selection',
  description: 'Transpose the selected notes or bars by a number of semitones.',
  parameters: [
    { name: 'noteIds', type: 'array', description: 'Optional selected note ids', required: false, items: { type: 'string' } },
    { name: 'startBar', type: 'number', description: 'Optional start bar of the range', required: false },
    { name: 'endBar', type: 'number', description: 'Optional end bar of the range', required: false },
    { name: 'semitones', type: 'number', description: 'Semitone delta', required: true },
  ],
}

export const changeTuningTool: ToolDefinition = {
  name: 'change_tuning',
  description: 'Change the guitar tuning for the active track.',
  parameters: [
    { name: 'tuning', type: 'array', description: 'Array of six open-string MIDI numbers, from string 1 to string 6', required: true, items: { type: 'number' } },
  ],
}

export const setCapoTool: ToolDefinition = {
  name: 'set_capo',
  description: 'Set the capo fret for the active guitar track.',
  parameters: [
    { name: 'capo', type: 'number', description: 'Capo fret number', required: true },
  ],
}

export const simplifyFingeringTool: ToolDefinition = {
  name: 'simplify_fingering',
  description: 'Reassign selected notes to easier guitar positions while preserving pitch.',
  parameters: [
    { name: 'startBar', type: 'number', description: 'Optional start bar of the range', required: false },
    { name: 'endBar', type: 'number', description: 'Optional end bar of the range', required: false },
  ],
}

export const reharmonizeSelectionTool: ToolDefinition = {
  name: 'reharmonize_selection',
  description: 'Replace harmony symbols in the selected bar range.',
  parameters: [
    { name: 'startBar', type: 'number', description: '0-based start bar', required: true },
    { name: 'endBar', type: 'number', description: '0-based end bar', required: true },
    { name: 'chordsJson', type: 'string', description: 'JSON array of { beat, symbol } objects', required: true },
  ],
}

export const addTechniqueTool: ToolDefinition = {
  name: 'add_technique',
  description: 'Add a guitar technique to one or more notes.',
  parameters: [
    { name: 'noteIds', type: 'array', description: 'Stable note ids to update', required: true, items: { type: 'string' } },
    { name: 'technique', type: 'string', description: 'Technique name', required: true, enum: ['bend', 'slide', 'hammerOn', 'pullOff', 'palmMute', 'harmonic', 'vibrato'] },
    { name: 'value', type: 'string', description: 'Optional technique value (for slides)', required: false },
  ],
}

export const removeTechniqueTool: ToolDefinition = {
  name: 'remove_technique',
  description: 'Remove a guitar technique from one or more notes.',
  parameters: [
    { name: 'noteIds', type: 'array', description: 'Stable note ids to update', required: true, items: { type: 'string' } },
    { name: 'technique', type: 'string', description: 'Technique name', required: true, enum: ['bend', 'slide', 'hammerOn', 'pullOff', 'palmMute', 'harmonic', 'vibrato'] },
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
  insertNoteTool,
  insertRestTool,
  deleteNoteTool,
  setDurationTool,
  setStringFretTool,
  addMeasureBeforeTool,
  addMeasureAfterTool,
  setSectionLabelTool,
  setChordDiagramPlacementTool,
  transposeSelectionTool,
  changeTuningTool,
  setCapoTool,
  simplifyFingeringTool,
  reharmonizeSelectionTool,
  addTechniqueTool,
  removeTechniqueTool,
  endEditSessionTool,
]

/** Set of tool names that are granular score edit operations (not end_edit_session). */
export const SCORE_PATCH_TOOL_NAMES = new Set(
  SCORE_EDIT_TOOLS.filter((t) => ![
    'end_edit_session',
    'insert_note',
    'insert_rest',
    'delete_note',
    'set_duration',
    'set_string_fret',
    'add_measure_before',
    'add_measure_after',
    'set_section_label',
    'set_chord_diagram_placement',
    'transpose_selection',
    'change_tuning',
    'set_capo',
    'simplify_fingering',
    'reharmonize_selection',
    'add_technique',
    'remove_technique',
  ].includes(t.name)).map((t) => t.name),
)

/** Set of tool names that map directly to ScoreCommandPatch events. */
export const SCORE_COMMAND_TOOL_NAMES = new Set([
  'insert_note',
  'insert_rest',
  'delete_note',
  'set_duration',
  'set_string_fret',
  'add_measure_before',
  'add_measure_after',
  'set_section_label',
  'set_chord_diagram_placement',
  'transpose_selection',
  'change_tuning',
  'set_capo',
  'simplify_fingering',
  'reharmonize_selection',
  'add_technique',
  'remove_technique',
])
