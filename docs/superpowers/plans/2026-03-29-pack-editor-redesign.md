# Pack Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign PackPage into an immersive Lovart/Figma-style score editor with OSMD rendering, floating toolbar, and right-side AI chat panel.

**Architecture:** New `EditorPage` replaces `PackPage` with a horizontal split layout. Left side: OSMD score canvas + compact DawPanel + floating toolbar. Right side: resizable/collapsible AI chat panel. New `editorStore` for editor-specific state; reuse existing `leadSheetStore`, `audioStore`, `dawPanelStore`, `agentStore`.

**Tech Stack:** React 18, TypeScript, Zustand, OpenSheetMusicDisplay (OSMD), Tailwind CSS, lucide-react, cn() utility

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `client/src/stores/editorStore.ts` | Editor state: tool mode, selection, view, zoom, undo/redo, panel state |
| `client/src/spaces/pack/EditorPage.tsx` | Top-level layout orchestrator (replaces PackPage) |
| `client/src/spaces/pack/EditorTitleBar.tsx` | Back button, editable pack name, save status |
| `client/src/spaces/pack/EditorCanvas.tsx` | OSMD renderer with zoom, scroll, selection overlays |
| `client/src/spaces/pack/EditorToolbar.tsx` | Floating pill toolbar at bottom-center |
| `client/src/spaces/pack/EditorChatPanel.tsx` | Right-side resizable/collapsible chat panel |
| `client/src/spaces/pack/EditorChatEmptyState.tsx` | Skill suggestion chips for empty chat |
| `client/src/spaces/pack/CompactDawStrip.tsx` | Collapsed/expandable DawPanel wrapper |
| `client/src/spaces/pack/ChordPopover.tsx` | Contextual chord editor popover |
| `client/src/spaces/pack/KeySigPopover.tsx` | Key/time signature picker popover |
| `client/src/spaces/pack/TextAnnotationInput.tsx` | Inline text annotation input |
| `client/src/hooks/useEditorKeyboard.ts` | Keyboard shortcut handler for editor |

### Modified Files

| File | Change |
|---|---|
| `client/src/router.tsx` | Replace `PackPage` import with `EditorPage` |
| `client/src/styles/tokens.css` | Add `--editor-chat-width` and `--editor-titlebar-height` tokens |
| `package.json` (client) | Add `opensheetmusicdisplay` dependency |

---

## Task 1: Install OSMD and Add CSS Tokens

**Files:**
- Modify: `client/package.json`
- Modify: `client/src/styles/tokens.css:36` (after dark theme block)

- [ ] **Step 1: Install opensheetmusicdisplay**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm add -F @lava/client opensheetmusicdisplay
```

- [ ] **Step 2: Add editor CSS tokens to tokens.css**

Add these tokens at the end of the `:root` block in `client/src/styles/tokens.css` (before line 36 closing brace):

```css
  --editor-chat-width: 380px;
  --editor-chat-min-width: 320px;
  --editor-titlebar-height: 48px;
  --editor-daw-collapsed-height: 40px;
  --editor-toolbar-height: 44px;
```

- [ ] **Step 3: Verify build still works**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/package.json pnpm-lock.yaml client/src/styles/tokens.css
git commit -m "chore: install opensheetmusicdisplay and add editor CSS tokens"
```

---

## Task 2: Create Editor Store

**Files:**
- Create: `client/src/stores/editorStore.ts`

- [ ] **Step 1: Create the editorStore**

