import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScoreSync } from './useScoreSync'
import { useEditorStore } from '@/stores/editorStore'

// Helper: create a fake OSMD container with measure and note SVG elements
function makeFakeContainer() {
  const container = document.createElement('div')

  // Measure 1 (id="1", 1-indexed)
  const m1 = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  m1.classList.add('vf-measure')
  m1.id = '1'
  const m1rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  m1rect.setAttribute('x', '10')
  m1rect.setAttribute('y', '20')
  m1rect.setAttribute('width', '100')
  m1rect.setAttribute('height', '50')
  m1.appendChild(m1rect)

  // Note in measure 1 (stavenote id="note-0-0")
  const n1 = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  n1.classList.add('vf-stavenote')
  n1.id = 'note-0-0'
  m1.appendChild(n1)

  // Measure 2 (id="2")
  const m2 = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  m2.classList.add('vf-measure')
  m2.id = '2'

  container.appendChild(m1)
  container.appendChild(m2)
  return { container, m1, n1, m2 }
}

describe('useScoreSync', () => {
  beforeEach(() => {
    useEditorStore.setState({
      selectedBars: [],
      selectedNotes: [],
      currentBar: -1,
      playbackState: 'stopped',
    })
  })

  it('syncHighlights adds lava-bar-selected to selected measures', () => {
    const { container, m1 } = makeFakeContainer()
    const containerRef = { current: container }
    const { result } = renderHook(() => useScoreSync(containerRef))

    act(() => {
      useEditorStore.setState({ selectedBars: [0] })
      result.current.syncHighlights()
    })

    expect(m1.classList.contains('lava-bar-selected')).toBe(true)
  })

  it('syncHighlights adds lava-note-selected to selected notes', () => {
    const { container, n1 } = makeFakeContainer()
    const containerRef = { current: container }
    const { result } = renderHook(() => useScoreSync(containerRef))

    act(() => {
      useEditorStore.setState({ selectedNotes: [{ barIndex: 0, noteIndex: 0 }] })
      result.current.syncHighlights()
    })

    expect(n1.classList.contains('lava-note-selected')).toBe(true)
  })

  it('syncHighlights clears old classes before re-applying', () => {
    const { container, m1, m2 } = makeFakeContainer()
    m1.classList.add('lava-bar-selected')
    m2.classList.add('lava-bar-selected')
    const containerRef = { current: container }
    const { result } = renderHook(() => useScoreSync(containerRef))

    act(() => {
      useEditorStore.setState({ selectedBars: [1] }) // only bar index 1 (m2)
      result.current.syncHighlights()
    })

    expect(m1.classList.contains('lava-bar-selected')).toBe(false)
    expect(m2.classList.contains('lava-bar-selected')).toBe(true)
  })

  it('getMeasureBounds returns DOMRect relative to container', () => {
    const { container, m1 } = makeFakeContainer()
    // jsdom getBoundingClientRect returns zeros, but the function should call it
    vi.spyOn(m1, 'getBoundingClientRect').mockReturnValue(
      { x: 50, y: 60, width: 100, height: 50, top: 60, bottom: 110, left: 50, right: 150 } as DOMRect
    )
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
      { x: 10, y: 10, width: 800, height: 600, top: 10, bottom: 610, left: 10, right: 810 } as DOMRect
    )
    const containerRef = { current: container }
    const { result } = renderHook(() => useScoreSync(containerRef))

    const bounds = result.current.getMeasureBounds(0)
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBe(40)  // 50 - 10
    expect(bounds!.y).toBe(50)  // 60 - 10
  })

  it('getMeasureBounds returns null for out-of-range index', () => {
    const { container } = makeFakeContainer()
    const containerRef = { current: container }
    const { result } = renderHook(() => useScoreSync(containerRef))

    const bounds = result.current.getMeasureBounds(99)
    expect(bounds).toBeNull()
  })
})
