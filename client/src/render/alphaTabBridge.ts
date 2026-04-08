/**
 * AlphaTabBridge — singleton wrapper around the AlphaTabApi.
 *
 * Owns the AlphaTabApi instance lifecycle. Call init() once the container
 * element is mounted, then call renderAst() whenever the AST changes.
 * Destroy() tears everything down cleanly.
 */

import {
  AlphaTabApi,
  LayoutMode,
  PlayerMode,
} from '@coderline/alphatab'
import type { Settings } from '@coderline/alphatab'
import { print } from '../editor/ast/printer'
import type { ScoreNode } from '../editor/ast/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HitPosition {
  trackIndex: number
  barIndex: number
  voiceIndex: number
  beatIndex: number
  /** 1-indexed, 1 = lowest (thickest) string */
  stringIndex: number
}

export interface BeatBoundsRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AlphaTabBridgeOptions {
  /** default: '/vendor/alphatab/sonivox.sf2' */
  soundFont: string
  /** default: '/vendor/alphatab/font/' */
  fontDirectory: string
  /** default: 4 */
  barsPerRow: number
  /** default: 1.0 */
  scale: number
  /** default: '/vendor/alphatab/' */
  workerPath: string
}

const DEFAULT_OPTIONS: AlphaTabBridgeOptions = {
  soundFont: '/vendor/alphatab/sonivox.sf2',
  fontDirectory: '/vendor/alphatab/font/',
  barsPerRow: 4,
  scale: 1.0,
  workerPath: '/vendor/alphatab/',
}

// ---------------------------------------------------------------------------
// Internal alphaTab shape helpers (the types we need but alphaTab doesn't
// export cleanly as standalone interfaces)
// ---------------------------------------------------------------------------

interface AlphaBeat {
  index: number
  voice: {
    index: number
    bar: {
      index: number
      staff: {
        track: {
          index: number
        }
      }
    }
  }
}

interface AlphaBoundsLike {
  x: number
  y: number
  w: number
  h: number
}

interface AlphaBeatBounds {
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
  beat: AlphaBeat
}

interface AlphaBarBounds {
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
  lineAlignedBounds?: AlphaBoundsLike
  beats: AlphaBeatBounds[]
}

interface AlphaMasterBarBounds {
  index: number
  visualBounds: AlphaBoundsLike
  realBounds: AlphaBoundsLike
  lineAlignedBounds: AlphaBoundsLike
  bars: AlphaBarBounds[]
  findBeatAtPos(x: number): AlphaBeat | null
}

interface AlphaBoundsLookup {
  staffSystems: Array<{
    visualBounds: AlphaBoundsLike
    realBounds: AlphaBoundsLike
    bars: AlphaMasterBarBounds[]
  }>
  getBeatAtPos(x: number, y: number): AlphaBeat | null
  findMasterBarByIndex(index: number): AlphaMasterBarBounds | null
  findBeat(beat: unknown): AlphaBeatBounds | null
  getNoteAtPos(beat: unknown, x: number, y: number): unknown | null
}

// ---------------------------------------------------------------------------
// AlphaTabBridge class
// ---------------------------------------------------------------------------

export class AlphaTabBridge {
  private api: AlphaTabApi | null = null
  private offRenderFinished: (() => void) | null = null
  private offBeatMouseDown: (() => void) | null = null

  // ---------------------------------------------------------------------------
  // Event callbacks — set these before calling init()
  // ---------------------------------------------------------------------------

  onReady: (() => void) | null = null
  onRenderFinished: (() => void) | null = null
  onBeatMouseDown: ((pos: HitPosition) => void) | null = null

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize alphaTab in the given container element.
   * Must be called once after the container is mounted in the DOM.
   */
  init(container: HTMLElement, options?: Partial<AlphaTabBridgeOptions>): void {
    if (this.api) {
      console.warn('[AlphaTabBridge] init() called more than once — call destroy() first')
      return
    }

    const opts: AlphaTabBridgeOptions = { ...DEFAULT_OPTIONS, ...options }

    const settings: Partial<Settings> = {
      core: {
        engine: 'svg',
        enableLazyLoading: false,
        fontDirectory: opts.fontDirectory,
        includeNoteBounds: true,
        useWorkers: false,
      } as Settings['core'],
      display: {
        barsPerRow: opts.barsPerRow,
        layoutMode: LayoutMode.Page,
        scale: opts.scale,
      } as Settings['display'],
      player: {
        playerMode: PlayerMode.EnabledAutomatic,
        soundFont: opts.soundFont,
        enableCursor: false,
        enableAnimatedBeatCursor: false,
        enableUserInteraction: false,
      } as Settings['player'],
    }

    this.api = new AlphaTabApi(container, settings as unknown as Settings)

    // renderFinished fires after each render pass
    this.offRenderFinished = this.api.renderFinished.on(() => {
      this.onRenderFinished?.()
    })

    // beatMouseDown: map alphaTab Beat → HitPosition
    this.offBeatMouseDown = this.api.beatMouseDown.on((beat: unknown) => {
      if (!this.onBeatMouseDown) return
      const b = beat as AlphaBeat
      const pos: HitPosition = {
        trackIndex: b.voice.bar.staff.track.index,
        barIndex: b.voice.bar.index,
        voiceIndex: b.voice.index,
        beatIndex: b.index,
        // stringIndex is not available directly from beatMouseDown;
        // callers that need string resolution should use hitTest() with the
        // mouse y-coordinate against the boundsLookup.
        stringIndex: 1,
      }
      this.onBeatMouseDown(pos)
    })

    // Signal ready after the first successful render
    const offReady = this.api.renderFinished.on(() => {
      this.onReady?.()
      offReady()
    })
  }

