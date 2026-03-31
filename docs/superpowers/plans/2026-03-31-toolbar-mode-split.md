# Editor Toolbar Mode-Aware Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign EditorToolbar so that the rail buttons change based on Play/Edit mode — Play mode shows practice-focused controls, Edit mode shows editing controls — and remove Split mode entirely.

**Architecture:** The toolbar rail conditionally renders different `RailButton` sets based on `editorMode`. Play mode shows: Style (opens drawer), Playback Settings (panel with instrument/speed/count-in), and Metronome toggle. Edit mode shows: Selection, Notes, Rests (separate panels), Notation, Chords, and Zoom. The mode switcher becomes a 2-button segment (Play/Edit). `EditorCanvas` drops the split view layout. The `onAddBar`/`onDeleteBars`/`onStylePicker` props are removed from the toolbar (bar operations remain on keyboard shortcuts).

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, lucide-react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/spaces/pack/EditorToolbar.tsx` | Major refactor | Mode-aware rail buttons, new panel types, split Notes/Rests panels, extract Chords panel |
| `client/src/spaces/pack/EditorCanvas.tsx` | Modify (small) | Remove split view rendering |
| `client/src/spaces/pack/EditorPage.tsx` | Modify (small) | Remove unused toolbar props |

---

### Task 1: Remove Split mode from mode switcher and EditorCanvas

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx:790-809` (mode switcher)
- Modify: `client/src/spaces/pack/EditorToolbar.tsx:705-715` (view panel split button)
- Modify: `client/src/spaces/pack/EditorCanvas.tsx:19-24` (split rendering)

- [ ] **Step 1: Remove Split MiniSegmentButton from mode switcher**

In `EditorToolbar.tsx`, replace lines 790-809 (the mode switcher `<div>`) with a 2-button segment:

```tsx
          <div className="flex items-center rounded-[22px] bg-surface-2 p-1">
            <MiniSegmentButton label="Play mode" active={editorMode === 'transform'} onClick={() => {
              setEditorMode('transform')
              setOpenPanel(null)
            }}>
              <Music2 className="size-4" />
              <span className="ml-1 text-[11px]">Play</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Edit mode" active={editorMode === 'fineEdit'} onClick={() => {
              setEditorMode('fineEdit')
              setOpenPanel(null)
            }}>
              <MousePointer2 className="size-4" />
              <span className="ml-1 text-[11px]">Edit</span>
            </MiniSegmentButton>
          </div>
```

Key changes vs current:
- Remove the third `MiniSegmentButton` for Split
- Add `setOpenPanel(null)` on mode switch so a stale panel from the other mode doesn't persist

- [ ] **Step 2: Remove split view PanelButton from View panel**

In the `case 'view':` panel content (around line 712), remove:

```tsx
                <PanelButton active={viewMode === 'split'} onClick={() => setViewMode('split')}>
                  Split view
                </PanelButton>
```

Keep only Tab view and Staff view buttons.

- [ ] **Step 3: Remove split rendering from EditorCanvas**

In `EditorCanvas.tsx`, remove lines 19-24:

```tsx
      {viewMode === 'split' && (
        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <StaffPreview className="min-h-0" />
          <PracticeSurface className="min-h-0" compact />
        </div>
      )}
```

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS — `'split'` remains in the `ViewMode` type union but is simply unused in UI.

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat(editor): remove Split mode from mode switcher and canvas"
```

---

### Task 2: Rewrite EditorToolbar with mode-aware rail and panels

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx` (imports, types, props, panels, rail JSX)
- Modify: `client/src/spaces/pack/EditorPage.tsx:435-442` (remove unused props)

This task rewrites the toolbar so Play mode and Edit mode show different rail buttons and panels.

**Play mode rail:**
```
[▶ Play/Pause] | [♫ Style] [⚙ Settings▼] [🕐 Metronome] | [Play•][Edit]
```
- Style: opens PlaybackStylePickerDrawer directly (no panel)
- Settings: opens panel with style picker button, position slider, instrument, speed, count-in
- Metronome: direct toggle on rail (highlighted when on)

**Edit mode rail:**
```
[▶ Play/Pause] | [↖ Select▼] [♩ Notes▼] [⏹ Rests▼] [🔗 Notation▼] [⊞ Chords▼] [🔍 Zoom▼] | [Play][Edit•]
```
- Each button opens its own panel on click