```typescript
import { create } from 'zustand'

export type ToolMode = 'pointer' | 'range' | 'chord' | 'keySig' | 'text'
export type ViewMode = 'staff' | 'tab' | 'leadSheet'
export type SaveStatus = 'saved' | 'saving' | 'unsaved'

const MAX_UNDO_STACK = 50

interface EditorStore {
  // Tool
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void

  // Selection
  selectedBars: number[]
  selectBar: (bar: number, additive?: boolean) => void
  selectRange: (start: number, end: number) => void
  clearSelection: () => void

  // View
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  zoom: number
  setZoom: (zoom: number) => void

  // Undo / Redo
  undoStack: string[]
  redoStack: string[]
  pushUndo: (snapshot: string) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Panels
  chatPanelWidth: number
  setChatPanelWidth: (width: number) => void
  chatPanelCollapsed: boolean
  toggleChatPanel: () => void
  dawPanelExpanded: boolean
  toggleDawPanel: () => void

  // Save
  saveStatus: SaveStatus
  setSaveStatus: (status: SaveStatus) => void
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Tool
  toolMode: 'pointer',
  setToolMode: (mode) => set({ toolMode: mode }),

  // Selection
  selectedBars: [],
  selectBar: (bar, additive = false) =>
    set((state) => ({
      selectedBars: additive
        ? state.selectedBars.includes(bar)
          ? state.selectedBars.filter((b) => b !== bar)
          : [...state.selectedBars, bar]
        : [bar],
    })),
  selectRange: (start, end) => {
    const bars: number[] = []
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    for (let i = lo; i <= hi; i++) bars.push(i)
    set({ selectedBars: bars })
  },
  clearSelection: () => set({ selectedBars: [] }),

  // View
  viewMode: 'staff',
  setViewMode: (mode) => set({ viewMode: mode }),
  zoom: 100,
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(200, zoom)) }),

  // Undo / Redo
  undoStack: [],
  redoStack: [],
  pushUndo: (snapshot) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), snapshot],
      redoStack: [],
    })),
  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return
    const snapshot = undoStack[undoStack.length - 1]
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, snapshot],
    })
    // Caller reads the returned snapshot from undoStack and applies it to leadSheetStore
  },
  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return
    const snapshot = redoStack[redoStack.length - 1]
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, snapshot],
    })
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // Panels
  chatPanelWidth: 380,
  setChatPanelWidth: (width) =>
    set({ chatPanelWidth: Math.max(320, Math.min(window.innerWidth * 0.5, width)) }),
  chatPanelCollapsed: false,
  toggleChatPanel: () => set((state) => ({ chatPanelCollapsed: !state.chatPanelCollapsed })),
  dawPanelExpanded: false,
  toggleDawPanel: () => set((state) => ({ dawPanelExpanded: !state.dawPanelExpanded })),

  // Save
  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),
}))
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/editorStore.ts
git commit -m "feat: add editorStore for tool mode, selection, zoom, undo/redo, panel state"
```

---

## Task 3: Create EditorTitleBar

**Files:**
- Create: `client/src/spaces/pack/EditorTitleBar.tsx`

- [ ] **Step 1: Create EditorTitleBar component**

```tsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'

interface EditorTitleBarProps {
  packName: string
  onNameChange: (name: string) => void
  className?: string
}

export function EditorTitleBar({ packName, onNameChange, className }: EditorTitleBarProps) {
  const navigate = useNavigate()
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(packName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commitName() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== packName) onNameChange(trimmed)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        'flex h-[var(--editor-titlebar-height)] items-center gap-3 border-b border-border bg-surface-0 px-4',
        className,
      )}
    >
      <button
        onClick={() => navigate(-1)}
        className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        aria-label="Go back"
      >
        <ArrowLeft className="size-4" />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') { setDraft(packName); setEditing(false) }
          }}
          className="h-7 rounded border border-border bg-surface-1 px-2 text-sm text-text-primary outline-none focus:border-border-hover"
        />
      ) : (
        <button
          onClick={() => { setDraft(packName); setEditing(true) }}
          className="text-sm font-semibold text-text-primary hover:text-accent"
        >
          {packName}
        </button>
      )}

      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        {saveStatus === 'saved' && (
          <>
            <span className="size-1.5 rounded-full bg-success" />
            Saved
          </>
        )}
        {saveStatus === 'saving' && (
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-warning" />
            Saving...
          </>
        )}
        {saveStatus === 'unsaved' && (
          <>
            <span className="size-1.5 rounded-full bg-text-muted" />
            Unsaved
          </>
        )}
      </div>

      <div className="flex-1" />
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorTitleBar.tsx
git commit -m "feat: add EditorTitleBar with editable name and save status"
```

---

## Task 4: Create EditorChatEmptyState

**Files:**
- Create: `client/src/spaces/pack/EditorChatEmptyState.tsx`

- [ ] **Step 1: Create the empty state component**

```tsx
import { Music, ArrowRightLeft, Layers, Mic, Sparkles, ListEnd } from 'lucide-react'
import { cn } from '@/components/ui/utils'

interface EditorChatEmptyStateProps {
  onSuggestionClick: (text: string) => void
  className?: string
}

const SUGGESTIONS = [
  { icon: Layers, label: 'Arrange for band', prompt: 'Arrange this score for a full band' },
  { icon: ArrowRightLeft, label: 'Transpose to...', prompt: 'Transpose this score to ' },
  { icon: Music, label: 'Add chord progression', prompt: 'Add a chord progression for ' },
  { icon: Mic, label: 'Generate accompaniment', prompt: 'Generate an accompaniment for this score' },
  { icon: Sparkles, label: 'Simplify chords', prompt: 'Simplify the chords in this score' },
  { icon: ListEnd, label: 'Add intro/outro', prompt: 'Add an intro and outro to this score' },
] as const

export function EditorChatEmptyState({ onSuggestionClick, className }: EditorChatEmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-6 px-6', className)}>
      <h3 className="text-base font-semibold text-text-primary">Try these Lava Skills</h3>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestionClick(s.prompt)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            <s.icon className="size-4" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorChatEmptyState.tsx
git commit -m "feat: add EditorChatEmptyState with skill suggestion chips"
```

---

## Task 5: Create EditorChatPanel

