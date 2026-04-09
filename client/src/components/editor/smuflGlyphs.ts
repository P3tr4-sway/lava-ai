/**
 * SMuFL code point constants for the Bravura font.
 *
 * Used by SmuflGlyph and NoteGlyph components to render
 * standard music notation symbols in toolbar buttons.
 *
 * Reference: https://w3c.github.io/smufl/latest/tables/
 */
import type { DynamicsValue } from '@/editor/ast/types'

export const GLYPH = {
  // Note heads
  noteWhole:   '\uE0A2',
  noteHalf:    '\uE0A3',
  noteQuarter: '\uE0A4',

  // Flags (upward)
  flag8th:     '\uE240',
  flag16th:    '\uE242',
  flag32nd:    '\uE244',

  // Augmentation Dot
  augDot: '\uE030',

  // Rests
  restWhole:   '\uE4E0',
  restHalf:    '\uE4E1',
  restQuarter: '\uE4E2',
  rest8th:     '\uE4E3',
  rest16th:    '\uE4E4',
  rest32nd:    '\uE4E5',

  // Dynamics letters (compose multi-char for pp, mf, etc.)
  dynamicP: '\uE520',
  dynamicM: '\uE521',
  dynamicF: '\uE522',

  // Articulations
  articAccent:  '\uE4A3',
  articMarcato: '\uE4A7',
  articTenuto:  '\uE4A6',

  // Techniques
  vibrato:  '\uE560',
  harmonic: '\uE0BF',  // noteheadDiamondBlack
  deadNote: '\uE0A9',  // noteheadXOrnamental
  ghostNote: '\uE0A6', // noteheadParenthesis

  // Pick stroke
  pickUp:   '\uE250',
  pickDown: '\uE251',

  // Triplet
  tuplet3: '\uE880',
} as const

/** Compose a dynamic marking string from individual SMuFL letters. */
export function dynamicGlyph(value: DynamicsValue): string {
  return value
    .split('')
    .map((c) =>
      c === 'p' ? GLYPH.dynamicP : c === 'm' ? GLYPH.dynamicM : GLYPH.dynamicF,
    )
    .join('')
}
