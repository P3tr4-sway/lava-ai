import { cn } from '@/components/ui/utils'
import { GLYPH } from './smuflGlyphs'
import type { Duration } from '@/editor/ast/types'

// ---------------------------------------------------------------------------
// SmuflGlyph — renders a single SMuFL glyph or composed string
// ---------------------------------------------------------------------------

interface SmuflGlyphProps {
  /** A GLYPH.xxx value or composed string (e.g. from dynamicGlyph()) */
  glyph: string
  /** Sizing: 'sm' | 'md' | 'lg'. Defaults to 'sm' */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SmuflGlyph({ glyph, size = 'sm', className }: SmuflGlyphProps) {
  return (
    <span className={cn('lava-smufl', `lava-smufl-${size}`, className)}>
      {glyph}
    </span>
  )
}

// ---------------------------------------------------------------------------
// NoteGlyph — composes note head + CSS stem + optional flags
// ---------------------------------------------------------------------------

interface NoteGlyphProps {
  duration: Duration // 1=whole, 2=half, 4=quarter, 8=eighth, 16=16th, 32=32nd
  className?: string
}

/** Duration value → number of flags needed (0 for whole/half/quarter) */
function flagCount(duration: Duration): number {
  if (duration >= 32) return 3
  if (duration >= 16) return 2
  if (duration >= 8) return 1
  return 0
}

const FLAG_GLYPHS = [GLYPH.flag8th, GLYPH.flag16th, GLYPH.flag32nd]

export function NoteGlyph({ duration, className }: NoteGlyphProps) {
  // Whole and half: just the note head
  if (duration === 1) {
    return <SmuflGlyph glyph={GLYPH.noteWhole} size="md" className={className} />
  }
  if (duration === 2) {
    return <SmuflGlyph glyph={GLYPH.noteHalf} size="md" className={className} />
  }

  // Quarter and shorter: note head + stem + optional flags
  const flags = flagCount(duration)
  return (
    <span className={cn('note-glyph', className)}>
      <span className="lava-smufl lava-smufl-md">{GLYPH.noteQuarter}</span>
      <span className="note-glyph__stem" />
      {flags > 0 && (
        <span className="note-glyph__flag lava-smufl lava-smufl-sm">
          {FLAG_GLYPHS.slice(0, flags).join('')}
        </span>
      )}
    </span>
  )
}
