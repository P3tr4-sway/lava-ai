import type { NoteValue } from '@lava/shared'

/**
 * Builds a CSS cursor url() from an SVG string.
 * Hot-spot at center-bottom (12, 20) so the tip of the note stem aligns with click point.
 */
function svgToCursorUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
  return `url('data:image/svg+xml,${encoded}') 12 20, auto`
}

/** SVG paths for each note duration (24x24 viewBox). */
const NOTE_PATHS: Record<NoteValue, string> = {
  whole: `<ellipse cx="12" cy="14" rx="6" ry="4" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  half: `<ellipse cx="10" cy="18" rx="5" ry="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
         <line x1="15" y1="18" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/>`,
  quarter: `<ellipse cx="10" cy="18" rx="5" ry="3.5" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/>`,
  eighth: `<ellipse cx="10" cy="18" rx="5" ry="3.5" fill="currentColor"/>
           <line x1="15" y1="18" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/>
           <path d="M15 4 Q19 7 16 11" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
  sixteenth: `<ellipse cx="10" cy="18" rx="5" ry="3.5" fill="currentColor"/>
              <line x1="15" y1="18" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/>
              <path d="M15 4 Q19 7 16 11" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <path d="M15 8 Q19 11 16 15" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
}

function buildNoteSvg(duration: NoteValue, color: string): string {
  const inner = NOTE_PATHS[duration].replace(/currentColor/g, color)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${inner}</svg>`
}

/**
 * Returns a CSS `cursor: url(...)` value for the given note duration.
 * Uses a neutral color (#888888) since CSS custom properties can't be used in data URIs.
 */
export function noteCursorUrl(duration: NoteValue, color = '#888888'): string {
  return svgToCursorUrl(buildNoteSvg(duration, color))
}

const REST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M10 6 L14 12 L10 12 L14 18" fill="none" stroke="#888888" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

/** Returns a CSS `cursor: url(...)` value for a rest symbol. */
export function restCursorUrl(): string {
  return svgToCursorUrl(REST_SVG)
}
