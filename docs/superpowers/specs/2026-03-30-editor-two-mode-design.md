# Editor Two-Mode Design: Transform + Fine Edit

**Date:** 2026-03-30
**Status:** Approved

---

## Overview

Redesign the editor into two modes. **Transform Mode** (default) puts AI-driven song transformation front and center — the user says "make this easier" or "blues version" and gets a new version of the song. **Fine Edit Mode** (secondary) houses the current pro tools for manual notation editing. The toolbar simplifies for casual use without losing depth.

This spec covers five areas: mode system, version system, toolbar restructure, chat panel redesign, and core functionality completion.

---

## 1. Editor Mode System

### New store fields in `useEditorStore`

- `editorMode: 'transform' | 'fineEdit'` — defaults to `'transform'`
- `setEditorMode(mode)` — switches mode
- `isPreview` — derived from `useVersionStore.previewVersionId !== null` (not stored independently)

### Capability matrix per mode

| Capability | Transform Mode | Fine Edit Mode |
|---|---|---|
| Canvas score display | Yes | Yes |
| Bar selection (pointer/range) | Yes | Yes |
| Note selection & editing | No | Yes |
| Keyboard shortcuts (pitch, duration, accidentals) | No | Yes |
| Popovers (chord, key/time, annotation, lyric) | No | Yes |
| Context pill (delete, clear, copy, transpose) | No | Yes |
| Chat panel | Yes (primary) | Yes (secondary) |
| Playback controls | Yes | Yes |
| Version picker | Yes | Yes |
| Compare button | Yes | No |
| Undo/Redo | Yes (version-level) | Yes (edit-level) |

### Mode switch

A segmented control in the toolbar: `Transform | Fine Edit`. Switching from Fine Edit back to Transform preserves all edits (already persisted in MusicXML).

### Preview state

`isPreview` is a derived value: true when `useVersionStore.previewVersionId !== null`. It is not stored independently — `useEditorStore` exposes a `getIsPreview()` selector that reads from the version store.

When preview is active:
- Canvas renders the previewed version's MusicXML
- All editing is disabled regardless of mode
- A floating action bar appears with Apply, Discard, and Compare with original buttons
- Exiting preview restores the previous active version

---

## 2. Version System

### New store: `useVersionStore`

```ts
interface VersionState {
  versions: Version[]
  activeVersionId: string
  previewVersionId: string | null
}
```

### Version shape

```ts
interface Version {
  id: string                      // unique ID
  name: string                    // display name ("Original", "Blues", "Fingerpicking")
  source: 'arrangement' | 'ai-transform'
  arrangementId?: ArrangementId   // for tier 1 (links to existing arrangement system)
  musicXml: string                // full MusicXML snapshot
  parentVersionId?: string        // which version this was derived from
  createdAt: number               // timestamp
  prompt?: string                 // user prompt that generated it (AI only)
}
```

### Two tiers

**Tier 1 — Arrangements:** When a project loads with arrangements, each arrangement becomes a version entry with `source: 'arrangement'`. Maps to existing `buildPlayableArrangements()` output. "Original" is always first.

**Tier 2 — AI Transforms:** When the agent produces new MusicXML (from "Blues version," "Fingerpicking," etc.), it's added as a version with `source: 'ai-transform'`, `parentVersionId` pointing to the active version when the user requested it, and the `prompt` that generated it.

### Version picker

Toolbar dropdown showing version names. Arrangement versions show difficulty badges. AI transform versions show an "AI" badge. Selecting a version swaps `musicXml` in `useLeadSheetStore` and sets `activeVersionId`.

### Preview flow

1. AI generates new version — added to store, `previewVersionId` set
2. Canvas swaps to preview MusicXML, `isPreview` becomes true in editor store
3. Floating bar appears:
   - **Apply** — sets as active version, clears preview state
   - **Discard** — removes version from store, restores previous active version
   - **Compare** — enters side-by-side view

### Compare view

Canvas splits horizontally — original on left, preview on right. Both render OSMD instances at the same zoom level. A "Close compare" button returns to single-canvas view.

