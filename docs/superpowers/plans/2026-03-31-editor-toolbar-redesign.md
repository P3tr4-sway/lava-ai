# Editor Toolbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the EditorToolbar so that all 8 tool groups are always accessible regardless of editor mode, fix the inverted mode logic, add missing notation features (slur, articulations), improve chord diagram UX, and add a zoom slider.

**Architecture:** The toolbar rail keeps its floating-panel pattern but removes the `editorMode === 'fineEdit'` gate so note/rest/notation/structure buttons are always visible. New `TechniqueSet` fields (`slur`, `accent`, `staccato`, `tenuto`) are added at the shared type level and wired through `ScoreCommand` → `scoreDocument.ts` → toolbar. The zoom panel gets an `<input type="range">` slider and a direct `%` input. The mode-switch segment gets text labels.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, lucide-react, `@lava/shared` types

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/shared/src/types/score.ts` | Modify | Add `slur`, `accent`, `staccato`, `tenuto` to `TechniqueSet`; add `toggleSlur` to `ScoreCommand` union |
| `client/src/lib/scoreDocument.ts` | Modify | Handle `toggleSlur` command; existing `addTechnique`/`removeTechnique` already handles new technique keys |
| `client/src/stores/editorStore.ts` | Modify | Add `chordDiagramGlobal: 'hidden' \| 'top' \| 'bottom' \| 'both'` and `setChordDiagramGlobal` for global chord diagram placement |
| `client/src/spaces/pack/EditorToolbar.tsx` | Modify (major) | Remove fineEdit gate; fix mode logic; add slur/articulation buttons; redesign zoom panel with slider; add labels to mode-switch; deduplicate icons |
| `client/src/spaces/pack/StaffPreview.tsx` | Modify | Wire `showChordDiagrams` + global placement to render chord symbols above/below staff |

---

### Task 1: Add missing technique types to shared schema

**Files:**
- Modify: `packages/shared/src/types/score.ts:64-72` (TechniqueSet interface)
- Modify: `packages/shared/src/types/score.ts:161-191` (ScoreCommand union)

- [ ] **Step 1: Add new fields to `TechniqueSet`**

In `packages/shared/src/types/score.ts`, add 4 fields to the `TechniqueSet` interface:

```typescript
export interface TechniqueSet {
  bend?: boolean
  slide?: TechniqueSlide
  hammerOn?: boolean
  pullOff?: boolean
  palmMute?: boolean
  harmonic?: boolean
  vibrato?: boolean
  // --- new articulations ---
  accent?: boolean
  staccato?: boolean
  tenuto?: boolean
  slur?: boolean
}
```

- [ ] **Step 2: Add `toggleSlur` to `ScoreCommand` union**

Append to the `ScoreCommand` type union (after the `removeTechnique` entry):

```typescript
  | { type: 'toggleSlur'; trackId: string; noteId: string }
```

- [ ] **Step 3: Run typecheck to verify no regressions**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS — new optional fields and union member don't break existing consumers.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/score.ts
git commit -m "feat(shared): add slur, accent, staccato, tenuto to TechniqueSet and ScoreCommand"
```

---

### Task 2: Wire `toggleSlur` command in score document engine

**Files:**
- Modify: `client/src/lib/scoreDocument.ts:872-876` (after `toggleTie` case)

- [ ] **Step 1: Add the `toggleSlur` case to `applyCommandToDocument`**

Insert after the `case 'toggleTie'` block (line ~876) in `client/src/lib/scoreDocument.ts`:

```typescript
    case 'toggleSlur':
      track.notes = track.notes.map((note) => note.id === command.noteId
        ? {
            ...note,
            techniques: {
              ...note.techniques,
              slur: !note.techniques.slur,
            },
          }
        : note)
      break
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/scoreDocument.ts
git commit -m "feat(score): handle toggleSlur command in score document engine"
```

---

### Task 3: Add global chord diagram placement to editor store

**Files:**
- Modify: `client/src/stores/editorStore.ts`

- [ ] **Step 1: Add `chordDiagramGlobal` state and setter**

In the `EditorStore` interface (after `toggleBeatMarkers`), add:

```typescript
  chordDiagramGlobal: 'hidden' | 'top' | 'bottom' | 'both'
  setChordDiagramGlobal: (placement: 'hidden' | 'top' | 'bottom' | 'both') => void
```

In the `create` body (after `toggleBeatMarkers`), add:

```typescript
  chordDiagramGlobal: 'hidden',
  setChordDiagramGlobal: (chordDiagramGlobal) => set({ chordDiagramGlobal }),
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/editorStore.ts
git commit -m "feat(editor): add chordDiagramGlobal state for toolbar-level chord placement"
```

