# Plan: Toolbar Notation Phase 1
## Tab Editor — Notation Glyphs + Full Tool Palette (Phase 1)

**Branch:** `feature/toolbar-notation`
**Worktree:** `.worktrees/toolbar-notation`

### Context

The tab editor (`client/src/spaces/pack/TabEditorToolbar.tsx`) currently has:
- Duration group with text labels ("W", "H", "Q", "E", "S", "T") — needs proper notation glyphs
- Dynamics panel with TODO stub (`SetDynamics` command missing)
- Techniques panel with text labels (H/P, vib, nh, etc.)
- Articulations only partially covered (accent only, inside techniques panel)
- No fermata, staccato, marcato, crescendo/decrescendo commands

This plan adds the missing commands, a glyph system, and restructures the toolbar into tab groups.

### Architecture decisions

- **Glyph system**: No external font package. Duration icons = inline SVG; dynamics = styled italic serif text (standard in real notation: pp, mf, ff ARE text); articulations = Unicode chars (♭ ♯ ♮ widely supported) or simple SVG.
- **Toolbar layout**: Two rows — Row 1 = always-visible duration strip, Row 2 = tab-based groups (NOTES / EXPR / TECH / BAR).
- **Interaction model**: All tools use "Apply to selection" — select note/beat first, then click tool. Duration buttons also update `currentDuration` for next entry.
- **AST fields already exist**: `beat.dynamics`, `beat.fermata`, `beat.staccato`, `beat.crescendo`, `beat.decrescendo` — just the commands are missing.

---

## Task 1 — Beat-level notation commands

**File:** `client/src/editor/commands/beatCommands.ts`
**Also:** `client/src/editor/commands/index.ts`

Add these command classes to `beatCommands.ts` (alongside existing SetDuration, SetRest etc.):

### `SetDynamics`
```ts
export class SetDynamics implements Command {
  readonly type = 'SetDynamics'
  readonly label = 'Set dynamics'
  constructor(
    private readonly loc: BeatLocation,
    private readonly dynamics: DynamicsValue | undefined,
    private readonly oldDynamics: DynamicsValue | undefined,
  ) {}
  execute(ctx): CommandResult {
    return { score: updateBeat(ctx, ...fn(b => ({...b, dynamics: this.dynamics}))), affectedBarIds: [loc.barId] }
  }
  invert() { return new SetDynamics(loc, oldDynamics, dynamics) }
  ...
}
```

### `SetFermata`
Toggle fermata on/off on a beat.
- `fermata: { type: 'medium'; length: 0 } | undefined`
- `oldFermata` for invert

### `SetStaccato`
Toggle `staccato: boolean` on a beat.
- `staccato: boolean`, `oldStaccato: boolean`

### `SetCrescendo`
Toggle `crescendo: boolean` on a beat. Mutually exclusive with decrescendo (if enabling crescendo, clear decrescendo).
- `crescendo: boolean`, `oldCrescendo: boolean`, also clears `decrescendo`

### `SetDecrescendo`
Toggle `decrescendo: boolean`. Mutually exclusive with crescendo.

### Exports
Add all 5 new command classes to `commands/index.ts` exports from `beatCommands`.

### Typecheck
Run `pnpm --filter @lava/client typecheck` — must pass with 0 errors.

### Commit
`git -C .worktrees/toolbar-notation commit -m "feat(editor): add SetDynamics, SetFermata, SetStaccato, SetCrescendo, SetDecrescendo commands"`

---

## Task 2 — Notation glyph components

**New file:** `client/src/components/editor/NotationGlyphs.tsx`

Create a set of small, self-contained React components that render music notation symbols using inline SVG or Unicode. No external fonts, no packages.

### `NoteGlyph` — SVG note duration icons

Renders a music note appropriate for each duration value. Used in duration buttons.

```tsx
// Example rendering spec:
// value=1 (whole):   open oval notehead, no stem
// value=2 (half):    open oval notehead + stem
// value=4 (quarter): filled oval notehead + stem
// value=8 (eighth):  filled notehead + stem + 1 flag
// value=16 (16th):   filled notehead + stem + 2 flags
// value=32 (32nd):   filled notehead + stem + 3 flags

export function NoteGlyph({ value, size = 20, className }: {
  value: 1 | 2 | 4 | 8 | 16 | 32 | 64
  size?: number
  className?: string
})
```

SVG viewBox: `0 0 14 24` for all. Keep it minimal — the notehead oval, a vertical stem line, and flag curves for 8th/16th/32nd.

Also export:
- `RestGlyph` — rest symbols (whole rest = filled rectangle on line, half = rectangle below, quarter = zigzag, eighth = flag)
- `DotGlyph` — small filled circle for augmentation dot
- `TripletGlyph` — the digit "3" in small text

### `DynGlyph` — Dynamics text symbols

Dynamics (pp, mf, ff, etc.) are rendered as italic text in music — don't use SVG.

```tsx
export function DynGlyph({ value, active, size = 'sm' }: {
  value: DynamicsValue  // 'ppp'|'pp'|'p'|'mp'|'mf'|'f'|'ff'|'fff'
  active?: boolean
  size?: 'sm' | 'md'
})
// Renders: <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{value}</span>
// Active = text-text-primary, inactive = text-text-secondary
```

