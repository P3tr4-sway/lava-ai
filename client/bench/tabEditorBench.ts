/**
 * Tab Editor Performance Benchmark
 *
 * Run in browser console:
 *   import('/bench/tabEditorBench.ts').then(m => m.runBench())
 *
 * Or open /bench/bench.html which imports this script via a module tag.
 *
 * This benchmark is NOT a Vitest test — it requires a real DOM and real
 * alphaTab instance to measure end-to-end render timing.
 */

import { nanoid } from 'nanoid'
import type { ScoreNode, BarNode, TrackNode } from '../src/editor/ast/types'
import { print } from '../src/editor/ast/printer'
import { diffAst } from '../src/render/astDiff'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchResult {
  barCount: number
  /** Time to serialize the full AST to alphaTex (ms) */
  printMs: number
  /** alphaTex output length (chars) */
  texLength: number
  /** Time to diff two ASTs with a single note change (ms) */
  diffMs: number
  /** changedBarIds count from the diff */
  diffChangedBars: number
}

// ---------------------------------------------------------------------------
// Score generator
// ---------------------------------------------------------------------------

function makeBar(barIndex: number): BarNode {
  return {
    id: nanoid(),
    voices: [
      {
        id: nanoid(),
        beats: [
          {
            id: nanoid(),
            duration: { value: 4, dots: 0 },
            notes: [{ id: nanoid(), string: 1, fret: barIndex % 12 }],
          },
          {
            id: nanoid(),
            duration: { value: 4, dots: 0 },
            notes: [{ id: nanoid(), string: 2, fret: (barIndex + 2) % 12 }],
          },
          {
            id: nanoid(),
            duration: { value: 4, dots: 0 },
            notes: [{ id: nanoid(), string: 3, fret: (barIndex + 4) % 12 }],
          },
          {
            id: nanoid(),
            duration: { value: 4, dots: 0 },
            notes: [{ id: nanoid(), string: 4, fret: (barIndex + 6) % 12 }],
          },
        ],
      },
    ],
  }
}

export function generateScore(barCount: number): ScoreNode {
  const bars: BarNode[] = Array.from({ length: barCount }, (_, i) => makeBar(i))

  const track: TrackNode = {
    id: nanoid(),
    name: 'Guitar',
    instrument: 25,
    tuning: [40, 45, 50, 55, 59, 64],
    capo: 0,
    chordDefs: [],
    staves: [{ id: nanoid(), bars }],
  }

  return {
    id: nanoid(),
    meta: { tempo: 120 },
    tracks: [track],
  }
}

// ---------------------------------------------------------------------------
// Micro-benchmark helper: run fn N times, return median ms
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function bench(fn: () => void, iterations = 5): number {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  return median(times)
}

// ---------------------------------------------------------------------------
// runBench
// ---------------------------------------------------------------------------

export async function runBench(): Promise<BenchResult[]> {
  const results: BenchResult[] = []
  const BAR_COUNTS = [200, 500, 1000]

  console.log('[tabEditorBench] Starting benchmark...')

  for (const barCount of BAR_COUNTS) {
    console.log(`[tabEditorBench] Generating ${barCount}-bar score...`)
    const score = generateScore(barCount)

    // --- Measure print time (median of 5 runs) ---
    let tex = ''
    const printMs = bench(() => {
      tex = print(score)
    })

    // --- Mutate a single note (middle bar) to create a diff target ---
    const mutated: ScoreNode = JSON.parse(JSON.stringify(score))
    const midBar = Math.floor(barCount / 2)
    mutated.tracks[0].staves[0].bars[midBar].voices[0].beats[0].notes[0].fret = 99

    // --- Measure diff time (median of 5 runs) ---
    let lastDiff = diffAst(score, mutated) // warm up
    const diffMs = bench(() => {
      lastDiff = diffAst(score, mutated)
    })

    results.push({
      barCount,
      printMs,
      texLength: tex.length,
      diffMs,
      diffChangedBars: lastDiff.changedBarIds.length,
    })

    // Yield to the event loop between iterations to avoid jank
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  console.table(results)
  console.log('[tabEditorBench] Done.')

  return results
}

// ---------------------------------------------------------------------------
// Auto-run if this script is the entry point (bench.html case)
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined' && (window as unknown as { __BENCH_AUTORUN__?: boolean }).__BENCH_AUTORUN__) {
  runBench()
}
