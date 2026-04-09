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
// NoteGlyph — single glyph per duration (no composition)
// ---------------------------------------------------------------------------

interface NoteGlyphProps {
  duration: Duration // 1=whole, 2=half, 4=quarter, 8=eighth, 16=16th, 32=32nd
  className?: string
}

/** Map duration → single SMuFL glyph character */
const DURATION_GLYPH: Record<number, string> = {
  1:  GLYPH.noteWhole,   // open oval
  2:  GLYPH.noteHalf,    // open oval
  4:  GLYPH.noteQuarter, // filled oval
  8:  GLYPH.flag8th,     // stem + single flag
  16: GLYPH.flag16th,    // stem + double flags
  32: GLYPH.flag32nd,    // stem + triple flags
}

export function NoteGlyph({ duration, className }: NoteGlyphProps) {
  return (
    <SmuflGlyph
      glyph={DURATION_GLYPH[duration] ?? GLYPH.noteQuarter}
      size="md"
      className={className}
    />
  )
}
