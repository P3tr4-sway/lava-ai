# Guitar Tab Editing Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining bugs in the guitar tab note-writing, hover precision, and editing UX flow.

**Architecture:** Six targeted fixes applied directly to existing files. No new files needed. Each task is independent and can be done in any order. All changes are in `client/src/`.

**Tech Stack:** React 18, TypeScript, Zustand, custom SVG canvas (`EditSurface`), alphaTab (`TabCanvas`)

---

## File Map

| File | Responsibility | Tasks |
|------|---------------|-------|
| `client/src/spaces/pack/TabCanvas.tsx:190` | alphaTab beat clamping | Task 1 |
| `client/src/spaces/pack/editor-core/commands.ts:31,44` | Caret step movement precision | Task 2 |
| `client/src/lib/scoreDocument.ts:665,953` | insertNoteAtCaret bounds + deleteMeasureRange guard | Task 3 |
| `client/src/spaces/pack/EditSurface.tsx:680-684` | Caret anchor matching tolerance + fallback | Task 4 |
| `client/src/spaces/pack/EditSurface.tsx` | Hardcoded colors → design tokens | Task 5 |
| `client/src/spaces/pack/EditorToolbar.tsx` | Hardcoded colors → design tokens | Task 5 |
| `client/src/spaces/pack/EditorTitleBar.tsx:59` | Hardcoded colors → design tokens | Task 5 |
| `client/src/spaces/pack/EditorChatPanel.tsx` | Hardcoded colors → design tokens | Task 5 |

---

### Task 1: Fix beat clamp so last beat position is reachable in TabCanvas

The alphaTab canvas clamps beat positions to `beatsPerBar - 0.25`, which prevents the last quarter-note beat from being clickable when the pointer is near the right edge. In 4/4 time the max ratio `0.999` maps to beat `3.996`, which rounds to `4.0`, then gets clamped to `3.75` — the user can never hit beat 3.0 via the far-right area of the measure.

**Files:**
- Modify: `client/src/spaces/pack/TabCanvas.tsx:189-197`

- [ ] **Step 1: Fix `beatToQuarterGrid` clamp upper bound**

Change the clamp upper bound from `beatsPerBar - 0.25` to `beatsPerBar - 0.25` but also clamp the _ratio_ to `< 1.0` properly so the maximum rounded beat is `beatsPerBar - 0.25` (last sixteenth) when clicking at the absolute edge, and beat `beatsPerBar - 1` (last quarter) is reachable in the interior:

```typescript
function beatToQuarterGrid(value: number, beatsPerBar: number) {
  return clamp(Math.round(value * 4) / 4, 0, Math.max(0, beatsPerBar - 0.25))
}

function resolveBeatFromPointer(api: AlphaTabApi, measureIndex: number, pointerX: number, beatsPerBar: number) {
  const bounds = resolveTabStaffBounds(api, measureIndex)
  if (!bounds) return 0
  const ratio = clamp((pointerX - bounds.x) / Math.max(bounds.w, 1), 0, 1)
  return beatToQuarterGrid(ratio * beatsPerBar, beatsPerBar)
}
```

The key change: `0.999` → `1` in the ratio clamp. The `beatToQuarterGrid` clamp to `beatsPerBar - 0.25` already prevents overflow to the next measure, so the ratio doesn't need artificial limiting.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS — no type errors introduced.

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/TabCanvas.tsx
git commit -m "fix(editor): allow ratio=1 in TabCanvas beat resolution so all beat positions are reachable"
```

---

### Task 2: Fix caret step precision loss from `.toFixed(2)`

`moveCaretByStep` uses `.toFixed(2)` which converts to string and back, accumulating floating-point drift over repeated arrow-key presses. After ~8 presses the beat value no longer matches any anchor exactly.

**Files:**
- Modify: `client/src/spaces/pack/editor-core/commands.ts:31,35,44`

- [ ] **Step 1: Replace `.toFixed(2)` with rounding to nearest 1/16**

```typescript
export function moveCaretByStep(
  caret: EditorCaret,
  direction: 'left' | 'right' | 'up' | 'down',
  measureCount: number,
  beatsPerMeasure: number,
  step = 0.25,
): EditorCaret {
  if (direction === 'up' || direction === 'down') {
    return {
      ...caret,
      string: Math.max(1, Math.min(6, caret.string + (direction === 'up' ? -1 : 1))),
    }
  }

  let nextMeasureIndex = caret.measureIndex
  let nextBeat = Math.round((caret.beat + (direction === 'left' ? -step : step)) * 4) / 4

  if (nextBeat < 0 && nextMeasureIndex > 0) {
    nextMeasureIndex -= 1
    nextBeat = Math.max(0, Math.round((beatsPerMeasure - step) * 4) / 4)
  } else if (nextBeat >= beatsPerMeasure && nextMeasureIndex < measureCount - 1) {
    nextMeasureIndex += 1
    nextBeat = 0
  }

  return {
    ...caret,
    measureIndex: Math.max(0, Math.min(measureCount - 1, nextMeasureIndex)),
    beat: Math.max(0, Math.min(Math.round((beatsPerMeasure - step) * 4) / 4, nextBeat)),
  }
}
```

Key change: all three `.toFixed(2)` calls → `Math.round(x * 4) / 4` which snaps to the sixteenth-note grid without string conversion.

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/editor-core/commands.ts
git commit -m "fix(editor): use grid-snap rounding instead of .toFixed(2) to prevent caret drift"
```