- [ ] **Step 1: Update imports — add `Music`, `SlidersHorizontal`, `Timer`**

Replace lines 1-13 of `EditorToolbar.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
  ChevronDown,
  Grid2x2,
  Link2,
  MousePointer2,
  Music,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Square,
  Timer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
```

Changes: add `Music`, `SlidersHorizontal`, `Timer`. Remove nothing (all existing icons are still used).

- [ ] **Step 2: Update `ToolbarPanel` type**

Replace the `ToolbarPanel` type (line 31):

```typescript
type ToolbarPanel =
  | 'playbackSettings'
  | 'selection'
  | 'note'
  | 'rest'
  | 'notation'
  | 'chords'
  | 'view'
  | null
```

Changes vs current: remove `'playback'` (renamed to `'playbackSettings'`), remove `'structure'` (split into `'chords'`; add/delete bars dropped from toolbar), add `'rest'` (split from combined `'note'` panel), add `'chords'`.

- [ ] **Step 3: Remove `onAddBar`, `onDeleteBars`, `onStylePicker` from props**

Replace the `EditorToolbarProps` interface (lines 22-29):

```typescript
interface EditorToolbarProps {
  totalBars?: number
  beatsPerBar?: number
  className?: string
}
```

Update the destructured props in the function signature (line 249-256):

```tsx
export function EditorToolbar({
  totalBars = 16,
  beatsPerBar = 4,
  className,
}: EditorToolbarProps) {
```

- [ ] **Step 4: Replace the `panelContent` switch statement**

Replace the entire `panelContent` variable (lines 428-721) with the new mode-specific panels:

```tsx
  const panelContent = (() => {
    switch (openPanel) {
      case 'playbackSettings':
        return (
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Playback</p>
                <p className="mt-1 text-sm text-text-secondary">Style, instrument, and timing controls for practice mode.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-between rounded-xl bg-surface-0"
                onClick={() => setStylePickerOpen(true)}
              >
                {selectedPlaybackStyle.label}
                <ChevronDown className="size-4 text-text-muted" />
              </Button>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Position</span>
                  <span>Bar {displayBar}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={1}
                  value={sliderValue}
                  onChange={(event) => locateToBar((Number(event.target.value) / 1000) * safeTotalBars)}
                  aria-label={`Playback position — bar ${displayBar} of ${safeTotalBars}`}
                  className={cn(
                    'block w-full cursor-pointer appearance-none bg-transparent',
                    '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border',
                    '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-border',
                    '[&::-webkit-slider-thumb]:-mt-[6px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
                    '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent',
                  )}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PanelSelect
                label="Instrument"
                value={playbackInstrument}
                onChange={setPlaybackInstrument}
                options={PLAYBACK_INSTRUMENT_OPTIONS}
              />
              <PanelSelect
                label="Speed"
                value={String(playbackRate)}
                onChange={(value) => setPlaybackRate(Number(value))}
                options={PLAYBACK_RATE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
              />
              <PanelSelect
                label="Count-in"
                value={String(countInBars)}
                onChange={(value) => setCountInBars(Number(value))}
                options={COUNT_IN_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))}
              />
              <div className="flex flex-col justify-end gap-2 rounded-2xl border border-border bg-surface-0 p-3">
                <p className="text-xs font-medium text-text-secondary">Metronome</p>
                <PanelButton active={metronomeEnabled} onClick={() => toggleMetronome()}>
                  {metronomeEnabled ? 'On' : 'Off'}
                </PanelButton>
              </div>
            </div>
          </div>
        )
      case 'selection':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Selection tool</p>
              <p className="mt-1 text-sm text-text-secondary">Switch between note, bar, section and range targeting.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SELECTION_SCOPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <PanelButton key={value} active={selectionScope === value} onClick={() => handleScopeChange(value)}>
                  {Icon && <span className="mr-1 inline-flex"><Icon className="size-4" /></span>}
                  {label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'note':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Notes</p>
              <p className="mt-1 text-sm text-text-secondary">Choose the active note value for direct entry or selected notes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((option) => (
                <PanelButton
                  key={`note-${option.value}`}
                  active={(primarySelectedNote?.durationType === option.value && !primarySelectedNote?.isRest) || (entryMode === 'note' && entryDuration === option.value)}
                  onClick={() => applyDurationToSelection(option.value, false)}
                >
                  {option.label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
      case 'rest':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Rests</p>
              <p className="mt-1 text-sm text-text-secondary">Choose the active rest duration.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((option) => (
                <PanelButton
                  key={`rest-${option.value}`}
                  active={(primarySelectedNote?.durationType === option.value && Boolean(primarySelectedNote?.isRest)) || (entryMode === 'rest' && entryDuration === option.value)}
                  onClick={() => applyDurationToSelection(option.value, true)}
                >
                  {option.label}
                </PanelButton>
              ))}
            </div>
          </div>
        )
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
                <PanelButton active={Boolean(primarySelectedNote?.slurStart)} onClick={toggleSlur}>
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
      case 'chords':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Chord diagrams</p>
              <p className="mt-1 text-sm text-text-secondary">Toggle chord diagram overlays above or below the score.</p>
            </div>
            <div className="flex flex-wrap gap-2">
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
        )
      case 'view':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Zoom</p>
              <p className="mt-1 text-sm text-text-secondary">Canvas zoom level.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom(zoom - 10)}
                className="flex size-9 items-center justify-center rounded-xl border border-border text-text-primary hover:bg-surface-1"
                aria-label="Zoom out"
              >
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
              <button
                type="button"
                onClick={() => setZoom(zoom + 10)}
                className="flex size-9 items-center justify-center rounded-xl border border-border text-text-primary hover:bg-surface-1"
                aria-label="Zoom in"
              >
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
            </div>
          </div>
        )
      default:
        return null
    }
  })()
```

