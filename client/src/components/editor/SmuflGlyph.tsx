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

export function NoteGlyph({ duration, className }: NoteGlyphProps) {
  // Whole and half: just the note head
  if (duration === 1) {
    return <SmuflGlyph glyph={GLYPH.noteWhole} size="md" className={className} />
  }
  if (duration === 2) {
    return <SmuflGlyph glyph={GLYPH.noteHalf} size="md" className={className} />
  }

  // Quarter: just the filled note head
  if (duration === 4) {
    return <SmuflGlyph glyph={GLYPH.noteQuarter} size="md" className={className} />
  }

  // 8th/16th/32nd: filled note head + flag glyph side by side
  const flagGlyph =
    duration >= 32 ? GLYPH.flag32nd
    : duration >= 16 ? GLYPH.flag16th
    : GLYPH.flag8th

  return (
    <span className={cn('inline-flex items-center gap-px', className)}>
      <SmuflGlyph glyph={GLYPH.noteQuarter} size="md" />
      <SmuflGlyph glyph={flagGlyph} size="sm" />
    </span>
  )
}
