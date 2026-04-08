/**
 * HoverNotePreview — ghost note/rest glyph that follows the cursor over the score.
 *
 * For tab mode: a semi-transparent circle with "0" at the snapped beat + string position.
 * For staff mode: a Bravura SMuFL notehead glyph at the beat column center.
 *
 * Rendered as an absolutely-positioned, pointer-events-none SVG so it layers
 * over the alphaTab canvas without blocking mouse events.
 */

import type { Duration } from '../../editor/ast/types'
import type { HoverState } from '../../hooks/useTabEditorPlacement'

// ---------------------------------------------------------------------------
// SMuFL glyph map
// ---------------------------------------------------------------------------

const NOTE_GLYPHS: Record<Duration, string> = {
  1:  '\uE1D2', // noteWhole
  2:  '\uE1D3', // noteHalfUp
  4:  '\uE1D5', // noteQuarterUp
  8:  '\uE1D7', // note8thUp
  16: '\uE1D9', // note16thUp
  32: '\uE1DB', // note32ndUp
  64: '\uE1DD', // note64thUp
}

const REST_GLYPHS: Record<Duration, string> = {
  1:  '\uE4E3', // restWhole
  2:  '\uE4E4', // restHalf
  4:  '\uE4E5', // restQuarter
  8:  '\uE4E6', // rest8th
  16: '\uE4E7', // rest16th
  32: '\uE4E8', // rest32nd
  64: '\uE4E9', // rest64th
}

const DOT_GLYPH = '\uE1E7' // augmentationDot

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HoverNotePreviewProps {
  hoverState: HoverState | null
  duration: Duration
  dots: number
  isRest: boolean
  isTabMode: boolean
  /** SVG viewport size — must match OverlayCanvas */
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HoverNotePreview({
  hoverState,
  duration,
  dots,
  isRest,
  isTabMode,
  width,
  height,
}: HoverNotePreviewProps) {
  if (!hoverState) return null

  const { beatCenterX, mouseY } = hoverState

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {isTabMode ? (
        /* Tab mode: circle with fret 0 at the snapped string line */
        <g opacity={0.55} transform={`translate(${beatCenterX}, ${mouseY})`}>
          <circle r={10} fill="var(--surface-0)" stroke="var(--text-primary)" strokeWidth={1.5} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fontFamily="'JetBrains Mono', 'Fira Code', monospace"
            fill="var(--text-primary)"
          >
            0
          </text>
        </g>
      ) : (
        /* Staff mode: Bravura glyph at beat column center */
        <text
          x={beatCenterX}
          y={mouseY}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Bravura, serif"
          fontSize={32}
          fill="var(--text-primary)"
          opacity={0.4}
        >
          {isRest
            ? (REST_GLYPHS[duration] ?? REST_GLYPHS[4])
            : (NOTE_GLYPHS[duration] ?? NOTE_GLYPHS[4])}
          {dots > 0 ? DOT_GLYPH : null}
        </text>
      )}
    </svg>
  )
}