---

### Task 4: Redesign EditorToolbar — remove fineEdit gate, fix mode logic

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

This is the largest task. It addresses:
1. The inverted mode logic on line 669-673
2. The `editorMode === 'fineEdit'` gate hiding note/rest/notation/structure buttons
3. Mode-switch segment lacking labels
4. Icon deduplication

- [ ] **Step 1: Fix the inverted mode logic for the Selection/Playback rail button**

Current code (line 668-674) says `editorMode === 'transform'` shows `Music2` icon → opens `'playback'` panel, which is backwards. Fix:

Replace lines 668-674:

```tsx
          <RailButton
            icon={MousePointer2}
            label="Selection tools"
            active={openPanel === 'selection'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'selection' ? null : 'selection')}
          />
```

This makes the Selection button always visible and always opens the selection panel.

- [ ] **Step 2: Add a dedicated Playback rail button (always visible, after Play/Pause)**

Insert a new `RailButton` between the Play/Pause button and the ToolDivider at line 666:

```tsx
          <RailButton
            icon={Music2}
            label="Playback options"
            active={openPanel === 'playback'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'playback' ? null : 'playback')}
          />
```

- [ ] **Step 3: Remove the `editorMode === 'fineEdit'` guard around note/notation/structure buttons**

Delete the `{editorMode === 'fineEdit' && (` wrapper and its closing `)}` (lines 676 and 699). The three `RailButton` components for note, notation, and structure should be rendered unconditionally.

Before:
```tsx
          {editorMode === 'fineEdit' && (
            <>
              <RailButton icon={Square} ... />
              <RailButton icon={Link2} ... />
              <RailButton icon={Grid2x2} ... />
            </>
          )}
```

After:
```tsx
          <RailButton icon={Square} ... />
          <RailButton icon={Link2} ... />
          <RailButton icon={Grid2x2} ... />
```

- [ ] **Step 4: Fix the View rail button — remove conditional icon**

Replace line 702-708 (which uses `editorMode === 'transform' ? Grid2x2 : ZoomIn`):

```tsx
          <RailButton
            icon={ZoomIn}
            label="View controls"
            active={openPanel === 'view'}
            withChevron
            onClick={() => setOpenPanel((current) => current === 'view' ? null : 'view')}
          />
```

This removes the `Grid2x2` icon reuse on the View button.

- [ ] **Step 5: Add text labels to the mode-switch segment**

Replace the three `MiniSegmentButton` components (lines 712-728). Each currently only has an icon. Add a text label next to each icon:

```tsx
          <div className="flex items-center rounded-[22px] bg-surface-2 p-1">
            <MiniSegmentButton label="Play mode" active={editorMode === 'transform' && viewMode !== 'split'} onClick={() => {
              setEditorMode('transform')
              if (viewMode === 'split') setViewMode('tab')
            }}>
              <Music2 className="size-4" />
              <span className="ml-1 text-[11px]">Play</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Edit mode" active={editorMode === 'fineEdit' && viewMode !== 'split'} onClick={() => {
              setEditorMode('fineEdit')
              if (viewMode === 'split') setViewMode('tab')
            }}>
              <MousePointer2 className="size-4" />
              <span className="ml-1 text-[11px]">Edit</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Split view" active={viewMode === 'split'} onClick={() => setViewMode(viewMode === 'split' ? 'tab' : 'split')}>
              <Grid2x2 className="size-4" />
              <span className="ml-1 text-[11px]">Split</span>
            </MiniSegmentButton>
          </div>
```

- [ ] **Step 6: Run typecheck and visual check**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "fix(editor): remove fineEdit gate, fix inverted mode logic, add mode labels"
```

---

### Task 5: Add slur and articulation buttons to Notation panel

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx` (notation panel and TECHNIQUE_OPTIONS constant)

- [ ] **Step 1: Fix `TECHNIQUE_OPTIONS` — correct labels and add new entries**

Replace the existing `TECHNIQUE_OPTIONS` constant (lines 101-105):

```typescript
const TECHNIQUE_OPTIONS: Array<{ value: keyof TechniqueSet; label: string }> = [
  { value: 'accent', label: 'Accent' },
  { value: 'staccato', label: 'Staccato' },
  { value: 'tenuto', label: 'Tenuto' },
  { value: 'palmMute', label: 'Palm mute' },
  { value: 'harmonic', label: 'Harmonic' },
  { value: 'vibrato', label: 'Vibrato' },
]
```

- [ ] **Step 2: Add slur toggle to the Notation panel (alongside Tie)**

In the `case 'notation':` panel content (around line 544-566), add a Slur button right after the Tie button. Add a `toggleSlur` function next to `toggleTie`:

```typescript
  const toggleSlur = () => {
    setActiveToolGroup('notation')
    if (!track || selectedNotes.length === 0) return
    selectedNotes.forEach((note) => {
      if (!note) return
      applyCommand({ type: 'toggleSlur', trackId: track.id, noteId: note.id })
    })
  }
```

In the panel JSX, after the Tie `PanelButton`:

```tsx
              <PanelButton active={Boolean(primarySelectedNote?.techniques.slur)} onClick={toggleSlur}>
                Slur
              </PanelButton>
```

- [ ] **Step 3: Reorganize the Notation panel into two sub-sections**

Replace the notation panel content with:

```tsx
      case 'notation':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Ties & Slurs</p>
                <p className="mt-1 text-sm text-text-secondary">Connect notes with ties or slurs.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PanelButton active={Boolean(primarySelectedNote?.tieStart)} onClick={toggleTie}>
                  Tie
                </PanelButton>
                <PanelButton active={Boolean(primarySelectedNote?.techniques.slur)} onClick={toggleSlur}>
                  Slur
                </PanelButton>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Articulations</p>
                <p className="mt-1 text-sm text-text-secondary">Apply accents and articulation marks to selected notes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TECHNIQUE_OPTIONS.map((option) => (
                  <PanelButton
                    key={option.value}
                    active={Boolean(primarySelectedNote?.techniques[option.value])}
                    onClick={() => toggleTechnique(option.value)}
                  >
                    {option.label}
                  </PanelButton>
                ))}
              </div>
            </div>
          </div>
        )
```

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat(editor): add slur toggle, fix accent label, add staccato/tenuto to notation panel"
```

---

### Task 6: Redesign chord diagram controls in Structure panel

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx` (structure panel)

- [ ] **Step 1: Import `chordDiagramGlobal` and `setChordDiagramGlobal` from editor store**

Add to the store selectors block inside `EditorToolbar`:

```typescript
  const chordDiagramGlobal = useEditorStore((s) => s.chordDiagramGlobal)
  const setChordDiagramGlobal = useEditorStore((s) => s.setChordDiagramGlobal)
```

- [ ] **Step 2: Replace the chord diagram toggle with a 4-state button group**

In the `case 'structure':` panel, replace the single "Chord diagrams" `PanelButton` with:

```tsx
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-muted">Chord diagrams</p>
                  <div className="flex gap-2">
                    <PanelButton active={chordDiagramGlobal === 'hidden'} onClick={() => { setChordDiagramGlobal('hidden'); if (showChordDiagrams) toggleChordDiagrams() }}>
                      Off
                    </PanelButton>
                    <PanelButton active={chordDiagramGlobal === 'top'} onClick={() => { setChordDiagramGlobal('top'); if (!showChordDiagrams) toggleChordDiagrams() }}>
                      Top
                    </PanelButton>
                    <PanelButton active={chordDiagramGlobal === 'bottom'} onClick={() => { setChordDiagramGlobal('bottom'); if (!showChordDiagrams) toggleChordDiagrams() }}>
                      Bottom
                    </PanelButton>
                    <PanelButton active={chordDiagramGlobal === 'both'} onClick={() => { setChordDiagramGlobal('both'); if (!showChordDiagrams) toggleChordDiagrams() }}>
                      Both
                    </PanelButton>
                  </div>
                </div>
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat(editor): replace chord diagram toggle with top/bottom/both placement controls"
```

---

### Task 7: Add zoom slider and percentage input to View panel

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx` (view panel)

- [ ] **Step 1: Replace the View panel with slider + input + buttons**

Replace the `case 'view':` panel content with:

```tsx
      case 'view':
        return (
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">View</p>
                <p className="mt-1 text-sm text-text-secondary">Canvas zoom and alternate score views.</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setZoom(zoom - 10)} className="flex size-9 items-center justify-center rounded-xl border border-border text-text-primary hover:bg-surface-1">
                  <ZoomOut className="size-4" />
                </button>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label={`Zoom level ${zoom}%`}
                  className={cn(
                    'flex-1 cursor-pointer appearance-none bg-transparent',
                    '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border',
                    '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-border',
                    '[&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
                    '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent',
                  )}
                />
                <button type="button" onClick={() => setZoom(zoom + 10)} className="flex size-9 items-center justify-center rounded-xl border border-border text-text-primary hover:bg-surface-1">
                  <ZoomIn className="size-4" />
                </button>
                <input
                  type="number"
                  min={50}
                  max={200}
                  step={5}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-9 w-16 rounded-xl border border-border bg-surface-0 px-2 text-center text-sm text-text-primary outline-none focus:border-border-hover"
                  aria-label="Zoom percentage"
                />
                <span className="text-sm text-text-muted">%</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <PanelButton active={viewMode === 'tab'} onClick={() => setViewMode('tab')}>
                  Tab view
                </PanelButton>
                <PanelButton active={viewMode === 'staff'} onClick={() => setViewMode('staff')}>
                  Staff view
                </PanelButton>
                <PanelButton active={viewMode === 'split'} onClick={() => setViewMode('split')}>
                  Split view
                </PanelButton>
              </div>
            </div>
          </div>
        )
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat(editor): add zoom slider and percentage input to View panel"
```

---

### Task 8: Wire chord diagrams in StaffPreview

**Files:**
- Modify: `client/src/spaces/pack/StaffPreview.tsx`

- [ ] **Step 1: Read `showChordDiagrams` and `chordDiagramGlobal` from editor store**

Add to the existing store selectors in `StaffPreview`:

```typescript
  const showChordDiagrams = useEditorStore((state) => state.showChordDiagrams)
  const chordDiagramGlobal = useEditorStore((state) => state.chordDiagramGlobal)
