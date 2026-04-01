# Editor Two-Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the editor into Transform Mode (default, AI chat-driven) and Fine Edit Mode (current notation tools), with a version system, restructured toolbar, and goal-based chat suggestions.

**Architecture:** Single component tree with `editorMode` as a UI filter — both modes share `EditorCanvas`, `EditorPage`, and stores. A new `useVersionStore` manages version snapshots (tier 1 from arrangements, tier 2 from AI). The toolbar conditionally renders controls per mode. The chat empty state swaps suggestions based on bar selection.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, OSMD, Fastify, lucide-react

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `packages/shared/src/types/version.ts` | `Version` interface and `VersionSource` type |
| `client/src/stores/versionStore.ts` | `useVersionStore` — versions list, active/preview IDs, CRUD actions |
| `client/src/spaces/pack/VersionPicker.tsx` | Toolbar dropdown for switching versions |
| `client/src/spaces/pack/PreviewBar.tsx` | Floating action bar during version preview |
| `client/src/spaces/pack/CompareView.tsx` | Side-by-side OSMD canvas for comparing versions |
| `server/src/agent/tools/definitions/version.tool.ts` | `create_version` tool definition |

### Modified files

| File | Changes |
|---|---|
| `packages/shared/src/types/index.ts` | Add `version.ts` re-export |
| `packages/shared/src/types/agent.ts` | Add `'versionCreated'` to `subtype` union, add `versionAction` field |
| `client/src/stores/editorStore.ts` | Add `editorMode`, `setEditorMode` |
| `client/src/spaces/pack/EditorCanvas.tsx` | Gate editing on mode, fix chord/annotation/keySig TODOs |
| `client/src/spaces/pack/EditorToolbar.tsx` | Conditional sections per mode, mode switch, version picker slot |
| `client/src/spaces/pack/EditorChatEmptyState.tsx` | Two suggestion sets (global vs. section-focused) |
| `client/src/spaces/pack/EditorChatPanel.tsx` | Pass `selectedBars` to empty state, wire version card actions |
| `client/src/spaces/pack/EditorPage.tsx` | Wire preview bar, compare view, derive playback duration |
| `client/src/components/agent/ChatMessage.tsx` | Render `versionCreated` subtype cards |
| `server/src/agent/tools/definitions/index.ts` | Add `createVersionTool` to `ALL_TOOLS` |
| `server/src/agent/tools/index.ts` | Add `create_version` handler |
| `server/src/agent/prompts/context.ts` | Add editor/transform context rules |

---

## Task 1: Core Fix — Chord Application

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx:172-178`

- [ ] **Step 1: Implement `handleChordSelect`**

Replace the TODO in `handleChordSelect` with the engine call:

```tsx
const handleChordSelect = useCallback(
  (chord: { root: string; quality: string }) => {
    const xml = getXml()
    if (!xml || !popover) return
    const { pushUndo } = useEditorStore.getState()
    const chordSymbol = chord.quality ? `${chord.root}${chord.quality}` : chord.root
    try {
      const newXml = setChord(xml, popover.barIndex, 0, chordSymbol)
      pushUndo(xml)
      saveXml(newXml)
      syncHighlights()
    } catch (err) {
      console.error('[handleChordSelect]', err)
    }
    setPopover(null)
  },
  [popover, syncHighlights],
)
```

Add `setChord` to the import from `@/lib/musicXmlEngine` (it's not currently imported):

```tsx
import {
  clearBars, copyBars, pasteBars, duplicateBars, transposeBars,
  setNotePitch, setNoteDuration, addAccidental, toggleTie, toggleRest,
  setLyric, setAnnotation, setChord, parseXml, getMeasures,
} from '@/lib/musicXmlEngine'
```

- [ ] **Step 2: Verify chord application works**

Run: `pnpm typecheck`
Expected: PASS — no type errors

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "fix: wire chord application to MusicXML engine in EditorCanvas"
```

---

## Task 2: Core Fix — Annotation Attachment

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx:190-196`

- [ ] **Step 1: Implement `handleTextSubmit`**

Replace the TODO:

```tsx
const handleTextSubmit = useCallback(
  (text: string) => {
    const xml = getXml()
    if (!xml || !popover) return
    const { pushUndo } = useEditorStore.getState()
    try {
      const newXml = setAnnotation(xml, popover.barIndex, text)
      pushUndo(xml)
      saveXml(newXml)
      syncHighlights()
    } catch (err) {
      console.error('[handleTextSubmit]', err)
    }
    setPopover(null)
  },
  [popover, syncHighlights],
)
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "fix: wire annotation attachment to MusicXML engine in EditorCanvas"
```

---

## Task 3: Core Fix — Key/Time Signature via MusicXML Engine

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx:180-188`

- [ ] **Step 1: Import `setKeySig` and `setTimeSig`**

Add to the musicXmlEngine import:

```tsx
import {
  clearBars, copyBars, pasteBars, duplicateBars, transposeBars,
  setNotePitch, setNoteDuration, addAccidental, toggleTie, toggleRest,
  setLyric, setAnnotation, setChord, setKeySig, setTimeSig,
  parseXml, getMeasures,
} from '@/lib/musicXmlEngine'
```

- [ ] **Step 2: Implement `handleKeySigSelect` with engine calls**

Replace the current handler:

