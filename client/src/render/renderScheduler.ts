/**
 * RenderScheduler — batches rapid AST mutations into a single render call.
 *
 * Uses requestAnimationFrame (or requestIdleCallback when available) to defer
 * renders. Multiple schedule() calls within the same frame collapse into one
 * render with the latest AST snapshot.
 *
 * For undo/redo, renderNow() forces a synchronous render, bypassing rAF.
 */

import type { ScoreNode } from '../editor/ast/types'
import type { AlphaTabBridge } from './alphaTabBridge'
import { diffAst } from './astDiff'

// ---------------------------------------------------------------------------
// RenderScheduler
// ---------------------------------------------------------------------------

export class RenderScheduler {
  private pendingAst: ScoreNode | null = null
  private lastRenderedAst: ScoreNode | null = null
  private rafHandle: number | null = null
  private idleHandle: number | null = null
  private destroyed = false

  // Perf counters
  private _renderCount = 0
  private _totalRenderTimeMs = 0

  constructor(private readonly bridge: AlphaTabBridge) {}

  // ---------------------------------------------------------------------------
  // schedule
  // ---------------------------------------------------------------------------

  /**
   * Schedule a render. If a render is already pending this frame, the new AST
   * replaces the pending one (only the latest snapshot is rendered).
   *
   * Prefers requestIdleCallback when available; falls back to rAF.
   */
  schedule(ast: ScoreNode): void {
    if (this.destroyed) return

    this.pendingAst = ast

    // Already have a pending frame — the existing callback will pick up the
    // latest pendingAst, nothing more to do.
    if (this.rafHandle !== null || this.idleHandle !== null) return

    if (typeof requestIdleCallback !== 'undefined') {
      // Use idle callback with a short deadline so we still render promptly
      this.idleHandle = requestIdleCallback(
        () => {
          this.idleHandle = null
          this.flush()
        },
        { timeout: 50 }, // fallback deadline: 50ms
      )
    } else {
      this.rafHandle = requestAnimationFrame(() => {
        this.rafHandle = null
        this.flush()
      })
    }
  }

  // ---------------------------------------------------------------------------
  // renderNow
  // ---------------------------------------------------------------------------

  /**
   * Force a synchronous render immediately.
   * Used after undo/redo where responsiveness matters more than batching.
   *
   * Cancels any pending scheduled render.
   */
  renderNow(ast: ScoreNode): void {
    if (this.destroyed) return

    // Cancel any pending deferred render
    this.cancelPending()
    this.pendingAst = ast
    this.flush()
  }

  // ---------------------------------------------------------------------------
  // Perf counters
  // ---------------------------------------------------------------------------

  getStats(): { renderCount: number; avgRenderTimeMs: number } {
    return {
      renderCount: this._renderCount,
      avgRenderTimeMs:
        this._renderCount > 0 ? this._totalRenderTimeMs / this._renderCount : 0,
    }
  }

  resetStats(): void {
    this._renderCount = 0
    this._totalRenderTimeMs = 0
  }

  // ---------------------------------------------------------------------------
  // Destroy
  // ---------------------------------------------------------------------------

  destroy(): void {
    this.destroyed = true
    this.cancelPending()
    this.pendingAst = null
    this.lastRenderedAst = null
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private flush(): void {
    const ast = this.pendingAst
    this.pendingAst = null

    if (!ast) return

    const t0 = performance.now()

    if (this.lastRenderedAst === null) {
      // First render — always full
      this.bridge.renderAst(ast)
    } else {
      const diff = diffAst(this.lastRenderedAst, ast)
      if (diff.requiresFullRender || diff.changedBarIds.length === 0) {
        // Full render or no-op
        if (diff.changedBarIds.length > 0 || diff.metaChanged || diff.tracksChanged) {
          this.bridge.renderAst(ast)
        }
        // If nothing changed at all, skip render entirely
      } else {
        // Partial render attempt
        this.bridge.renderDirtyBars(ast, diff.changedBarIds)
      }
    }

    const elapsed = performance.now() - t0
    this._renderCount++
    this._totalRenderTimeMs += elapsed

    this.lastRenderedAst = ast
  }

  private cancelPending(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }
    if (this.idleHandle !== null) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(this.idleHandle)
      }
      this.idleHandle = null
    }
  }
}