**Files:**
- Create: `client/src/spaces/pack/EditorChatPanel.tsx`

- [ ] **Step 1: Create the chat panel component**

```tsx
import { useRef, useState, useCallback, useEffect } from 'react'
import { MessageSquarePlus, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { ChatMessage } from '@/components/agent/ChatMessage'
import { useAgentStore } from '@/stores/agentStore'
import { useAgent } from '@/hooks/useAgent'
import { useEditorStore } from '@/stores/editorStore'
import { EditorChatEmptyState } from './EditorChatEmptyState'
import type { MessageChip } from '@lava/shared'

interface EditorChatPanelProps {
  className?: string
}

export function EditorChatPanel({ className }: EditorChatPanelProps) {
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const clearMessages = useAgentStore((s) => s.clearMessages)

  const { sendMessage, handleChipClick } = useAgent()
  const chatInputRef = useRef<ChatInputRef>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const collapsed = useEditorStore((s) => s.chatPanelCollapsed)
  const toggleChat = useEditorStore((s) => s.toggleChatPanel)
  const width = useEditorStore((s) => s.chatPanelWidth)
  const setChatPanelWidth = useEditorStore((s) => s.setChatPanelWidth)
  const selectedBars = useEditorStore((s) => s.selectedBars)

  const [resizing, setResizing] = useState(false)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, streamingContent])

  // Resize drag handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setResizing(true)
      const startX = e.clientX
      const startWidth = width

      function onMove(ev: MouseEvent) {
        const delta = startX - ev.clientX
        setChatPanelWidth(startWidth + delta)
      }
      function onUp() {
        setResizing(false)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [width, setChatPanelWidth],
  )

  function handleSuggestionClick(text: string) {
    chatInputRef.current?.setValue(text)
    chatInputRef.current?.focus()
  }

  function handleNewChat() {
    clearMessages()
  }

  const visibleMessages = messages.filter((m) => !m.hidden)
  const hasMessages = visibleMessages.length > 0

  // Collapsed state — thin strip
  if (collapsed) {
    return (
      <div className={cn('flex w-10 flex-col items-center border-l border-border bg-surface-0 pt-3', className)}>
        <button
          onClick={toggleChat}
          className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          aria-label="Open chat panel"
        >
          <PanelRightOpen className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn('relative flex flex-col border-l border-border bg-surface-0', className)}
      style={{ width, minWidth: 320, maxWidth: '50vw' }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className={cn(
          'absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-accent/20',
          resizing && 'bg-accent/20',
        )}
      />

      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold text-text-primary">New chat</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          <button
            onClick={toggleChat}
            className="flex size-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            aria-label="Collapse chat panel"
          >
            <PanelRightClose className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {hasMessages ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-4">
            {visibleMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onChipClick={handleChipClick} />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: Date.now(),
                }}
                isStreaming
              />
            )}
          </div>
        </div>
      ) : (
        <EditorChatEmptyState onSuggestionClick={handleSuggestionClick} />
      )}

      {/* Footer */}
      <div className="border-t border-border px-3 py-2">
        {selectedBars.length > 0 && (
          <div className="mb-1.5 flex">
            <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-text-secondary">
              Selected: bars {Math.min(...selectedBars)}–{Math.max(...selectedBars)}
            </span>
          </div>
        )}
        <ChatInput
          ref={chatInputRef}
          onSend={sendMessage}
          disabled={isStreaming}
          compact
          placeholder="Start with an idea..."
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorChatPanel.tsx
git commit -m "feat: add EditorChatPanel with resize, collapse, empty state, and selection context"
```

---

## Task 6: Create EditorToolbar

**Files:**
- Create: `client/src/spaces/pack/EditorToolbar.tsx`

- [ ] **Step 1: Create the floating toolbar component**