```tsx
const handleKeySigSelect = useCallback(
  (keySig: { key: string; mode: 'major' | 'minor'; timeSig: string }) => {
    const xml = getXml()
    if (!xml || !popover) return
    const { pushUndo } = useEditorStore.getState()
    try {
      let newXml = setKeySig(xml, popover.barIndex, keySig.key)
      const [beats, beatType] = keySig.timeSig.split('/').map(Number)
      if (beats && beatType) {
        newXml = setTimeSig(newXml, popover.barIndex, beats, beatType)
      }
      pushUndo(xml)
      saveXml(newXml)
      syncHighlights()
    } catch (err) {
      console.error('[handleKeySigSelect]', err)
    }
    useLeadSheetStore.getState().setKey(keySig.key)
    useLeadSheetStore.getState().setTimeSignature(keySig.timeSig)
    setPopover(null)
  },
  [popover, syncHighlights],
)
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "fix: apply key/time signature changes via MusicXML engine"
```

---

## Task 4: Core Fix — Playback Duration from Score

**Files:**
- Modify: `client/src/spaces/pack/EditorPage.tsx:142-149`

- [ ] **Step 1: Import `parseXml` and `getMeasures`**

Add to EditorPage imports:

```tsx
import { addBars, deleteBars, parseXml, getMeasures } from '@/lib/musicXmlEngine'
```

- [ ] **Step 2: Derive `totalBars` from MusicXML and pass to toolbar**

Add a `useMemo` inside `EditorPage` that computes the bar count from the current MusicXML, and use the `bpm` from `audioStore` to derive duration:

```tsx
import { useMemo } from 'react'
// ... (add to existing import from 'react')

const musicXml = useLeadSheetStore((s) => s.musicXml)
const bpm = useAudioStore((s) => s.bpm)

const totalBars = useMemo(() => {
  if (!musicXml) return 16
  try {
    const doc = parseXml(musicXml)
    return getMeasures(doc).length
  } catch {
    return 16
  }
}, [musicXml])

const beatsPerBar = useMemo(() => {
  if (!musicXml) return 4
  try {
    const doc = parseXml(musicXml)
    const timeEl = doc.querySelector('time')
    const beats = parseInt(timeEl?.querySelector('beats')?.textContent ?? '4', 10)
    return isNaN(beats) ? 4 : beats
  } catch {
    return 4
  }
}, [musicXml])
```

Add the `useAudioStore` import if not present:

```tsx
import { useAudioStore } from '@/stores/audioStore'
```

- [ ] **Step 3: Update toolbar props**

Change the `<EditorToolbar>` to use the derived values:

```tsx
<EditorToolbar
  onAddBar={handleAddBar}
  onDeleteBars={handleDeleteBars}
  onStylePicker={handleStylePicker}
  totalBars={totalBars}
  beatsPerBar={beatsPerBar}
  className="z-20"
/>
```

- [ ] **Step 4: Set audio store duration when score changes**

Add a `useEffect` that updates audio duration when the measure count or BPM changes:

```tsx
useEffect(() => {
  const durationSeconds = totalBars * beatsPerBar * (60 / bpm)
  useAudioStore.getState().setDuration(durationSeconds)
}, [totalBars, beatsPerBar, bpm])
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/pack/EditorPage.tsx
git commit -m "fix: derive playback duration and bar count from actual score"
```

---

## Task 5: Version Type Definition

**Files:**
- Create: `packages/shared/src/types/version.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Create the Version type**

```tsx
// packages/shared/src/types/version.ts
import type { ArrangementId } from './score.js'

export type VersionSource = 'arrangement' | 'ai-transform'

export interface Version {
  id: string
  name: string
  source: VersionSource
  arrangementId?: ArrangementId
  musicXml: string
  parentVersionId?: string
  createdAt: number
  prompt?: string
}

export interface VersionAction {
  versionId: string
  name: string
  changeSummary: string[]
}
```

- [ ] **Step 2: Add re-export to barrel**

Add to `packages/shared/src/types/index.ts`:

```tsx
export * from './version.js'
```

- [ ] **Step 3: Add `versionCreated` subtype to AgentMessage**

In `packages/shared/src/types/agent.ts`, update the `subtype` union:

```tsx
subtype?: 'chat' | 'onboarding' | 'highlight' | 'coachingTip' | 'practiceStatus' | 'practiceNudge' | 'practiceSummary' | 'versionCreated'
```

Add the `versionAction` optional field to `AgentMessage`:

```tsx
versionAction?: VersionAction
```

Add the import at the top of `agent.ts`:

```tsx
import type { VersionAction } from './version.js'
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/version.ts packages/shared/src/types/index.ts packages/shared/src/types/agent.ts
git commit -m "feat: add Version type and versionCreated message subtype"
```

---

## Task 6: Editor Mode in Store

**Files:**
- Modify: `client/src/stores/editorStore.ts`

- [ ] **Step 1: Add `EditorMode` type and store fields**

Add the type after existing type exports (after line 6):

```tsx
export type EditorMode = 'transform' | 'fineEdit'
```

Add to the `EditorStore` interface (after `toolMode` section, around line 19):

```tsx
// Mode
editorMode: EditorMode
setEditorMode: (mode: EditorMode) => void
```

- [ ] **Step 2: Add default and setter to the store implementation**

Add after `setToolMode` implementation (around line 76):

```tsx
// Mode
editorMode: 'transform',
setEditorMode: (mode) => set({ editorMode: mode }),
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/editorStore.ts
git commit -m "feat: add editorMode (transform/fineEdit) to editor store"
```

---

## Task 7: Version Store

**Files:**
- Create: `client/src/stores/versionStore.ts`

- [ ] **Step 1: Create `useVersionStore`**

```tsx
import { create } from 'zustand'
import type { Version, VersionSource } from '@lava/shared'
import type { ArrangementId } from '@lava/shared'
import { useLeadSheetStore } from '@/stores/leadSheetStore'

