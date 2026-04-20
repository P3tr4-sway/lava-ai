/**
 * BendCurveEditor tests — cover preset buttons, point rendering, right-click
 * removal, and click-to-add behavior.
 *
 * We deliberately avoid pointerdown + pointermove drag simulation because
 * jsdom does not implement setPointerCapture / releasePointerCapture fully.
 * Instead we verify the pure helper surface (preset lookup) and the DOM
 * output shape.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import {
  BendCurveEditor,
  BEND_PRESETS,
  WHAMMY_PRESETS,
  getPresetsForKind,
} from '../BendCurveEditor'

describe('BendCurveEditor presets', () => {
  it('bend presets have valid shape', () => {
    for (const [name, points] of Object.entries(BEND_PRESETS)) {
      expect(points.length).toBeGreaterThanOrEqual(2)
      for (const pt of points) {
        expect(pt.position).toBeGreaterThanOrEqual(0)
        expect(pt.position).toBeLessThanOrEqual(60)
        expect(pt.value).toBeGreaterThanOrEqual(0)
        expect(pt.value).toBeLessThanOrEqual(12)
      }
      // must start at position 0 and end at 60 so AlphaTab renders cleanly
      expect(points[0].position).toBe(0)
      expect(points[points.length - 1].position).toBe(60)
      expect(name).toBeTruthy()
    }
  })

  it('whammy presets allow negative values', () => {
    expect(WHAMMY_PRESETS.dive.some((p) => p.value < 0)).toBe(true)
    for (const points of Object.values(WHAMMY_PRESETS)) {
      for (const pt of points) {
        expect(pt.value).toBeGreaterThanOrEqual(-12)
        expect(pt.value).toBeLessThanOrEqual(12)
      }
    }
  })

  it('getPresetsForKind returns the correct preset list', () => {
    const bend = getPresetsForKind('bend')
    expect(bend.map((p) => p.key)).toEqual(['full', 'half', 'prebend', 'release', 'vibrato'])
    const whammy = getPresetsForKind('whammy')
    expect(whammy.map((p) => p.key)).toEqual(['dive', 'diveHold', 'up', 'dip'])
  })
})

describe('BendCurveEditor rendering', () => {
  it('renders empty SVG when no points', () => {
    const { container } = render(
      <BendCurveEditor kind="bend" points={[]} onChange={() => {}} />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelectorAll('circle').length).toBe(0)
    expect(container.querySelectorAll('polyline').length).toBe(0)
  })

  it('renders one circle per control point', () => {
    const points = BEND_PRESETS.full
    const { container } = render(
      <BendCurveEditor kind="bend" points={points} onChange={() => {}} />,
    )
    expect(container.querySelectorAll('circle').length).toBe(points.length)
  })

  it('renders polyline when >= 2 points', () => {
    const { container } = render(
      <BendCurveEditor kind="bend" points={BEND_PRESETS.half} onChange={() => {}} />,
    )
    const polyline = container.querySelector('polyline')
    expect(polyline).not.toBeNull()
    // half preset has 3 points → 3 "x,y" pairs separated by spaces
    const pointsAttr = polyline!.getAttribute('points') ?? ''
    expect(pointsAttr.split(/\s+/).filter(Boolean).length).toBe(3)
  })

  it('right-click removes a control point', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BendCurveEditor kind="bend" points={BEND_PRESETS.full} onChange={onChange} />,
    )
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(3)
    fireEvent.contextMenu(circles[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as Array<{ position: number; value: number }>
    expect(next.length).toBe(2)
    // middle one (position 15) should be removed
    expect(next.find((p) => p.position === 15)).toBeUndefined()
  })

  it('uses different stroke class for whammy (fill-warning) vs bend (fill-accent)', () => {
    const bendRender = render(
      <BendCurveEditor kind="bend" points={BEND_PRESETS.full} onChange={() => {}} />,
    )
    expect(bendRender.container.querySelector('circle')?.getAttribute('class')).toMatch(/fill-accent/)
    bendRender.unmount()

    const whammyRender = render(
      <BendCurveEditor kind="whammy" points={WHAMMY_PRESETS.dive} onChange={() => {}} />,
    )
    expect(whammyRender.container.querySelector('circle')?.getAttribute('class')).toMatch(
      /fill-warning/,
    )
  })

  it('whammy mode renders an explicit zero reference line', () => {
    const { container } = render(
      <BendCurveEditor kind="whammy" points={[]} onChange={() => {}} />,
    )
    // 7 y-grid lines (-12,-8,-4,0,4,8,12) + 5 x-grid + 1 zero line = 13 total
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThanOrEqual(7 + 5 + 1)
  })

  it('clicking on empty SVG canvas adds a point', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BendCurveEditor kind="bend" points={[]} onChange={onChange} width={240} height={120} />,
    )
    const svg = container.querySelector('svg')!
    // Simulate pointer down on the SVG itself (not a circle).
    // jsdom returns getBoundingClientRect as 0,0 so clientX/Y map directly.
    // pointerType is required for React's onPointerDown to fire.
    fireEvent.pointerDown(svg, {
      clientX: 20,
      clientY: 20,
      button: 0,
      pointerType: 'mouse',
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as Array<{ position: number; value: number }>
    expect(next.length).toBe(1)
    expect(next[0].position).toBeGreaterThanOrEqual(0)
    expect(next[0].position).toBeLessThanOrEqual(60)
  })
})