### Relationship to existing arrangement system

`useLeadSheetStore` currently holds `arrangements: PlayableArrangement[]` and `selectedArrangementId`. Once the version system is in place, these fields become the **data source** for tier 1 versions but are no longer the primary selection mechanism. On project load, `useVersionStore` reads `arrangements` from the lead sheet store and creates version entries from them. `selectedArrangementId` is kept in sync: when the user selects a tier 1 version, `selectedArrangementId` updates to match. For tier 2 (AI) versions, `selectedArrangementId` remains unchanged (pointing to whichever arrangement was last active). This avoids breaking existing code that reads `selectedArrangementId`.

### Persistence

Versions are saved to the server alongside the project. On project load, versions are restored. The undo stack in `useEditorStore` remains per-session and applies to Fine Edit changes within the active version only.

---

## 3. Toolbar Restructure

### Transform Mode toolbar (left to right)

| Group | Controls |
|---|---|
| Mode switch | `Transform \| Fine Edit` segmented control |
| Playback | Play/Pause, Restart, BPM display |
| Loop | Loop toggle + start/end |
| Speed | Playback speed (0.5x-2x) |
| Version | Version picker dropdown |
| Compare | Compare with original (disabled if only one version) |
| Zoom | Zoom out / percentage / Zoom in |
| Selection | Pointer, Range select |

### Fine Edit Mode toolbar (left to right)

| Group | Controls |
|---|---|
| Mode switch | `Transform \| Fine Edit` segmented control |
| Playback | Play/Pause, Restart, BPM display |
| Selection | Pointer, Range select |
| Editing | Chord, Key/Time Sig, Annotation/Text |
| Bars | Add bar, Delete bars |
| History | Undo, Redo |
| View | View mode cycle (Staff / Lead Sheet / Tab) |
| Training wheels | Chord diagrams toggle, Beat grid toggle |
| Zoom | Zoom out / percentage / Zoom in |

### Implementation

`EditorToolbar` reads `editorMode` from the store. Shared controls (mode switch, playback, zoom) always render. Mode-specific controls conditionally render. No new component files — conditional sections within the existing toolbar.

### Floating preview bar

Fixed at the top of the canvas area, only visible when `isPreview` is true. Shows the preview version name ("Previewing: Blues Version") with Apply, Discard, and Compare with original buttons. Full width of the canvas area.

---

## 4. Chat Panel Redesign

### Empty state — no bars selected (global suggestions)

| Label | Prompt sent |
|---|---|
| "Make easier" | "Make an easier version of this song" |
| "Blues version" | "Create a blues arrangement of this song" |
| "Fingerpicking" | "Create a fingerpicking version of this song" |
| "Transpose for my voice" | "Transpose this song to suit my vocal range" |
| "Open chords" | "Rearrange this song to use only open chords" |
| "Unique cover version" | "Create a unique cover arrangement of this song" |

### Empty state — bars selected (section-focused suggestions)

| Label | Prompt sent |
|---|---|
| "Simplify this section" | "Simplify bars {X}-{Y}" |
| "Make this the solo" | "Turn bars {X}-{Y} into a guitar solo section" |
| "Different strumming" | "Change the strumming pattern for bars {X}-{Y}" |
| "Add fills" | "Add fills and embellishments to bars {X}-{Y}" |
| "Change chords" | "Suggest alternative chords for bars {X}-{Y}" |
| "Simplify rhythm" | "Simplify the rhythm in bars {X}-{Y}" |

Bar numbers are injected dynamically from `selectedBars` in `useEditorStore`.

### During conversation

Suggestions hide once messages exist. The selected-bars badge remains visible above the input.

### Agent response for transforms

When the agent produces a new version, the chat thread shows a version card via a new `message.subtype: 'versionCreated'`. The card shows the version name, a short description of changes, and inline Preview and Apply buttons. Rendered by `ChatMessage` — similar to existing `toneActions` card pattern.

### Server-side: `create_version` tool