interface VersionStore {
  versions: Version[]
  activeVersionId: string
  previewVersionId: string | null

  // Queries
  getActiveVersion: () => Version | undefined
  getPreviewVersion: () => Version | undefined
  isPreview: () => boolean

  // Actions
  setActiveVersion: (id: string) => void
  addVersion: (version: Version) => void
  removeVersion: (id: string) => void
  startPreview: (id: string) => void
  applyPreview: () => void
  discardPreview: () => void
  loadFromArrangements: () => void
  reset: () => void
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versions: [],
  activeVersionId: 'original',
  previewVersionId: null,

  getActiveVersion: () => {
    const { versions, activeVersionId } = get()
    return versions.find((v) => v.id === activeVersionId)
  },

  getPreviewVersion: () => {
    const { versions, previewVersionId } = get()
    if (!previewVersionId) return undefined
    return versions.find((v) => v.id === previewVersionId)
  },

  isPreview: () => get().previewVersionId !== null,

  setActiveVersion: (id) => {
    const version = get().versions.find((v) => v.id === id)
    if (!version) return
    set({ activeVersionId: id })
    useLeadSheetStore.getState().setMusicXml(version.musicXml)
    // Sync arrangement selection for tier 1 versions
    if (version.source === 'arrangement' && version.arrangementId) {
      useLeadSheetStore.getState().selectArrangement(version.arrangementId)
    }
  },

  addVersion: (version) => {
    set((s) => ({ versions: [...s.versions, version] }))
  },

  removeVersion: (id) => {
    set((s) => ({
      versions: s.versions.filter((v) => v.id !== id),
      previewVersionId: s.previewVersionId === id ? null : s.previewVersionId,
    }))
  },

  startPreview: (id) => {
    const version = get().versions.find((v) => v.id === id)
    if (!version) return
    set({ previewVersionId: id })
    useLeadSheetStore.getState().setMusicXml(version.musicXml)
  },

  applyPreview: () => {
    const { previewVersionId } = get()
    if (!previewVersionId) return
    set({ activeVersionId: previewVersionId, previewVersionId: null })
  },

  discardPreview: () => {
    const { previewVersionId, activeVersionId, versions } = get()
    if (!previewVersionId) return
    // Restore active version's XML
    const activeVersion = versions.find((v) => v.id === activeVersionId)
    if (activeVersion) {
      useLeadSheetStore.getState().setMusicXml(activeVersion.musicXml)
    }
    // Remove the discarded preview version
    set((s) => ({
      previewVersionId: null,
      versions: s.versions.filter((v) => v.id !== previewVersionId),
    }))
  },

  loadFromArrangements: () => {
    const { arrangements, musicXml } = useLeadSheetStore.getState()
    const versions: Version[] = []

    // Always create an "Original" version from the current MusicXML
    if (musicXml) {
      versions.push({
        id: 'original',
        name: 'Original',
        source: 'arrangement',
        arrangementId: 'original',
        musicXml,
        createdAt: Date.now(),
      })
    }

    // Create versions from other arrangements (they share the same MusicXML base for now)
    for (const arr of arrangements) {
      if (arr.id === 'original') continue
      versions.push({
        id: `arrangement-${arr.id}`,
        name: arr.label,
        source: 'arrangement',
        arrangementId: arr.id,
        musicXml: musicXml ?? '',
        createdAt: Date.now(),
      })
    }

    set({ versions, activeVersionId: 'original', previewVersionId: null })
  },

  reset: () => set({ versions: [], activeVersionId: 'original', previewVersionId: null }),
}))
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/versionStore.ts
git commit -m "feat: add useVersionStore for version management"
```

---

## Task 8: Version Picker Component

**Files:**
- Create: `client/src/spaces/pack/VersionPicker.tsx`

- [ ] **Step 1: Create the dropdown component**

```tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Sparkles, Layers } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface VersionPickerProps {
  className?: string
}

