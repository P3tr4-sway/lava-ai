# Pack Editor Redesign — Lovart-Style Score Editor

**Date:** 2026-03-29
**Status:** Draft
**Approach:** Hybrid (C) — new layout component, reuse internals from PackPage

---

## Overview

Redesign the `PackPage` (`/pack/:id`) into an immersive, Lovart/Figma-inspired score editor. The current vertical layout (score top, chat bottom) is replaced with a horizontal split: a full editing canvas on the left with a floating toolbar, and an AI chat panel on the right.

The score rendering switches from the custom `FollowView` component to **OpenSheetMusicDisplay (OSMD)**, supporting staff notation, guitar tablature, and lead sheet views.

All UI follows the existing Figma design system — surface colors, border tokens, typography, radius, and spacing from `tokens.css`.

---

## Layout

### Overall Structure

The editor is **immersive** — no AppShell sidebar. The page fills the full viewport.

```
┌─────────────────────────────────────────────────┬──────────────────────┐
│  EDITOR AREA                                    │  CHAT PANEL          │
│                                                 │                      │
│  ┌─ Title Bar ──────────────────────────────┐   │  ┌────────────────┐  │
│  │ ← Back  │ Pack Name ▾ │  ● Saved  │ ⚡80 │   │  │  New chat   ─☐│  │
│  └──────────────────────────────────────────┘   │  ├────────────────┤  │
│                                                 │  │                │  │
│  ┌──────────────────────────────────────────┐   │  │  Messages /    │  │
│  │                                          │   │  │  Empty state   │  │
│  │         OSMD Score Canvas                │   │  │  (skill chips) │  │
│  │     (staff / tab / lead sheet)           │   │  │                │  │
│  │     scrollable, zoomable                 │   │  │                │  │
│  │                                          │   │  │                │  │
│  └──────────────────────────────────────────┘   │  │                │  │
│                                                 │  │                │  │
│  ┌──────────────────────────────────────────┐   │  ├────────────────┤  │
│  │  ▾ Compact DawPanel (collapsible strip)  │   │  │ [📎] input [➤] │  │
│  └──────────────────────────────────────────┘   │  └────────────────┘  │
│                                                 │                      │
│         ┌─────────────────────────┐             │                      │
│         │  Floating Toolbar (pill) │             │                      │
│         └─────────────────────────┘             │                      │
└─────────────────────────────────────────────────┴──────────────────────┘
```

### Title Bar

Sits at the top of the editor area (not the global TopBar):

- **Back button** (← arrow) — returns to previous page
- **Pack name** — editable inline (click to edit, Enter to confirm)
- **Save status indicator** — "Saved" / "Saving..." / "Unsaved changes" with a dot
- **Credits display** — lightning bolt + count (from existing pattern)

Styling: `bg-surface-0 border-b border-border h-12 px-4 flex items-center justify-between`

### Chat Panel (Right Side)

- **Default width:** 380px
- **Resizable:** drag handle on the left edge, min 320px, max 50vw
- **Collapsible:** toggle button collapses to a thin strip (~40px) with a chat icon; re-opens via the same toggle or `Cmd+/`
- **Background:** `bg-surface-0 border-l border-border`

### Compact DawPanel

- **Collapsed (default):** thin strip (~40px) showing toggle arrow, track count ("3 tracks"), mini transport indicator
- **Expanded:** reveals full DawPanel, capped at ~200px with internal scroll
- **Resize:** drag handle on top edge to resize between collapsed and expanded
- Styling: `bg-surface-1 border-t border-border`

---

## Floating Toolbar

Pill-shaped bar floating at bottom-center of the editor area, modeled after Lovart/Figma.

### Visual Design

- Shape: `rounded-full`
- Background: `bg-surface-0`
- Border: `border border-border`
- Shadow: `shadow-lg`
- Padding: `px-2 py-1.5`
- Icon buttons: `size-8 rounded-lg` with `hover:bg-surface-2` and `active:bg-surface-3`
- Tool groups separated by thin vertical dividers (`w-px h-5 bg-border`)
- Positioned: `absolute bottom-6 left-1/2 -translate-x-1/2` within the editor area's `relative` container (not `fixed`, since chat panel shifts the editor area)

### Tool Groups (left to right)

