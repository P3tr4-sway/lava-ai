# Editor Toolbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolve `ScoreSidebarToolbar` and merge its 11 tools into a redesigned two-row bottom `EditorToolbar` with solid minimalist styling, number badges, and a full-height mode toggle on the right.

**Architecture:** `EditorToolbar.tsx` is rewritten to render two horizontal tool rows in `fineEdit` mode (note/rhythm tools on top, structural tools on bottom), with a chevron-panel system for all tools that have sub-options, and a mode toggle that spans the full height of both rows. Row 1 tools use the existing `activeToolGroup` store; Row 2 structural tools track their active state in local component state. `ScoreSidebarToolbar.tsx` is deleted.

**Tech Stack:** React 18, TypeScript strict, Zustand (`useEditorStore`), `lucide-react` icons, Tailwind CSS with project tokens (`bg-surface-0`, `border-border`, `text-text-muted`), Vite + Vitest.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/spaces/pack/ScoreSidebarToolbar.tsx` | **Delete** | No longer needed |
| `client/src/spaces/pack/EditorCanvas.tsx` | **Modify** | Remove import + render of ScoreSidebarToolbar |
| `client/src/spaces/pack/EditorToolbar.tsx` | **Rewrite** | Two-row layout, 11 merged tools, badges, solid style |

`client/src/stores/editorStore.ts` — no changes. Row 2 tools use local component state; existing `ActiveToolGroup` values cover Row 1.

---

## Task 1: Remove ScoreSidebarToolbar from EditorCanvas

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx` (lines ~5 and ~137)
- Delete: `client/src/spaces/pack/ScoreSidebarToolbar.tsx`

- [ ] **Step 1: Remove the import from EditorCanvas.tsx**

In `client/src/spaces/pack/EditorCanvas.tsx`, delete line 5:
```tsx
// DELETE this line:
import { ScoreSidebarToolbar } from './ScoreSidebarToolbar'
```

- [ ] **Step 2: Remove the render call from EditorCanvas.tsx**

In `client/src/spaces/pack/EditorCanvas.tsx`, delete line 137:
```tsx
// DELETE this line:
<ScoreSidebarToolbar />
```

- [ ] **Step 3: Verify the file still compiles**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo
pnpm typecheck 2>&1 | head -30
```

Expected: no errors related to `ScoreSidebarToolbar`.

- [ ] **Step 4: Delete ScoreSidebarToolbar.tsx**

```bash
rm client/src/spaces/pack/ScoreSidebarToolbar.tsx
```

- [ ] **Step 5: Confirm clean compile**

```bash
pnpm typecheck 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx client/src/spaces/pack/ScoreSidebarToolbar.tsx
git commit -m "refactor(editor): remove ScoreSidebarToolbar in preparation for toolbar merge"
```

---

## Task 2: Rewrite EditorToolbar — solid style, two-row layout, spanning toggle

This task rebuilds the container structure only. The Row 1 tools stay functionally identical to today; Row 2 is populated as empty placeholders (rendered but tool buttons filled in Task 3). The goal: get the shape right and confirm it renders correctly before adding content.

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Replace the outer container and add local Row 2 state**

At the top of the `EditorToolbar` function body, after the existing store subscriptions, add local state for the Row 2 active tool:

```tsx
const [activeSidebarTool, setActiveSidebarTool] = useState<string | null>(null)

const toggleSidebarTool = (id: string) => {
  setActiveSidebarTool((prev) => (prev === id ? null : id))
  setOpenPanel(null)
}
```

- [ ] **Step 2: Expand the ToolbarPanel type**

Replace the existing `ToolbarPanel` type (around line 35):

```tsx
type ToolbarPanel =
  | 'playbackSettings'
  | 'note'
  | 'notation'
  | 'chords'
  | 'view'
  | 'accidentals'
  | 'dynamics'
  | 'keySig'
  | 'timeSig'
  | 'repeats'
  | 'barlines'
  | 'clefs'
  | 'tempo'
  | 'pitch'
  | null
