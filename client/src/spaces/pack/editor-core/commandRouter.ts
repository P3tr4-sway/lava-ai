import type { CommandResult, ScoreCommand, ScoreCommandPatch, ScoreDocument } from '@lava/shared'
import { validateAndTruncate } from './validation'
import { getEffectiveTimeSignature } from './helpers'

// Import all handlers
import { handleInsertNote, handleInsertNoteAtCaret, handleInsertRestAtCaret, handleDeleteNote } from './handlers/noteEntry'
import { handleSetDuration, handleSetPitch, handleSetStringFret, handleToggleRest, handleSetNoteDynamic, handleSimplifyFingering } from './handlers/noteProperties'
import { handleAddTechnique, handleRemoveTechnique } from './handlers/techniques'
import { handleSplitNote, handleMergeWithNext, handleMoveNoteToBeat, handleTransposeSelection } from './handlers/noteMutation'
import { handleToggleTie, handleToggleSlur, handleToggleDot, handleToggleTuplet } from './handlers/notation'
import { handleAddMeasureBefore, handleAddMeasureAfter, handleDeleteMeasureRange } from './handlers/measures'
import { handleSetTempo, handleSetKeySignature, handleSetTimeSignature, handleSetTrackClef, handleSetCapo, handleChangeTuning } from './handlers/scoreMeta'
import {
  handleSetMeasureTimeSignature, handleSetMeasureKeySignature,
  handleSetBarlineType, handleSetRepeat, handleSetRepeatMarker,
  handleSetChordSymbol, handleSetAnnotation, handleSetSectionLabel,
  handleSetChordDiagramPlacement, handleReharmonizeSelection,
} from './handlers/measureMeta'
import { handleSetLyric } from './handlers/lyrics'
import { handlePasteSelection } from './handlers/clipboard'

type Handler = (doc: ScoreDocument, cmd: any) => CommandResult

const HANDLER_MAP: Record<string, Handler> = {
  insertNote: handleInsertNote,
  insertNoteAtCaret: handleInsertNoteAtCaret,
  insertRestAtCaret: handleInsertRestAtCaret,
  deleteNote: handleDeleteNote,
  setDuration: handleSetDuration,
  setPitch: handleSetPitch,
  setStringFret: handleSetStringFret,
  toggleRest: handleToggleRest,
  setNoteDynamic: handleSetNoteDynamic,
  addTechnique: handleAddTechnique,
  removeTechnique: handleRemoveTechnique,
  splitNote: handleSplitNote,
  mergeWithNext: handleMergeWithNext,
  moveNoteToBeat: handleMoveNoteToBeat,
  transposeSelection: handleTransposeSelection,
  toggleTie: handleToggleTie,
  toggleSlur: handleToggleSlur,
  toggleDot: handleToggleDot,
  toggleTuplet: handleToggleTuplet,
  addMeasureBefore: handleAddMeasureBefore,
  addMeasureAfter: handleAddMeasureAfter,
  deleteMeasureRange: handleDeleteMeasureRange,
  setTempo: handleSetTempo,
  setKeySignature: handleSetKeySignature,
  setTimeSignature: handleSetTimeSignature,
  setTrackClef: handleSetTrackClef,
  setCapo: handleSetCapo,
  setTuning: handleChangeTuning, // legacy alias — prefer changeTuning for new callers
  changeTuning: handleChangeTuning,
  setMeasureTimeSignature: handleSetMeasureTimeSignature,
  setMeasureKeySignature: handleSetMeasureKeySignature,
  setBarlineType: handleSetBarlineType,
  setRepeat: handleSetRepeat,
  setRepeatMarker: handleSetRepeatMarker,
  setChordSymbol: handleSetChordSymbol,
  setAnnotation: handleSetAnnotation,
  setSectionLabel: handleSetSectionLabel,
  setChordDiagramPlacement: handleSetChordDiagramPlacement,
  reharmonizeSelection: handleReharmonizeSelection,
  simplifyFingering: handleSimplifyFingering,
  setLyric: handleSetLyric,
  pasteSelection: handlePasteSelection,
  // No-op commands (UI-only, handled by store)
  moveCursor: (doc) => ({ document: doc, warnings: [] }),
  selectNotes: (doc) => ({ document: doc, warnings: [] }),
  setMeasureRange: (doc) => ({ document: doc, warnings: [] }),
}

const COMMANDS_NEEDING_VALIDATION = new Set([
  'insertNoteAtCaret',
  'insertRestAtCaret',
  'setDuration',
  'splitNote',
  'mergeWithNext',
  'setMeasureTimeSignature',
  'toggleDot',
  'toggleTuplet',
  'pasteSelection',
])

export function applyCommandToDocument(
  doc: ScoreDocument,
  cmd: ScoreCommand,
): CommandResult {
  const handler = HANDLER_MAP[cmd.type]
  if (!handler) {
    return { document: doc, warnings: [`Unknown command: ${cmd.type}`] }
  }

  const result = handler(doc, cmd)

  if (COMMANDS_NEEDING_VALIDATION.has(cmd.type)) {
    if (cmd.type === 'pasteSelection') {
      // Validate all measures affected by the paste
      const start = cmd.targetMeasureIndex
      const end = start + cmd.clipboard.sourceMeasureCount - 1
      for (let mi = start; mi <= end; mi++) {
        const meter = getEffectiveTimeSignature(result.document, mi)
        for (const track of result.document.tracks) {
          track.notes = validateAndTruncate(track.notes, mi, meter, result.document.divisions)
        }
      }
    } else {
      const measureIndex = 'measureIndex' in cmd ? (cmd as { measureIndex: number }).measureIndex : undefined
      if (measureIndex !== undefined) {
        const meter = getEffectiveTimeSignature(result.document, measureIndex)
        for (const track of result.document.tracks) {
          track.notes = validateAndTruncate(track.notes, measureIndex, meter, result.document.divisions)
        }
      }
    }
  }

  return result
}

export function applyCommandPatch(document: ScoreDocument, patch: ScoreCommandPatch): CommandResult {
  return patch.commands.reduce<CommandResult>(
    (result, command) => {
      const next = applyCommandToDocument(result.document, command)
      return {
        document: next.document,
        warnings: [...result.warnings, ...next.warnings],
      }
    },
    { document, warnings: patch.warnings ?? [] },
  )
}
