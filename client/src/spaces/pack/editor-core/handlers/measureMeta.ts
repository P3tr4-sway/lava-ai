import type { CommandResult, ScoreCommand, ScoreDocument } from '@lava/shared'
import { cloneDocument, createId } from '../helpers'

export function handleSetBarlineType(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setBarlineType' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures.find((m) => m.index === cmd.measureIndex)
  if (measure) {
    if (cmd.barlineType === null) {
      delete measure.barlineType
    } else {
      measure.barlineType = cmd.barlineType
    }
  }
  return { document: next, warnings: [] }
}

export function handleSetRepeat(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setRepeat' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures.find((m) => m.index === cmd.measureIndex)
  if (measure) {
    if (cmd.repeatType === 'start') {
      if (cmd.enabled) measure.isRepeatStart = true
      else delete measure.isRepeatStart
    } else {
      if (cmd.enabled) measure.isRepeatEnd = true
      else delete measure.isRepeatEnd
    }
  }
  return { document: next, warnings: [] }
}

export function handleSetRepeatMarker(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setRepeatMarker' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures.find((m) => m.index === cmd.measureIndex)
  if (measure) {
    if (cmd.marker === null) delete measure.repeatMarker
    else measure.repeatMarker = cmd.marker
  }
  return { document: next, warnings: [] }
}

export function handleSetChordSymbol(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setChordSymbol' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures[cmd.measureIndex]
  if (measure) {
    measure.harmony = [
      ...measure.harmony.filter((entry) => entry.beat !== cmd.beat),
      { id: createId('harmony'), beat: cmd.beat, symbol: cmd.symbol },
    ].sort((a, b) => a.beat - b.beat)
  }
  return { document: next, warnings: [] }
}

export function handleSetAnnotation(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setAnnotation' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures[cmd.measureIndex]
  if (measure) {
    const text = cmd.text.trim()
    // annotations is an array for future multi-annotation support; for now each command sets a single entry
    measure.annotations = text ? [text] : []
  }
  return { document: next, warnings: [] }
}

export function handleSetSectionLabel(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setSectionLabel' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const label = cmd.label.trim()
  next.measures = next.measures.map((measure) => {
    if (measure.index < cmd.startMeasureIndex || measure.index > cmd.endMeasureIndex)
      return measure
    return {
      ...measure,
      sectionLabel:
        measure.index === cmd.startMeasureIndex && label ? label : undefined,
    }
  })
  return { document: next, warnings: [] }
}

export function handleSetChordDiagramPlacement(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setChordDiagramPlacement' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures[cmd.measureIndex]
  if (measure) {
    measure.chordDiagramPlacement = cmd.placement
  }
  return { document: next, warnings: [] }
}

export function handleReharmonizeSelection(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'reharmonizeSelection' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const [start, end] = cmd.measureRange ?? [0, next.measures.length - 1]
  for (let index = start; index <= end; index += 1) {
    const measure = next.measures[index]
    if (!measure) continue
    measure.harmony = cmd.chords.map((entry) => ({
      id: createId('harmony'),
      beat: entry.beat,
      symbol: entry.symbol,
    }))
  }
  return { document: next, warnings: [] }
}

export function handleSetMeasureTimeSignature(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setMeasureTimeSignature' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures[cmd.measureIndex]
  if (measure) {
    measure.timeSignature = { ...cmd.timeSignature }
  }
  return { document: next, warnings: [] }
}

export function handleSetMeasureKeySignature(
  doc: ScoreDocument,
  cmd: Extract<ScoreCommand, { type: 'setMeasureKeySignature' }>,
): CommandResult {
  const next = cloneDocument(doc)
  const measure = next.measures[cmd.measureIndex]
  if (measure) {
    measure.keySignature = { ...cmd.keySignature }
  }
  return { document: next, warnings: [] }
}
