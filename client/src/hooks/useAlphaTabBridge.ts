/**
 * useAlphaTabBridge — React hook managing AlphaTabBridge lifecycle.
 *
 * Uses a callback ref so initialization happens the moment the container
 * DOM node is attached — even if it mounts later than the hook itself
 * (e.g. when the parent shows a loading skeleton first). Exposes
 * `setContainer` as the ref to attach to the container element, along
 * with a plain `containerRef` for synchronous DOM reads.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { AlphaTabBridge } from '../render/alphaTabBridge'
import type { HitPosition } from '../render/alphaTabBridge'
import type { ScoreNode } from '../editor/ast/types'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface UseAlphaTabBridgeOptions {
  onBeatClick: (hit: HitPosition) => void
  onReady: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAlphaTabBridge({
  onBeatClick,
  onReady,
}: UseAlphaTabBridgeOptions) {
  const bridgeRef = useRef<AlphaTabBridge | null>(null)

  // Container tracked as state so the init effect re-runs when it mounts.
  // Also mirrored into a ref for synchronous reads (scrollWidth, etc.).
  const [container, setContainerState] = useState<HTMLElement | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  // Exposed so callers can include it in rendering effect deps to handle the
  // race where the AST is set before the bridge is initialized.
  const [isBridgeReady, setIsBridgeReady] = useState(false)

  const setContainer = useCallback((node: HTMLElement | null) => {
    containerRef.current = node
    setContainerState(node)
  }, [])

  // Keep callback refs so the bridge closures don't go stale
  const onBeatClickRef = useRef(onBeatClick)
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onBeatClickRef.current = onBeatClick
  }, [onBeatClick])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  // -------------------------------------------------------------------------
  // Initialize bridge whenever the container element becomes available.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!container) return

    const bridge = new AlphaTabBridge()

    bridge.onReady = () => {
      onReadyRef.current()
    }

    bridge.onBeatMouseDown = (pos: HitPosition) => {
      onBeatClickRef.current(pos)
    }

    bridge.init(container)
    bridgeRef.current = bridge
    // Set ready immediately after init so the rendering effect can call renderAst.
    // onReady fires only after the first renderFinished — if we waited for it, the
    // rendering effect (gated on isBridgeReady) would never fire api.tex() and
    // onReady would never fire: circular deadlock.
    setIsBridgeReady(true)

    return () => {
      bridge.destroy()
      bridgeRef.current = null
      setIsBridgeReady(false)
    }
  }, [container])

  // -------------------------------------------------------------------------
  // renderAst — call bridge.renderAst(ast) when ast changes
  // -------------------------------------------------------------------------
  const renderAst = useCallback((ast: ScoreNode) => {
    bridgeRef.current?.renderAst(ast)
  }, [])

  const renderActiveTrack = useCallback((trackIndex: number) => {
    bridgeRef.current?.renderTracks([trackIndex])
  }, [])

  return { bridgeRef, renderAst, renderActiveTrack, setContainer, containerRef, isBridgeReady }
}