  /**
   * Feed the AST through the printer and call api.tex() for a full re-render.
   */
  renderAst(ast: ScoreNode): void {
    if (!this.api) {
      console.warn('[AlphaTabBridge] renderAst() called before init()')
      return
    }
    const texString = print(ast)
    this.api.tex(texString)
  }

  /**
   * Attempt to re-render only the bars that changed.
   *
   * ## alphaTab 1.8.1 partial-render research
   *
   * alphaTab 1.8.1 exposes `api.renderTracks(tracks: Track[])` but this
   * operates at the *track* level — it re-renders a specific set of tracks but
   * still triggers a full layout pass for those tracks, not a bar-level
   * incremental update. It is primarily intended for toggling track visibility,
   * not for hot-patching individual bars.
   *
   * There is no public API for bar-level partial rendering in 1.8.1.
   * The internal renderer re-builds the full SVG layout from the alphaTex
   * string on every `api.tex()` call.
   *
   * **Resolution**: This method falls back to a full `api.tex()` render but is
   * guarded by the `RenderScheduler`'s rAF batching, which already collapses
   * multiple mutations within a single frame into one render call. The
   * meaningful optimisation for Phase 8 is therefore the scheduler (step 2),
   * not true bar-level incremental SVG patching.
   *
   * Future: alphaTab 2.x is expected to expose a `renderRange()` or similar
   * API. When available, replace this implementation.
   *
   * @param ast - The full AST (needed to reconstruct the alphaTex string)
   * @param changedBarIds - Bar IDs that changed (used for logging / future use)
   */
  renderDirtyBars(ast: ScoreNode, changedBarIds: string[]): void {
    if (!this.api) {
      console.warn('[AlphaTabBridge] renderDirtyBars() called before init()')
      return
    }
    // Log for observability — useful when alphaTab gains partial-render support
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[AlphaTabBridge] renderDirtyBars: ${changedBarIds.length} bars changed — full render (alphaTab 1.8.1 limitation)`,
        changedBarIds,
      )
    }
    // Full re-render (batched by RenderScheduler to ≤1 per rAF frame)
    const texString = print(ast)
    this.api.tex(texString)
  }

  /**
   * Expose the underlying AlphaTabApi instance.
   * Returns null if the bridge has not been initialised yet.
   */
  getApi(): AlphaTabApi | null {
    return this.api
  }

  /**
   * Expose the live boundsLookup for hit-testing.
   * Returns null if alphaTab is not yet initialised or has not rendered.
   */
  getBoundsLookup(): unknown | null {
    return this.api?.boundsLookup ?? null
  }

  /**
   * Returns the screen rect for a given AST position.
   * Uses the tab staff bounds (last bar in the masterBarBounds.bars array)
   * matching the pattern established in TabCanvas.tsx.
   */
  getBeatRect(
    trackIndex: number,
    barIndex: number,
    voiceIndex: number,
    beatIndex: number,
  ): BeatBoundsRect | null {
    if (!this.api) return null
    const lookup = this.api.boundsLookup as AlphaBoundsLookup | null
    if (!lookup) return null

    const masterBarBounds = lookup.findMasterBarByIndex(barIndex)
    if (!masterBarBounds) return null

    // Each masterBarBounds.bars[] entry corresponds to one staff (score, tab, etc.)
    // We prefer the last bar (tab staff) matching TabCanvas behaviour.
    const barBounds: AlphaBarBounds | undefined =
      masterBarBounds.bars[masterBarBounds.bars.length - 1]
    if (!barBounds) return null

    // Walk beats to find matching track/voice/beat indices
    for (const beatBounds of barBounds.beats) {
      const b = beatBounds.beat
      if (
        b.voice.bar.staff.track.index === trackIndex &&
        b.voice.index === voiceIndex &&
        b.index === beatIndex
      ) {
        const bounds = beatBounds.visualBounds
        return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }
      }
    }

    // Fallback: return the bar bounds if we couldn't find the exact beat
    const fallback =
      barBounds.lineAlignedBounds ?? barBounds.realBounds ?? barBounds.visualBounds
    if (!fallback) return null
    return { x: fallback.x, y: fallback.y, w: fallback.w, h: fallback.h }
  }

  /**
   * Destroy the alphaTab instance and clean up event subscriptions.
   */
  destroy(): void {
    if (this.offRenderFinished) {
      this.offRenderFinished()
      this.offRenderFinished = null
    }
    if (this.offBeatMouseDown) {
      this.offBeatMouseDown()
      this.offBeatMouseDown = null
    }
    if (this.api) {
      this.api.destroy()
      this.api = null
    }
  }
}
