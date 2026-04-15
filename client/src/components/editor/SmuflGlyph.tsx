import { cn } from '@/components/ui/utils'

// ---------------------------------------------------------------------------
// SmuflGlyph — renders a styled text glyph (for dynamics, techniques, etc.)
// NOTE: Bravura font does NOT work for CSS rendering — only use this for
//       text-based glyphs where we can use the system font instead.
// ---------------------------------------------------------------------------

interface SmuflGlyphProps {
  /** Text content to render */
  glyph: string
  className?: string
}

export function SmuflGlyph({ glyph, className }: SmuflGlyphProps) {
  return (
    <span className={cn('text-sm font-medium leading-none', className)}>
      {glyph}
    </span>
  )
}
