/**
 * PlaybackCursor — renders the moving playback cursor over the score.
 *
 * Uses a different color from the edit cursor (warning/amber) so the user
 * can visually distinguish the playback position from their editing caret.
 *
 * Renders nothing when playback is stopped or position is not yet known.
 */

import { usePlaybackStore } from '../../stores/playbackStore'
import { OverlayCanvas } from '../overlay/OverlayCanvas'
import type { AlphaTabBridge } from '../../render/alphaTabBridge'
import { OverlayLayer } from '../../render/overlayLayer'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlaybackCursorProps {
  bridge: AlphaTabBridge | null
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaybackCursor({ bridge, width, height }: PlaybackCursorProps) {
  const position = usePlaybackStore((s) => s.position)
  const state = usePlaybackStore((s) => s.state)

  // Hide cursor when stopped or no position available yet
  if (state === 'stopped' || !position?.beatPosition || !bridge) return null

  const layer = new OverlayLayer(bridge)
  const rect = layer.getCursorRect(position.beatPosition)
  if (!rect) return null

  return (
    <OverlayCanvas
      rects={[{ ...rect, kind: 'cursor' }]}
      width={width}
      height={height}
      isInsertMode={true}
    />
  )
}
