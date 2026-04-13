/**
 * RenderScheduler unit tests.
 *
 * AlphaTabBridge is mocked. requestAnimationFrame and requestIdleCallback
 * are replaced with synchronous fakes so we can control frame timing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RenderScheduler } from '../renderScheduler'
import type { AlphaTabBridge } from '../alphaTabBridge'
import type { ScoreNode } from '../../editor/ast/types'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// rAF / idle fake
// ---------------------------------------------------------------------------

let rafCallbacks: Array<() => void> = []
let idleCallbacks: Array<() => void> = []

function flushRaf() {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach((cb) => cb())
}

function flushIdle() {
  const cbs = [...idleCallbacks]
  idleCallbacks = []
  cbs.forEach((cb) => cb())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScore(id?: string): ScoreNode {
  return {
    id: id ?? nanoid(),
    meta: { tempo: 120 },
    tracks: [
      {
        id: nanoid(),
        name: 'Track 1',
        instrument: 25,
        tuning: [40, 45, 50, 55, 59, 64],
        capo: 0,
        chordDefs: [],
        staves: [
          {
            id: nanoid(),
            bars: [
              {
                id: nanoid(),
                voices: [
                  {
                    id: nanoid(),
                    beats: [
                      {
                        id: nanoid(),
                        duration: { value: 4, dots: 0 },
                        notes: [{ id: nanoid(), string: 1, fret: 5 }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

function makeBridge(): { bridge: AlphaTabBridge; renderAst: ReturnType<typeof vi.fn>; renderDirtyBars: ReturnType<typeof vi.fn> } {
  const renderAst = vi.fn()
  const renderDirtyBars = vi.fn()
  const bridge = { renderAst, renderDirtyBars } as unknown as AlphaTabBridge
  return { bridge, renderAst, renderDirtyBars }
}

// ---------------------------------------------------------------------------
// Setup: replace global rAF with synchronous fake
// ---------------------------------------------------------------------------

beforeEach(() => {
  rafCallbacks = []
  idleCallbacks = []

  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    const id = rafCallbacks.push(cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks[id - 1] = () => {} // no-op the cancelled callback
  })

  // Remove requestIdleCallback so the scheduler falls back to rAF
  vi.stubGlobal('requestIdleCallback', undefined)
  vi.stubGlobal('cancelIdleCallback', undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RenderScheduler.schedule', () => {
  it('defers render to next rAF frame', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)
    const ast = makeScore()

    scheduler.schedule(ast)
    expect(renderAst).not.toHaveBeenCalled() // not yet

    flushRaf()
    expect(renderAst).toHaveBeenCalledTimes(1)

    scheduler.destroy()
  })

  it('multiple schedule() calls in same frame → only one render (latest AST)', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    const ast1 = makeScore('score-1')
    const ast2 = makeScore('score-2')
    const ast3 = makeScore('score-3')

    scheduler.schedule(ast1)
    scheduler.schedule(ast2)
    scheduler.schedule(ast3)

    expect(renderAst).not.toHaveBeenCalled()

    flushRaf()

    // Only one render — with the last (ast3) snapshot
    expect(renderAst).toHaveBeenCalledTimes(1)
    expect(renderAst).toHaveBeenCalledWith(ast3)

    scheduler.destroy()
  })

  it('two separate frames → two renders', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    const ast1 = makeScore()

    scheduler.schedule(ast1)
    flushRaf() // first frame
    expect(renderAst).toHaveBeenCalledTimes(1)

    const ast2 = makeScore()
    scheduler.schedule(ast2)
    flushRaf() // second frame
    expect(renderAst).toHaveBeenCalledTimes(2)

    scheduler.destroy()
  })
})

describe('RenderScheduler.renderNow', () => {
  it('renders synchronously without waiting for rAF', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)
    const ast = makeScore()

    scheduler.renderNow(ast)

    // Render happened immediately — no rAF flush needed
    expect(renderAst).toHaveBeenCalledTimes(1)
    expect(renderAst).toHaveBeenCalledWith(ast)

    scheduler.destroy()
  })

  it('renderNow cancels any pending scheduled render', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    const ast1 = makeScore('sched')
    const ast2 = makeScore('now')

    scheduler.schedule(ast1) // queued
    scheduler.renderNow(ast2) // should cancel ast1 and render ast2 now

    expect(renderAst).toHaveBeenCalledTimes(1)
    expect(renderAst).toHaveBeenCalledWith(ast2)

    // Flush rAF — should be a no-op since we cancelled
    flushRaf()
    expect(renderAst).toHaveBeenCalledTimes(1) // still just 1

    scheduler.destroy()
  })
})

describe('RenderScheduler.getStats', () => {
  it('reports renderCount after a flush', () => {
    const { bridge } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    scheduler.schedule(makeScore())
    flushRaf()

    expect(scheduler.getStats().renderCount).toBe(1)

    scheduler.destroy()
  })

  it('resetStats zeros out counters', () => {
    const { bridge } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    scheduler.schedule(makeScore())
    flushRaf()

    expect(scheduler.getStats().renderCount).toBe(1)

    scheduler.resetStats()
    expect(scheduler.getStats().renderCount).toBe(0)
    expect(scheduler.getStats().avgRenderTimeMs).toBe(0)

    scheduler.destroy()
  })

  it('avgRenderTimeMs is ≥ 0', () => {
    const { bridge } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    scheduler.renderNow(makeScore())

    const stats = scheduler.getStats()
    expect(stats.renderCount).toBe(1)
    expect(stats.avgRenderTimeMs).toBeGreaterThanOrEqual(0)

    scheduler.destroy()
  })
})

describe('RenderScheduler.destroy', () => {
  it('schedule() after destroy is a no-op', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    scheduler.destroy()
    scheduler.schedule(makeScore())

    flushRaf() // nothing should be queued
    expect(renderAst).not.toHaveBeenCalled()
  })

  it('renderNow() after destroy is a no-op', () => {
    const { bridge, renderAst } = makeBridge()
    const scheduler = new RenderScheduler(bridge)

    scheduler.destroy()
    scheduler.renderNow(makeScore())

    expect(renderAst).not.toHaveBeenCalled()
  })
})
