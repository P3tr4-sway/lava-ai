import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePlaybackCursor } from './usePlaybackCursor'
import { useEditorStore } from '@/stores/editorStore'

describe('usePlaybackCursor', () => {
  beforeEach(() => {
    useEditorStore.setState({
      currentBar: -1,
      playbackState: 'stopped',
    })
  })

  it('returns visible=false when playbackState is stopped', () => {
    useEditorStore.setState({ currentBar: 0, playbackState: 'stopped' })
    const getMeasureBounds = vi.fn().mockReturnValue({ x: 10, y: 20, width: 100, height: 50 })
    const { result } = renderHook(() => usePlaybackCursor(getMeasureBounds))
    expect(result.current.visible).toBe(false)
  })

  it('returns visible=true when playing and currentBar >= 0', () => {
    useEditorStore.setState({ currentBar: 1, playbackState: 'playing' })
    const getMeasureBounds = vi.fn().mockReturnValue({ x: 10, y: 20, width: 100, height: 50 })
    const { result } = renderHook(() => usePlaybackCursor(getMeasureBounds))
    expect(result.current.visible).toBe(true)
  })

  it('returns visible=true when paused and currentBar >= 0', () => {
    useEditorStore.setState({ currentBar: 0, playbackState: 'paused' })
    const getMeasureBounds = vi.fn().mockReturnValue({ x: 10, y: 20, width: 100, height: 50 })
    const { result } = renderHook(() => usePlaybackCursor(getMeasureBounds))
    expect(result.current.visible).toBe(true)
  })

  it('returns visible=false when currentBar is -1 even while playing', () => {
    useEditorStore.setState({ currentBar: -1, playbackState: 'playing' })
    const getMeasureBounds = vi.fn().mockReturnValue(null)
    const { result } = renderHook(() => usePlaybackCursor(getMeasureBounds))
    expect(result.current.visible).toBe(false)
  })

  it('returns correct bounds from getMeasureBounds', () => {
    useEditorStore.setState({ currentBar: 2, playbackState: 'playing' })
    const bounds = { x: 50, y: 30, width: 120, height: 60 }
    const getMeasureBounds = vi.fn().mockReturnValue(bounds)
    const { result } = renderHook(() => usePlaybackCursor(getMeasureBounds))
    expect(result.current.bounds).toEqual(bounds)
    expect(getMeasureBounds).toHaveBeenCalledWith(2)
  })

  it('returns bounds=null when getMeasureBounds returns null', () => {
    useEditorStore.setState({ currentBar: 0, playbackState: 'playing' })
    const getMeasureBounds = vi.fn().mockReturnValue(null)
    const { result } = renderHook(() => usePlaybackCursor(getMeasureBounds))
    expect(result.current.bounds).toBeNull()
    expect(result.current.visible).toBe(false)
  })
})
