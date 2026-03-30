import type { NoteValue, ScoreDocument, ScoreMeasureMeta, ScoreNoteEvent } from '@lava/shared'

export interface LayoutNoteCell {
  noteId: string
  measureIndex: number
  beat: number
  string: number
  fret: number | null
  isRest: boolean
  durationType: NoteValue
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutBeatAnchor {
  measureIndex: number
  beat: number
  x: number
  y: number
  width: number
  height: number
  stringCenters: number[]
}

export interface LayoutMeasure {
  measure: ScoreMeasureMeta
  index: number
  x: number
  y: number
  width: number
  height: number
  contentX: number
  contentY: number
  stringCenters: number[]
  beatAnchors: LayoutBeatAnchor[]
  noteCells: LayoutNoteCell[]
  topAnchorRect: { x: number; y: number; width: number; height: number }
  bottomAnchorRect: { x: number; y: number; width: number; height: number }
}

export interface TabLayout {
  width: number
  height: number
  measures: LayoutMeasure[]
  barsPerRow: number
}

export interface LayoutPointer {
  x: number
  y: number
}

const DEFAULT_BARS_PER_ROW = 4

export function buildTabLayout(document: ScoreDocument, zoom = 100, barsPerRow = DEFAULT_BARS_PER_ROW): TabLayout {
  const scale = zoom / 100
  const measureWidth = 220 * scale
  const measureHeight = 178 * scale
  const gapX = 20 * scale
  const gapY = 28 * scale
  const outerPadding = 24 * scale
  const contentInsetX = 18 * scale
  const contentInsetY = 44 * scale
  const stringsHeight = 64 * scale

  const measures = document.measures.map<LayoutMeasure>((measure, index) => {
    const row = Math.floor(index / barsPerRow)
    const column = index % barsPerRow
    const x = outerPadding + column * (measureWidth + gapX)
    const y = outerPadding + row * (measureHeight + gapY)
    const contentX = x + contentInsetX
    const contentY = y + contentInsetY
    const stringGap = stringsHeight / 5
    const stringCenters = Array.from({ length: 6 }, (_, stringIndex) => contentY + stringIndex * stringGap)
    const numerator = measure.timeSignature?.numerator ?? document.meter.numerator
    const subdivisionCount = Math.max(1, numerator * 4)
    const beatAnchors = Array.from({ length: subdivisionCount }, (_, subdivisionIndex) => {
      const beat = subdivisionIndex / 4
      const beatWidth = (measureWidth - contentInsetX * 2) / subdivisionCount
      return {
        measureIndex: index,
        beat,
        x: contentX + subdivisionIndex * beatWidth,
        y: contentY - 12 * scale,
        width: beatWidth,
        height: stringsHeight + 24 * scale,
        stringCenters,
      }
    })

    const noteCells = getMeasureNotes(document, index).map<LayoutNoteCell>((note) => {
      const columnIndex = Math.max(0, Math.round(note.beat * 4))
      const anchor = beatAnchors[Math.min(columnIndex, beatAnchors.length - 1)]
      const string = note.placement?.string ?? 3
      const stringCenter = stringCenters[Math.max(0, Math.min(5, string - 1))]
      return {
        noteId: note.id,
        measureIndex: index,
        beat: note.beat,
        string,
        fret: note.placement?.fret ?? null,
        isRest: note.isRest,
        durationType: note.durationType,
        x: anchor.x + anchor.width * 0.15,
        y: stringCenter - 11 * scale,
        width: Math.max(20 * scale, anchor.width * 0.7),
        height: 22 * scale,
      }
    })

    return {
      measure,
      index,
      x,
      y,
      width: measureWidth,
      height: measureHeight,
      contentX,
      contentY,
      stringCenters,
      beatAnchors,
      noteCells,
      topAnchorRect: {
        x: contentX,
        y: y + 8 * scale,
        width: measureWidth - contentInsetX * 2,
        height: 22 * scale,
      },
      bottomAnchorRect: {
        x: contentX,
        y: y + measureHeight - 30 * scale,
        width: measureWidth - contentInsetX * 2,
        height: 22 * scale,
      },
    }
  })

  const rowCount = Math.max(1, Math.ceil(document.measures.length / barsPerRow))
  return {
    width: outerPadding * 2 + barsPerRow * measureWidth + Math.max(0, barsPerRow - 1) * gapX,
    height: outerPadding * 2 + rowCount * measureHeight + Math.max(0, rowCount - 1) * gapY,
    measures,
    barsPerRow,
  }
}

export function getMeasureNotes(document: ScoreDocument, measureIndex: number): ScoreNoteEvent[] {
  return (document.tracks[0]?.notes ?? [])
    .filter((note) => note.measureIndex === measureIndex)
    .sort((a, b) => a.beat - b.beat || (a.placement?.string ?? 99) - (b.placement?.string ?? 99))
}

export function hitTestNote(layout: TabLayout, pointer: LayoutPointer): LayoutNoteCell | null {
  for (const measure of layout.measures) {
    for (const note of measure.noteCells) {
      if (
        pointer.x >= note.x &&
        pointer.x <= note.x + note.width &&
        pointer.y >= note.y &&
        pointer.y <= note.y + note.height
      ) {
        return note
      }
    }
  }
  return null
}

export function hitTestMeasure(layout: TabLayout, pointer: LayoutPointer): LayoutMeasure | null {
  return layout.measures.find((measure) =>
    pointer.x >= measure.x &&
    pointer.x <= measure.x + measure.width &&
    pointer.y >= measure.y &&
    pointer.y <= measure.y + measure.height,
  ) ?? null
}

export function hitTestBeat(layout: TabLayout, pointer: LayoutPointer): LayoutBeatAnchor | null {
  const measure = hitTestMeasure(layout, pointer)
  if (!measure) return null
  const anchor = measure.beatAnchors.find((entry) =>
    pointer.x >= entry.x &&
    pointer.x <= entry.x + entry.width &&
    pointer.y >= entry.y &&
    pointer.y <= entry.y + entry.height,
  ) ?? null
  return anchor
}

export function inferStringFromPointer(anchor: LayoutBeatAnchor, y: number): number {
  let bestString = 1
  let bestDistance = Number.POSITIVE_INFINITY
  anchor.stringCenters.forEach((center, index) => {
    const distance = Math.abs(center - y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestString = index + 1
    }
  })
  return bestString
}

export function getMeasuresInRect(
  layout: TabLayout,
  start: LayoutPointer,
  end: LayoutPointer,
): number[] {
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)

  return layout.measures
    .filter((measure) =>
      left < measure.x + measure.width &&
      right > measure.x &&
      top < measure.y + measure.height &&
      bottom > measure.y,
    )
    .map((measure) => measure.index)
}