| Group | Tools | Icons (lucide-react) |
|---|---|---|
| **Playback** | Play/pause toggle, tempo display (clickable) | `Play`, `Pause` |
| **Selection** | Pointer (single bar), Range select (multi-bar) | `MousePointer2`, `BoxSelect` |
| **Editing** | Chord tool, Key/time sig, Text annotation | `Hash`, `Music`, `Type` |
| **History** | Undo, Redo | `Undo2`, `Redo2` |
| **Bar mgmt** | Add bar, Delete bar | `Plus`, `Trash2` |
| **Style** | Playback style picker (opens popover) | `Disc3` |
| **View/Zoom** | Zoom out, zoom %, zoom in, view mode dropdown | `ZoomOut`, `ZoomIn`, `Layers` |

### Active Tool State

- Active tool button gets `bg-surface-3` background and `text-accent` color
- Only one tool active at a time within selection/editing groups
- Playback, history, bar mgmt, zoom are instant actions (not toggle states)

---

## Score Canvas

### OSMD Integration

- **Library:** `opensheetmusicdisplay` (npm)
- **Source of truth:** MusicXML stored in `leadSheetStore`
- **Rendering:** OSMD renders MusicXML → SVG into a container div
- **View modes:** Staff (standard notation), Lead Sheet (chord symbols + melody), Tab (guitar tablature — OSMD does not natively support tab, so tab view will use a lightweight custom SVG renderer or a future OSMD plugin; staff and lead sheet are MVP, tab is stretch)
- **Zoom:** 50%–200%, controlled via toolbar, applied as CSS transform on the container
- **Scroll:** vertical scroll for long scores, container uses `overflow-y-auto`

### Selection & Interaction

**Pointer tool (`MousePointer2`):**
- Click a bar → selects it (highlight with `accent/10` overlay + `border-accent` outline)
- Shift+click → add to selection
- Click empty area → deselect all
- `Escape` → deselect all

**Range tool (`BoxSelect`):**
- Click+drag → select range of bars
- Same highlight styling as pointer

**Chord tool (`Hash`):**
- Click a selected bar → opens `ChordPopover` near the selection
- Popover contains: root note grid (C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B) + quality buttons (maj, min, 7, maj7, min7, dim, aug, sus2, sus4) + extensions
- Selecting a chord applies it immediately and pushes to undo stack

**Key/Time Sig tool (`Music`):**
- Click → opens `KeySigPopover` near the selection
- Key selector (all 12 keys, major/minor toggle) + time signature picker (4/4, 3/4, 6/8, etc.)

**Text tool (`Type`):**
- Click a bar → opens inline text input for annotation
- Enter confirms, Escape cancels

**Double-click shortcut:**
- Double-clicking any chord symbol in the score inline-edits it directly (regardless of active tool)

---

## Chat Panel

### Header

- "New chat" title, left-aligned
- Action buttons, right-aligned: new chat, minimize/collapse panel
- Divider below: `border-b border-border`

### Empty State

Centered content when no messages:

- Heading: **"Try these Lava Skills"** — `text-base font-semibold text-text-primary`
- Skill suggestion chips in a wrapped flex layout — `flex flex-wrap justify-center gap-2`
- Each chip: `rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 cursor-pointer`
- Chip icon + label (using lucide icons)

Suggested skills:
- "Arrange for band"
- "Transpose to..."
- "Add chord progression"
- "Generate accompaniment"
- "Simplify chords"
- "Add intro/outro"

Clicking a chip calls `chatInputRef.current?.setValue(text)` to prefill the input.

### Message History

- Scrollable area, `overflow-y-auto flex-1`
- Reuses existing `ChatMessage` component
- AI responses include **action chips** — clickable buttons that apply changes to the score:
  - "Apply this change" — applies the AI's suggested MusicXML modification
  - "Replace bars N-M" — replaces specific bars
  - Chips use the existing `onChipClick` pattern in `ChatMessage`

### Chat Input (Footer)

- Attachment button (📎) on the left — `Paperclip` icon
- Text input in the middle — reuses `ChatInput` in compact mode
- Send button (➤) on the right — `SendHorizontal` icon
- **Selection context tag:** when bars are selected, a small tag appears above the input: `"Selected: bars 4-8"` in a `bg-surface-2 rounded px-2 py-0.5 text-xs text-text-secondary` badge

---

## State Management

### New Store: `useEditorStore`

