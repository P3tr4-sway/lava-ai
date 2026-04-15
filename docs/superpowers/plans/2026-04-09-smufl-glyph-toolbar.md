# SMuFL Glyph Toolbar Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all text labels in TabEditorToolbar and PropertyPanel with standard SMuFL music notation glyphs using the already-installed Bravura font.

**Architecture:** A constants file maps SMuFL code points. A `SmuflGlyph` component renders single glyphs; a `NoteGlyph` component composes note head + CSS stem + flags for duration buttons. Toolbar and PropertyPanel buttons swap their text children for these components.

**Tech Stack:** React, TypeScript, Bravura font (already loaded via `@font-face` in `tokens.css`), existing `.lava-smufl` CSS class.

**Spec:** `docs/superpowers/specs/2026-04-09-smufl-glyph-toolbar-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `client/src/components/editor/smuflGlyphs.ts` | SMuFL code point constants + `dynamicGlyph()` helper |
| Create | `client/src/components/editor/SmuflGlyph.tsx` | `<SmuflGlyph>` and `<NoteGlyph>` React components |
| Modify | `client/src/styles/tokens.css` (lines 69-74) | Add sizing classes + note-glyph layout + text fallback |
| Modify | `client/src/spaces/pack/TabEditorToolbar.tsx` | Replace text labels with SMuFL glyphs in all buttons |
| Modify | `client/src/components/editor/PropertyPanel.tsx` | Replace text labels with SMuFL glyphs in all buttons |

---

### Task 1: Create SMuFL code point constants

**Files:**
- Create: `client/src/components/editor/smuflGlyphs.ts`

- [ ] **Step 1: Create the constants file**

```ts
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

  // Augmentation dot
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editor/smuflGlyphs.ts
git commit -m "[smufl] add SMuFL code point constants and dynamicGlyph helper"
```

---

### Task 2: Add CSS sizing and layout classes

**Files:**
- Modify: `client/src/styles/tokens.css` (after line 74)

- [ ] **Step 1: Add sizing and layout classes after the existing `.lava-smufl` block**

After the existing `.lava-smufl { ... }` block (line 69-74), append:

```css

/* SMuFL glyph sizing */
.lava-smufl-sm  { font-size: 14px; }
.lava-smufl-md  { font-size: 18px; }
.lava-smufl-lg  { font-size: 22px; }

/* Composed note glyph (note head + stem + flags) */
.note-glyph {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  line-height: 1;
}
.note-glyph__stem {
  width: 1.5px;
  background: currentColor;
  margin-left: -1px;
  height: 16px;
}
.note-glyph__flag {
  position: absolute;
  top: -4px;
  left: -2px;
}

