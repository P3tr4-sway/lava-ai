# Editor Cursor System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default browser cursor with a mode-aware SVG overlay cursor system that provides elastic snapping, smooth playback animation, and duration-specific note entry cursors across both StaffPreview and EditSurface views.

**Architecture:** A single `useCursorEngine` hook derives cursor mode from existing stores and drives a `<CursorOverlay>` SVG component. Pure math functions handle elastic snapping and interpolation. The unified Select mode replaces the old `selectionScope` branching — click target determines behavior, not mode.

**Tech Stack:** React 18, TypeScript, Zustand, SVG, requestAnimationFrame, CSS custom cursors (data URI SVGs), vitest

**Spec:** `docs/superpowers/specs/2026-03-31-editor-cursor-system-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `client/src/lib/cursorMath.ts` | Create | Pure functions: `lerp`, `computeSnapTarget`, `isSnapped`, `deriveCursorMode` |
| `client/src/lib/cursorMath.test.ts` | Create | Tests for all cursor math functions |
| `client/src/lib/cursorIcons.ts` | Create | SVG data URI generators for note/rest cursor icons |
| `client/src/lib/cursorIcons.test.ts` | Create | Tests for cursor icon generators |
| `client/src/components/score/CursorOverlay.tsx` | Create | SVG overlay component rendering the cursor line |
| `client/src/hooks/useCursorEngine.ts` | Create | Main cursor hook: mode derivation, snapping, rAF loop |
| `client/src/stores/editorStore.ts` | Modify | Remove `selectionScope`, `SelectionScope` type; simplify `toolMode` |
| `client/src/spaces/pack/EditorCanvas.tsx` | Modify | Wrap views in container div with `onMouseMove` + `<CursorOverlay>` |
| `client/src/spaces/pack/EditSurface.tsx` | Modify | Replace `selectionScope` branching with click-target detection |
| `client/src/spaces/pack/StaffPreview.tsx` | Modify | Replace `selectionScope` branching with click-target detection |
| `client/src/spaces/pack/TabCanvas.tsx` | Modify | Replace `selectionScope` references with click-target detection |
| `client/src/spaces/pack/EditorToolbar.tsx` | Modify | Remove selection scope sub-buttons panel |
| `client/src/spaces/pack/EditorPage.tsx` | Modify | Remove `selectionScope` references |
| `client/src/hooks/useEditorKeyboard.ts` | Modify | Remove `selectionScope` references |
| `client/src/hooks/useRangeSelect.ts` | Modify | Change gate from `toolMode === 'range'` to `activeToolGroup === 'selection'` |
| `client/src/hooks/useRangeSelect.test.ts` | Modify | Update test setup for new gate condition |
| `client/src/styles/tokens.css` | Modify | Remove `cursor: pointer` from `.vf-stavenote` |
| `client/src/components/score/PlaybackCursor.tsx` | Delete | Replaced by CursorOverlay |
| `client/src/hooks/usePlaybackCursor.ts` | Delete | Replaced by useCursorEngine |
| `client/src/hooks/usePlaybackCursor.test.ts` | Delete | Replaced by cursorMath tests + useCursorEngine |
| `server/src/agent/prompts/context.ts` | Modify | Remove `selectionScope` from agent prompt context |
| `packages/shared/src/types/agent.ts` | Modify | Remove `selectionScope` from `EditorContext` type |

---

### Task 1: Pure Cursor Math — Snap & Interpolation

**Files:**
- Create: `client/src/lib/cursorMath.ts`
- Create: `client/src/lib/cursorMath.test.ts`

- [ ] **Step 1: Write failing tests for `lerp`**

```ts
// client/src/lib/cursorMath.test.ts
import { describe, it, expect } from 'vitest'
import { lerp, computeSnapTarget, isSnapped, deriveCursorMode } from './cursorMath'

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })
  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })
  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })
  it('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/cursorMath.test.ts`
Expected: FAIL — module `./cursorMath` not found

- [ ] **Step 3: Implement `lerp`**

```ts
// client/src/lib/cursorMath.ts

/** Linear interpolation between a and b by factor t (0–1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
```

- [ ] **Step 4: Run lerp tests to verify they pass**

Run: `cd client && npx vitest run src/lib/cursorMath.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Write failing tests for `computeSnapTarget`**

Add to `cursorMath.test.ts`:

```ts
describe('computeSnapTarget', () => {
  const SNAP_RADIUS = 30
  const SNAP_STRENGTH = 0.6

  it('returns rawX when no snap points within radius', () => {
    const result = computeSnapTarget(100, [0, 200], SNAP_RADIUS, SNAP_STRENGTH)
    expect(result).toBe(100)
  })

  it('pulls toward nearest snap point within radius', () => {
    // rawX=85, snap at 100, distance=15, within radius=30
    const result = computeSnapTarget(85, [100], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 15/30) * 0.6 = 0.3
    // target = 85 + (100 - 85) * 0.3 = 85 + 4.5 = 89.5
    expect(result).toBe(89.5)
  })

  it('pulls stronger when closer to snap point', () => {
    // rawX=95, snap at 100, distance=5, within radius=30
    const result = computeSnapTarget(95, [100], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 5/30) * 0.6 = 0.5
    // target = 95 + (100 - 95) * 0.5 = 95 + 2.5 = 97.5
    expect(result).toBe(97.5)
  })

  it('returns rawX when exactly at radius boundary', () => {
    // rawX=70, snap at 100, distance=30, equals radius
    const result = computeSnapTarget(70, [100], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 30/30) * 0.6 = 0
    expect(result).toBe(70)
  })

  it('snaps to the closest snap point when multiple are within radius', () => {
    // rawX=110, snaps at [100, 115], closest is 115 (distance=5)
    const result = computeSnapTarget(110, [100, 115], SNAP_RADIUS, SNAP_STRENGTH)
    // pull = (1 - 5/30) * 0.6 ≈ 0.5
    // target = 110 + (115 - 110) * 0.5 = 112.5
    expect(result).toBe(112.5)
  })

  it('handles empty snap points array', () => {
    expect(computeSnapTarget(50, [], SNAP_RADIUS, SNAP_STRENGTH)).toBe(50)
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/cursorMath.test.ts`
Expected: FAIL — `computeSnapTarget` is not a function (not exported yet)

- [ ] **Step 7: Implement `computeSnapTarget`**

Add to `cursorMath.ts`:

```ts
/**
 * Computes the snapped x target given raw mouse x and an array of snap-point x values.
 * Returns rawX if no snap point is within snapRadius.
 * Uses elastic pull: pull strength increases as cursor approaches the snap point.
 */
export function computeSnapTarget(
  rawX: number,
  snapPoints: number[],
  snapRadius: number,
  snapStrength: number,
): number {
  if (snapPoints.length === 0) return rawX

  // Find the closest snap point within radius
  let nearestSnap: number | null = null
  let nearestDist = Infinity

  for (const sx of snapPoints) {
    const dist = Math.abs(rawX - sx)
    if (dist < nearestDist && dist < snapRadius) {
      nearestDist = dist
      nearestSnap = sx
    }
  }

  if (nearestSnap === null) return rawX

  const pull = (1 - nearestDist / snapRadius) * snapStrength
  return rawX + (nearestSnap - rawX) * pull
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/cursorMath.test.ts`
Expected: All tests PASS

- [ ] **Step 9: Write failing tests for `isSnapped`**

Add to `cursorMath.test.ts`:

```ts
describe('isSnapped', () => {
  it('returns true when displayX is within threshold of a snap point', () => {
    expect(isSnapped(98, [100], 5)).toBe(true)
  })
  it('returns false when displayX is beyond threshold', () => {
    expect(isSnapped(90, [100], 5)).toBe(false)
  })
  it('returns true when exactly on a snap point', () => {
    expect(isSnapped(100, [100], 5)).toBe(true)
  })
  it('returns false with empty snap points', () => {
    expect(isSnapped(100, [], 5)).toBe(false)
  })
})
```

- [ ] **Step 10: Implement `isSnapped`**

Add to `cursorMath.ts`:

```ts
/** Returns true if displayX is within threshold of any snap point. */
export function isSnapped(displayX: number, snapPoints: number[], threshold: number): boolean {
  return snapPoints.some((sx) => Math.abs(displayX - sx) <= threshold)
}
```

- [ ] **Step 11: Run all tests to verify they pass**

Run: `cd client && npx vitest run src/lib/cursorMath.test.ts`
Expected: All tests PASS

- [ ] **Step 12: Write failing tests for `deriveCursorMode`**

Add to `cursorMath.test.ts`:

```ts
import type { CursorMode } from './cursorMath'

describe('deriveCursorMode', () => {
  it('returns playback when playing regardless of tool group', () => {
    expect(deriveCursorMode('selection', 'playing')).toBe('playback')
    expect(deriveCursorMode('note', 'playing')).toBe('playback')
    expect(deriveCursorMode('notation', 'playing')).toBe('playback')
  })
  it('returns noteEntry when note tool is active and not playing', () => {
    expect(deriveCursorMode('note', 'stopped')).toBe('noteEntry')
    expect(deriveCursorMode('note', 'paused')).toBe('noteEntry')
  })
  it('returns select when selection tool is active and not playing', () => {
    expect(deriveCursorMode('selection', 'stopped')).toBe('select')
    expect(deriveCursorMode('selection', 'paused')).toBe('select')
  })
  it('returns hidden for notation tool when not playing', () => {
    expect(deriveCursorMode('notation', 'stopped')).toBe('hidden')
  })
  it('returns hidden for rest tool when not playing', () => {
    expect(deriveCursorMode('rest', 'stopped')).toBe('hidden')
  })
  it('returns hidden for measure tool when not playing', () => {
    expect(deriveCursorMode('measure', 'stopped')).toBe('hidden')
  })
  it('returns hidden for playback tool group when not playing', () => {
    expect(deriveCursorMode('playback', 'stopped')).toBe('hidden')
  })
})
```

- [ ] **Step 13: Implement `deriveCursorMode`**

Add to `cursorMath.ts`:

```ts
export type CursorMode = 'select' | 'noteEntry' | 'playback' | 'hidden'

type ActiveToolGroup = 'selection' | 'note' | 'rest' | 'notation' | 'measure' | 'playback'
type PlaybackState = 'stopped' | 'playing' | 'paused'

/** Derives the cursor mode from toolbar and playback state. */
export function deriveCursorMode(
  activeToolGroup: ActiveToolGroup,
  playbackState: PlaybackState,
): CursorMode {
  if (playbackState === 'playing') return 'playback'
  if (activeToolGroup === 'note') return 'noteEntry'
  if (activeToolGroup === 'selection') return 'select'
  return 'hidden'
}
```

- [ ] **Step 14: Run all cursorMath tests**

Run: `cd client && npx vitest run src/lib/cursorMath.test.ts`
Expected: All tests PASS

- [ ] **Step 15: Commit**

```bash
git add client/src/lib/cursorMath.ts client/src/lib/cursorMath.test.ts
git commit -m "feat(editor): add pure cursor math utilities — lerp, snap, mode derivation"
```

---

### Task 2: Cursor Icon SVG Generators

**Files:**
- Create: `client/src/lib/cursorIcons.ts`
- Create: `client/src/lib/cursorIcons.test.ts`

- [ ] **Step 1: Write failing tests for cursor icon generators**

```ts
// client/src/lib/cursorIcons.test.ts
import { describe, it, expect } from 'vitest'
import { noteCursorUrl, restCursorUrl } from './cursorIcons'
import type { NoteValue } from '@lava/shared'

describe('noteCursorUrl', () => {
  const durations: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']

  for (const d of durations) {
    it(`returns a valid data URI for ${d} note`, () => {
      const url = noteCursorUrl(d)
      expect(url).toMatch(/^url\('data:image\/svg\+xml,/)
      expect(url).toContain('svg')
      expect(url).toContain('xmlns')
    })
  }

  it('returns different SVGs for different durations', () => {
    const quarter = noteCursorUrl('quarter')
    const half = noteCursorUrl('half')
    expect(quarter).not.toBe(half)
  })
})

describe('restCursorUrl', () => {
  it('returns a valid data URI', () => {
    const url = restCursorUrl()
    expect(url).toMatch(/^url\('data:image\/svg\+xml,/)
    expect(url).toContain('svg')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/cursorIcons.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cursor icon generators**

```ts
// client/src/lib/cursorIcons.ts
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
 * Color defaults to the accent color (#e5e5e5 dark / #0d0d0d light).
 * Since CSS custom properties can't be used in data URIs, we use a
 * neutral color that works on both light and dark backgrounds.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/cursorIcons.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/cursorIcons.ts client/src/lib/cursorIcons.test.ts
git commit -m "feat(editor): add cursor icon SVG generators for note entry"
```

---

### Task 3: Remove `selectionScope` from editorStore

**Files:**
- Modify: `client/src/stores/editorStore.ts` (lines 7, 44-55, 130-134, and all `selectionScope` references)
- Modify: `client/src/spaces/pack/EditSurface.test.tsx` (line 23)
- Modify: `client/src/spaces/pack/TabCanvas.test.tsx` (line 98)
- Modify: `packages/shared/src/types/agent.ts` (line 90)
- Modify: `server/src/agent/prompts/context.ts` (lines 47-48)

- [ ] **Step 1: Remove `SelectionScope` type and `selectionScope` state from editorStore**

In `client/src/stores/editorStore.ts`:

Remove the type definition on line 7:
```ts
// DELETE this line:
export type SelectionScope = 'note' | 'bar' | 'section' | 'range'
```

Remove `selectionScope` from the store interface (around line 48):
```ts
// DELETE these lines:
  selectionScope: SelectionScope
  setSelectionScope: (scope: SelectionScope) => void
```

Remove from the initial state (around line 132):
```ts
// DELETE these lines:
  selectionScope: 'note',
  setSelectionScope: (selectionScope) => set({ selectionScope }),
```

- [ ] **Step 2: Run typecheck to find all broken references**

Run: `cd client && npx tsc --noEmit 2>&1 | head -60`
Expected: Multiple errors listing every file that still references `selectionScope` or `SelectionScope`

- [ ] **Step 3: Fix EditSurface.tsx — replace selectionScope branching with click-target detection**

In `client/src/spaces/pack/EditSurface.tsx`:

Remove the `selectionScope` subscription (around line 73 — find the exact destructure line that pulls `selectionScope` from the store and remove it).

In `handleMouseDown` (lines 252-299), replace the `selectionScope === 'note'` branch with click-target detection:

Replace the entire `handleMouseDown` body with:
```ts
const handleMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
  const pointer = pointerFromEvent(event, layout)
  if (!pointer) return

  const note = hitTestNote(layout, pointer)
  const beat = hitTestBeat(layout, pointer)
  const measure = hitTestMeasure(layout, pointer)

  // Click on a note → select it (regardless of tool group)
  if (note) {
    selectNoteById(note.noteId, event.shiftKey)
    return
  }

  // Click on a beat with note tool active → set caret + insert
  if (beat && activeToolGroup === 'note') {
    const track = /* existing track lookup logic — preserve as-is */
    if (track) {
      const target = { trackId: track.id, measureIndex: beat.measureIndex, beat: beat.beat, string: beat.string }
      setCaret(target)
      if (!event.altKey && !event.metaKey) {
        commitEntryAtTarget(target)
      }
    }
    return
  }

  // Click on empty space → start drag for bar range selection
  if (measure) {
    setDragState({ active: true, mode: 'range', startMeasureIndex: measure.index, currentMeasureIndex: measure.index })
    selectBar(measure.index, event.shiftKey)
    return
  }

  // Click on nothing → clear
  clearSelection()
  setCaret(null)
}, [/* update dependency array — remove selectionScope, keep activeToolGroup */])
```

Note: Preserve the existing `pointerFromEvent`, `hitTestNote`, `hitTestBeat`, `hitTestMeasure`, track lookup, and `commitEntryAtTarget` logic exactly as they are. The only change is removing the `selectionScope` branching and using click target + `activeToolGroup` instead.

In `handleMouseMove` (lines 219-250), remove the `selectionScope` check for hover target kind. Replace with:
```ts
// If hovering a note, always show note hover
if (note) {
  setHoverTarget({ kind: 'note', noteId: note.noteId, measureIndex: note.measureIndex })
} else if (beat) {
  setHoverTarget({ kind: 'beat', measureIndex: beat.measureIndex, beat: beat.beat, string: beat.string })
} else if (measure) {
  setHoverTarget({ kind: 'bar', measureIndex: measure.index })
} else {
  setHoverTarget(null)
}
```

- [ ] **Step 4: Fix StaffPreview.tsx — replace selectionScope branching**

In `client/src/spaces/pack/StaffPreview.tsx`:

Remove `selectionScope` subscription from the store.

In `onClick` handler (lines 136-153), replace with click-target detection:
```ts
onClick={(event) => {
  const target = event.target as HTMLElement
  const noteEl = target.closest('.vf-stavenote') as HTMLElement | null
  const measureEl = target.closest('.vf-measure') as SVGGElement | null
  const measureId = measureEl ? parseInt(measureEl.id, 10) - 1 : null

  // Click on note → select it
  if (noteEl?.dataset.scoreNoteId) {
    selectNoteById(noteEl.dataset.scoreNoteId, event.shiftKey)
    return
  }

  // Click on measure → select bar
  if (measureId != null && measureId >= 0) {
    selectBar(measureId, event.shiftKey)
    return
  }

  clearSelection()
}}
```

In `onMouseMove` handler (lines 126-134), remove selectionScope check — always show note hover if on a note, bar hover if on a measure:
```ts
onMouseMove={(event) => {
  clearHoverHighlights()
  const target = event.target as HTMLElement
  const noteEl = target.closest('.vf-stavenote') as HTMLElement | null
  if (noteEl) {
    noteEl.classList.add('lava-note-hover')
    return
  }
  const measureEl = target.closest('.vf-measure') as SVGGElement | null
  if (measureEl) {
    measureEl.classList.add('lava-bar-hover')
  }
}}
```

- [ ] **Step 5: Fix TabCanvas.tsx — remove selectionScope references**

In `client/src/spaces/pack/TabCanvas.tsx` (line 314 and all usage sites):

Remove the `selectionScope` subscription. Apply the same click-target detection pattern:
- Click on note → `selectNoteById()`
- Click on beat with note tool → `setCaret()` + entry
- Click on measure → `selectBar()`
- Drag → range select

Use `activeToolGroup` instead of `selectionScope` to decide whether beat-clicks do note entry.

- [ ] **Step 6: Fix EditorToolbar.tsx — remove selection scope sub-buttons**

In `client/src/spaces/pack/EditorToolbar.tsx`:

Remove the `handleScopeChange` function (lines 425-429).

Remove the selection scope options array (lines 102-107).

Remove the selection scope panel rendering (lines 547-567) — the four-button panel showing Note/Bar/Section/Range scope options. The Selection tool button (lines 772-785) should remain but with no chevron/dropdown since there are no sub-options.

Remove `selectionScope` from the store subscription.

Remove `setSelectionScope` from the store subscription.

- [ ] **Step 7: Fix EditorPage.tsx — remove selectionScope references**

In `client/src/spaces/pack/EditorPage.tsx`:

Remove `selectionScope` from the `useEditorStore.getState()` call (around line 188) and from the object passed to the agent context (around lines 218, 247, 253, 266, 275, 299).

- [ ] **Step 8: Fix useEditorKeyboard.ts — remove selectionScope references**

In `client/src/hooks/useEditorKeyboard.ts`:

Find any references to `selectionScope` and remove them. The keyboard shortcut `V` currently sets `selectionScope: 'note'` — change it to just set `activeToolGroup: 'selection'` (it likely already does this too).

- [ ] **Step 9: Fix useRangeSelect — change activation gate**

In `client/src/hooks/useRangeSelect.ts`:

Change the activation condition from `toolMode === 'range'` (line 55) to `activeToolGroup === 'selection'`:

```ts
// Line 40: change subscription
const activeToolGroup = useEditorStore((s) => s.activeToolGroup)
// Remove: const toolMode = useEditorStore((s) => s.toolMode)

// Line 55: change gate condition
if (activeToolGroup !== 'selection') return
```

In `client/src/hooks/useRangeSelect.test.ts`, update test setup:

```ts
// Line 8: change initial state
useEditorStore.setState({ activeToolGroup: 'selection', selectedBars: [] })

// Line 26: change "range mode" test
useEditorStore.setState({ activeToolGroup: 'selection' })

// Line 41: change "pointer mode" test to "non-selection mode"
useEditorStore.setState({ activeToolGroup: 'note' })

// Line 54: change "range mode" test
useEditorStore.setState({ activeToolGroup: 'selection' })
```

- [ ] **Step 10: Fix shared types — remove selectionScope from agent types**

In `packages/shared/src/types/agent.ts` (line 90):
```ts
// DELETE this line:
  selectionScope?: 'note' | 'bar' | 'section' | 'range'
```

In `server/src/agent/prompts/context.ts` (lines 47-48):
```ts
// DELETE these lines:
      if (ec.selectionScope) {
        prompt += `\nSelection scope: ${ec.selectionScope}`
      }
```

- [ ] **Step 11: Fix existing test files**

In `client/src/spaces/pack/EditSurface.test.tsx` (line 23):
Remove `selectionScope: 'note'` from the `useEditorStore.setState()` call.

In `client/src/spaces/pack/TabCanvas.test.tsx` (line 98):
Remove `selectionScope: 'note'` from the `useEditorStore.setState()` call.

- [ ] **Step 12: Run typecheck to verify no remaining errors**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 13: Run all existing tests**

Run: `cd client && npx vitest run`
Expected: All tests PASS (some may need minor fixes if they reference `selectionScope`)

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor(editor): remove selectionScope — unified click-target detection"
```

---

### Task 4: CursorOverlay Component

**Files:**
- Create: `client/src/components/score/CursorOverlay.tsx`

- [ ] **Step 1: Create CursorOverlay component**

```tsx
// client/src/components/score/CursorOverlay.tsx
import type { CursorMode } from '@/lib/cursorMath'

interface CursorOverlayProps {
  cursorMode: CursorMode
  displayX: number
  displayY: { top: number; bottom: number }
  isSnapped: boolean
  className?: string
}

/**
 * SVG overlay rendering the cursor line for Select and Playback modes.
 * Positioned absolutely over the score canvas. pointer-events: none so
 * all clicks pass through to the score beneath.
 */
export function CursorOverlay({ cursorMode, displayX, displayY, isSnapped }: CursorOverlayProps) {
  if (cursorMode === 'hidden' || cursorMode === 'noteEntry') return null

  const isPlayback = cursorMode === 'playback'
  const stroke = isPlayback ? 'var(--text-muted)' : 'var(--accent)'
  const opacity = isPlayback ? 0.7 : isSnapped ? 1 : 0.8

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <line
        x1={displayX}
        y1={displayY.top}
        x2={displayX}
        y2={displayY.bottom}
        stroke={stroke}
        strokeWidth={1.5}
        opacity={opacity}
        style={{ transition: 'opacity 150ms ease-out, stroke 150ms ease-out' }}
      />
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/score/CursorOverlay.tsx
git commit -m "feat(editor): add CursorOverlay SVG component"
```

---

### Task 5: useCursorEngine Hook

**Files:**
- Create: `client/src/hooks/useCursorEngine.ts`

- [ ] **Step 1: Create the useCursorEngine hook**

```ts
// client/src/hooks/useCursorEngine.ts
import { useRef, useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'
import { lerp, computeSnapTarget, isSnapped as checkSnapped, deriveCursorMode } from '@/lib/cursorMath'
import type { CursorMode } from '@/lib/cursorMath'

const SNAP_RADIUS = 30
const SNAP_STRENGTH = 0.6
const SNAP_THRESHOLD = 5
const LERP_FACTOR = 0.3

interface CursorEngineState {
  cursorMode: CursorMode
  displayX: number
  displayY: { top: number; bottom: number }
  isSnapped: boolean
  /** Feed mouse position from the container's onMouseMove. */
  onMouseMove: (e: React.MouseEvent) => void
  /** Feed mouse leave to hide the cursor when mouse exits the score. */
  onMouseLeave: () => void
}

type GetMeasureBounds = (barIndex: number) => { x: number; y: number; width: number; height: number } | null

/**
 * Core cursor engine hook. Drives the CursorOverlay.
 * - Reads activeToolGroup + playbackState to derive cursor mode.
 * - In Select mode: tracks mouse with elastic snapping to beat 1.
 * - In Playback mode: animates cursor based on audio time + measure bounds.
 * - In NoteEntry/Hidden: no cursor line (CursorOverlay renders nothing).
 */
export function useCursorEngine(
  containerRef: RefObject<HTMLElement | null>,
  getMeasureBounds: GetMeasureBounds,
  snapPoints: number[],
): CursorEngineState {
  const activeToolGroup = useEditorStore((s) => s.activeToolGroup)
  const playbackState = useEditorStore((s) => s.playbackState)
  const currentBar = useAudioStore((s) => s.currentBar)
  const currentTime = useAudioStore((s) => s.currentTime)
  const bpm = useAudioStore((s) => s.bpm)

  const cursorMode = deriveCursorMode(activeToolGroup, playbackState)

  // Internal animation state (refs to avoid re-renders every frame)
  const targetXRef = useRef(0)
  const displayXRef = useRef(0)
  const mouseActiveRef = useRef(false)
  const rafIdRef = useRef<number>(0)

  // Render state — only updated when values change meaningfully
  const [displayX, setDisplayX] = useState(0)
  const [isSnapped, setIsSnapped] = useState(false)

  // Container height for the cursor line extent
  const [displayY, setDisplayY] = useState<{ top: number; bottom: number }>({ top: 0, bottom: 0 })

  // Update container height on mount and resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => {
      setDisplayY({ top: 0, bottom: container.scrollHeight })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawX = e.clientX - rect.left + container.scrollLeft
    targetXRef.current = computeSnapTarget(rawX, snapPoints, SNAP_RADIUS, SNAP_STRENGTH)
    mouseActiveRef.current = true
  }, [containerRef, snapPoints])

  const onMouseLeave = useCallback(() => {
    mouseActiveRef.current = false
  }, [])

  // Animation loop
  useEffect(() => {
    if (cursorMode === 'hidden' || cursorMode === 'noteEntry') {
      // No animation needed
      return
    }

    let running = true

    const tick = () => {
      if (!running) return

      if (cursorMode === 'select' && mouseActiveRef.current) {
        // Lerp toward snapped target
        displayXRef.current = lerp(displayXRef.current, targetXRef.current, LERP_FACTOR)
        const snapped = checkSnapped(displayXRef.current, snapPoints, SNAP_THRESHOLD)
        setDisplayX(Math.round(displayXRef.current * 10) / 10)
        setIsSnapped(snapped)
      }

      if (cursorMode === 'playback') {
        // Compute position from audio time
        const barDuration = 60 / bpm * 4 // assuming 4/4 — TODO: read actual meter
        const barBounds = getMeasureBounds(currentBar)
        const nextBarBounds = getMeasureBounds(currentBar + 1)

        if (barBounds) {
          if (nextBarBounds) {
            // Interpolate within bar
            const barStartTime = currentBar * barDuration
            const fraction = Math.max(0, Math.min(1, (currentTime - barStartTime) / barDuration))
            const x = lerp(barBounds.x, nextBarBounds.x, fraction)
            displayXRef.current = x
          } else {
            // Last bar — stay at left edge
            displayXRef.current = barBounds.x
          }
          setDisplayX(Math.round(displayXRef.current * 10) / 10)
          setIsSnapped(false)

          // Scroll following: keep cursor at ~30% from left edge
          const container = containerRef.current
          if (container) {
            const viewportWidth = container.clientWidth
            const targetScroll = displayXRef.current - viewportWidth * 0.3
            const currentScroll = container.scrollLeft
            if (Math.abs(targetScroll - currentScroll) > viewportWidth * 0.4) {
              container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' })
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [cursorMode, snapPoints, bpm, currentBar, currentTime, getMeasureBounds, containerRef])

  return {
    cursorMode,
    displayX: mouseActiveRef.current || cursorMode === 'playback' ? displayX : -100,
    displayY,
    isSnapped,
    onMouseMove,
    onMouseLeave,
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useCursorEngine.ts
git commit -m "feat(editor): add useCursorEngine hook — snapping, playback, mode derivation"
```

---

### Task 6: Integrate CursorOverlay into EditorCanvas

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`
- Modify: `client/src/hooks/useScoreSync.ts` (export `getMeasureBounds` for external use)

- [ ] **Step 1: Build snap points and integrate overlay in EditorCanvas**

In `client/src/spaces/pack/EditorCanvas.tsx`, wrap the existing view in a container div with `onMouseMove`, the cursor overlay, and cursor CSS:

```tsx
// client/src/spaces/pack/EditorCanvas.tsx
import { useRef, useMemo } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { StaffPreview } from './StaffPreview'
import { PracticeSurface } from './PracticeSurface'
import { CursorOverlay } from '@/components/score/CursorOverlay'
import { useCursorEngine } from '@/hooks/useCursorEngine'
import { noteCursorUrl, restCursorUrl } from '@/lib/cursorIcons'
import { cn } from '@/components/ui/utils'

export function EditorCanvas(/* existing props */) {
  const viewMode = useEditorStore((s) => s.viewMode)
  const entryDuration = useEditorStore((s) => s.entryDuration)
  const entryMode = useEditorStore((s) => s.entryMode)
  const containerRef = useRef<HTMLDivElement>(null)

  // getMeasureBounds — get from useScoreSync or from the child view ref
  // This will need to be wired from StaffPreview/EditSurface (see Step 2)
  const getMeasureBoundsRef = useRef<(barIndex: number) => { x: number; y: number; width: number; height: number } | null>(() => null)

  // Build snap points from measure bounds
  const snapPoints = useMemo(() => {
    const points: number[] = []
    for (let i = 0; i < 500; i++) {
      const bounds = getMeasureBoundsRef.current?.(i)
      if (!bounds) break
      points.push(bounds.x)
    }
    return points
  }, [/* rebuild trigger — e.g. viewMode, or a render counter */])

  const cursor = useCursorEngine(containerRef, getMeasureBoundsRef.current ?? (() => null), snapPoints)

  // Cursor CSS for note entry mode
  const cursorStyle = cursor.cursorMode === 'noteEntry'
    ? { cursor: entryMode === 'rest' ? restCursorUrl() : noteCursorUrl(entryDuration) }
    : cursor.cursorMode === 'select' || cursor.cursorMode === 'playback'
      ? { cursor: 'none' }
      : undefined

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto')}
      style={cursorStyle}
      onMouseMove={cursor.onMouseMove}
      onMouseLeave={cursor.onMouseLeave}
    >
      {viewMode === 'staff' && <StaffPreview getMeasureBoundsRef={getMeasureBoundsRef} /* ...existing props */ />}
      {viewMode === 'tab' && <PracticeSurface /* ...existing props */ />}
      {viewMode === 'leadSheet' && <StaffPreview getMeasureBoundsRef={getMeasureBoundsRef} /* ...existing props */ />}

      <CursorOverlay
        cursorMode={cursor.cursorMode}
        displayX={cursor.displayX}
        displayY={cursor.displayY}
        isSnapped={cursor.isSnapped}
      />
    </div>
  )
}
```

Note: The exact prop-wiring to get `getMeasureBounds` from child views depends on how StaffPreview/EditSurface currently expose it. Use a `MutableRefObject` callback pattern: parent passes a ref, child assigns its `getMeasureBounds` to `ref.current` in a `useEffect`.

- [ ] **Step 2: Wire getMeasureBounds from StaffPreview**

In `client/src/spaces/pack/StaffPreview.tsx`, accept a `getMeasureBoundsRef` prop and assign the function:

```tsx
interface StaffPreviewProps {
  // ... existing props
  getMeasureBoundsRef?: React.MutableRefObject<((barIndex: number) => { x: number; y: number; width: number; height: number } | null) | null>
}

// Inside the component, after useScoreSync:
useEffect(() => {
  if (getMeasureBoundsRef) {
    getMeasureBoundsRef.current = getMeasureBounds
  }
}, [getMeasureBoundsRef, getMeasureBounds])
```

Apply the same pattern for EditSurface / PracticeSurface.

- [ ] **Step 3: Run typecheck + dev server to verify**

Run: `cd client && npx tsc --noEmit`
Run: `pnpm dev` and verify the editor loads without errors

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx client/src/spaces/pack/StaffPreview.tsx
git commit -m "feat(editor): integrate CursorOverlay into EditorCanvas with snap points"
```

---

### Task 7: Remove Old PlaybackCursor + Update tokens.css

**Files:**
- Delete: `client/src/components/score/PlaybackCursor.tsx`
- Delete: `client/src/hooks/usePlaybackCursor.ts`
- Delete: `client/src/hooks/usePlaybackCursor.test.ts`
- Modify: `client/src/styles/tokens.css` (lines 85-86)
- Remove any imports of `PlaybackCursor` or `usePlaybackCursor`

- [ ] **Step 1: Find and remove all PlaybackCursor imports**

Run: `grep -rn "PlaybackCursor\|usePlaybackCursor" client/src/ --include="*.tsx" --include="*.ts"` to find all import sites.

Remove the import and usage from each file. The `<PlaybackCursor>` component is rendered somewhere in the score views — remove it since `<CursorOverlay>` now handles playback cursor rendering.

- [ ] **Step 2: Delete old files**

```bash
rm client/src/components/score/PlaybackCursor.tsx
rm client/src/hooks/usePlaybackCursor.ts
rm client/src/hooks/usePlaybackCursor.test.ts
```

- [ ] **Step 3: Update tokens.css — remove cursor: pointer from .vf-stavenote**

In `client/src/styles/tokens.css` (line 86), remove:
```css
/* DELETE this line: */
  cursor: pointer;
```

The `.vf-stavenote` rule should keep its hover styles (fill/stroke changes) but no longer override the cursor — the cursor is now managed by the overlay system and the `cursor: none` / `cursor: url(...)` on the container.

- [ ] **Step 4: Run typecheck + tests**

Run: `cd client && npx tsc --noEmit && npx vitest run`
Expected: No errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(editor): remove old PlaybackCursor, update tokens.css for overlay cursor"
```

---

### Task 8: Rebuild Snap Points on Layout Change

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Add a render counter to trigger snap point rebuilds**

The snap points array must be rebuilt whenever the score re-renders (e.g., bars added/deleted, zoom changed, window resized). Add a `layoutVersion` counter:

```tsx
// In EditorCanvas
const [layoutVersion, setLayoutVersion] = useState(0)

// Increment after OSMD/AlphaTab re-renders
const onScoreRerender = useCallback(() => {
  setLayoutVersion((v) => v + 1)
}, [])

// Pass onScoreRerender to StaffPreview/EditSurface as a callback
// They call it after their score render completes

// Update snapPoints useMemo dependency:
const snapPoints = useMemo(() => {
  const points: number[] = []
  for (let i = 0; i < 500; i++) {
    const bounds = getMeasureBoundsRef.current?.(i)
    if (!bounds) break
    points.push(bounds.x)
  }
  return points
}, [layoutVersion])
```

- [ ] **Step 2: Wire onScoreRerender to child views**

In StaffPreview: call `onScoreRerender?.()` after OSMD finishes rendering (in the existing render callback or useEffect that runs after `osmd.render()`).

In EditSurface/TabCanvas: call `onScoreRerender?.()` after AlphaTab bounds are ready.

- [ ] **Step 3: Verify snap points rebuild**

Run: `pnpm dev` — open editor, add a bar, verify the cursor still snaps correctly to the new barline.

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx client/src/spaces/pack/StaffPreview.tsx
git commit -m "feat(editor): rebuild cursor snap points on score layout change"
```

---

### Task 9: Final Integration — Toolbar Cleanup + Polish

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Simplify selection tool button**

In `EditorToolbar.tsx`, the Selection tool button (lines 772-785) should:
- Keep the MousePointer2 icon
- Set `activeToolGroup = 'selection'` on click (already does this)
- Remove the chevron/dropdown that opens the scope sub-panel
- Remove the scope sub-panel entirely (already done in Task 3 step 6)

Verify the Note tool button still sets `activeToolGroup = 'note'` and the Notation tool still sets `activeToolGroup = 'notation'`.

- [ ] **Step 2: Simplify toolMode type**

In `client/src/stores/editorStore.ts`, simplify `ToolMode`:

```ts
// Change from:
export type ToolMode = 'pointer' | 'range' | 'chord' | 'keySig' | 'text'
// To:
export type ToolMode = 'pointer' | 'chord' | 'keySig' | 'text'
```

Search for any code that sets `toolMode` to `'range'` and change it to `'pointer'` (or remove the set call if it was only triggered by the now-removed scope change).

- [ ] **Step 3: Run full test suite + typecheck**

Run: `cd client && npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 4: Run the dev server and manually verify all cursor modes**

Run: `pnpm dev`

Verify:
1. **Select mode:** Click Selection tool → cursor becomes thin vertical accent-colored line; hover over score → cursor snaps elastically to barlines; click note → note highlights; drag empty space → bar range selection
2. **Note entry:** Click Note tool → cursor becomes note icon; changes with duration selection; click on score → note inserted
3. **Playback:** Press Play → cursor turns gray, moves smoothly across bars; pause → cursor freezes; stop → cursor returns to previous mode
4. **Hidden:** Click Notation tool → default browser cursor, no overlay line

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(editor): complete cursor system — toolbar cleanup and ToolMode simplification"
```

---

## Summary of Deliverables

| Task | What it delivers |
|------|-----------------|
| 1 | Pure math: `lerp`, `computeSnapTarget`, `isSnapped`, `deriveCursorMode` — fully tested |
| 2 | Note/rest cursor SVG generators — fully tested |
| 3 | `selectionScope` removal — unified click-target detection across all views |
| 4 | `<CursorOverlay>` SVG component |
| 5 | `useCursorEngine` hook — snapping, playback animation, mode derivation |
| 6 | Integration into EditorCanvas + wiring to child views |
| 7 | Old PlaybackCursor removal + tokens.css cleanup |
| 8 | Dynamic snap point rebuilding on layout change |
| 9 | Toolbar simplification + final ToolMode cleanup |
