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
  }, [containerRef])

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
