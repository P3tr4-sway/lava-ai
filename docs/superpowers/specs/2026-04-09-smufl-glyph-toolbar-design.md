# SMuFL Glyph Integration for Toolbar & PropertyPanel

**Date:** 2026-04-09
**Status:** Draft

## Problem

All toolbar and property panel buttons in the tab editor use plain text labels (`W`, `H`, `Q`, `ppp`, `vib`, `H/P`). These abbreviations are not immediately recognizable as music notation. The Bravura font is installed and loaded via CSS but the `.lava-smufl` class is never used.

## Goal

Replace all text labels with standard SMuFL music notation glyphs rendered via the already-installed Bravura font. Techniques without standard SMuFL code points fall back to italic text.

## Scope

- `client/src/spaces/pack/TabEditorToolbar.tsx` — all button labels
- `client/src/components/editor/PropertyPanel.tsx` — all button labels
- New files: `smuflGlyphs.ts`, `SmuflGlyph.tsx`
- CSS additions in `tokens.css`

Not in scope: alphaTab score rendering (already uses Bravura), any behavior/logic changes.

## Approach

CSS font + Unicode code points. Each glyph is rendered as a `<span>` with the `.lava-smufl` class using Bravura at a specific `font-size`. Duration buttons that need stem+flag use a composed `<NoteGlyph>` component with CSS layout for vertical stacking.

## Files

### 1. `client/src/components/editor/smuflGlyphs.ts`

SMuFL code point constants and helpers:

```ts
export const GLYPH = {
  // Note heads
  noteWhole:   '\uE0A2',
  noteHalf:    '\uE0A3',
  noteQuarter: '\uE0A4',

  // Flags (upward)
  flag8th:     '\uE240',
  flag16th:    '\uE242',
  flag32nd:    '\uE244',

  // Stem
  stem:        '\uE210',

  // Augmentation dot
  augDot:      '\uE030',

  // Rests
  restWhole:   '\uE4E0',
  restHalf:    '\uE4E1',
  restQuarter: '\uE4E2',
  rest8th:     '\uE4E3',
  rest16th:    '\uE4E4',
  rest32nd:    '\uE4E5',

  // Dynamics letters (compose multi-char)
  dynamicP: '\uE520',
  dynamicM: '\uE521',
  dynamicF: '\uE522',

  // Articulations
  articAccent:  '\uE4A3',
  articMarcato: '\uE4A7',
  articTenuto:  '\uE4A6',

  // Techniques
  vibrato:    '\uE560',
  harmonic:   '\uE0BF',
  deadNote:   '\uE0A9',
  ghostNote:  '\uE0A6',

  // Pick stroke
  pickUp:   '\uE250',
  pickDown: '\uE251',

  // Triplet
  tuplet3: '\uE880',
} as const
```

Helper to compose dynamic markings:

```ts
export function dynamicGlyph(value: DynamicsValue): string {
  return value.split('').map(c =>
    c === 'p' ? GLYPH.dynamicP : c === 'm' ? GLYPH.dynamicM : GLYPH.dynamicF
  ).join('')
}
```

### 2. `client/src/components/editor/SmuflGlyph.tsx`

**`<SmuflGlyph>`** — renders a single glyph or composed string:

```tsx
interface SmuflGlyphProps {
  glyph: string
  className?: string
}
export function SmuflGlyph({ glyph, className }: SmuflGlyphProps)
```

**`<NoteGlyph>`** — composes note head + CSS stem + optional flag:

```tsx
interface NoteGlyphProps {
  duration: Duration   // 1=whole, 2=half, 4=quarter, 8=eighth, 16=16th, 32=32nd
  dots?: number
}
export function NoteGlyph({ duration, dots }: NoteGlyphProps)
```

Layout:
- Whole/half: single glyph span
- Quarter+: note head + `border-left` CSS stem (1.5px wide, 16px tall)
- 8th/16th/32nd: note head + stem + flag glyph positioned absolute at top

### 3. CSS additions in `client/src/styles/tokens.css`

Extend existing `.lava-smufl`:

```css
.lava-smufl-sm  { font-size: 14px; }
.lava-smufl-md  { font-size: 18px; }
.lava-smufl-lg  { font-size: 22px; }

.note-glyph { display: inline-flex; flex-direction: column; align-items: flex-start; position: relative; }
.note-glyph__stem { width: 1.5px; background: currentColor; margin-left: -1px; height: 16px; }
.note-glyph__flag { position: absolute; top: -4px; left: -2px; }

.glyph-text-fallback { font-style: italic; font-size: 12px; letter-spacing: 0.02em; }
```

## Button Mapping

### Duration (main pill)

| Current | Glyph | Component |
|---|---|---|
| `W` | `GLYPH.noteWhole` | `SmuflGlyph` |
| `H` | `GLYPH.noteHalf` | `SmuflGlyph` |
| `Q` | quarter head + stem | `NoteGlyph({4})` |
| `E` | quarter head + stem + 1 flag | `NoteGlyph({8})` |
| `S` | quarter head + stem + 2 flags | `NoteGlyph({16})` |
| `T` | quarter head + stem + 3 flags | `NoteGlyph({32})` |
| `.` | `GLYPH.augDot` | `SmuflGlyph` |
| `3` | `GLYPH.tuplet3` | `SmuflGlyph` |

### Rest (floating panel)

| Current | Glyph |
|---|---|
| `rest` | `GLYPH.restQuarter` |

### Dynamics (floating panel)

| Current | Glyph |
|---|---|
| `ppp` | `dynamicGlyph('ppp')` |
| `pp` | `dynamicGlyph('pp')` |
| `p` | `GLYPH.dynamicP` |
| `mp` | `dynamicGlyph('mp')` |
| `mf` | `dynamicGlyph('mf')` |
| `f` | `GLYPH.dynamicF` |
| `ff` | `dynamicGlyph('ff')` |
| `fff` | `dynamicGlyph('fff')` |

### Techniques (floating panel)

| Current | Glyph | Type |
|---|---|---|
| `vib` | `GLYPH.vibrato` | SMuFL |
| `nh` | `GLYPH.harmonic` | SMuFL |
| `X` | `GLYPH.deadNote` | SMuFL |
| `g` | `GLYPH.ghostNote` | SMuFL |
| `ac` | `GLYPH.articAccent` | SMuFL |
| `hac` | `GLYPH.articMarcato` | SMuFL |
| `ten` | `GLYPH.articTenuto` | SMuFL |
| `H/P` | italic `H/P` | text fallback |
| `p-o` | italic `p-o` | text fallback |
| `/sl` | italic `/sl` | text fallback |
| `\sd` | italic `\sd` | text fallback |
| `tap` | italic `tap` | text fallback |
| `pm` | italic `pm` | text fallback |
| `lr` | italic `lr` | text fallback |

### Pick stroke (floating panel)

| Current | Glyph |
|---|---|
| `↑` | `GLYPH.pickUp` |
| `↓` | `GLYPH.pickDown` |

### PropertyPanel

Identical mapping applied to every `PillButton`. Text fallback techniques get a `glyph-text-fallback` class.

## Sizing

| Element | CSS class | font-size |
|---|---|---|
| Dynamics, articulations, small glyphs | `lava-smufl-sm` | 14px |
| Note heads, rest glyphs | `lava-smufl-md` | 18px |
| Duration note heads in main pill | `lava-smufl-lg` | 22px |

Sizing may need adjustment after visual testing.
