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
 * Returns utilities to sync editorStore selection/playback state
 * into CSS classes on OSMD-rendered SVG elements.
 *
 * OSMD DOM conventions:
 *   - Measures: <g class="vf-measure" id="N"> where N is 1-indexed measure number
 *   - Notes:    <g class="vf-stavenote" id="note-{barIndex}-{noteIndex}">
 *               where barIndex and noteIndex are 0-indexed
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

  const syncHighlights = useCallback(() => {
    const container = containerRef.current
    if (!container) return

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

  return { syncHighlights, getMeasureBounds, getNoteBounds }
}
