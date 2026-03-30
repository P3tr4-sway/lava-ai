import { useCallback } from 'react'
import type { RefObject } from 'react'
import { useEditorStore } from '@/stores/editorStore'

const LAVA_CLASSES = [
  'lava-bar-selected',
  'lava-note-selected',
  'lava-bar-playing',
  'lava-note-playing',
]

/**
 * Walk the OSMD-rendered SVG and assign `note-{barIndex}-{noteIndex}` IDs to
 * each `vf-stavenote` element.  OSMD itself does not label notes with our ID
 * scheme, so this must run after every render.
 *
 * Strategy: for each `.vf-measure` (which carries id="N", 1-indexed), collect
 * all descendant `.vf-stavenote` groups and number them left-to-right.
 * If notes are *siblings* of measures rather than children (varies by OSMD
 * version), we fall back to spatial hit-testing via bounding boxes.
 */
function assignNoteIds(container: HTMLElement) {
  const measureEls = Array.from(
    container.querySelectorAll<SVGGElement>('.vf-measure'),
  )

  // First pass — try child-based assignment (fastest)
  let assigned = 0
  for (const measureEl of measureEls) {
    const mId = parseInt(measureEl.id, 10)
    if (isNaN(mId) || mId < 1) continue
    const barIndex = mId - 1
    const notes = Array.from(
      measureEl.querySelectorAll<SVGGElement>(':scope > .vf-stavenote, :scope .vf-stavenote'),
    )
    // Sort left-to-right by x-position for consistent ordering
    notes.sort((a, b) => {
      const aRect = a.getBoundingClientRect()
      const bRect = b.getBoundingClientRect()
      return aRect.left - bRect.left
    })
    notes.forEach((noteEl, noteIndex) => {
      noteEl.id = `note-${barIndex}-${noteIndex}`
      assigned++
    })
  }

  // Second pass — spatial fallback if child-based found nothing but notes exist
  if (assigned === 0) {
    const allNotes = Array.from(
      container.querySelectorAll<SVGGElement>('.vf-stavenote'),
    )
    if (allNotes.length === 0 || measureEls.length === 0) return

    // Build measure x-ranges
    const measureBounds = measureEls
      .map((el) => {
        const id = parseInt(el.id, 10)
        if (isNaN(id) || id < 1) return null
        const rect = el.getBoundingClientRect()
        return { barIndex: id - 1, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      })
      .filter(Boolean) as { barIndex: number; left: number; right: number; top: number; bottom: number }[]

    const noteCounts: Record<string, number> = {}

    // Sort notes top-to-bottom, left-to-right for deterministic ordering
    allNotes.sort((a, b) => {
      const ar = a.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      const dy = ar.top - br.top
      return Math.abs(dy) > 5 ? dy : ar.left - br.left
    })

    for (const noteEl of allNotes) {
      const nr = noteEl.getBoundingClientRect()
      const cx = nr.left + nr.width / 2
      const cy = nr.top + nr.height / 2
      const measure = measureBounds.find(
        (m) => cx >= m.left && cx <= m.right && cy >= m.top - 10 && cy <= m.bottom + 10,
      )
      if (!measure) continue
      const key = `${measure.barIndex}`
      const noteIndex = noteCounts[key] ?? 0
      noteCounts[key] = noteIndex + 1
      noteEl.id = `note-${measure.barIndex}-${noteIndex}`
    }
  }
}

/**
 * Returns utilities to sync editorStore selection/playback state
 * into CSS classes on OSMD-rendered SVG elements.
 *
 * OSMD DOM conventions:
 *   - Measures: <g class="vf-measure" id="N"> where N is 1-indexed measure number
 *   - Notes:    <g class="vf-stavenote" id="note-{barIndex}-{noteIndex}">
 *               (assigned by assignNoteIds after each render)
 */
export function useScoreSync(containerRef: RefObject<HTMLElement | null>) {
  // Subscribe to relevant slices so the component re-renders when they change,
  // keeping syncHighlights stable for callers that want reactivity.
  useEditorStore((s) => s.selectedBars)
  useEditorStore((s) => s.selectedNotes)
  useEditorStore((s) => s.currentBar)
  useEditorStore((s) => s.playbackState)
  useEditorStore((s) => s.showBeatMarkers)

  const syncBeatMarkers = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Remove existing beat marker lines
    container.querySelectorAll('.lava-beat-marker, .lava-beat-marker-downbeat').forEach((el) => el.remove())

    const { showBeatMarkers } = useEditorStore.getState()
    if (!showBeatMarkers) return

    const svgNS = 'http://www.w3.org/2000/svg'
    const measureEls = container.querySelectorAll<SVGGraphicsElement>('.vf-measure')

    measureEls.forEach((measureEl) => {
      let bbox: DOMRect | SVGRect | null = null
      try {
        bbox = measureEl.getBBox()
      } catch {
        return
      }
      if (!bbox || bbox.width === 0) return

      // Default 4 beats per bar (full time-sig awareness would require XML parsing)
      const beats = 4
      for (let beat = 1; beat < beats; beat++) {
        const x = bbox.x + (beat / beats) * bbox.width
        const line = document.createElementNS(svgNS, 'line')
        line.setAttribute('x1', String(x))
        line.setAttribute('y1', String(bbox.y))
        line.setAttribute('x2', String(x))
        line.setAttribute('y2', String(bbox.y + bbox.height))
        line.classList.add('lava-beat-marker')
        measureEl.appendChild(line)
      }
    })
  }, [containerRef])

  /** Assign note IDs after OSMD re-render so click detection and CSS selection work. */
  const tagNotes = useCallback(() => {
    const container = containerRef.current
    if (container) assignNoteIds(container)
  }, [containerRef])

  const syncHighlights = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Ensure note IDs are present (idempotent — safe to re-run)
    assignNoteIds(container)

    // Read latest state directly at call-time to avoid stale closure values
    const { selectedBars, selectedNotes, currentBar, playbackState } =
      useEditorStore.getState()

    // Clear all lava classes
    for (const cls of LAVA_CLASSES) {
      container.querySelectorAll(`.${cls}`).forEach((el) => el.classList.remove(cls))
    }

    // Apply bar selection
    for (const barIndex of selectedBars) {
      const el = container.querySelector(`.vf-measure[id="${barIndex + 1}"]`)
      el?.classList.add('lava-bar-selected')
    }

    // Apply note selection
    for (const { barIndex, noteIndex } of selectedNotes) {
      const el = container.querySelector(`#note-${barIndex}-${noteIndex}`)
      el?.classList.add('lava-note-selected')
    }

    // Apply playback bar highlight
    if (playbackState !== 'stopped' && currentBar >= 0) {
      const el = container.querySelector(`.vf-measure[id="${currentBar + 1}"]`)
      el?.classList.add('lava-bar-playing')
    }

    syncBeatMarkers()
  }, [containerRef, syncBeatMarkers])

  const getMeasureBounds = useCallback(
    (barIndex: number): DOMRect | null => {
      const container = containerRef.current
      if (!container) return null
      const el = container.querySelector(`.vf-measure[id="${barIndex + 1}"]`)
      if (!el) return null
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      return new DOMRect(
        elRect.x - containerRect.x,
        elRect.y - containerRect.y,
        elRect.width,
        elRect.height,
      )
    },
    [containerRef],
  )

  const getNoteBounds = useCallback(
    (barIndex: number, noteIndex: number): DOMRect | null => {
      const container = containerRef.current
      if (!container) return null
      const el = container.querySelector(`#note-${barIndex}-${noteIndex}`)
      if (!el) return null
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      return new DOMRect(
        elRect.x - containerRect.x,
        elRect.y - containerRect.y,
        elRect.width,
        elRect.height,
      )
    },
    [containerRef],
  )

  return { syncHighlights, tagNotes, getMeasureBounds, getNoteBounds }
}