```

- [ ] **Step 2: Render chord symbols above/below the OSMD container**

After the OSMD render completes (inside the `syncHighlights` function or as a separate overlay), add chord symbol text elements. Since OSMD renders to an internal DOM, the simplest approach is to overlay chord labels as absolutely-positioned HTML elements.

Add a state for chord positions after OSMD render, and render an overlay div:

```tsx
  const chordOverlays = useMemo(() => {
    if (!showChordDiagrams || chordDiagramGlobal === 'hidden') return []
    return document.measures.flatMap((measure) => {
      const symbol = measure.harmony[0]?.symbol
      if (!symbol) return []
      return [{ measureIndex: measure.index, symbol }]
    })
  }, [document.measures, showChordDiagrams, chordDiagramGlobal])
```

Below the OSMD container `<div ref={containerRef} ... />`, add:

```tsx
        {chordOverlays.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0">
            {(chordDiagramGlobal === 'top' || chordDiagramGlobal === 'both') && (
              <div className="flex gap-4 px-4 py-1">
                {chordOverlays.map((entry) => (
                  <span key={`top-${entry.measureIndex}`} className="text-xs font-semibold text-text-primary">
                    {entry.symbol}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
```

Note: Precise positioning will need refinement based on OSMD measure bounding boxes. This initial implementation provides a horizontal chord label strip above/below the staff. A follow-up task can align labels to measure positions using OSMD's `GraphicalMeasure` bounds.

- [ ] **Step 3: Wrap the OSMD container in `relative` positioning**

Ensure the parent div uses `relative` so the chord overlay can position absolutely:

```tsx
      <div className={cn('relative overflow-auto', className)}>
        <div ref={containerRef} className="min-h-[200px]" />
        {/* chord overlays here */}
      </div>
```

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/StaffPreview.tsx
git commit -m "feat(editor): render chord symbol overlays in StaffPreview based on global placement"
```

---

### Task 9: Clean up unused imports and remove `onCompare` prop

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Remove `onCompare` from `EditorToolbarProps`**

Delete `onCompare: () => void` from the interface and from the destructured props.

- [ ] **Step 2: Remove unused imports**

After all changes, verify that all lucide-react icon imports are still used. The `Square` icon for the note/rest button is still needed. Remove any icons that are no longer referenced.

- [ ] **Step 3: Run lint and typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm lint && pnpm typecheck`
Expected: Both PASS

- [ ] **Step 4: Update `EditorPage.tsx` to stop passing `onCompare` to `EditorToolbar`**

Remove the `onCompare={handleCompare}` prop from the `<EditorToolbar>` JSX in `EditorPage.tsx`.

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx client/src/spaces/pack/EditorPage.tsx
git commit -m "chore(editor): remove unused onCompare prop and clean up imports"
```

---

### Task 10: Final integration verification

- [ ] **Step 1: Run full build**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm build`
Expected: PASS

- [ ] **Step 2: Run dev server and manually verify**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm dev`

Verify in browser at `http://localhost:5173/editor`:
1. Play/Pause button works
2. Selection button always visible, opens selection panel with note/bar/section/range
3. Playback button always visible, opens playback panel
4. Note/Rest duration buttons always visible (not gated behind fineEdit)
5. Notation panel shows Tie, Slur, Accent, Staccato, Tenuto, Palm mute, Harmonic, Vibrato
6. Structure panel shows chord diagram placement: Off/Top/Bottom/Both
7. View panel has zoom slider 50%-200% with % input
8. Mode-switch shows "Play", "Edit", "Split" text labels

- [ ] **Step 3: Commit any final fixes if needed**