Key changes:
- `'playback'` → `'playbackSettings'` (same content, renamed)
- `'note'` now shows notes only (rests removed)
- `'rest'` is new (shows rest durations only)
- `'structure'` removed; chord diagram controls extracted to `'chords'`
- `'view'` panel: Split view button removed, only Tab + Staff remain

- [ ] **Step 5: Replace the rail buttons with mode-conditional rendering**

Replace the rail buttons section (lines 732-809 inside the `<div className="pointer-events-auto flex items-center ...">`) with:

```tsx
        <div className="pointer-events-auto flex items-center gap-2 rounded-[32px] border border-border bg-surface-0/96 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop-blur">
          {/* Play/Pause — always visible */}
          <RailButton
            icon={isPlaying ? Pause : Play}
            label={isPlaying ? 'Pause playback' : 'Play score'}
            highlighted={isPlaying}
            onClick={handleTogglePlayback}
          />

          <ToolDivider />

          {editorMode === 'transform' ? (
            <>
              {/* ── Play mode rail ── */}
              <RailButton
                icon={Music2}
                label="Playback style"
                onClick={() => setStylePickerOpen(true)}
              />
              <RailButton
                icon={SlidersHorizontal}
                label="Playback settings"
                active={openPanel === 'playbackSettings'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'playbackSettings' ? null : 'playbackSettings')}
              />
              <RailButton
                icon={Timer}
                label={metronomeEnabled ? 'Metronome on' : 'Metronome off'}
                highlighted={metronomeEnabled}
                onClick={() => toggleMetronome()}
              />
            </>
          ) : (
            <>
              {/* ── Edit mode rail ── */}
              <RailButton
                icon={MousePointer2}
                label="Selection tools"
                active={openPanel === 'selection'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'selection' ? null : 'selection')}
              />
              <RailButton
                icon={Music}
                label="Note durations"
                active={openPanel === 'note'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'note' ? null : 'note')}
              />
              <RailButton
                icon={Square}
                label="Rest durations"
                active={openPanel === 'rest'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'rest' ? null : 'rest')}
              />
              <RailButton
                icon={Link2}
                label="Ties, slurs & articulations"
                active={openPanel === 'notation'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'notation' ? null : 'notation')}
              />
              <RailButton
                icon={Grid2x2}
                label="Chord diagrams"
                active={openPanel === 'chords'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'chords' ? null : 'chords')}
              />
              <RailButton
                icon={ZoomIn}
                label="Zoom"
                active={openPanel === 'view'}
                withChevron
                onClick={() => setOpenPanel((p) => p === 'view' ? null : 'view')}
              />
            </>
          )}

          <ToolDivider />

          {/* Mode switcher — always visible */}
          <div className="flex items-center rounded-[22px] bg-surface-2 p-1">
            <MiniSegmentButton label="Play mode" active={editorMode === 'transform'} onClick={() => {
              setEditorMode('transform')
              setOpenPanel(null)
            }}>
              <Music2 className="size-4" />
              <span className="ml-1 text-[11px]">Play</span>
            </MiniSegmentButton>
            <MiniSegmentButton label="Edit mode" active={editorMode === 'fineEdit'} onClick={() => {
              setEditorMode('fineEdit')
              setOpenPanel(null)
            }}>
              <MousePointer2 className="size-4" />
              <span className="ml-1 text-[11px]">Edit</span>
            </MiniSegmentButton>
          </div>
        </div>
```