---

### Task 3: Add bounds guards for `insertNoteAtCaret` and `deleteMeasureRange`

Two edge cases: (a) `insertNoteAtCaret` doesn't check `measureIndex < measures.length`, allowing ghost notes; (b) `deleteMeasureRange` can delete all measures, leaving an empty document that crashes rendering.

**Files:**
- Modify: `client/src/lib/scoreDocument.ts:665,953`

- [ ] **Step 1: Add bounds check in `insertNoteAtCaret`**

At `scoreDocument.ts:665`, add a guard at the top of the `insertNoteAtCaret` case:

```typescript
    case 'insertNoteAtCaret': {
      if (command.measureIndex < 0 || command.measureIndex >= next.measures.length) {
        warnings.push(`Measure index ${command.measureIndex} is out of bounds.`)
        break
      }
      const existing = track.notes.find((note) =>
```

- [ ] **Step 2: Add min-1-bar guard in `deleteMeasureRange`**

At `scoreDocument.ts:953`, add a guard:

```typescript
    case 'deleteMeasureRange': {
      const [start, end] = [command.start, command.end]
      const deleteCount = end - start + 1
      if (deleteCount >= next.measures.length) {
        // Keep at least 1 empty measure
        next.measures = [createMeasureMeta(0)]
        track.notes = []
        break
      }
      next.measures = next.measures
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/scoreDocument.ts
git commit -m "fix(editor): guard insertNoteAtCaret bounds and prevent deleting all measures"
```

---

### Task 4: Widen caret anchor matching tolerance and add fallback

When `caret.beat` has floating-point imprecision, the strict `< 0.001` check in `EditSurface.tsx:683` silently hides the caret with no fallback.

**Files:**
- Modify: `client/src/spaces/pack/EditSurface.tsx:680-684`

- [ ] **Step 1: Widen tolerance and add nearest-anchor fallback**

Replace lines 680-684:

```typescript
          {caret && (() => {
            const measure = layout.measures[caret.measureIndex]
            if (!measure) return null
            const anchor = measure.beatAnchors.find((entry) => Math.abs(entry.beat - caret.beat) < 0.001)
            if (!anchor) return null
```

With:

```typescript
          {caret && (() => {
            const measure = layout.measures[caret.measureIndex]
            if (!measure || measure.beatAnchors.length === 0) return null
            // Widen tolerance and fall back to nearest anchor
            let anchor = measure.beatAnchors.find((entry) => Math.abs(entry.beat - caret.beat) < 0.02)
            if (!anchor) {
              anchor = measure.beatAnchors.reduce((best, entry) =>
                Math.abs(entry.beat - caret.beat) < Math.abs(best.beat - caret.beat) ? entry : best,
              )
            }
```

Key changes:
- Tolerance widened from `0.001` to `0.02` (covers any sixteenth-note rounding error)
- Falls back to nearest anchor instead of returning `null`
- No more invisible caret

- [ ] **Step 2: Apply same fix to hover beat in EditSurface**