```tsx
import {
  Play, Pause, MousePointer2, BoxSelect,
  Hash, Music, Type, Undo2, Redo2,
  Plus, Trash2, Disc3, ZoomOut, ZoomIn, Layers,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore, type ToolMode, type ViewMode } from '@/stores/editorStore'
import { useAudioStore, type PlaybackState } from '@/stores/audioStore'

interface EditorToolbarProps {
  onPlayPause: () => void
  onAddBar: () => void
  onDeleteBars: () => void
  onStylePicker: () => void
  className?: string
}

function ToolButton({
  icon: Icon,
  active,
  disabled,
  onClick,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-surface-3 text-accent'
          : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />
}

const VIEW_LABELS: Record<ViewMode, string> = {
  staff: 'Staff',
  tab: 'Tab',
  leadSheet: 'Lead Sheet',
}

export function EditorToolbar({
  onPlayPause,
  onAddBar,
  onDeleteBars,
  onStylePicker,
  className,
}: EditorToolbarProps) {
  const toolMode = useEditorStore((s) => s.toolMode)
  const setToolMode = useEditorStore((s) => s.setToolMode)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectedBars = useEditorStore((s) => s.selectedBars)

  const playbackState = useAudioStore((s) => s.playbackState)
  const bpm = useAudioStore((s) => s.bpm)

  const canUndo = useEditorStore((s) => s.undoStack.length > 0)
  const canRedo = useEditorStore((s) => s.redoStack.length > 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  const isPlaying = playbackState === 'playing'

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-border bg-surface-0 px-2 py-1.5 shadow-lg',
        className,
      )}
    >
      {/* Playback */}
      <ToolButton
        icon={isPlaying ? Pause : Play}
        onClick={onPlayPause}
        label={isPlaying ? 'Pause' : 'Play'}
      />
      <button
        className="min-w-[3rem] px-1.5 text-center text-xs font-mono text-text-secondary hover:text-text-primary"
        title="Tempo"
      >
        {bpm}
      </button>

      <Divider />

      {/* Selection */}
      <ToolButton
        icon={MousePointer2}
        active={toolMode === 'pointer'}
        onClick={() => setToolMode('pointer')}
        label="Pointer tool"
      />
      <ToolButton
        icon={BoxSelect}
        active={toolMode === 'range'}
        onClick={() => setToolMode('range')}
        label="Range select"
      />

      <Divider />

      {/* Editing */}
      <ToolButton
        icon={Hash}
        active={toolMode === 'chord'}
        onClick={() => setToolMode('chord')}
        label="Chord tool"
      />
      <ToolButton
        icon={Music}
        active={toolMode === 'keySig'}
        onClick={() => setToolMode('keySig')}
        label="Key/time signature"
      />
      <ToolButton
        icon={Type}
        active={toolMode === 'text'}
        onClick={() => setToolMode('text')}
        label="Text annotation"
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
        label="Delete selected bars"
      />

      <Divider />

      {/* Style picker */}
      <ToolButton icon={Disc3} onClick={onStylePicker} label="Playback style" />

      <Divider />

      {/* Zoom + View */}
      <ToolButton icon={ZoomOut} onClick={() => setZoom(zoom - 10)} disabled={zoom <= 50} label="Zoom out" />
      <span className="min-w-[2.5rem] text-center text-xs font-mono text-text-secondary">
        {zoom}%
      </span>
      <ToolButton icon={ZoomIn} onClick={() => setZoom(zoom + 10)} disabled={zoom >= 200} label="Zoom in" />

      <Divider />

      {/* View mode dropdown */}
      <select
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value as ViewMode)}
        className="h-7 rounded-lg border-none bg-transparent px-1.5 text-xs text-text-secondary outline-none hover:text-text-primary"
        aria-label="View mode"
      >
        {(Object.entries(VIEW_LABELS) as [ViewMode, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/EditorToolbar.tsx
git commit -m "feat: add EditorToolbar floating pill with all tool groups"
```

---

## Task 7: Create CompactDawStrip

**Files:**
- Create: `client/src/spaces/pack/CompactDawStrip.tsx`

- [ ] **Step 1: Create the compact DAW strip**

```tsx
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { DawPanel, type DawPanelProps } from '@/components/daw/DawPanel'
import { useEditorStore } from '@/stores/editorStore'

interface CompactDawStripProps {
  dawProps: DawPanelProps
  className?: string
}

export function CompactDawStrip({ dawProps, className }: CompactDawStripProps) {
  const expanded = useEditorStore((s) => s.dawPanelExpanded)
  const toggle = useEditorStore((s) => s.toggleDawPanel)
  const trackCount = dawProps.tracks.length

  return (
    <div
      className={cn('border-t border-border bg-surface-1', className)}
      style={{ height: expanded ? 200 : 'var(--editor-daw-collapsed-height)' }}
    >
      {/* Collapsed strip header */}
      <button
        onClick={toggle}
        className="flex h-[var(--editor-daw-collapsed-height)] w-full items-center gap-2 px-4 text-xs text-text-secondary hover:bg-surface-2"
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        <span className="font-medium">{trackCount} track{trackCount !== 1 ? 's' : ''}</span>
      </button>

      {/* Expanded DawPanel */}
      {expanded && (
        <div className="h-[calc(100%-var(--editor-daw-collapsed-height))] overflow-y-auto">
          <DawPanel {...dawProps} showTransportBar={false} className="h-full" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/pack/CompactDawStrip.tsx
git commit -m "feat: add CompactDawStrip collapsible wrapper for DawPanel"
```

---

## Task 8: Create ChordPopover and KeySigPopover

**Files:**
- Create: `client/src/spaces/pack/ChordPopover.tsx`
- Create: `client/src/spaces/pack/KeySigPopover.tsx`
- Create: `client/src/spaces/pack/TextAnnotationInput.tsx`

- [ ] **Step 1: Create ChordPopover**

