import { describe, it, expect } from 'vitest'
import { lerp, computeSnapTarget, isSnapped, deriveCursorMode } from './cursorMath'

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })
  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })
  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })
  it('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })
})

describe('computeSnapTarget', () => {
  const SNAP_RADIUS = 30
  const SNAP_STRENGTH = 0.6

  it('returns rawX when no snap points within radius', () => {
    const result = computeSnapTarget(100, [0, 200], SNAP_RADIUS, SNAP_STRENGTH)
    expect(result).toBe(100)
  })

  it('pulls toward nearest snap point within radius', () => {
    // rawX=85, snap at 100, distance=15, within radius=30
    const result = computeSnapTarget(85, [100], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 15/30) * 0.6 = 0.3
    // target = 85 + (100 - 85) * 0.3 = 85 + 4.5 = 89.5
    expect(result).toBe(89.5)
  })

  it('pulls stronger when closer to snap point', () => {
    // rawX=95, snap at 100, distance=5, within radius=30
    const result = computeSnapTarget(95, [100], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 5/30) * 0.6 = 0.5
    // target = 95 + (100 - 95) * 0.5 = 95 + 2.5 = 97.5
    expect(result).toBe(97.5)
  })

  it('returns rawX when exactly at radius boundary', () => {
    // rawX=70, snap at 100, distance=30, equals radius
    const result = computeSnapTarget(70, [100], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 30/30) * 0.6 = 0
    expect(result).toBe(70)
  })

  it('snaps to the closest snap point when multiple are within radius', () => {
    // rawX=110, snaps at [100, 115], closest is 115 (distance=5)
    const result = computeSnapTarget(110, [100, 115], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 5/30) * 0.6 ≈ 0.5
    // target = 110 + (115 - 110) * 0.5 = 112.5
    expect(result).toBe(112.5)
  })

  it('handles empty snap points array', () => {
    expect(computeSnapTarget(50, [], SNAP_RADIUS, SNAP_STRENGTH)).toBe(50)
  })
})

describe('isSnapped', () => {
  it('returns true when displayX is within threshold of a snap point', () => {
    expect(isSnapped(98, [100], 5)).toBe(true)
  })
  it('returns false when displayX is beyond threshold', () => {
    expect(isSnapped(90, [100], 5)).toBe(false)
  })
  it('returns true when exactly on a snap point', () => {
    expect(isSnapped(100, [100], 5)).toBe(true)
  })
  it('returns false with empty snap points', () => {
    expect(isSnapped(100, [], 5)).toBe(false)
  })
})

describe('deriveCursorMode', () => {
  it('returns playback when playing regardless of tool group', () => {
    expect(deriveCursorMode('selection', 'playing')).toBe('playback')
    expect(deriveCursorMode('note', 'playing')).toBe('playback')
    expect(deriveCursorMode('notation', 'playing')).toBe('playback')
  })
  it('returns noteEntry when note tool is active and not playing', () => {
    expect(deriveCursorMode('note', 'stopped')).toBe('noteEntry')
    expect(deriveCursorMode('note', 'paused')).toBe('noteEntry')
  })
  it('returns select when selection tool is active and not playing', () => {
    expect(deriveCursorMode('selection', 'stopped')).toBe('select')
    expect(deriveCursorMode('selection', 'paused')).toBe('select')
  })
  it('returns hidden for notation tool when not playing', () => {
    expect(deriveCursorMode('notation', 'stopped')).toBe('hidden')
  })
  it('returns hidden for rest tool when not playing', () => {
    expect(deriveCursorMode('rest', 'stopped')).toBe('hidden')
  })
  it('returns hidden for measure tool when not playing', () => {
    expect(deriveCursorMode('measure', 'stopped')).toBe('hidden')
  })
  it('returns hidden for playback tool group when not playing', () => {
    expect(deriveCursorMode('playback', 'stopped')).toBe('hidden')
  })
})