Also:
- `CrescendoGlyph` — renders a hairpin open-right SVG (<)
- `DecrescendoGlyph` — renders a hairpin open-left SVG (>)

### `ArticGlyph` — Articulation symbols

```tsx
export const ARTIC_GLYPHS = {
  staccato: '•',    // U+2022 bullet, small above note
  accent: '>',      // standard > symbol
  marcato: '^',     // caret
  tenuto: '—',      // em dash
  fermata: '𝄐',     // U+1D110 Musical Symbol Fermata (try first; fallback to SVG circle+dot)
} as const

export function ArticGlyph({ type, size = 16, className }: {
  type: keyof typeof ARTIC_GLYPHS
  size?: number
  className?: string
})
```

### Exports

Export everything from `client/src/components/editor/NotationGlyphs.tsx` as named exports.

### Typecheck
Run `pnpm --filter @lava/client typecheck` — must pass.

### Commit
`git -C .worktrees/toolbar-notation commit -m "feat(editor): add NotationGlyphs component (NoteGlyph, RestGlyph, DynGlyph, ArticGlyph)"`

---

## Task 3 — Toolbar restructuring + full wiring

**File:** `client/src/spaces/pack/TabEditorToolbar.tsx`

Restructure the toolbar render to:
1. Replace all text labels with glyph components
2. Wire dynamics using `SetDynamics`
3. Add articulations section (staccato, fermata, marcato, accent/tenuto)
4. Add crescendo/decrescendo
5. Reorganize into inline tab groups

### Layout spec

```
┌──────────────────────────────────────────────────── toolbar ─┐
│ Row 1 (always visible, floating pill):                        │
│  [⏮] [▶] [⏹]  │  [♩W][♩H][♩Q][♩E][♩S][♩T]  [.][3]  │ [r]  │
│                                                               │
│ Row 2 (tab-based, above Row 1):                               │
│  Tab: [NOTES] [EXPR] [TECH] [BAR]                             │
│  ┌─── NOTES tab ───────────────────────────────────────────┐  │
│  │  Accidentals: [♭] [♮] [♯]                               │  │
│  │  (future: more note modifiers)                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─── EXPR tab ────────────────────────────────────────────┐  │
│  │  Dynamics: [ppp][pp][p][mp][mf][f][ff][fff]             │  │
│  │  Hairpins:  [<cresc>] [>decresc]                        │  │
│  │  Articulations: [•stac] [>acc] [^marc] [—ten] [𝄐ferm]   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─── TECH tab ────────────────────────────────────────────┐  │
│  │  H/P  /sl  \sd  vib  nh  X  g  tap  pm  lr             │  │
│  │  Pick stroke: [↑] [↓]                                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─── BAR tab ─────────────────────────────────────────────┐  │
│  │  [+ before] [+ after] [- bar]  │  [Time sig] [Tempo]   │  │
│  │  [Track settings] [Export]                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Implementation notes

- The existing `FloatingPanel` system stays for BAR and TECH sub-panels (they're already working)
- Row 2 tab content renders inline (not as floating panel) — appears above Row 1
- Default active tab: EXPR (since dynamics/articulations are most commonly needed)
- Tab state: `const [activeTab, setActiveTab] = useState<'notes'|'expr'|'tech'|'bar'>('expr')`
- Duration buttons in Row 1 use `<NoteGlyph value={...} size={16} />` instead of text
- Dynamics buttons use `<DynGlyph value={...} active={...} />`
- Articulation buttons use `<ArticGlyph type={...} />`

### Dynamics wiring

Replace the existing TODO:
```tsx
// BEFORE:
onClick={() => { console.warn('[TabEditorToolbar] SetDynamics not yet implemented') }}

// AFTER:
onClick={() => {
  if (!beatLoc || !ids) return
  const next = ids.beat.dynamics === d ? undefined : d
  applyCommand(new SetDynamics(beatLoc, next, ids.beat.dynamics))
}}
```

### Articulations wiring

Map each articulation to its command:
- **staccato**: `SetStaccato(beatLoc, !beat.staccato, beat.staccato)`
- **accent**: already `SetAccent` (type='normal') — reuse
- **marcato**: `SetAccent` (type='heavy') — reuse  
- **tenuto**: `SetAccent` (type='tenuto') — reuse
- **fermata**: `SetFermata(beatLoc, beat.fermata ? undefined : {type:'medium', length:0}, beat.fermata)`

### Crescendo/decrescendo wiring

```tsx
// crescendo button
active={ids?.beat?.crescendo === true}
onClick={() => {
  if (!beatLoc || !ids) return
  applyCommand(new SetCrescendo(beatLoc, !ids.beat.crescendo, ids.beat.crescendo))
}}
```

### Imports to add

```tsx
import {
  SetDynamics, SetFermata, SetStaccato, SetCrescendo, SetDecrescendo,
} from '@/editor/commands'
import {
  NoteGlyph, RestGlyph, DotGlyph, DynGlyph, ArticGlyph, CrescendoGlyph, DecrescendoGlyph,
} from '@/components/editor/NotationGlyphs'
```

### Typecheck
Run `pnpm --filter @lava/client typecheck` — must pass with 0 errors.

### Commit
`git -C .worktrees/toolbar-notation commit -m "feat(editor): restructure toolbar with notation glyphs, wire dynamics/articulations"`
