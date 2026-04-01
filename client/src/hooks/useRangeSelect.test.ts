import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRangeSelect } from './useRangeSelect'
import { useEditorStore } from '@/stores/editorStore'

describe('useRangeSelect', () => {
  beforeEach(() => {
    useEditorStore.setState({ activeToolGroup: 'note', selectedBars: [] })
  })

  it('isDragging starts false', () => {
    const getMeasureBounds = vi.fn()
    const containerRef = { current: document.createElement('div') }
    const { result } = renderHook(() => useRangeSelect(containerRef, getMeasureBounds))
    expect(result.current.isDragging).toBe(false)
  })

  it('selectionBox is null initially', () => {
    const getMeasureBounds = vi.fn()
    const containerRef = { current: document.createElement('div') }
    const { result } = renderHook(() => useRangeSelect(containerRef, getMeasureBounds))
    expect(result.current.selectionBox).toBeNull()
  })

  it('onMouseDown in selection group sets isDragging', () => {
    useEditorStore.setState({ activeToolGroup: 'selection' })
    const getMeasureBounds = vi.fn()
    const containerRef = { current: document.createElement('div') }
    vi.spyOn(containerRef.current, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800 } as DOMRect
    )
    const { result } = renderHook(() => useRangeSelect(containerRef, getMeasureBounds))

    act(() => {
      result.current.onMouseDown({ clientX: 50, clientY: 100 } as React.MouseEvent)
    })

    expect(result.current.isDragging).toBe(true)
  })

  it('onMouseDown in non-selection group does NOT set isDragging', () => {
    useEditorStore.setState({ activeToolGroup: 'note' })
    const getMeasureBounds = vi.fn()
    const containerRef = { current: document.createElement('div') }
    const { result } = renderHook(() => useRangeSelect(containerRef, getMeasureBounds))

    act(() => {
      result.current.onMouseDown({ clientX: 50, clientY: 100 } as React.MouseEvent)
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('onMouseUp in selection group clears isDragging', () => {
    useEditorStore.setState({ activeToolGroup: 'selection' })
    const getMeasureBounds = vi.fn().mockReturnValue(null)
    const containerRef = { current: document.createElement('div') }
    vi.spyOn(containerRef.current, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800 } as DOMRect
    )
    const { result } = renderHook(() => useRangeSelect(containerRef, getMeasureBounds))

    act(() => {
      result.current.onMouseDown({ clientX: 50, clientY: 100 } as React.MouseEvent)
    })
    act(() => {
      result.current.onMouseUp()
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.selectionBox).toBeNull()
  })
})