New tool in the tool registry. Agent calls it with `{ name, musicXml, changeSummary }`. The tool executor:
1. Adds the version to the client via SSE stream (`version_created` event type)
2. Returns confirmation to the LLM for its follow-up message

For now, the agent's MusicXML generation is mocked — returns a modified copy of the current MusicXML. Real LLM-driven arrangement generation is a future step.

---

## 5. Core Functionality Completion

These fixes land before the mode/version/toolbar/chat work. They fix existing TODOs that affect both modes.

### 5.1 Chord application

`EditorCanvas.handleChordSelect()` — call `musicXmlEngine.setChord(xml, barIndex, beatIndex, chordSymbol)` with undo support, then re-render. Engine function is complete.

### 5.2 Annotation attachment

`EditorCanvas.handleTextSubmit()` — call `musicXmlEngine.setAnnotation(xml, barIndex, text)` with undo support. Engine function is complete.

### 5.3 Key/Time signature changes

Key signature popover handler must call `setKeySig()` and `setTimeSig()` with undo, applying from the selected bar forward.

### 5.4 Dot/triplet duration

`lava-toggle-dot` and `lava-toggle-triplet` events are dispatched but need canvas-side listeners that modify note durations via the engine.

### 5.5 Chord diagram display

`showChordDiagrams` toggle exists in store and toolbar. Needs to render chord diagrams above measures when enabled, using `ChordDiagramPopover` as reference.

### 5.6 Beat grid display

`showBeatMarkers` toggle exists. Beat marker rendering (`lava-beat-marker` SVG lines) needs to be injected into measures when enabled.

### 5.7 View mode switching

View mode cycles through `staff | leadSheet | tab`. OSMD needs reconfiguration for each mode (tab mode requires tablature staves).

### 5.8 Playback tied to score length

`duration` in `audioStore` must be derived from actual measure count and BPM rather than a static value.

---

## Implementation Order

1. **Core functionality fixes** (Section 5) — contained within existing files
2. **Mode system** (Section 1) — store fields + conditional rendering in toolbar and canvas
3. **Version store** (Section 2) — new store, version picker, preview/compare flow
4. **Toolbar restructure** (Section 3) — conditional toolbar sections per mode
5. **Chat panel redesign** (Section 4) — new suggestions, version cards, `create_version` tool

---

## Files affected

### New files
- `client/src/stores/versionStore.ts` — `useVersionStore`
- `client/src/spaces/pack/VersionPicker.tsx` — toolbar dropdown
- `client/src/spaces/pack/PreviewBar.tsx` — floating preview action bar
- `client/src/spaces/pack/CompareView.tsx` — side-by-side OSMD comparison

### Modified files
- `client/src/stores/editorStore.ts` — add `editorMode`, `setEditorMode`
- `client/src/spaces/pack/EditorToolbar.tsx` — conditional sections per mode, mode switch, version picker slot, compare button, loop/speed controls
- `client/src/spaces/pack/EditorCanvas.tsx` — disable editing in transform mode, chord/annotation TODO fixes, dot/triplet listeners, chord diagrams, beat grid, view mode OSMD config
- `client/src/spaces/pack/EditorChatPanel.tsx` — pass selected bars to empty state
- `client/src/spaces/pack/EditorChatEmptyState.tsx` — two suggestion sets (global vs. section-focused), dynamic bar numbers
- `client/src/spaces/pack/EditorPage.tsx` — wire preview bar, compare view, playback duration from score
- `client/src/components/agent/ChatMessage.tsx` — render `versionCreated` subtype cards
- `server/src/agent/tools/` — new `create_version` tool
- `server/src/agent/prompts/context.ts` — updated editor context for transform-oriented guidance
- `packages/shared/src/types/` — `Version` type definition

---

## Out of scope

- Real LLM-driven MusicXML generation (mocked for now)
- Audio playback of AI-generated versions (uses same OSMD + tone.js pipeline)
- Multi-user collaboration on versions
- Version diffing (visual diff between two MusicXML documents)