/* Text fallback for techniques without SMuFL glyphs */
.glyph-text-fallback {
  font-style: italic;
  font-size: 12px;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/styles/tokens.css
git commit -m "[smufl] add sizing, note-glyph layout, and text-fallback CSS classes"
```

---

### Task 3: Create SmuflGlyph and NoteGlyph components

**Files:**
- Create: `client/src/components/editor/SmuflGlyph.tsx`

- [ ] **Step 1: Create the component file**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editor/SmuflGlyph.tsx
git commit -m "[smufl] add SmuflGlyph and NoteGlyph components"
```

---

### Task 4: Update TabEditorToolbar — duration buttons

**Files:**
- Modify: `client/src/spaces/pack/TabEditorToolbar.tsx`

- [ ] **Step 1: Add imports at the top of the file**

After the existing imports (around line 50), add:

```ts
import { GLYPH, dynamicGlyph } from '@/components/editor/smuflGlyphs'
import { SmuflGlyph, NoteGlyph } from '@/components/editor/SmuflGlyph'
```

- [ ] **Step 2: Remove `label` from DURATION_OPTIONS (line 75-82)**

The `label` field is no longer needed — glyph rendering derives from the `value` field. Replace:

```ts
const DURATION_OPTIONS: Array<{ value: Duration; label: string; shortcut: string }> = [
  { value: 1, label: 'W', shortcut: 'Whole' },
  { value: 2, label: 'H', shortcut: 'Half' },
  { value: 4, label: 'Q', shortcut: 'Quarter' },
  { value: 8, label: 'E', shortcut: 'Eighth' },
  { value: 16, label: 'S', shortcut: '16th' },
  { value: 32, label: 'T', shortcut: '32nd' },
]
```

With:

```ts
const DURATION_OPTIONS: Array<{ value: Duration; shortcut: string }> = [
  { value: 1, shortcut: 'Whole' },
  { value: 2, shortcut: 'Half' },
  { value: 4, shortcut: 'Quarter' },
  { value: 8, shortcut: 'Eighth' },
  { value: 16, shortcut: '16th' },
  { value: 32, shortcut: '32nd' },
]
```

- [ ] **Step 3: Update main pill duration buttons (around line 850-859)**

Replace the duration group inside the main pill:

```tsx
{DURATION_OPTIONS.map(({ value, shortcut }) => (
  <ToolbarBtn
    key={value}
    active={currentDuration.value === value}
    onClick={() => applyDuration(value)}
    title={shortcut}
  >
    <NoteGlyph duration={value} />
  </ToolbarBtn>
))}
```

- [ ] **Step 4: Update main pill dot and triplet buttons (around line 860-873)**

Replace:

```tsx
<ToolbarBtn
  active={currentDuration.dots > 0}
  onClick={toggleDot}
  title="Dot"
>
  .
</ToolbarBtn>
<ToolbarBtn
  active={ids?.beat?.duration?.tuplet?.numerator === 3}
  onClick={toggleTriplet}
  title="Triplet"
>
  3
</ToolbarBtn>
```

With:

```tsx
<ToolbarBtn
  active={currentDuration.dots > 0}
  onClick={toggleDot}
  title="Dot"
>
  <SmuflGlyph glyph={GLYPH.augDot} size="md" />
</ToolbarBtn>
<ToolbarBtn
  active={ids?.beat?.duration?.tuplet?.numerator === 3}
  onClick={toggleTriplet}
  title="Triplet"
>
  <SmuflGlyph glyph={GLYPH.tuplet3} size="sm" />
</ToolbarBtn>
```

- [ ] **Step 5: Update floating duration panel buttons (around line 557-566)**

Same change as the main pill — replace `{label}` with `<NoteGlyph>`:

```tsx
{DURATION_OPTIONS.map(({ value, shortcut }) => (
  <ToolbarBtn
    key={value}
    active={currentDuration.value === value}
    onClick={() => { applyDuration(value); setOpenPanel(null) }}
    title={shortcut}
  >
    <NoteGlyph duration={value} />
  </ToolbarBtn>
))}
```

- [ ] **Step 6: Update floating panel dot, triplet, and rest buttons (around line 567-595)**

Replace:

```tsx
<ToolbarBtn
  active={currentDuration.dots > 0}
  onClick={toggleDot}
  title={`Dotted (${currentDuration.dots} dot${currentDuration.dots !== 1 ? 's' : ''})`}
>
  .
</ToolbarBtn>
<ToolbarBtn
  active={ids?.beat?.duration?.tuplet?.numerator === 3}
  onClick={toggleTriplet}
  title="Triplet"
>
  3
</ToolbarBtn>
```

With:

```tsx
<ToolbarBtn
  active={currentDuration.dots > 0}
  onClick={toggleDot}
  title={`Dotted (${currentDuration.dots} dot${currentDuration.dots !== 1 ? 's' : ''})`}
>
  <SmuflGlyph glyph={GLYPH.augDot} size="md" />
</ToolbarBtn>
<ToolbarBtn
  active={ids?.beat?.duration?.tuplet?.numerator === 3}
  onClick={toggleTriplet}
  title="Triplet"
>
  <SmuflGlyph glyph={GLYPH.tuplet3} size="sm" />
</ToolbarBtn>
```

Replace the rest button (around line 583-595):

```tsx
<ToolbarBtn
  active={ids?.beat?.rest === true}
  onClick={() => {
    if (beatLoc && ids) {
      applyCommand(new SetRest(beatLoc, !ids.beat.rest, ids.beat.rest ?? false))
    }
  }}
  title="Toggle rest"
>
  <SmuflGlyph glyph={GLYPH.restQuarter} size="md" />
</ToolbarBtn>
```

- [ ] **Step 7: Commit**

```bash
git add client/src/spaces/pack/TabEditorToolbar.tsx
git commit -m "[smufl] replace duration button text with SMuFL note glyphs"
```

---

### Task 5: Update TabEditorToolbar — dynamics and pick stroke

**Files:**
- Modify: `client/src/spaces/pack/TabEditorToolbar.tsx`

- [ ] **Step 1: Update dynamics buttons (around line 638-654)**

Replace the dynamics panel button children. Change:

```tsx
{d}
```

To:

```tsx
<SmuflGlyph glyph={dynamicGlyph(d)} size="sm" />
```

The full mapped block should look like:

```tsx
{DYNAMICS_OPTIONS.map((d) => (
  <ToolbarBtn
    key={d}
    disabled={!beatLoc}
    active={ids?.beat?.dynamics === d}
    onClick={() => {
      if (!beatLoc || !ids) return
      const newValue = ids.beat.dynamics === d ? undefined : d
      applyCommand(new SetDynamics(beatLoc, newValue, ids.beat.dynamics))
      setOpenPanel(null)
    }}
    title={beatLoc ? d : 'Select a beat first'}
  >
    <SmuflGlyph glyph={dynamicGlyph(d)} size="sm" />
  </ToolbarBtn>
))}
```

- [ ] **Step 2: Update pick stroke buttons (around line 659-672)**

Replace:

```tsx
{dir === 'up' ? '↑' : '↓'}
```

With:

```tsx
<SmuflGlyph glyph={dir === 'up' ? GLYPH.pickUp : GLYPH.pickDown} size="sm" />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/TabEditorToolbar.tsx
git commit -m "[smufl] replace dynamics and pick stroke text with SMuFL glyphs"
```

---

### Task 6: Update TabEditorToolbar — technique buttons

**Files:**
- Modify: `client/src/spaces/pack/TabEditorToolbar.tsx`

The `TECHNIQUE_BUTTONS` array (around line 418-523) has a `label` field on each entry. We need to change the rendering to use SMuFL glyphs where available and italic text fallback otherwise.

- [ ] **Step 1: Add a `glyph` field to TECHNIQUE_BUTTONS**

Add a new optional `glyph` field and a `textFallback` boolean to the array type. Replace the type annotation:

```ts
const TECHNIQUE_BUTTONS: Array<{
  label: string
  glyph?: string
  textFallback?: boolean
  title: string
  isActive: () => boolean
  onPress: () => void
}> = [
```

Then add the `glyph` / `textFallback` fields to each entry:

```ts
  { label: 'H/P', textFallback: true, title: 'Hammer-on / Pull-off', ... },
  { label: 'p-o', textFallback: true, title: 'Pull-off', ... },
  { label: '/sl', textFallback: true, title: 'Slide up (legato)', ... },
  { label: '\\sd', textFallback: true, title: 'Slide down', ... },
  { label: 'vib', glyph: GLYPH.vibrato, title: 'Vibrato (slight)', ... },
  { label: 'nh', glyph: GLYPH.harmonic, title: 'Natural harmonic', ... },
  { label: 'X', glyph: GLYPH.deadNote, title: 'Dead note', ... },
  { label: 'g', glyph: GLYPH.ghostNote, title: 'Ghost note', ... },
  { label: 'tap', textFallback: true, title: 'Left-hand tap', ... },
  { label: 'pm', textFallback: true, title: 'Palm mute', ... },
  { label: 'lr', textFallback: true, title: 'Let ring', ... },
```

Only the `label` and new fields are shown — keep all existing `isActive`/`onPress` logic unchanged.

- [ ] **Step 2: Update the technique button rendering (around line 603-611)**

Replace:

```tsx
{TECHNIQUE_BUTTONS.map((btn) => (
  <ToolbarBtn
    key={btn.label}
    active={btn.isActive()}
    onClick={btn.onPress}
    title={btn.title}
  >
    {btn.label}
  </ToolbarBtn>
))}
```

With:

```tsx
{TECHNIQUE_BUTTONS.map((btn) => (
  <ToolbarBtn
    key={btn.label}
    active={btn.isActive()}
    onClick={btn.onPress}
    title={btn.title}
  >
    {btn.glyph ? (
      <SmuflGlyph glyph={btn.glyph} size="sm" />
    ) : (
      <span className="glyph-text-fallback">{btn.label}</span>
    )}
  </ToolbarBtn>
))}
```

- [ ] **Step 3: Update accent buttons (around line 617-629)**

Replace:

```tsx
{(['normal', 'heavy', 'tenuto'] as AccentType[]).map((type) => (
  <ToolbarBtn
    key={type}
    active={ids?.note?.accent === type}
    onClick={() => {
      if (!noteLoc || !ids?.note) return
      applyCommand(new SetAccent(noteLoc, ids.note.accent === type ? undefined : type, ids.note.accent))
    }}
    title={`Accent: ${type}`}
  >
    {type === 'normal' ? 'ac' : type === 'heavy' ? 'hac' : 'ten'}
  </ToolbarBtn>
))}
```

With:

```tsx
{(['normal', 'heavy', 'tenuto'] as const).map((type) => {
  const accentGlyph = type === 'normal' ? GLYPH.articAccent
    : type === 'heavy' ? GLYPH.articMarcato
    : GLYPH.articTenuto
  return (
    <ToolbarBtn
      key={type}
      active={ids?.note?.accent === type}
      onClick={() => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetAccent(noteLoc, ids.note.accent === type ? undefined : type, ids.note.accent))
      }}
      title={`Accent: ${type}`}
    >
      <SmuflGlyph glyph={accentGlyph} size="sm" />
    </ToolbarBtn>
  )
})}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/TabEditorToolbar.tsx
git commit -m "[smufl] replace technique and accent button text with SMuFL glyphs"
```

---

### Task 7: Update PropertyPanel — all buttons

**Files:**
- Modify: `client/src/components/editor/PropertyPanel.tsx`

- [ ] **Step 1: Add imports at the top**

After the existing imports (around line 33), add:

```ts
import { GLYPH, dynamicGlyph } from '@/components/editor/smuflGlyphs'
import { SmuflGlyph, NoteGlyph } from '@/components/editor/SmuflGlyph'
```

- [ ] **Step 2: Update beat duration row (around line 260-275)**

Find the duration row that renders `DURATIONS.map(...)` with `{d.label}` as the button text. Replace each `{d.label}` with:

```tsx
<NoteGlyph duration={d.value} />
```

- [ ] **Step 3: Update dot button (around line 276-280)**

Replace the `.` text with:

```tsx
<SmuflGlyph glyph={GLYPH.augDot} size="md" />
```

- [ ] **Step 4: Update rest button (around line 284-287)**

Replace `rest` text with:

```tsx
<SmuflGlyph glyph={GLYPH.restQuarter} size="md" />
```

- [ ] **Step 5: Update dynamics row (around line 289-301)**

Replace `{d}` with:

```tsx
<SmuflGlyph glyph={dynamicGlyph(d)} size="sm" />
```

- [ ] **Step 6: Update pick stroke row (around line 303-312)**

Replace `{dir === 'up' ? '↑' : '↓'}` with:

```tsx
<SmuflGlyph glyph={dir === 'up' ? GLYPH.pickUp : GLYPH.pickDown} size="sm" />
```

- [ ] **Step 7: Update technique PillButtons in Note section (around line 342-428)**

Replace each text label:

| Current text | Replace with |
|---|---|
| `H/P` | `<span className="glyph-text-fallback">H/P</span>` |
| `{d.label}` (slides) | `<span className="glyph-text-fallback">{d.label}</span>` |
| `vib` | `<SmuflGlyph glyph={GLYPH.vibrato} size="sm" />` |
| `ghost` | `<SmuflGlyph glyph={GLYPH.ghostNote} size="sm" />` |
| `X` | `<SmuflGlyph glyph={GLYPH.deadNote} size="sm" />` |
| `pm` | `<span className="glyph-text-fallback">pm</span>` |
| `lr` | `<span className="glyph-text-fallback">lr</span>` |
| `tie` | `<span className="glyph-text-fallback">tie</span>` |
| `nh` | `<SmuflGlyph glyph={GLYPH.harmonic} size="sm" />` |
| `tap` | `<span className="glyph-text-fallback">tap</span>` |

For accent buttons (around line 401-413), replace:

```tsx
{type === 'normal' ? 'ac' : type === 'heavy' ? 'hac' : 'ten'}
```

With:

```tsx
<SmuflGlyph glyph={type === 'normal' ? GLYPH.articAccent : type === 'heavy' ? GLYPH.articMarcato : GLYPH.articTenuto} size="sm" />
```

- [ ] **Step 8: Commit**

```bash
git add client/src/components/editor/PropertyPanel.tsx
git commit -m "[smufl] replace PropertyPanel text labels with SMuFL glyphs"
```

---

### Task 8: Visual verification and sizing adjustments

**Files:**
- Possibly modify: `client/src/styles/tokens.css` (font-size values)
- Possibly modify: `client/src/components/editor/SmuflGlyph.tsx` (NoteGlyph layout)

- [ ] **Step 1: Run dev server and visually inspect**

```bash
pnpm dev
```

Open the editor at `/editor` and check:

1. Duration buttons in the main pill render note glyphs correctly
2. Duration floating panel renders the same glyphs
3. Dynamics panel shows SMuFL p/m/f letter combinations
4. Technique panel shows vibrato/harmonic/dead/ghost glyphs and italic text for others
5. Accent buttons show articulation marks
6. Pick stroke buttons show SMuFL arrows
7. PropertyPanel mirrors all the same glyphs

- [ ] **Step 2: Adjust sizing if needed**

If any glyphs appear too large/small, update the font-size values in `tokens.css`:
- `.lava-smufl-sm` (14px) — dynamics, articulations, techniques
- `.lava-smufl-md` (18px) — note heads, rests
- `.lava-smufl-lg` (22px) — currently unused, reserved if main pill buttons need larger glyphs

If NoteGlyph stem/flag alignment is off, adjust in `SmuflGlyph.tsx`:
- `.note-glyph__stem` height (16px) and margin-left (-1px)
- `.note-glyph__flag` top (−4px) and left (−2px) offsets

- [ ] **Step 3: Commit any adjustments**

```bash
git add -u
git commit -m "[smufl] fine-tune glyph sizing and note composition layout"
```