At around line 660 (the hover beat rendering), verify the anchor matching uses the same pattern. If it also uses `< 0.001`, apply the same widening.

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditSurface.tsx
git commit -m "fix(editor): widen caret anchor tolerance and add nearest-anchor fallback"
```

---

### Task 5: Replace hardcoded colors with design tokens

36 instances of `text-black/N`, `border-black/N`, `bg-white`, `bg-[#faf9f6]`, `bg-[#1593ff]`, `bg-[#f3f4f6]` across 4 files. These break dark mode and violate the design system.

**Files:**
- Modify: `client/src/spaces/pack/EditSurface.tsx` (~16 occurrences of `text-black/`, `border-black/`, `bg-white/`, `bg-[#faf9f6]`)
- Modify: `client/src/spaces/pack/EditorToolbar.tsx` (~20 occurrences of `text-black/`, `border-black/`, `bg-white/`, `bg-[#1593ff]`, `bg-[#f3f4f6]`)
- Modify: `client/src/spaces/pack/EditorTitleBar.tsx` (1 occurrence of `border-black/10`)
- Modify: `client/src/spaces/pack/EditorChatPanel.tsx` (4 occurrences of `border-black/8`, `bg-white`)

**Token mapping:**

| Hardcoded | Replace with |
|-----------|-------------|
| `bg-white` / `bg-white/96` / `bg-white/98` | `bg-surface-0` / `bg-surface-0/96` / `bg-surface-0/98` |
| `bg-[#faf9f6]` | `bg-surface-1` |
| `bg-[#f3f4f6]` | `bg-surface-2` |
| `bg-[#1593ff]` | `bg-accent` |
| `text-black/40` | `text-text-muted` |
| `text-black/60` | `text-text-secondary` |
| `text-black/80` | `text-text-primary` |
| `border-black/8` | `border-border` |
| `border-black/10` | `border-border` |
| `border-black/20` | `border-border-hover` |
| `rgba(0,0,0,0.10)` / `rgba(0,0,0,0.12)` in shadows | `rgba(0,0,0,0.10)` (shadows are OK as-is — they read from opacity not theme color) |

- [ ] **Step 1: Fix EditSurface.tsx**

Apply replacements globally:
- `text-black/40` → `text-text-muted`
- `text-black/60` → `text-text-secondary`
- `text-black/80` → `text-text-primary`
- `border-black/8` → `border-border`
- `border-black/10` → `border-border`
- `bg-white/96` → `bg-surface-0/96`
- `bg-white/98` → `bg-surface-0/98`
- `bg-[#faf9f6]` → `bg-surface-1`

- [ ] **Step 2: Fix EditorToolbar.tsx**

Apply replacements globally:
- Same text/border/bg mappings as Step 1
- `bg-[#1593ff]` → `bg-accent` (slider thumbs on lines 443-444)
- `bg-[#f3f4f6]` → `bg-surface-2` (segment buttons on line 701)
- `bg-white` → `bg-surface-0`

- [ ] **Step 3: Fix EditorTitleBar.tsx**

Line 59: `border-black/10` → `border-border`, `bg-white` → `bg-surface-0`, `focus:border-black/20` → `focus:border-border-hover`

- [ ] **Step 4: Fix EditorChatPanel.tsx**

Lines 98, 113, 126, 176: `border-black/8` → `border-border`, `bg-white` → `bg-surface-0`

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Visual review**

Run `pnpm dev` and check the editor in both light and dark mode. Verify:
- Toolbar background, borders, and text are themed
- EditSurface canvas background, floating cards, context menu are themed
- Slider thumb uses accent color
- Chat panel border and background are themed
- No raw white/black areas remain

- [ ] **Step 7: Commit**

```bash
git add client/src/spaces/pack/EditSurface.tsx client/src/spaces/pack/EditorToolbar.tsx client/src/spaces/pack/EditorTitleBar.tsx client/src/spaces/pack/EditorChatPanel.tsx
git commit -m "fix(editor): replace all hardcoded colors with design tokens for dark mode support"
```

---

### Task 6: Add `insertNoteAtCaret` duplicate-note tolerance widening

The duplicate detection in `insertNoteAtCaret` uses `Math.abs(note.beat - command.beat) < 0.001`. After Task 2's rounding fix this is less critical, but the tolerance should match the caret tolerance for consistency.

**Files:**
- Modify: `client/src/lib/scoreDocument.ts:668,718`

- [ ] **Step 1: Widen beat tolerance for duplicate detection**

At lines 668 and 718, change `< 0.001` to `< 0.02`:

```typescript
    case 'insertNoteAtCaret': {
      // ... bounds check from Task 3 ...
      const existing = track.notes.find((note) =>
        note.measureIndex === command.measureIndex
        && Math.abs(note.beat - command.beat) < 0.02
        && note.placement?.string === command.string,
      )
```

```typescript
    case 'insertRestAtCaret': {
      // ...
      const existing = track.notes.find((note) =>
        note.measureIndex === command.measureIndex && Math.abs(note.beat - command.beat) < 0.02,
      )
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/scoreDocument.ts
git commit -m "fix(editor): widen beat tolerance in note insertion to match caret precision"
```