export function VersionPicker({ className }: VersionPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const versions = useVersionStore((s) => s.versions)
  const activeVersionId = useVersionStore((s) => s.activeVersionId)
  const setActiveVersion = useVersionStore((s) => s.setActiveVersion)
  const isPreview = useVersionStore((s) => s.isPreview())

  const activeVersion = versions.find((v) => v.id === activeVersionId)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (versions.length <= 1) return null

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isPreview}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
          'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          isPreview && 'cursor-not-allowed opacity-40',
        )}
      >
        <Layers className="size-3.5" />
        <span className="max-w-[100px] truncate">{activeVersion?.name ?? 'Original'}</span>
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 min-w-[180px] rounded-lg border border-border bg-surface-0 p-1 shadow-lg">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveVersion(v.id)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                v.id === activeVersionId
                  ? 'bg-surface-2 text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              <span className="flex-1 truncate">{v.name}</span>
              {v.source === 'ai-transform' && (
                <span className="flex items-center gap-0.5 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-text-muted">
                  <Sparkles className="size-2.5" />
                  AI
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/VersionPicker.tsx
git commit -m "feat: add VersionPicker toolbar dropdown component"
```

---

## Task 9: Preview Bar Component

**Files:**
- Create: `client/src/spaces/pack/PreviewBar.tsx`

- [ ] **Step 1: Create the floating preview action bar**

```tsx
import { Check, X, Columns2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface PreviewBarProps {
  onCompare: () => void
  className?: string
}

export function PreviewBar({ onCompare, className }: PreviewBarProps) {
  const previewVersion = useVersionStore((s) => s.getPreviewVersion())
  const applyPreview = useVersionStore((s) => s.applyPreview)
  const discardPreview = useVersionStore((s) => s.discardPreview)

  if (!previewVersion) return null

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 z-30 flex items-center justify-between',
        'border-b border-border bg-surface-1 px-4 py-2',
        className,
      )}
    >
      <span className="text-sm font-medium text-text-primary">
        Previewing: <span className="text-accent">{previewVersion.name}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCompare}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
        >
          <Columns2 className="size-3.5" />
          Compare
        </button>
        <button
          type="button"
          onClick={discardPreview}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
        >
          <X className="size-3.5" />
          Discard
        </button>
        <button
          type="button"
          onClick={applyPreview}
          className="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-80"
        >
          <Check className="size-3.5" />
          Apply
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/PreviewBar.tsx
git commit -m "feat: add PreviewBar floating action bar for version preview"
```

---

## Task 10: Toolbar Restructure with Mode Switch

**Files:**
- Modify: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Add imports for new dependencies**

Update imports at top of file:

```tsx
import type { ComponentType } from 'react'
import {
  Play, Pause, RotateCcw, MousePointer2, BoxSelect,
  Hash, Music, Type, Undo2, Redo2,
  Plus, Trash2, ZoomOut, ZoomIn, Layers,
  Guitar, Grid3x3, Repeat, Gauge, Columns2,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore, type ViewMode, type EditorMode } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'
import { useVersionStore } from '@/stores/versionStore'
import { VersionPicker } from './VersionPicker'
```

- [ ] **Step 2: Add mode switch and mode-conditional rendering**

Read `editorMode` from the store — add after the existing store selectors (around line 89):

```tsx
const editorMode = useEditorStore((s) => s.editorMode)
const setEditorMode = useEditorStore((s) => s.setEditorMode)
const isPreview = useVersionStore((s) => s.isPreview())
const versionCount = useVersionStore((s) => s.versions.length)
```

- [ ] **Step 3: Add `onCompare` prop to EditorToolbar**

Update the interface:

```tsx
interface EditorToolbarProps {
  onAddBar: () => void
  onDeleteBars: () => void
  onStylePicker: () => void
  onCompare: () => void
  totalBars?: number
  beatsPerBar?: number
  className?: string
}
```

Add `onCompare` to the destructured props.

- [ ] **Step 4: Replace toolbar pill contents with mode-conditional rendering**

Replace the contents of the toolbar pill `<div>` (the one with `flex items-center gap-0.5 rounded-full`) with:

```tsx
{/* Mode switch — always visible */}
<div className="flex items-center rounded-lg bg-surface-2 p-0.5">
  <button
    type="button"
    onClick={() => setEditorMode('transform')}
    className={cn(
      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
      editorMode === 'transform'
        ? 'bg-surface-0 text-text-primary shadow-sm'
        : 'text-text-muted hover:text-text-secondary',
    )}
  >
    Transform
  </button>
  <button
    type="button"
    onClick={() => setEditorMode('fineEdit')}
    className={cn(
      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
      editorMode === 'fineEdit'
        ? 'bg-surface-0 text-text-primary shadow-sm'
        : 'text-text-muted hover:text-text-secondary',
    )}
  >
    Fine Edit
  </button>
</div>

<Divider />

{/* Playback — always visible */}
<ToolButton
  icon={isPlaying ? Pause : Play}
  onClick={handleTogglePlayback}
  label={isPlaying ? 'Pause' : 'Play'}
/>
<ToolButton icon={RotateCcw} onClick={handleRestart} label="Restart" />
<span
  className="min-w-[3rem] px-1 text-center text-[11px] font-mono text-text-muted"
  title="Tempo"
>
  {bpm} BPM
</span>

<Divider />

{/* Selection — always visible */}
<ToolButton
  icon={MousePointer2}
  active={toolMode === 'pointer'}
  onClick={() => setToolMode('pointer')}
  label="Select"
/>
<ToolButton
  icon={BoxSelect}
  active={toolMode === 'range'}
  onClick={() => setToolMode('range')}
  label="Range select"
/>

{editorMode === 'transform' && (
  <>
    <Divider />
    {/* Version picker */}
    <VersionPicker />

    {/* Compare */}
    <ToolButton
      icon={Columns2}
      onClick={onCompare}
      disabled={versionCount <= 1 || isPreview}
      label="Compare with original"
    />
  </>
)}

{editorMode === 'fineEdit' && (
  <>
    <Divider />

    {/* Editing tools */}
    <ToolButton
      icon={Hash}
      active={toolMode === 'chord'}
      onClick={() => setToolMode('chord')}
      label="Edit chord"
    />
    <ToolButton
      icon={Music}
      active={toolMode === 'keySig'}
      onClick={() => setToolMode('keySig')}
      label="Key & time sig"
    />
    <ToolButton
      icon={Type}
      active={toolMode === 'text'}
      onClick={() => setToolMode('text')}
      label="Add annotation"
    />

    <Divider />

    {/* History */}
    <ToolButton icon={Undo2} onClick={undo} disabled={!canUndo} label="Undo" />
    <ToolButton icon={Redo2} onClick={redo} disabled={!canRedo} label="Redo" />

    <Divider />

    {/* Bar management */}
    <ToolButton icon={Plus} onClick={onAddBar} label="Add bar" />
    <ToolButton
      icon={Trash2}
      onClick={onDeleteBars}
      disabled={selectedBars.length === 0}
      label="Delete bar"
    />

    <Divider />

    {/* View mode cycle */}
    <ToolButton
      icon={Layers}
      label={viewModeLabel[viewMode] ?? 'View mode'}
      onClick={() => {
        const modes: ViewMode[] = ['staff', 'leadSheet', 'tab']
        const next = modes[(modes.indexOf(viewMode) + 1) % modes.length]
        setViewMode(next)
      }}
    />

    <Divider />

    {/* Training wheels */}
    <ToolButton
      icon={Guitar}
      label="Chord shapes"
      active={showChordDiagrams}
      onClick={toggleChordDiagrams}
    />
    <ToolButton
      icon={Grid3x3}
      label="Beat grid"
      active={showBeatMarkers}
      onClick={toggleBeatMarkers}
    />
  </>
)}

<Divider />

{/* Zoom — always visible */}
<ToolButton icon={ZoomOut} onClick={() => setZoom(zoom - 10)} disabled={zoom <= 50} label="Zoom out" />
<span className="min-w-[2.5rem] text-center text-xs font-mono text-text-secondary">
  {zoom}%
</span>
<ToolButton icon={ZoomIn} onClick={() => setZoom(zoom + 10)} disabled={zoom >= 200} label="Zoom in" />
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat: restructure toolbar with Transform/Fine Edit mode switch"
```

---

## Task 11: Gate Canvas Editing on Mode

**Files:**
- Modify: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Read `editorMode` and `isPreview` in canvas**

Add after existing store selectors (around line 63):

```tsx
const editorMode = useEditorStore((s) => s.editorMode)
const isPreview = useVersionStore((s) => s.isPreview())
const editingDisabled = editorMode === 'transform' || isPreview
```

Add the import:

```tsx
import { useVersionStore } from '@/stores/versionStore'
```

- [ ] **Step 2: Guard note selection and popovers in `handleCanvasClick`**

In `handleCanvasClick`, after the range tool early return (line 131), add a mode gate for note selection and tool popovers. Replace the note-selection and tool-popover branches:

```tsx
if (hit.type === 'note' && toolMode === 'pointer' && !editingDisabled) {
  selectNote(hit.barIndex, hit.noteIndex, e.shiftKey)
  syncHighlights()
  return
}
```

And for the tool popovers, wrap the `else if` block:

```tsx
} else if (!editingDisabled && (toolMode === 'chord' || toolMode === 'keySig' || toolMode === 'text')) {
```

- [ ] **Step 3: Guard keyboard event handlers**

In the `useEffect` that registers keyboard events, add an early return to each handler when editing is disabled. Wrap the `useEffect` to re-register when `editingDisabled` changes:

Add `editingDisabled` check at the top of each keyboard handler function body (e.g., `onLavaPitchStep`, `onLavaDurationKey`, etc.):

```tsx
function onLavaPitchStep(e: CustomEvent<{ steps: number }>) {
  const { editorMode } = useEditorStore.getState()
  if (editorMode === 'transform' || useVersionStore.getState().isPreview()) return
  // ... rest of handler
}
```

Apply the same pattern to: `onLavaDurationKey`, `onLavaAccidental`, `onLavaToggleTie`, `onLavaToggleRest`, `onLavaCopy`, `onLavaPaste`, `onLavaDuplicate`, `onLavaTranspose`.

- [ ] **Step 4: Hide context pill in transform mode**

Wrap the `ContextPill` render with the mode check:

```tsx
{!editingDisabled && (
  <ContextPill
    selectionType={contextSelectionType}
    bounds={contextBounds}
    onDelete={handleContextDelete}
    onClear={handleContextClear}
    onCopy={handleContextCopy}
    onTranspose={handleContextTranspose}
  />
)}
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat: gate editing interactions on editorMode and preview state"
```

---

## Task 12: Chat Panel — Contextual Suggestions

**Files:**
- Modify: `client/src/spaces/pack/EditorChatEmptyState.tsx`
- Modify: `client/src/spaces/pack/EditorChatPanel.tsx`

- [ ] **Step 1: Rewrite `EditorChatEmptyState` with two suggestion sets**

```tsx
import { Sparkles, Music2, Guitar, Mic2, Hand, Palette, Scissors, Zap, RefreshCw, Sliders } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface EditorChatEmptyStateProps {
  onSuggestionClick: (text: string) => void
  selectedBars: number[]
  className?: string
}

const GLOBAL_SUGGESTIONS = [
  { icon: Sparkles, label: 'Make easier', prompt: 'Make an easier version of this song' },
  { icon: Music2, label: 'Blues version', prompt: 'Create a blues arrangement of this song' },
  { icon: Guitar, label: 'Fingerpicking', prompt: 'Create a fingerpicking version of this song' },
  { icon: Mic2, label: 'Transpose for my voice', prompt: 'Transpose this song to suit my vocal range' },
  { icon: Hand, label: 'Open chords', prompt: 'Rearrange this song to use only open chords' },
  { icon: Palette, label: 'Unique cover version', prompt: 'Create a unique cover arrangement of this song' },
] as const

function getSectionSuggestions(bars: number[]) {
  const min = Math.min(...bars) + 1
  const max = Math.max(...bars) + 1
  const range = min === max ? `bar ${min}` : `bars ${min}–${max}`
  return [
    { icon: Scissors, label: 'Simplify this section', prompt: `Simplify ${range}` },
    { icon: Zap, label: 'Make this the solo', prompt: `Turn ${range} into a guitar solo section` },
    { icon: RefreshCw, label: 'Different strumming', prompt: `Change the strumming pattern for ${range}` },
    { icon: Sparkles, label: 'Add fills', prompt: `Add fills and embellishments to ${range}` },
    { icon: Music2, label: 'Change chords', prompt: `Suggest alternative chords for ${range}` },
    { icon: Sliders, label: 'Simplify rhythm', prompt: `Simplify the rhythm in ${range}` },
  ] as const
}

export function EditorChatEmptyState({ onSuggestionClick, selectedBars, className }: EditorChatEmptyStateProps) {
  const hasBarsSelected = selectedBars.length > 0
  const suggestions = hasBarsSelected ? getSectionSuggestions(selectedBars) : GLOBAL_SUGGESTIONS
  const heading = hasBarsSelected ? 'Transform this section' : 'Transform your song'

  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-6 px-6', className)}>
      <h3 className="text-base font-semibold text-text-primary">{heading}</h3>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            type="button"
            key={s.label}
            onClick={() => onSuggestionClick(s.prompt)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            <s.icon className="size-4" aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Pass `selectedBars` to empty state in `EditorChatPanel`**

In `EditorChatPanel.tsx`, update the empty state render (around line 152):

```tsx
<EditorChatEmptyState onSuggestionClick={handleSuggestionClick} selectedBars={selectedBars} />
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorChatEmptyState.tsx client/src/spaces/pack/EditorChatPanel.tsx
git commit -m "feat: contextual chat suggestions — global vs. section-focused"
```

---

## Task 13: Version Card in Chat Messages

**Files:**
- Modify: `client/src/components/agent/ChatMessage.tsx`

- [ ] **Step 1: Add version card props and rendering**

Add new props to the interface:

```tsx
interface ChatMessageProps {
  message: AgentMessage
  isStreaming?: boolean
  onChipClick?: (chip: MessageChip) => void
  onApplyToneAction?: (messageId: string) => void
  onUndoToneAction?: (messageId: string) => void
  onRetryToneAction?: (messageId: string) => void
  onPreviewVersion?: (versionId: string) => void
  onApplyVersion?: (versionId: string) => void
}
```

Destructure the new props in the component function signature.

- [ ] **Step 2: Add version card render block**

After the `toneAction` render block (after line 128, before the closing `</div>`), add:

```tsx
{message.subtype === 'versionCreated' && message.versionAction && (
  <div className="mt-2 rounded-2xl border border-border bg-surface-1 p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
      New Version
    </p>
    <p className="mt-2 text-sm font-medium text-text-primary">
      {message.versionAction.name}
    </p>
    {message.versionAction.changeSummary.length > 0 && (
      <div className="mt-2 flex flex-col gap-1">
        {message.versionAction.changeSummary.map((change) => (
          <p key={change} className="text-xs text-text-secondary">
            {change}
          </p>
        ))}
      </div>
    )}
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onPreviewVersion?.(message.versionAction!.versionId)}
        className="rounded-full border border-border bg-surface-0 px-3 py-1.5 text-[11px] font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-surface-2"
      >
        Preview
      </button>
      <button
        type="button"
        onClick={() => onApplyVersion?.(message.versionAction!.versionId)}
        className="rounded-full bg-text-primary px-3 py-1.5 text-[11px] font-medium text-surface-0 transition-opacity hover:opacity-80"
      >
        Apply
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/components/agent/ChatMessage.tsx
git commit -m "feat: render versionCreated message cards with Preview/Apply buttons"
```

---

## Task 14: Wire Chat Panel to Version Actions

**Files:**
- Modify: `client/src/spaces/pack/EditorChatPanel.tsx`

- [ ] **Step 1: Import version store and add handlers**

Add import:

```tsx
import { useVersionStore } from '@/stores/versionStore'
```

Add handler functions inside the component, after `handleSuggestionClick`:

```tsx
function handlePreviewVersion(versionId: string) {
  useVersionStore.getState().startPreview(versionId)
}

function handleApplyVersion(versionId: string) {
  const store = useVersionStore.getState()
  // If we're previewing this version, apply the preview
  if (store.previewVersionId === versionId) {
    store.applyPreview()
  } else {
    // Direct apply without preview
    store.setActiveVersion(versionId)
  }
}
```

- [ ] **Step 2: Pass handlers to ChatMessage**

Update the `<ChatMessage>` render in the messages list:

```tsx
{visibleMessages.map((msg) => (
  <ChatMessage
    key={msg.id}
    message={msg}
    onChipClick={handleChipClick}
    onPreviewVersion={handlePreviewVersion}
    onApplyVersion={handleApplyVersion}
  />
))}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorChatPanel.tsx
git commit -m "feat: wire chat panel to version preview/apply actions"
```

---

## Task 15: Wire EditorPage — PreviewBar, Versions, Compare

**Files:**
- Modify: `client/src/spaces/pack/EditorPage.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useVersionStore } from '@/stores/versionStore'
import { PreviewBar } from './PreviewBar'
```

- [ ] **Step 2: Add compare state and version initialization**

Add inside `EditorPage`, after existing hooks:

```tsx
const [comparing, setComparing] = useState(false)
const isPreview = useVersionStore((s) => s.isPreview())
```

Add `useState` to the React import if not already present.

Load versions from arrangements when project loads — add after the project load `useEffect` (the one that calls `projectService.get`):

```tsx
// Initialize versions from arrangements after project load
useEffect(() => {
  const musicXml = useLeadSheetStore.getState().musicXml
  if (musicXml) {
    useVersionStore.getState().loadFromArrangements()
  }
}, [id])
```

- [ ] **Step 3: Add compare handler and onCompare prop**

Add the handler:

```tsx
const handleCompare = useCallback(() => {
  setComparing((prev) => !prev)
}, [])
```

Pass `onCompare` to `EditorToolbar`:

```tsx
<EditorToolbar
  onAddBar={handleAddBar}
  onDeleteBars={handleDeleteBars}
  onStylePicker={handleStylePicker}
  onCompare={handleCompare}
  totalBars={totalBars}
  beatsPerBar={beatsPerBar}
  className="z-20"
/>
```

- [ ] **Step 4: Add PreviewBar to the layout**

Inside the editor area `<div>` (the one with `relative flex flex-1 flex-col`), add the `PreviewBar` after `EditorTitleBar`:

```tsx
<EditorTitleBar packName={projectName || 'Untitled'} onNameChange={handleNameChange} />

<PreviewBar onCompare={handleCompare} />

<EditorCanvas className="flex-1" />
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/pack/EditorPage.tsx
git commit -m "feat: wire PreviewBar, version init, and compare toggle into EditorPage"
```

---

## Task 16: Server-Side — `create_version` Tool

**Files:**
- Create: `server/src/agent/tools/definitions/version.tool.ts`
- Modify: `server/src/agent/tools/definitions/index.ts`
- Modify: `server/src/agent/tools/index.ts`

- [ ] **Step 1: Create tool definition**

```tsx
// server/src/agent/tools/definitions/version.tool.ts
import type { ToolDefinition } from '@lava/shared'

export const createVersionTool: ToolDefinition = {
  name: 'create_version',
  description: 'Create a new version/arrangement of the current song. Returns a version with modified MusicXML that the user can preview and apply. For now, returns a mock version based on the requested transformation.',
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: 'Display name for the version (e.g., "Blues Version", "Easier", "Fingerpicking")',
      required: true,
    },
    {
      name: 'changeSummary',
      type: 'string',
      description: 'JSON array of strings describing the changes made (e.g., ["Simplified chord voicings", "Reduced to 3 chords per section"])',
      required: true,
    },
    {
      name: 'transformType',
      type: 'string',
      description: 'The type of transformation applied',
      required: true,
      enum: ['simplify', 'genre', 'fingerpicking', 'transpose', 'open_chords', 'custom'],
    },
  ],
}
```

- [ ] **Step 2: Add to ALL_TOOLS barrel**

In `server/src/agent/tools/definitions/index.ts`, add the import and export:

```tsx
import { createVersionTool } from './version.tool.js'
```

Add `createVersionTool` to the `ALL_TOOLS` array:

```tsx
export const ALL_TOOLS: ToolDefinition[] = [
  navigateToSpaceTool,
  openSearchResultsTool,
  createProjectTool,
  listProjectsTool,
  loadProjectTool,
  startTranscriptionTool,
  getTranscriptionStatusTool,
  addTrackTool,
  aiComposeTool,
  uploadAudioTool,
  processAudioTool,
  createVersionTool,
]
```

- [ ] **Step 3: Add handler in `server/src/agent/tools/index.ts`**

Add the handler to the `handlers` object inside `getHandler`:

```tsx
create_version: async (input) => {
  const name = String(input.name)
  const transformType = String(input.transformType)
  let changeSummary: string[] = []
  try {
    changeSummary = JSON.parse(String(input.changeSummary))
  } catch {
    changeSummary = [String(input.changeSummary)]
  }

  // Mock version ID — real implementation would generate MusicXML
  const versionId = `ai-${Date.now()}`

  return {
    action: 'version_created',
    versionId,
    name,
    transformType,
    changeSummary,
    // MusicXML generation is mocked — the client will receive this
    // and create the version with the current score's MusicXML as a placeholder
  }
},
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/agent/tools/definitions/version.tool.ts server/src/agent/tools/definitions/index.ts server/src/agent/tools/index.ts
git commit -m "feat: add create_version agent tool (mocked MusicXML generation)"
```

---

## Task 17: Update Agent Context for Transform Mode

**Files:**
- Modify: `server/src/agent/prompts/context.ts`

- [ ] **Step 1: Add editor/create context block**

After the coaching context block (after line 77, before `return prompt`), add an editor context block:

```tsx
if (ctx.currentSpace === 'create' && !ctx.coachContext) {
  prompt += `\n\n## Editor Rules`
  prompt += `\n- The editor has two modes: Transform (default) and Fine Edit.`
  prompt += `\n- In Transform mode, help the user create new versions of their song through natural language.`
  prompt += `\n- When the user asks for a transformation (e.g., "make easier", "blues version", "fingerpicking"), use the create_version tool.`
  prompt += `\n- Choose a clear, short name for the version (e.g., "Blues Version", "Easy Fingerpicking", "Open Chords").`
  prompt += `\n- Provide a changeSummary as a JSON array of 2-4 short descriptions of what changed.`
  prompt += `\n- After creating a version, write one sentence explaining what you changed and why.`
  prompt += `\n- If the user asks to edit specific notes, chords, or bars manually, suggest switching to Fine Edit mode.`
  prompt += `\n- When bars are selected, the user likely wants section-specific changes. Reference the bar numbers in your response.`
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/agent/prompts/context.ts
git commit -m "feat: add editor Transform mode context rules for agent"
```

---

## Task 18: Handle `version_created` Tool Result on Client

**Files:**
- Modify: `client/src/hooks/useAgent.ts`

- [ ] **Step 1: Read the current useAgent hook**

Read `client/src/hooks/useAgent.ts` to find where tool results are handled — look for `tool_result` event handling and the chip action handler.

- [ ] **Step 2: Add version_created handling**

In the stream event handler (where `tool_result` events are processed), add a case for the `version_created` action:

```tsx
if (parsed.action === 'version_created') {
  const { useVersionStore } = await import('@/stores/versionStore')
  const { useLeadSheetStore } = await import('@/stores/leadSheetStore')
  const currentXml = useLeadSheetStore.getState().musicXml ?? ''
  const version: Version = {
    id: parsed.versionId,
    name: parsed.name,
    source: 'ai-transform',
    musicXml: currentXml, // Mocked — uses current XML as placeholder
    parentVersionId: useVersionStore.getState().activeVersionId,
    createdAt: Date.now(),
    prompt: undefined, // Will be set from the user's original message if needed
  }
  useVersionStore.getState().addVersion(version)
  useVersionStore.getState().startPreview(version.id)

  // Add a versionCreated message to the thread
  const versionMsg: AgentMessage = {
    id: `version-${parsed.versionId}`,
    role: 'assistant',
    content: '',
    subtype: 'versionCreated',
    versionAction: {
      versionId: parsed.versionId,
      name: parsed.name,
      changeSummary: parsed.changeSummary ?? [],
    },
    createdAt: Date.now(),
  }
  useAgentStore.getState().addMessage(versionMsg)
}
```

Add the `Version` type import at the top of the file:

```tsx
import type { Version } from '@lava/shared'
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useAgent.ts
git commit -m "feat: handle version_created tool results — create version and start preview"
```

---

## Task 19: Final Integration Verification

- [ ] **Step 1: Run full type check**

```bash
pnpm typecheck
```

Expected: PASS across all three workspaces (client, server, shared)

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: PASS — all three packages build successfully

- [ ] **Step 4: Commit any lint/type fixes**

```bash
git add -A
git commit -m "chore: fix lint and type issues from two-mode integration"
```

---

## Deferred Core Fixes (from spec Section 5)

The following spec items are not covered in this plan because they require deeper OSMD integration work that is better handled in a follow-up plan:

- **5.4 Dot/triplet duration** — requires engine-level duration math (dotted = 1.5x, triplet = 2/3x) and OSMD re-render
- **5.5 Chord diagram display** — requires rendering SVG chord diagrams above measures, positional math tied to OSMD layout
- **5.6 Beat grid display** — requires injecting SVG lines into OSMD measure elements after render
- **5.7 View mode switching** — requires OSMD reconfiguration for tablature staves, which is a separate OSMD setup concern

These 4 items should be a follow-up plan focused on OSMD rendering enhancements.

---

## Summary

| Task | Area | Files |
|---|---|---|
| 1 | Core fix: chord application | `EditorCanvas.tsx` |
| 2 | Core fix: annotation attachment | `EditorCanvas.tsx` |
| 3 | Core fix: key/time sig via engine | `EditorCanvas.tsx` |
| 4 | Core fix: playback duration | `EditorPage.tsx` |
| 5 | Version type definition | `version.ts`, `agent.ts`, `index.ts` (shared) |
| 6 | Editor mode in store | `editorStore.ts` |
| 7 | Version store | `versionStore.ts` (new) |
| 8 | Version picker component | `VersionPicker.tsx` (new) |
| 9 | Preview bar component | `PreviewBar.tsx` (new) |
| 10 | Toolbar restructure | `EditorToolbar.tsx` |
| 11 | Gate canvas editing on mode | `EditorCanvas.tsx` |
| 12 | Contextual chat suggestions | `EditorChatEmptyState.tsx`, `EditorChatPanel.tsx` |
| 13 | Version card in messages | `ChatMessage.tsx` |
| 14 | Chat panel version wiring | `EditorChatPanel.tsx` |
| 15 | EditorPage integration | `EditorPage.tsx` |
| 16 | Server: create_version tool | `version.tool.ts`, `index.ts` (tools) |
| 17 | Agent context prompt | `context.ts` |
| 18 | Client: handle tool result | `useAgent.ts` |
| 19 | Final verification | All |