```typescript
interface EditorState {
  // Tool state
  toolMode: 'pointer' | 'range' | 'chord' | 'keySig' | 'text'
  setToolMode: (mode: EditorState['toolMode']) => void

  // Selection
  selectedBars: number[]
  selectBar: (bar: number, additive?: boolean) => void
  selectRange: (start: number, end: number) => void
  clearSelection: () => void

  // View
  viewMode: 'staff' | 'tab' | 'leadSheet'
  setViewMode: (mode: EditorState['viewMode']) => void
  zoom: number  // 50–200
  setZoom: (zoom: number) => void

  // Undo/Redo
  undoStack: string[]  // MusicXML snapshots, max 50 entries (FIFO eviction)
  redoStack: string[]  // cleared on new edit
  pushUndo: (snapshot: string) => void
  undo: () => void
  redo: () => void

  // Panel state
  chatPanelWidth: number
  setChatPanelWidth: (width: number) => void
  chatPanelCollapsed: boolean
  toggleChatPanel: () => void
  dawPanelExpanded: boolean
  toggleDawPanel: () => void

  // Save
  saveStatus: 'saved' | 'saving' | 'unsaved'
  setSaveStatus: (status: EditorState['saveStatus']) => void
}
```

### Reused Stores

| Store | Usage in Editor |
|---|---|
| `leadSheetStore` | MusicXML data, sections, chords, metadata, key, tempo |
| `audioStore` | Playback state, transport, BPM, current bar position |
| `dawPanelStore` | Tracks, clips for the compact DawPanel |
| `agentStore` | Chat messages, streaming, tool activities |

### AI Data Flow

1. User selects bars → `editorStore.selectedBars` updates
2. User types in chat → message sent with context: `{ selectedBars, viewMode, currentMusicXML }`
3. AI responds with tool calls (e.g., `update_chords`, `insert_bars`, `transpose`)
4. Tool result applies changes to `leadSheetStore` → MusicXML updates → OSMD re-renders
5. Previous MusicXML snapshot pushed to `undoStack` before changes
6. Action chips in chat let user accept/reject

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Play/pause |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+/` | Toggle chat panel |
| `Escape` | Deselect / close popovers |
| `Delete` / `Backspace` | Delete selected bars |
| `V` | Pointer tool |
| `C` | Chord tool |
| `T` | Text tool |

---

## Component Architecture

### New Components

```
client/src/spaces/pack/
├── EditorPage.tsx              — top-level layout, replaces PackPage
├── EditorTitleBar.tsx          — back button, pack name, save status
├── EditorCanvas.tsx            — OSMD renderer, zoom, scroll, selection overlay
├── EditorToolbar.tsx           — floating pill toolbar
├── EditorChatPanel.tsx         — right-side chat panel, resize, collapse
├── EditorChatEmptyState.tsx    — skill suggestion chips
├── CompactDawStrip.tsx         — collapsed/expandable DawPanel strip
├── ChordPopover.tsx            — contextual chord editor
├── KeySigPopover.tsx           — key/time signature popover
├── TextAnnotationInput.tsx     — inline text annotation input

client/src/stores/
└── editorStore.ts              — Zustand store for editor state
```

### Reused Components

- `ChatInput` — chat panel input (compact mode)
- `ChatMessage` — message rendering with action chips
- `useAgent()` — message sending and tool result handling
- `DawPanel` — rendered inside CompactDawStrip when expanded
- `agentStore`, `leadSheetStore`, `audioStore`, `dawPanelStore`

### Removed / Replaced

- `FollowView` — replaced by OSMD canvas
- `ScoreVersionRail` — arrangement switching moves to title bar dropdown
- `LeadSheetPlaybackBar` — playback controls move into floating toolbar
- `PackPage.tsx` — replaced by EditorPage.tsx (keep temporarily for reference)

### New Dependency

- `opensheetmusicdisplay` — OSMD npm package

---

## Mobile Behavior (< 768px)

- **Full-width editor** — score canvas takes full screen
- **Chat panel → bottom sheet** — swipe up from a handle at the bottom to reveal chat, similar to current PackPage's bottom chat zone
- **Toolbar shrinks** — less-used tools move into an overflow menu (⋯ button)
- **DawPanel** — same collapsible strip behavior
- **Contextual popovers → bottom drawers** — chord picker etc. render as drawers on mobile

---

## Design System Compliance

All UI uses existing tokens from `tokens.css`:

- **Surfaces:** `bg-surface-0` through `bg-surface-4`
- **Text:** `text-text-primary`, `text-text-secondary`, `text-text-muted`
- **Borders:** `border-border`, `border-border-hover`
- **Accent:** `text-accent`, `bg-accent` for active states
- **Radius:** `rounded` (4px), `rounded-lg` (8px), `rounded-full` for toolbar pill
- **Typography:** `font-sans` (Inter), `font-mono` (JetBrains Mono)
- **Animations:** `animate-fade-in`, `animate-slide-in-right`
- **Icons:** `lucide-react` only, `size-4` / `size-5` default
- **Class merging:** `cn()` from `@/components/ui/utils`
- **No hardcoded hex colors, no inline styles for colors/spacing**
