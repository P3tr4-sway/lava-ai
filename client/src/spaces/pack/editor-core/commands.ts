import type { NoteValue } from '@lava/shared'
import type { EditorCaret } from '@/stores/editorStore'

const DURATION_BEATS: Record<NoteValue, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
}

export function durationToBeats(duration: NoteValue): number {
  return DURATION_BEATS[duration] ?? 1
}

export function moveCaretByStep(
  caret: EditorCaret,
  direction: 'left' | 'right' | 'up' | 'down',
  measureCount: number,
  beatsPerMeasure: number,
  step = 0.25,
): EditorCaret {
  const snapToQuarterGrid = (value: number) => Math.round(value * 4) / 4

  if (direction === 'up' || direction === 'down') {
    return {
      ...caret,
      string: Math.max(1, Math.min(6, caret.string + (direction === 'up' ? -1 : 1))),
    }
  }

  let nextMeasureIndex = caret.measureIndex
  const maxBeat = Math.max(0, snapToQuarterGrid(beatsPerMeasure - step))
  let nextBeat = snapToQuarterGrid(caret.beat + (direction === 'left' ? -step : step))

  if (nextBeat < 0 && nextMeasureIndex > 0) {
    nextMeasureIndex -= 1
    nextBeat = maxBeat
  } else if (nextBeat >= beatsPerMeasure && nextMeasureIndex < measureCount - 1) {
    nextMeasureIndex += 1
    nextBeat = 0
  }

  return {
    ...caret,
    measureIndex: Math.max(0, Math.min(measureCount - 1, nextMeasureIndex)),
    beat: Math.max(0, Math.min(maxBeat, nextBeat)),
  }
}

export function togglePlacementMode(current: 'hidden' | 'top' | 'bottom' | 'both', anchor: 'top' | 'bottom') {
  if (anchor === 'top') {
    if (current === 'hidden') return 'top'
    if (current === 'top') return 'hidden'
    if (current === 'bottom') return 'both'
    return 'bottom'
  }
  if (current === 'hidden') return 'bottom'
  if (current === 'bottom') return 'hidden'
  if (current === 'top') return 'both'
  return 'top'
}