```tsx
import { useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

const ROOTS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const QUALITIES = ['maj', 'min', '7', 'maj7', 'min7', 'dim', 'aug', 'sus2', 'sus4'] as const

interface ChordPopoverProps {
  position: { x: number; y: number }
  currentChord?: string
  onSelect: (chord: string) => void
  onClose: () => void
  className?: string
}

export function ChordPopover({ position, currentChord, onSelect, onClose, className }: ChordPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const selectedRoot = useRef<string>('')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  function handleRootClick(root: string) {
    selectedRoot.current = root
  }

  function handleQualityClick(quality: string) {
    const root = selectedRoot.current || 'C'
    const chord = quality === 'maj' ? root : `${root}${quality}`
    onSelect(chord)
  }

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 rounded-lg border border-border bg-surface-0 p-3 shadow-lg animate-fade-in',
        className,
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div className="mb-2 text-xs font-medium text-text-muted">Root</div>
      <div className="mb-3 grid grid-cols-6 gap-1">
        {ROOTS.map((root) => (
          <button
            key={root}
            onClick={() => handleRootClick(root)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              selectedRoot.current === root
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {root}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-medium text-text-muted">Quality</div>
      <div className="grid grid-cols-3 gap-1">
        {QUALITIES.map((q) => (
          <button
            key={q}
            onClick={() => handleQualityClick(q)}
            className="rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create KeySigPopover**

```tsx
import { useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

const KEYS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'] as const
const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8'] as const

interface KeySigPopoverProps {
  position: { x: number; y: number }
  currentKey?: string
  currentTimeSig?: string
  onKeyChange: (key: string) => void
  onTimeSigChange: (timeSig: string) => void
  onClose: () => void
  className?: string
}

export function KeySigPopover({
  position, currentKey, currentTimeSig,
  onKeyChange, onTimeSigChange, onClose, className,
}: KeySigPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 rounded-lg border border-border bg-surface-0 p-3 shadow-lg animate-fade-in',
        className,
      )}
      style={{ left: position.x, top: position.y }}
    >
      <div className="mb-2 text-xs font-medium text-text-muted">Key</div>
      <div className="mb-3 grid grid-cols-4 gap-1">
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => onKeyChange(k)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              currentKey === k
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-medium text-text-muted">Time Signature</div>
      <div className="grid grid-cols-3 gap-1">
        {TIME_SIGS.map((ts) => (
          <button
            key={ts}
            onClick={() => onTimeSigChange(ts)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              currentTimeSig === ts
                ? 'bg-surface-3 text-accent'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            {ts}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create TextAnnotationInput**

```tsx
import { useEffect, useRef } from 'react'
import { cn } from '@/components/ui/utils'

interface TextAnnotationInputProps {
  position: { x: number; y: number }
  defaultValue?: string
  onSubmit: (text: string) => void
  onCancel: () => void
  className?: string
}

export function TextAnnotationInput({
  position, defaultValue = '', onSubmit, onCancel, className,
}: TextAnnotationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const val = inputRef.current?.value.trim()
      if (val) onSubmit(val)
      else onCancel()
    }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      className={cn(
        'absolute z-50 animate-fade-in',
        className,
      )}
      style={{ left: position.x, top: position.y }}
    >
      <input
        ref={inputRef}
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        className="h-7 w-48 rounded border border-border bg-surface-0 px-2 text-sm text-text-primary shadow-lg outline-none focus:border-border-hover"
        placeholder="Add annotation..."
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/ChordPopover.tsx client/src/spaces/pack/KeySigPopover.tsx client/src/spaces/pack/TextAnnotationInput.tsx
git commit -m "feat: add ChordPopover, KeySigPopover, and TextAnnotationInput contextual editors"
```

---

## Task 9: Create EditorCanvas (OSMD Integration)

**Files:**
- Create: `client/src/spaces/pack/EditorCanvas.tsx`

- [ ] **Step 1: Create the OSMD canvas component**

```tsx
import { useEffect, useRef, useCallback } from 'react'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { ChordPopover } from './ChordPopover'
import { KeySigPopover } from './KeySigPopover'
import { TextAnnotationInput } from './TextAnnotationInput'

// Minimal MusicXML template for empty scores
const EMPTY_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

interface PopoverState {
  type: 'chord' | 'keySig' | 'text'
  position: { x: number; y: number }
  barIndex: number
}

interface EditorCanvasProps {
  className?: string
}

export function EditorCanvas({ className }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)

  const zoom = useEditorStore((s) => s.zoom)
  const viewMode = useEditorStore((s) => s.viewMode)
  const toolMode = useEditorStore((s) => s.toolMode)
  const selectedBars = useEditorStore((s) => s.selectedBars)
  const selectBar = useEditorStore((s) => s.selectBar)
  const selectRange = useEditorStore((s) => s.selectRange)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const [popover, setPopover] = useState<PopoverState | null>(null)

  // Initialize OSMD
  useEffect(() => {
    if (!containerRef.current) return
    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawTitle: false,
      drawComposer: false,
      drawCredits: false,
    })
    osmdRef.current = osmd

    // Load initial score or empty template
    osmd.load(EMPTY_MUSICXML).then(() => {
      osmd.render()
    })

    return () => {
      osmdRef.current = null
    }
  }, [])

  // Re-render on zoom change
  useEffect(() => {
    if (!osmdRef.current) return
    osmdRef.current.Zoom = zoom / 100
    osmdRef.current.render()
  }, [zoom])

  // Handle click on score
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Simple bar detection: divide the score width evenly by measure count
      // In production, OSMD's GraphicalMeasure positions would be used for precise hit-testing
      const osmd = osmdRef.current
      if (!osmd?.GraphicSheet) return

      const measures = osmd.GraphicSheet.MeasureList
      if (!measures || measures.length === 0) return

      // Approximate: find which measure was clicked
      const barIndex = findClickedMeasure(osmd, e.clientX, e.clientY, rect)
      if (barIndex < 0) {
        clearSelection()
        setPopover(null)
        return
      }

      if (toolMode === 'pointer') {
        selectBar(barIndex, e.shiftKey)
      } else if (toolMode === 'chord' || toolMode === 'keySig' || toolMode === 'text') {
        selectBar(barIndex)
        setPopover({
          type: toolMode === 'chord' ? 'chord' : toolMode === 'keySig' ? 'keySig' : 'text',
          position: { x: e.clientX - rect.left, y: e.clientY - rect.top - 10 },
          barIndex,
        })
      }
    },
    [toolMode, selectBar, clearSelection],
  )

  function handleChordSelect(chord: string) {
    // TODO: Apply chord to the selected bar in MusicXML via leadSheetStore
    setPopover(null)
  }

  function handleKeyChange(key: string) {
    useLeadSheetStore.getState().setKey(key)
    setPopover(null)
  }

  function handleTimeSigChange(timeSig: string) {
    useLeadSheetStore.getState().setTimeSignature(timeSig)
    setPopover(null)
  }

  function handleTextSubmit(text: string) {
    // TODO: Attach annotation to the selected bar
    setPopover(null)
  }

  return (
    <div className={cn('relative flex-1 overflow-y-auto bg-surface-0', className)}>
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="min-h-full cursor-crosshair p-6"
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
      />

      {/* Selection overlays would be rendered here based on OSMD measure positions */}

      {/* Contextual popovers */}
      {popover?.type === 'chord' && (
        <ChordPopover
          position={popover.position}
          onSelect={handleChordSelect}
          onClose={() => setPopover(null)}
        />
      )}
      {popover?.type === 'keySig' && (
        <KeySigPopover
          position={popover.position}
          currentKey={useLeadSheetStore.getState().key}
          currentTimeSig={useLeadSheetStore.getState().timeSignature}
          onKeyChange={handleKeyChange}
          onTimeSigChange={handleTimeSigChange}
          onClose={() => setPopover(null)}
        />
      )}
      {popover?.type === 'text' && (
        <TextAnnotationInput
          position={popover.position}
          onSubmit={handleTextSubmit}
          onCancel={() => setPopover(null)}
        />
      )}
    </div>
  )
}

/** Approximate measure hit-test using OSMD's graphic sheet. */
function findClickedMeasure(
  osmd: OpenSheetMusicDisplay,
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
): number {
  // OSMD renders SVG elements — walk the MeasureList to find which one contains the click point
  const measures = osmd.GraphicSheet.MeasureList
  if (!measures) return -1

  // Fallback: divide container width equally among measures
  const totalMeasures = measures.length
  const relativeX = clientX - containerRect.left
  const barWidth = containerRect.width / totalMeasures
  const index = Math.floor(relativeX / barWidth)
  return index >= 0 && index < totalMeasures ? index : -1
}
```

- [ ] **Step 2: Add missing import**

The `useState` import is missing from the initial code. Fix line 1:

```tsx
import { useEffect, useRef, useCallback, useState } from 'react'
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors (OSMD types may need `@types` or the package includes its own types)

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorCanvas.tsx
git commit -m "feat: add EditorCanvas with OSMD integration, click-to-select, contextual popovers"
```

---

## Task 10: Create Keyboard Shortcuts Hook

**Files:**
- Create: `client/src/hooks/useEditorKeyboard.ts`

- [ ] **Step 1: Create the keyboard hook**

```typescript
import { useEffect } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'

interface UseEditorKeyboardOptions {
  onPlayPause: () => void
  onDeleteBars: () => void
  enabled?: boolean
}

export function useEditorKeyboard({ onPlayPause, onDeleteBars, enabled = true }: UseEditorKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const meta = e.metaKey || e.ctrlKey

      if (e.key === ' ') {
        e.preventDefault()
        onPlayPause()
        return
      }

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().undo()
        return
      }

      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        useEditorStore.getState().redo()
        return
      }

      if (meta && e.key === '/') {
        e.preventDefault()
        useEditorStore.getState().toggleChatPanel()
        return
      }

      if (e.key === 'Escape') {
        useEditorStore.getState().clearSelection()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = useEditorStore.getState().selectedBars
        if (selected.length > 0) {
          e.preventDefault()
          onDeleteBars()
        }
        return
      }

      // Tool shortcuts (single letter, no modifier)
      if (!meta && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            useEditorStore.getState().setToolMode('pointer')
            break
          case 'c':
            useEditorStore.getState().setToolMode('chord')
            break
          case 't':
            useEditorStore.getState().setToolMode('text')
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onPlayPause, onDeleteBars])
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useEditorKeyboard.ts
git commit -m "feat: add useEditorKeyboard hook for editor shortcuts"
```

---

## Task 11: Create EditorPage (Layout Orchestrator)

**Files:**
- Create: `client/src/spaces/pack/EditorPage.tsx`

- [ ] **Step 1: Create the EditorPage component**

```tsx
import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { cn } from '@/components/ui/utils'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAudioStore } from '@/stores/audioStore'
import { useAgentStore } from '@/stores/agentStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useIsMobile } from '@/hooks/useIsMobile'
import { EditorTitleBar } from './EditorTitleBar'
import { EditorCanvas } from './EditorCanvas'
import { EditorToolbar } from './EditorToolbar'
import { EditorChatPanel } from './EditorChatPanel'
import { CompactDawStrip } from './CompactDawStrip'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()

  // Lead sheet state
  const projectName = useLeadSheetStore((s) => s.projectName)

  // Audio
  const playbackState = useAudioStore((s) => s.playbackState)

  // DAW
  const tracks = useDawPanelStore((s) => s.tracks)
  const updateTrack = useDawPanelStore((s) => s.updateTrack)
  const addTrack = useDawPanelStore((s) => s.addTrack)
  const removeTrack = useDawPanelStore((s) => s.removeTrack)

  // Editor
  const chatCollapsed = useEditorStore((s) => s.chatPanelCollapsed)

  // Set agent space context
  useEffect(() => {
    useAgentStore.getState().setSpaceContext({
      currentSpace: 'create',
      projectId: id,
      projectName,
    })
  }, [id, projectName])

  // Seed DAW tracks on mount if empty
  useEffect(() => {
    if (tracks.length === 0) {
      useDawPanelStore.getState().addTrack()
    }
  }, [tracks.length])

  // Playback toggle
  const handlePlayPause = useCallback(() => {
    const store = useAudioStore.getState()
    if (store.playbackState === 'playing') {
      store.setPlaybackState('paused')
    } else {
      store.setPlaybackState('playing')
    }
  }, [])

  // Bar management
  const handleAddBar = useCallback(() => {
    // TODO: Add a bar to the MusicXML in leadSheetStore
  }, [])

  const handleDeleteBars = useCallback(() => {
    const selected = useEditorStore.getState().selectedBars
    if (selected.length === 0) return
    // TODO: Delete selected bars from MusicXML in leadSheetStore
    useEditorStore.getState().clearSelection()
  }, [])

  const handleStylePicker = useCallback(() => {
    // TODO: Open playback style picker drawer
  }, [])

  const handleNameChange = useCallback((name: string) => {
    useLeadSheetStore.getState().setProjectName(name)
    useEditorStore.getState().setSaveStatus('unsaved')
  }, [])

  // Keyboard shortcuts
  useEditorKeyboard({
    onPlayPause: handlePlayPause,
    onDeleteBars: handleDeleteBars,
  })

  return (
    <div className="flex h-screen w-screen flex-col bg-surface-0">
      {/* Horizontal split: editor + chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor area */}
        <div className="relative flex flex-1 flex-col">
          <EditorTitleBar packName={projectName || 'Untitled'} onNameChange={handleNameChange} />

          <EditorCanvas className="flex-1" />

          <CompactDawStrip
            dawProps={{
              tracks,
              onUpdateTrack: updateTrack,
              onAddTrack: addTrack,
              onRemoveTrack: removeTrack,
              showRecordButton: true,
              totalBars: 16,
              beatsPerBar: 4,
            }}
          />

          {/* Floating toolbar — absolute within editor area */}
          <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
            <EditorToolbar
              onPlayPause={handlePlayPause}
              onAddBar={handleAddBar}
              onDeleteBars={handleDeleteBars}
              onStylePicker={handleStylePicker}
              className="pointer-events-auto"
            />
          </div>
        </div>

        {/* Right: Chat panel */}
        {!isMobile && <EditorChatPanel />}
      </div>

      {/* Mobile: Chat as bottom sheet (placeholder — full implementation in a later task) */}
      {isMobile && !chatCollapsed && (
        <div className="h-[40vh] border-t border-border">
          <EditorChatPanel />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check if `useIsMobile` hook exists**

Run:
```bash
ls /Users/p3tr4/Documents/LavaAI-demo/client/src/hooks/useIsMobile*
```

If it doesn't exist, check for a responsive hook:
```bash
grep -r "useIsMobile\|useMobile\|useMediaQuery" /Users/p3tr4/Documents/LavaAI-demo/client/src/hooks/
```

If `useIsMobile` doesn't exist, create it:

```typescript
// client/src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint)
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])
  return isMobile
}
```

- [ ] **Step 3: Check if `setProjectName` exists in leadSheetStore**

Run:
```bash
grep "setProjectName" /Users/p3tr4/Documents/LavaAI-demo/client/src/stores/leadSheetStore.ts
```

If it doesn't exist, add it to the store interface and implementation. Add after the existing `setKey` method:
```typescript
setProjectName: (name: string) => void
```
Implementation:
```typescript
setProjectName: (name) => set({ projectName: name }),
```

- [ ] **Step 4: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/EditorPage.tsx client/src/hooks/useIsMobile.ts
git commit -m "feat: add EditorPage layout orchestrator with horizontal split"
```

---

## Task 12: Wire Up Router

**Files:**
- Modify: `client/src/router.tsx`

- [ ] **Step 1: Replace PackPage with EditorPage in router**

In `client/src/router.tsx`, change the import and route:

Replace:
```typescript
import { PackPage } from './spaces/pack/PackPage'
```
With:
```typescript
import { EditorPage } from './spaces/pack/EditorPage'
```

Replace:
```typescript
{ path: 'pack/:id', element: <PackPage /> },
```
With:
```typescript
{ path: 'pack/:id', element: <EditorPage /> },
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck
```
Expected: No errors

- [ ] **Step 3: Verify the app starts and navigates to /pack/test**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm dev
```

Open `http://localhost:5173/pack/test` in a browser. Expected:
- Title bar with "Untitled" and back arrow
- OSMD canvas area (may show empty score)
- Compact DawPanel strip at bottom
- Floating toolbar at bottom-center
- Chat panel on the right with "Try these Lava Skills" chips

- [ ] **Step 4: Commit**

```bash
git add client/src/router.tsx
git commit -m "feat: wire EditorPage into router, replacing PackPage"
```

---

## Task 13: Visual Polish and Integration Testing

**Files:**
- Modify: `client/src/spaces/pack/EditorPage.tsx` (if adjustments needed)
- Modify: `client/src/spaces/pack/EditorToolbar.tsx` (if adjustments needed)
- Modify: `client/src/spaces/pack/EditorChatPanel.tsx` (if adjustments needed)

- [ ] **Step 1: Run the app and verify layout**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm dev
```

Navigate to `http://localhost:5173/pack/test`. Verify:

1. Title bar renders correctly with back button, name, save status
2. Score canvas takes up the main area
3. Floating toolbar is centered at the bottom of the editor area (not overlapping the chat panel)
4. Chat panel is on the right, ~380px wide
5. Chat panel resize handle works (drag left edge)
6. Chat panel collapse/expand toggles work
7. Toolbar tool buttons highlight when active
8. Keyboard shortcuts work: V (pointer), C (chord), T (text), Space (play/pause), Cmd+/ (toggle chat)
9. Compact DawPanel strip shows at the bottom of the editor area
10. DawPanel expand/collapse toggle works

- [ ] **Step 2: Fix any layout issues found during testing**

Common fixes:
- Toolbar z-index: ensure `z-20` or higher so it floats above the score canvas
- Chat panel resize: ensure the editor area fills remaining space using `flex-1`
- OSMD overflow: ensure the score container scrolls properly

- [ ] **Step 3: Verify typecheck and lint pass**

Run:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck && pnpm lint
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "fix: visual polish and layout adjustments for editor page"
```

---

## Summary

| Task | Component | Depends On |
|---|---|---|
| 1 | Install OSMD + CSS tokens | — |
| 2 | editorStore | — |
| 3 | EditorTitleBar | Task 2 |
| 4 | EditorChatEmptyState | — |
| 5 | EditorChatPanel | Tasks 2, 4 |
| 6 | EditorToolbar | Task 2 |
| 7 | CompactDawStrip | Task 2 |
| 8 | ChordPopover, KeySigPopover, TextAnnotationInput | — |
| 9 | EditorCanvas (OSMD) | Tasks 2, 8 |
| 10 | useEditorKeyboard | Task 2 |
| 11 | EditorPage (orchestrator) | Tasks 2–10 |
| 12 | Router wiring | Task 11 |
| 13 | Visual polish & integration | Task 12 |

**Parallelizable tasks:** Tasks 3, 4, 6, 7, 8, 10 can all be built in parallel (they depend only on Task 2). Tasks 5 and 9 each depend on one earlier task. Task 11 brings them together. Tasks 12–13 are sequential.