```

- [ ] **Step 3: Add the `badge` prop to `ToolbarToolButton`**

Update the `ToolbarToolButton` component props interface and render:

```tsx
function ToolbarToolButton({
  icon: Icon,
  label,
  selected,
  withChevron = false,
  panelOpen,
  badge,
  onClick,
  onChevronClick,
  onHoverOpen,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  selected?: boolean
  withChevron?: boolean
  panelOpen?: boolean
  badge?: string
  onClick: () => void
  onChevronClick?: (e: ReactMouseEvent) => void
  onHoverOpen?: (e: ReactMouseEvent) => void
}) {
  return (
    <div
      data-rail-button
      onMouseEnter={(e) => onHoverOpen?.(e)}
      className={cn(
        'flex h-full items-center rounded transition-colors',
        selected ? 'bg-[#8df790]' : 'text-[#0d0d0d] hover:bg-[#f6f6f6]',
      )}
    >
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'flex h-full items-center rounded px-[3px]',
          withChevron ? 'pr-[2px]' : '',
        )}
      >
        <span className="relative flex size-[30px] items-center justify-center rounded">
          <Icon className="size-[18px] stroke-[2]" />
          {badge && !selected && (
            <span className="pointer-events-none absolute bottom-0 right-0 text-[10px] leading-none text-text-muted">
              {badge}
            </span>
          )}
        </span>
      </button>
      {withChevron && (
        <button
          type="button"
          aria-label={`${label} options`}
          onClick={(e) => {
            e.stopPropagation()
            onChevronClick?.(e)
          }}
          className="flex h-full w-3 items-center justify-center rounded-r text-[#0d0d0d]"
        >
          <ChevronDown className={cn('size-3 transition-transform', panelOpen && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Replace the main toolbar container JSX**

Replace the entire `return (...)` block of `EditorToolbar` (the outer `<>` containing the toolbar div and `PlaybackStylePickerDrawer`) with the following. This keeps the `transform` mode row unchanged and introduces the two-row layout for `fineEdit` mode.

```tsx
return (
  <>
    <div
      ref={toolbarRef}
      onMouseLeave={() => closeOpenPanel()}
      className={cn('pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2', className)}
    >
      {activePanelContent && (
        <div
          ref={panelRef}
          className="pointer-events-auto absolute bottom-full mb-3 w-auto min-w-[180px] max-w-[min(92vw,380px)] rounded-2xl border border-border bg-surface-0 p-3 shadow-sm"
          style={panelAnchor ? {
            left: `${panelAnchor.left}px`,
            transform: 'translateX(-50%)',
          } : {
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {activePanelContent}
        </div>
      )}

      <div className="pointer-events-auto overflow-hidden rounded-[12px] border border-border bg-surface-0 shadow-sm">
        {editorMode === 'transform' ? (
          /* ── Transform (playback) mode — single row, unchanged ── */
          <div className="flex items-center gap-[5px] p-2 h-[46px]">
            <ToolbarToolButton
              icon={isPlaying ? Pause : Play}
              label={isPlaying ? 'Pause playback' : 'Play score'}
              selected={isPlaying}
              onClick={handleTogglePlayback}
            />
            <ToolbarToolButton
              icon={Music2}
              label="Playback style"
              onClick={() => setStylePickerOpen(true)}
            />
            <ToolbarToolButton
              icon={SlidersHorizontal}
              label="Playback settings"
              selected={openPanel === 'playbackSettings'}
              withChevron
              panelOpen={openPanel === 'playbackSettings'}
              onClick={() => setOpenPanel((p) => p === 'playbackSettings' ? null : 'playbackSettings')}
              onHoverOpen={(e) => openPanelAt('playbackSettings', e)}
              onChevronClick={(e) => openPanelAt('playbackSettings', e)}
            />
            <ToolbarToolButton
              icon={Timer}
              label={metronomeEnabled ? 'Metronome on' : 'Metronome off'}
              selected={metronomeEnabled}
              onClick={() => toggleMetronome()}
            />
            <ToolDivider />
            <div className="flex h-[39px] items-center px-1">
              <ToolbarModeSwitch
                editMode={false}
                onToggle={() => {
                  setEditorMode('fineEdit')
                  closeOpenPanel()
                }}
              />
            </div>
          </div>
        ) : (
          /* ── fineEdit mode — two rows + spanning toggle ── */
          <div className="flex">
            {/* Left: two rows */}
            <div className="flex flex-col">
              {/* Row 1 — note/rhythm tools */}
              <div className="flex h-[46px] items-center gap-[5px] p-2">
                {/* populated in Task 3 step 1 */}
              </div>
              {/* Row 2 — structural tools */}
              <div className="flex h-[46px] items-center gap-[5px] border-t border-border p-2">
                {/* populated in Task 3 step 2 */}
              </div>
            </div>
            {/* Right: mode toggle spanning both rows */}
            <div className="flex items-center justify-center border-l border-border px-3">
              <ToolbarModeSwitch
                editMode={true}
                onToggle={() => {
                  setEditorMode('transform')
                  setActiveSidebarTool(null)
                  closeOpenPanel()
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>

    <PlaybackStylePickerDrawer
      open={stylePickerOpen}
      onClose={() => setStylePickerOpen(false)}
      options={PLAYBACK_STYLE_OPTIONS}
      selectedPlaybackStyleId={playbackStyleId}
      onSelectPlaybackStyle={setPlaybackStyleId}
    />
  </>
)
```

- [ ] **Step 5: Update `activePanelContent` guard for fineEdit**

The existing guard (near line 687) checks `editorMode === 'fineEdit' && openPanel === 'playbackSettings'`. No changes needed — the new panel IDs are all different from `'playbackSettings'`.

- [ ] **Step 6: Verify compile and basic render**

```bash
pnpm typecheck 2>&1 | head -30
```

Expected: no TypeScript errors. The toolbar should render an empty two-row box in fineEdit mode (rows are there, tools populated in Task 3).

- [ ] **Step 7: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "refactor(toolbar): two-row solid layout with spanning mode toggle"
```

---

## Task 3: Populate Row 1 and Row 2 tools with panels

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

### Step 1: Fill Row 1 (note/rhythm tools)

- [ ] Replace the `{/* populated in Task 3 step 1 */}` comment inside the Row 1 div:

```tsx
<ToolbarToolButton
  icon={MousePointer2}
  label="Selection"
  badge="1"
  selected={activeToolGroup === 'selection'}
  onClick={() => {
    setActiveToolGroup('selection')
    setToolMode('pointer')
    setCaret(null)
    setOpenPanel(null)
  }}
/>
<ToolbarToolButton
  icon={Music}
  label="Notes & rests"
  badge="2"
  selected={activeToolGroup === 'note' || activeToolGroup === 'rest'}
  withChevron
  panelOpen={openPanel === 'note'}
  onClick={() => {
    setActiveToolGroup('note')
    setOpenPanel(null)
  }}
  onHoverOpen={(e) => openPanelAt('note', e)}
  onChevronClick={(e) => openPanelAt('note', e)}
/>
<ToolbarToolButton
  icon={Hash}
  label="Accidentals"
  badge="3"
  selected={openPanel === 'accidentals'}
  withChevron
  panelOpen={openPanel === 'accidentals'}
  onClick={() => setOpenPanel((p) => p === 'accidentals' ? null : 'accidentals')}
  onHoverOpen={(e) => openPanelAt('accidentals', e)}
  onChevronClick={(e) => openPanelAt('accidentals', e)}
/>
<ToolbarToolButton
  icon={Spline}
  label="Ties, slurs & articulations"
  badge="4"
  selected={activeToolGroup === 'notation'}
  withChevron
  panelOpen={openPanel === 'notation'}
  onClick={() => {
    setActiveToolGroup('notation')
    setOpenPanel(null)
  }}
  onHoverOpen={(e) => openPanelAt('notation', e)}
  onChevronClick={(e) => openPanelAt('notation', e)}
/>
<ToolbarToolButton
  icon={WholeWord}
  label="Dynamics"
  badge="5"
  selected={openPanel === 'dynamics'}
  withChevron
  panelOpen={openPanel === 'dynamics'}
  onClick={() => setOpenPanel((p) => p === 'dynamics' ? null : 'dynamics')}
  onHoverOpen={(e) => openPanelAt('dynamics', e)}
  onChevronClick={(e) => openPanelAt('dynamics', e)}
/>
<ToolbarToolButton
  icon={Type}
  label="Text"
  badge="6"
  selected={activeToolGroup === 'notation' && openPanel === null}
  onClick={() => {
    setToolMode('text')
    setOpenPanel(null)
  }}
/>
```

### Step 2: Fill Row 2 (structural tools)

- [ ] Replace the `{/* populated in Task 3 step 2 */}` comment inside the Row 2 div:

```tsx
<ToolbarToolButton
  icon={KeyRound}
  label="Key signatures"
  badge="7"
  selected={activeSidebarTool === 'keySig'}
  withChevron
  panelOpen={openPanel === 'keySig'}
  onClick={() => {
    toggleSidebarTool('keySig')
    setToolMode('keySig')
  }}
  onHoverOpen={(e) => openPanelAt('keySig', e)}
  onChevronClick={(e) => openPanelAt('keySig', e)}
/>
<ToolbarToolButton
  icon={Clock3}
  label="Time signatures"
  badge="8"
  selected={activeSidebarTool === 'timeSig'}
  withChevron
  panelOpen={openPanel === 'timeSig'}
  onClick={() => toggleSidebarTool('timeSig')}
  onHoverOpen={(e) => openPanelAt('timeSig', e)}
  onChevronClick={(e) => openPanelAt('timeSig', e)}
/>
<ToolbarToolButton
  icon={Repeat2}
  label="Repeats & jumps"
  badge="9"
  selected={activeSidebarTool === 'repeats'}
  withChevron
  panelOpen={openPanel === 'repeats'}
  onClick={() => toggleSidebarTool('repeats')}
  onHoverOpen={(e) => openPanelAt('repeats', e)}
  onChevronClick={(e) => openPanelAt('repeats', e)}
/>
<ToolbarToolButton
  icon={Columns2}
  label="Barlines"
  badge="0"
  selected={activeSidebarTool === 'barlines'}
  withChevron
  panelOpen={openPanel === 'barlines'}
  onClick={() => toggleSidebarTool('barlines')}
  onHoverOpen={(e) => openPanelAt('barlines', e)}
  onChevronClick={(e) => openPanelAt('barlines', e)}
/>
<ToolbarToolButton
  icon={Music2}
  label="Clefs"
  selected={activeSidebarTool === 'clefs'}
  withChevron
  panelOpen={openPanel === 'clefs'}
  onClick={() => toggleSidebarTool('clefs')}
  onHoverOpen={(e) => openPanelAt('clefs', e)}
  onChevronClick={(e) => openPanelAt('clefs', e)}
/>
<ToolbarToolButton
  icon={SlidersVertical}
  label="Tempo"
  selected={activeSidebarTool === 'tempo'}
  withChevron
  panelOpen={openPanel === 'tempo'}
  onClick={() => toggleSidebarTool('tempo')}
  onHoverOpen={(e) => openPanelAt('tempo', e)}
  onChevronClick={(e) => openPanelAt('tempo', e)}
/>
<ToolbarToolButton
  icon={AudioLines}
  label="Pitch"
  selected={activeSidebarTool === 'pitch'}
  withChevron
  panelOpen={openPanel === 'pitch'}
  onClick={() => toggleSidebarTool('pitch')}
  onHoverOpen={(e) => openPanelAt('pitch', e)}
  onChevronClick={(e) => openPanelAt('pitch', e)}
/>
<ToolbarToolButton
  icon={PenTool}
  label="Chord diagrams"
  selected={showChordDiagrams}
  withChevron
  panelOpen={openPanel === 'chords'}
  onClick={() => {
    toggleChordDiagrams()
    setOpenPanel(null)
  }}
  onHoverOpen={(e) => openPanelAt('chords', e)}
  onChevronClick={(e) => openPanelAt('chords', e)}
/>
<ToolbarToolButton
  icon={ZoomIn}
  label="Zoom"
  selected={openPanel === 'view'}
  onClick={() => setOpenPanel((p) => p === 'view' ? null : 'view')}
  onHoverOpen={(e) => openPanelAt('view', e)}
/>
<ToolbarToolButton
  icon={Circle}
  label="Playback style"
  onClick={() => setStylePickerOpen(true)}
/>
```

### Step 3: Add new panel content cases to `panelContent`

- [ ] Add the following cases to the `panelContent` switch statement (after the existing `case 'view':` block, before `default:`):

```tsx
case 'accidentals':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Accidentals</p>
      <div className="flex flex-col gap-1">
        {[
          { value: 'sharp', label: 'Sharp' },
          { value: 'flat', label: 'Flat' },
          { value: 'natural', label: 'Natural' },
          { value: 'courtesy', label: 'Courtesy accidental' },
        ].map((opt) => (
          <PanelButton key={opt.value} active={false} onClick={() => window.dispatchEvent(new CustomEvent('lava-accidental', { detail: { type: opt.value } }))}>
            {opt.label}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'dynamics':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Dynamics</p>
      <div className="flex gap-1">
        {['pp', 'p', 'mf', 'f', 'ff'].map((dyn) => (
          <PanelButton key={dyn} active={false} onClick={() => window.dispatchEvent(new CustomEvent('lava-dynamic', { detail: { value: dyn } }))}>
            {dyn}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'keySig':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Key signatures</p>
      <div className="flex flex-col gap-1">
        {['C major', 'G major', 'D major', 'F major', 'Bb major', 'A minor', 'E minor', 'D minor'].map((key) => (
          <PanelButton key={key} active={false} onClick={() => {
            setActiveSidebarTool('keySig')
            closeOpenPanel()
          }}>
            {key}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'timeSig':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Time signatures</p>
      <div className="flex flex-wrap gap-1">
        {['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '5/4', '7/8'].map((sig) => (
          <PanelButton key={sig} active={false} onClick={() => {
            setActiveSidebarTool('timeSig')
            closeOpenPanel()
          }}>
            {sig}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'repeats':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Repeats & jumps</p>
      <div className="flex flex-col gap-1">
        {['Repeat start', 'Repeat end', 'D.C. al Fine', 'D.S. al Coda', 'Segno', 'Fine', 'Coda'].map((opt) => (
          <PanelButton key={opt} active={false} onClick={() => {
            setActiveSidebarTool('repeats')
            closeOpenPanel()
          }}>
            {opt}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'barlines':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Barlines</p>
      <div className="flex flex-col gap-1">
        {['Single', 'Double', 'Final', 'Dashed', 'Dotted'].map((opt) => (
          <PanelButton key={opt} active={false} onClick={() => {
            setActiveSidebarTool('barlines')
            closeOpenPanel()
          }}>
            {opt}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'clefs':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Clefs</p>
      <div className="flex flex-col gap-1">
        {['Treble', 'Bass', 'Alto', 'Tenor'].map((opt) => (
          <PanelButton key={opt} active={false} onClick={() => {
            setActiveSidebarTool('clefs')
            closeOpenPanel()
          }}>
            {opt}
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'tempo':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Tempo</p>
      <div className="flex flex-col gap-1">
        {[
          { label: 'Largo', bpm: '40–60' },
          { label: 'Andante', bpm: '76–108' },
          { label: 'Moderato', bpm: '108–120' },
          { label: 'Allegro', bpm: '120–168' },
          { label: 'Presto', bpm: '168–200' },
        ].map((opt) => (
          <PanelButton key={opt.label} active={false} onClick={() => {
            setActiveSidebarTool('tempo')
            closeOpenPanel()
          }}>
            {opt.label} <span className="text-text-muted">{opt.bpm}</span>
          </PanelButton>
        ))}
      </div>
    </div>
  )
case 'pitch':
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Pitch</p>
      <div className="flex flex-col gap-1">
        {['Concert pitch', 'Octave up', 'Octave down', 'Chromatic'].map((opt) => (
          <PanelButton key={opt} active={false} onClick={() => {
            setActiveSidebarTool('pitch')
            closeOpenPanel()
          }}>
            {opt}
          </PanelButton>
        ))}
      </div>
    </div>
  )
```

### Step 4: Add missing lucide imports

- [ ] At the top of `EditorToolbar.tsx`, add any newly used icons to the import from `lucide-react`. The full import should include:

```tsx
import {
  AudioLines,
  ChevronDown,
  Circle,
  Clock3,
  Columns2,
  Guitar,
  Hash,
  KeyRound,
  MousePointer2,
  Music,
  Music2,
  Pause,
  PenTool,
  PencilLine,
  Play,
  Repeat2,
  SlidersHorizontal,
  SlidersVertical,
  Spline,
  Timer,
  Type,
  WholeWord,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
```

### Step 5: Verify compile

- [ ] **Run typecheck**

```bash
pnpm typecheck 2>&1 | head -40
```

Expected: no TypeScript errors.

- [ ] **Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat(toolbar): merge 11 sidebar tools into two-row bottom toolbar with panels"
```

---

## Task 4: Reset activeSidebarTool when leaving fineEdit mode

When switching from `fineEdit` → `transform`, the local `activeSidebarTool` should clear (already handled in Task 2 Step 4 where `setActiveSidebarTool(null)` is called in the toggle's `onToggle`). This task verifies the cleanup also happens when the store's `editorMode` changes externally (e.g., from a keyboard shortcut or another component).

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Add a useEffect to sync activeSidebarTool with editorMode**

Inside the `EditorToolbar` function body, add after the existing `useEffect` blocks:

```tsx
useEffect(() => {
  if (editorMode !== 'fineEdit') {
    setActiveSidebarTool(null)
    setOpenPanel(null)
  }
}, [editorMode])
```

- [ ] **Step 2: Verify compile**

```bash
pnpm typecheck 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Final commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "fix(toolbar): clear sidebar tool selection when leaving fineEdit mode"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ ScoreSidebarToolbar removed (Task 1)
  - ✅ 11 tools merged (Keyboard + Layout dropped, remaining 11 in Tasks 3)
  - ✅ Two-row layout (Task 2)
  - ✅ Solid style, no backdrop-blur (Task 2 — `bg-surface-0`, `shadow-sm`, no `/96` or `backdrop-blur`)
  - ✅ Mode toggle spanning both rows (Task 2)
  - ✅ Number badges 1-0, hidden when active (Task 2 `ToolbarToolButton` + Task 3 `badge=` props)
  - ✅ Chevron panels for all new tools (Task 3)
  - ✅ Transform mode unchanged (Task 2)
  - ✅ No keyboard shortcut wiring (deferred per spec)

- **No placeholders:** All panel option lists are concrete. PanelButton `onClick` stubs dispatch custom events or update local state — ready for future engine wiring.

- **Type consistency:** `ToolbarPanel` expanded in Task 2; all new `openPanelAt('keySig', e)` etc. calls use the exact string IDs defined in the type.

- **Icon note:** `Guitar` is imported but no longer used in the merged design (Chord diagrams uses `PenTool`). Remove `Guitar` from the import list in Task 3 Step 4 if it causes an unused-import lint warning.