Play mode rail overview:
- **Style** (`Music2` icon): opens `PlaybackStylePickerDrawer` directly — no panel flyout
- **Settings** (`SlidersHorizontal` icon, chevron): opens `'playbackSettings'` panel with instrument, speed, count-in, position slider, metronome
- **Metronome** (`Timer` icon): direct toggle, `highlighted={metronomeEnabled}`

Edit mode rail overview:
- **Select** (`MousePointer2`): scope panel (note/bar/section/range)
- **Notes** (`Music`): note duration panel
- **Rests** (`Square`): rest duration panel
- **Notation** (`Link2`): tie/slur + articulations panel
- **Chords** (`Grid2x2`): chord diagram placement panel
- **Zoom** (`ZoomIn`): zoom slider + percentage + tab/staff view

- [ ] **Step 6: Update EditorPage.tsx — remove unused toolbar props**

In `EditorPage.tsx`, replace lines 435-442:

```tsx
          <EditorToolbar
            totalBars={totalBars}
            beatsPerBar={beatsPerBar}
            className="z-10"
          />
```

Remove `onAddBar={handleAddBar}`, `onDeleteBars={handleDeleteBars}`, `onStylePicker={handleStylePicker}`. The `handleAddBar` and `handleDeleteBars` functions in EditorPage are still used by keyboard shortcuts — only the toolbar props are removed.

- [ ] **Step 7: Run typecheck**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx client/src/spaces/pack/EditorPage.tsx
git commit -m "feat(editor): mode-aware toolbar — Play shows practice controls, Edit shows editing controls"
```

---

### Task 3: Final verification

- [ ] **Step 1: Run full build**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm build`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm lint`
Expected: PASS — no unused imports or variables.

- [ ] **Step 3: Visual verification in browser**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm dev`

Verify at `http://localhost:5173/editor`:

**Play mode (default):**
1. Mode switcher shows only "Play" and "Edit" — no "Split"
2. Rail shows: Play/Pause | Style, Settings▼, Metronome | [Play• Edit]
3. Style button opens PlaybackStylePickerDrawer (bottom sheet)
4. Settings button opens panel: style picker button, position slider, instrument, speed, count-in, metronome toggle
5. Metronome button toggles directly (highlighted when on)
6. No editing tools visible (no selection, notes, rests, notation, chords, zoom)

**Edit mode (click "Edit" in mode switcher):**
1. Rail shows: Play/Pause | Select▼, Notes▼, Rests▼, Notation▼, Chords▼, Zoom▼ | [Play Edit•]
2. Select panel: note/bar/section/range scope buttons
3. Notes panel: 1, 1/2, 1/4, 1/8, 1/16 duration buttons (notes only)
4. Rests panel: 1, 1/2, 1/4, 1/8, 1/16 duration buttons (rests only)
5. Notation panel: Tie + Slur in left column, Articulations (Accent, Staccato, Tenuto, Palm mute, Harmonic, Vibrato) in right column
6. Chords panel: Off / Top / Bottom / Both placement buttons
7. Zoom panel: zoom slider 50-200%, ±10 buttons, percentage input, Tab view / Staff view buttons
8. No playback settings visible (no style, instrument, speed, count-in)

**Mode switching:**
9. Switching from Edit→Play closes any open Edit panel
10. Switching from Play→Edit closes any open Play panel
11. Play/Pause button works in both modes

- [ ] **Step 4: Commit any final fixes if needed**
