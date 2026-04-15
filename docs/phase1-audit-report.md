# Phase 1 — Current State Audit Report

**Project:** LavaAI — Guitar Tab Editor  
**Branch:** `Tabeditor_rebuild`  
**Audit Date:** 2026-04-08  
**Auditor:** Claude Code (read-only; no files modified)  
**Plan Reference:** tab-editor-rebuild-plan-EN.md

---

## Executive Summary

The codebase is in a **significantly more advanced state** than the rebuild plan assumed at time of writing. The three "known issues" in the plan (cursor not moving, playback broken, dead code from experiments) have all been addressed in prior development cycles. This report documents the actual current state as a baseline for deciding which phases of the plan still apply, which need adjustment, and which are already complete.

**Key finding:** The project already has a working alphaTab integration, a functional cursor system, working playback, and a production-grade command/history architecture — but using a different data model than the plan proposes (MusicXML/ScoreDocument rather than alphaTex AST).

---

## 1. Project Structure Overview

### Monorepo Layout

```
/Users/p3tr4/Documents/LavaAI-demo/
├── client/                          # React 18 + Vite 5 frontend (port 5173)
│   ├── src/
│   │   ├── spaces/pack/             # ★ Editor workspace (primary focus)
│   │   │   ├── TabCanvas.tsx        # alphaTab renderer — 1097 LOC
│   │   │   ├── EditSurface.tsx      # Custom SVG canvas — 751 LOC
│   │   │   ├── PracticeSurface.tsx  # Thin wrapper → TabCanvas — 25 LOC
│   │   │   ├── StaffPreview.tsx     # OSMD renderer — 214 LOC — ORPHANED ❌
│   │   │   ├── EditorCanvas.tsx     # Container with CursorOverlay — 94 LOC
│   │   │   ├── EditorPage.tsx       # Route /pack/:id — top-level
│   │   │   ├── EditorTitleBar.tsx
│   │   │   ├── EditorToolbar.tsx
│   │   │   └── editor-core/        # Command system (16 files, ~1200 LOC)
│   │   │       ├── commands.ts          # moveCaretByStep, durationToBeats
│   │   │       ├── commandRouter.ts     # Dispatch → handlers
│   │   │       ├── validation.ts        # Bar capacity + duration truncation
│   │   │       ├── layout.ts            # Hit-testing geometry
│   │   │       ├── toolbarBridge.ts     # Custom event → command mapper
│   │   │       ├── techniqueDefinitions.ts  # Data-driven registry
│   │   │       └── handlers/            # 11 handler modules + test files
│   │   ├── components/score/        # Score UI components
│   │   │   ├── CursorOverlay.tsx    # SVG cursor (select/playback) — 50 LOC
│   │   │   ├── LeadSheetPlaybackBar.tsx
│   │   │   ├── PlaybackStylePickerDrawer.tsx
│   │   │   └── [others]
│   │   ├── lib/
│   │   │   ├── cursorMath.ts        # Pure math: lerp, snap, mode derivation
│   │   │   ├── cursorIcons.ts       # SVG data URI cursor generators
│   │   │   ├── scoreDocument.ts     # Music data model — 755 LOC
│   │   │   ├── pitchUtils.ts        # MIDI ↔ pitch conversion
│   │   │   └── musicXmlEngine.ts    # MusicXML read/write
│   │   ├── hooks/
│   │   │   ├── useCursorEngine.ts   # Cursor rAF loop + snap + playback interpolation
│   │   │   ├── useEditorKeyboard.ts # Keyboard shortcuts
│   │   │   ├── usePlaybackStateBridge.ts
│   │   │   ├── useScoreSync.ts
│   │   │   └── useAutoSave.ts
│   │   └── stores/
│   │       ├── editorStore.ts       # Tool mode, selection, zoom, panels
│   │       ├── scoreDocumentStore.ts # Document + undo/redo + command apply
│   │       └── audioStore.ts        # Playback state, current time, BPM
│   └── public/
│       └── vendor/alphatab/
│           ├── alphaTab.min.mjs     # v1.8.1 main bundle
│           ├── alphaTab.worker.min.mjs
│           ├── sonivox.sf2          # 1.3 MB SoundFont ✅
│           └── font/Bravura.*       # Music notation font ✅
├── server/                          # Fastify 4 API (port 3001)
│   └── src/routes/ | agent/ | db/
├── packages/shared/                 # Shared TypeScript types + Zod schemas
└── docs/superpowers/plans/          # Prior implementation plans (not the rebuild plan)
    ├── 2026-03-31-editor-cursor-system.md
    ├── 2026-03-31-guitar-tab-editing-fixes.md
    └── 2026-04-03-score-editor-guitar-pro-parity.md
```

### Key Dependencies (client/package.json)

| Package | Version | Role |
|---|---|---|
| `@coderline/alphatab` | ^1.8.1 | Rendering engine + playback |
| `opensheetmusicdisplay` | ^1.9.7 | Staff view (experimental, mostly unused) |
| `zustand` | ^4.5.5 | State management |
| `tone` | ^15.1.22 | Audio (Tone.js — for non-alphaTab audio) |
| `wavesurfer.js` | ^7.12.4 | Waveform display |
| `react` | ^18.3.1 | UI framework |

**Notable absences vs. rebuild plan:**
- `xstate` — not installed (input state machine is hand-rolled)
- `nanoid` — not installed (IDs generated differently)
- `immer` — not installed (mutations handled via immutable spread in handlers)
- `vitest` — used for tests (`cursorMath.test.ts`, `scoreDocument.test.ts`, etc.)

### Build / Run Commands

```bash
pnpm dev          # Starts client (port 5173) + server (port 3001) concurrently
pnpm build        # TypeScript compile + Vite bundle
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
```

---

## 2. alphaTab Integration Status

### Version & Installation Method

- **Version:** 1.8.1 (`@coderline/alphatab` npm package)
- **Runtime delivery:** Browser bundles reference `/vendor/alphatab/alphaTab.min.mjs` from `client/public/vendor/` (static asset serving via Vite)
- **Worker:** `/vendor/alphatab/alphaTab.worker.min.mjs` — loaded automatically by alphaTab
- **Font:** Bravura loaded from `/vendor/alphatab/font/` — correctly configured

### Initialization Code

**Location:** `client/src/spaces/pack/TabCanvas.tsx` lines 483–510

```typescript
const api = new AlphaTabApi(alphaTabRootRef.current, {
  core: {
    engine: 'svg',               // SVG (not Canvas2D)
    enableLazyLoading: false,
    fontDirectory: '/vendor/alphatab/font/',
    includeNoteBounds: true,     // Required for hit-testing
    useWorkers: false,           // Synchronous render
  },
  display: {
    barsPerRow: 4,
    layoutMode: LayoutMode.Page,
    scale: zoom / 100,
    staveProfile: staveProfile,  // Tab | Staff | ScoreTab
  },
  notation: {
    rhythmMode: TabRhythmMode.Automatic,
  },
  player: {
    playerMode: PlayerMode.EnabledAutomatic,
    soundFont: '/vendor/alphatab/sonivox.sf2',
    enableCursor: true,
    enableAnimatedBeatCursor: true,
    enableUserInteraction: false,
  },
})
```

**Assessment:** All critical settings are present and correct. No configuration gaps.

### Score Source

- **Data format in use:** MusicXML (not alphaTex)
- **Source of truth:** `ScoreDocument` TypeScript object (`client/src/lib/scoreDocument.ts`)
- **Render path:** `ScoreDocument` → `exportScoreDocumentToMusicXml()` → MusicXML string → `api.load(xmlBytes)` → alphaTab renders

**Divergence from rebuild plan:** The plan proposes alphaTex as the source of truth with a custom AST. The current implementation uses MusicXML as the interchange format with a custom `ScoreDocument` TypeScript model. Both approaches achieve the same architectural goal (custom mutable document → renderer-readable format).

---

## 3. Feature Inventory

| Feature | Status | Notes |
|---|---|---|
| Tab rendering (alphaTab SVG) | ✅ Working | 4 bars/row, Page layout, Tab/Staff/ScoreTab stave profiles |
| Staff rendering (OSMD) | ❌ Orphaned | StaffPreview.tsx exists but is never imported or used |
| Playback (AlphaSynth) | ✅ Working | PlayerMode.EnabledAutomatic; SoundFont at correct path |
| Playback cursor | ✅ Working | enableCursor + enableAnimatedBeatCursor in config |
| Custom selection cursor | ✅ Working | CursorOverlay.tsx + useCursorEngine.ts fully implemented |
| Cursor movement (arrow keys) | ✅ Fixed | Grid-snap fix applied; no float drift |
| Beat hit-testing | ✅ Working | boundsLookup.getBeatAtPos(x,y) → EditorCaret |
| Note hit-testing | ✅ Working | boundsLookup.getNoteAtPos(beat,x,y) → selection sync |
| Note entry (digit keys) | ✅ Working | insertNoteAtCaret command; fret + string |
| Two-digit fret input | ⚠️ Partial | Timer-based two-digit pending state designed but not verified complete |
| Chord input (same beat) | ✅ Working | Shift+click or ↑/↓ then digit adds note to same beat |
| Duration selection | ✅ Working | Q/W/E/R/T/Y mapped to durations in useEditorKeyboard.ts |
| Dot toggle | ✅ Working | Keyboard shortcut and toolbar button wired |
| Tuplet toggle | ✅ Working | Triplet toggle wired |
| Rest toggle | ✅ Working | Toolbar + keyboard shortcut |
| Tie toggle | ✅ Working | Wired via toolbarBridge |
| Hammer-on / Pull-off | ⚠️ Partial | Data model supports it; handler stubs exist; parameters not fully settable via UI |
| Slide (all types) | ⚠️ Partial | Data model has slide type field; UI mapping incomplete |
| Bend (curve points) | ⚠️ Partial | BendPoint[] in data model; no UI for editing curve |
| Vibrato | ⚠️ Partial | Data model flag; handler stub |
| Harmonic | ⚠️ Partial | Data model flag; handler stub |
| Palm mute / Let ring | ⚠️ Partial | Data model flags; handler stubs |
| Ghost / Dead note / Tap | ⚠️ Partial | Data model flags; handler stubs |
| Dynamics / Accent / Stroke | ⚠️ Partial | Schema present; UI not complete |
| Bar insert / delete | ✅ Working | handlers/measures.ts; keyboard shortcut wired |
| Time signature (global) | ✅ Working | setTimeSignature in scoreMeta.ts |
| Time signature (per-bar) | ⚠️ Partial | Schema supports it; UI missing |
| Key signature | ✅ Working | setKeySignature in scoreMeta.ts |
| Tempo (global) | ✅ Working | setTempo in scoreMeta.ts |
| Tempo (per-bar) | ⚠️ Partial | Schema supports it; UI missing |
| Repeat marks | ⚠️ Partial | Schema fields; no UI |
| Section labels | ⚠️ Partial | Schema fields; no UI |
| Chord symbols | ⚠️ Partial | UI component exists; playback/export integration TBD |
| Lyrics | ⚠️ Partial | setLyric handler; LyricInput UI exists; keyboard shortcut wired |
| Copy / Paste | ✅ Implemented | clipboard.ts; copySelection/pasteSelection commands |
| Undo / Redo | ✅ Working | scoreDocumentStore undo/redo stacks; Ctrl+Z/Ctrl+Y |
| Playback speed control | ✅ Working | audioStore playbackRate → api.playbackSpeed |
| Playback loop | ⚠️ Unknown | Not confirmed in audit |
| Metronome | ⚠️ Unknown | Not confirmed |
| Auto-save | ✅ Working | useAutoSave.ts timer |
| JSON persistence | ✅ Working | scoreDocumentStore serialization |
| GP file import | ❌ Not implemented | |
| MIDI export | ❌ Not implemented | |
| PDF export | ⚠️ Partial | ExportPdfDialog.tsx exists; implementation TBD |
| Zoom | ✅ Working | Slider → display.scale in alphaTab config |
| Stave profile switch | ✅ Working | Tab / Staff / ScoreTab toggle |
| Multi-track | ⚠️ Partial | Schema supports tracks array; UI for adding/removing tracks TBD |

---

## 4. Root Cause Analysis — "Cursor Won't Move"

**Status: RESOLVED** ✅ (fixed in prior development, before this audit)

### Original Problem

In `editor-core/commands.ts`, `moveCaretByStep()` previously used `.toFixed(2)` for beat values:

```typescript
// BUG (old code — no longer present):
let nextBeat = Number((caret.beat + step).toFixed(2))
```

After ~8 arrow presses, floating-point string formatting accumulated error (e.g., `0.9999999999` instead of `1.0`), causing beat positions to drift off the quarter-note grid. The hit-test lookup then failed to find matching beats, so the cursor appeared to stop.

### Current Implementation (Fixed)

`editor-core/commands.ts` lines 16–49:

```typescript
const snapToQuarterGrid = (value: number) => Math.round(value * 4) / 4
```

This maps any float to the nearest 1/16th-note interval without string conversion. The grid stays stable under repeated moves.

**Boundary handling:** If `beat < 0`, cursor wraps to previous measure; if `beat >= beatsPerMeasure`, wraps to next measure. Range-clamped to first/last measure.

**Test coverage:** `cursorMath.test.ts` includes snap/wrap assertions. Fix confirmed by test suite.

---

## 5. Root Cause Analysis — "Playback Broken"

**Status: RESOLVED** ✅ (working, fully integrated)

### Current Playback Architecture

```
User gesture (play button in UI)
  → audioStore.setPlaybackState('playing')
    → useEffect subscription in TabCanvas (line 560)
      → api.play()
        → AlphaSynth initializes (lazy, first call only)
          → Fetches /vendor/alphatab/sonivox.sf2 (same-origin, no CORS)
            → Web Audio API output
              → playerStateChanged event → audioStore sync
              → playerPositionChanged event → audioStore.setCurrentTime()
                → CursorOverlay follows position via useCursorEngine lerp
```

### SoundFont Assessment

- **File present:** `/client/public/vendor/alphatab/sonivox.sf2` (1.3 MB) ✅
- **Path in config:** `/vendor/alphatab/sonivox.sf2` — matches Vite static asset URL ✅
- **CORS:** Not applicable (same origin) ✅
- **AudioContext:** User-gesture requirement satisfied by play button click ✅

### Error Handling in Place

| Potential error | Guard |
|---|---|
| `api.playBeat()` before ready | `try { api.playBeat(beat) } catch {}` (line 814, 906) |
| `api.tickPosition` before ready | `try { api.tickPosition = ... } catch {}` (line 571) |
| Bidirectional state loop | Flag guard at line 536 prevents echo |

**Conclusion:** No playback blockers. If audio is absent in dev, check: browser tab not muted, browser audio permissions granted, DevTools Network tab shows sonivox.sf2 with status 200.

---

## 6. Code Quality Issues

### Critical (affects correctness)

| Issue | Location | Recommendation |
|---|---|---|
| Technique handlers incomplete — parameter setters missing | `editor-core/handlers/techniques.ts` (50 LOC stubs) | Extend with bend semitones, slide style, harmonic type, etc. |
| Two-digit fret input — timer-based pending state unverified | `editor-core/handlers/noteEntry.ts` | Write integration test: press 1 then 2 within 500ms → fret 12 |

### Moderate (dead code / maintenance burden)

| Issue | Location | Recommendation |
|---|---|---|
| StaffPreview.tsx — OSMD orphan, never imported | `spaces/pack/StaffPreview.tsx` (214 LOC) | **Delete** |
| PracticeSurface.tsx — pure pass-through, no logic | `spaces/pack/PracticeSurface.tsx` (25 LOC) | Keep as placeholder; document intent |
| EditSurface.tsx — hardcoded hex colors (`'#222'`, `'#0f0'`) | `spaces/pack/EditSurface.tsx` | Refactor to CSS custom properties |

### Minor (style / documentation)

| Issue | Location | Recommendation |
|---|---|---|
| `resolveStringFromPointer()` return type undocumented (1-indexed vs 0-indexed unclear at callsite) | `editor-core/layout.ts` | Add JSDoc comment |
| `useWorkers: false` in alphaTab config — blocks main thread on large scores | `TabCanvas.tsx:498` | Evaluate enabling workers in Phase 8 (performance) |
| `opensheetmusicdisplay` in package.json — 1.9 MB dependency for unused OSMD integration | `client/package.json` | Remove after StaffPreview.tsx is deleted |

### No Anti-Patterns Found

- ✅ No direct mutation of alphaTab internals (Score, Track, Beat objects)
- ✅ No circular imports
- ✅ Event listeners cleaned up in all useEffect returns
- ✅ No `eval()` or dynamic code generation
- ✅ TypeScript strict mode; no `any` in critical paths

---

## 7. Keep / Delete / Rewrite Decision Table

| File or Module | Current State | Decision | Reason |
|---|---|---|---|
| `spaces/pack/TabCanvas.tsx` | 1097 LOC, fully working | **Keep & Extend** | Core alphaTab integration; clean architecture |
| `spaces/pack/EditorPage.tsx` | Working top-level route | **Keep & Extend** | Add missing panels (per-bar meta, multi-track) |
| `spaces/pack/EditorCanvas.tsx` | Container + CursorOverlay | **Keep** | Clean 94-LOC wrapper |
| `spaces/pack/EditorToolbar.tsx` | Working, partially wired | **Keep & Extend** | Wire remaining technique buttons |
| `spaces/pack/EditorTitleBar.tsx` | Working | **Keep** | |
| `spaces/pack/EditSurface.tsx` | 751 LOC, used as fallback | **Keep & Refactor** | Refactor hardcoded colors to CSS vars |
| `spaces/pack/PracticeSurface.tsx` | 25 LOC, pass-through | **Keep** | Placeholder; document intent |
| `spaces/pack/StaffPreview.tsx` | 214 LOC, never imported | **Delete** | Dead code; OSMD path abandoned |
| `spaces/pack/editor-core/commands.ts` | Fixed, clean | **Keep** | Grid-snap fix confirmed working |
| `spaces/pack/editor-core/commandRouter.ts` | Clean dispatcher | **Keep** | |
| `spaces/pack/editor-core/validation.ts` | Correct implementation | **Keep** | |
| `spaces/pack/editor-core/layout.ts` | Hit-testing geometry | **Keep** | Add JSDoc |
| `spaces/pack/editor-core/toolbarBridge.ts` | Nearly complete | **Keep & Extend** | Wire remaining technique shortcuts |
| `spaces/pack/editor-core/techniqueDefinitions.ts` | Data-driven registry | **Keep & Extend** | Add parameter definitions |
| `spaces/pack/editor-core/helpers.ts` | Utility functions | **Keep** | |
| `spaces/pack/editor-core/handlers/noteEntry.ts` | Working | **Keep & Extend** | Verify two-digit fret |
| `spaces/pack/editor-core/handlers/noteProperties.ts` | Working | **Keep** | |
| `spaces/pack/editor-core/handlers/techniques.ts` | Stubs only | **Rewrite** | Implement full parameter setters |
| `spaces/pack/editor-core/handlers/notation.ts` | Working | **Keep** | |
| `spaces/pack/editor-core/handlers/measures.ts` | Working | **Keep** | |
| `spaces/pack/editor-core/handlers/scoreMeta.ts` | Working (global) | **Keep & Extend** | Add per-bar override UI |
| `spaces/pack/editor-core/handlers/measureMeta.ts` | Schema ready, UI TBD | **Keep & Extend** | Wire chord symbol + annotation UI |
| `spaces/pack/editor-core/handlers/lyrics.ts` | Working | **Keep** | |
| `spaces/pack/editor-core/handlers/clipboard.ts` | Implemented | **Keep** | |
| `spaces/pack/editor-core/handlers/noteMutation.ts` | Working | **Keep** | |
| `components/score/CursorOverlay.tsx` | New, clean | **Keep** | Production-ready |
| `hooks/useCursorEngine.ts` | New, fully tested | **Keep** | |
| `hooks/useEditorKeyboard.ts` | Working | **Keep & Extend** | Add missing shortcuts (loop, metronome) |
| `lib/cursorMath.ts` | Pure functions, 100% tested | **Keep** | |
| `lib/cursorIcons.ts` | SVG generators, tested | **Keep** | |
| `lib/scoreDocument.ts` | 755 LOC data model | **Keep & Extend** | Source of truth; add technique parameter serialization |
| `lib/musicXmlEngine.ts` | MusicXML read/write | **Keep** | |
| `stores/editorStore.ts` | Production-ready | **Keep** | |
| `stores/scoreDocumentStore.ts` | Undo/redo + commands | **Keep** | |
| `stores/audioStore.ts` | Playback sync | **Keep** | |
| `public/vendor/alphatab/` | All files present | **Keep** | |
| `client/package.json` → `opensheetmusicdisplay` | Dependency for orphaned code | **Remove** (after StaffPreview deleted) | 1.9 MB saved |

---

## 8. Architecture Divergence from Rebuild Plan

The rebuild plan proposes a specific architecture (alphaTex AST → custom parser/printer → Commands → alphaTab). The current codebase implements a different but architecturally equivalent approach:

| Plan proposes | Current implementation | Assessment |
|---|---|---|
| alphaTex string as Source of Truth | `ScoreDocument` TypeScript object as Source of Truth | Equivalent; different serialization format |
| Custom alphaTex AST parser/printer | MusicXML export via `exportScoreDocumentToMusicXml()` | Different format; same architectural role |
| `api.tex(text)` for re-render | `api.load(xmlBytes)` for re-render | Equivalent alphaTab API calls |
| Command objects with `execute()`/`invert()` | ScoreCommand union type dispatched via commandRouter | Equivalent; slightly different pattern |
| `invert()` for undo | Snapshot-based undo (full document snapshots in stack) | Different mechanism; both correct |
| XState input machine | Hand-rolled state enum + event handlers | Equivalent; less formal |
| nanoid for stable IDs | IDs generated differently | Verify stability across renders |
| immer for immutable updates | Immutable spread in handlers | Equivalent |
| Overlay layer (SVG over alphaTab) | `CursorOverlay.tsx` + `useCursorEngine.ts` | ✅ Already implemented |
| Hit-test via boundsLookup | `editor-core/layout.ts` + boundsLookup | ✅ Already implemented |

**Conclusion:** The plan's architectural goals are achieved, via a different but sound implementation path. The decision of whether to migrate to alphaTex AST or continue with MusicXML/ScoreDocument is a strategic choice for the human to make before Phase 3 begins.

---

## 9. Phase-by-Phase Assessment vs. Rebuild Plan

| Phase | Plan description | Current status | Recommendation |
|---|---|---|---|
| Phase 1 | Audit | ✅ This report | Complete |
| Phase 2 | Cleanup & scaffold | Partially done (structure exists; dead code remains) | Delete StaffPreview.tsx + opensheetmusicdisplay; document structure |
| Phase 3 | AlphaTex AST | Not implemented (MusicXML path used instead) | **Decision needed:** migrate to alphaTex AST, or extend ScoreDocument? |
| Phase 4 | Command/History system | 80% implemented (ScoreCommand + commandRouter + undo stacks) | Extend existing; fill gaps (technique params, per-bar meta) |
| Phase 5 | Render Adapter & Overlay | ✅ Complete | CursorOverlay + useCursorEngine + alphaTabBridge equivalent |
| Phase 6 | Selection / Cursor / Input | ✅ Complete | Cursor fixed; keyboard shortcuts working; input state hand-rolled |
| Phase 7 | Playback engine | ✅ Complete | AlphaSynth working; playback cursor working |
| Phase 8 | Incremental rendering & performance | ❌ Not started | `useWorkers: false` blocks main thread; evaluate enabling workers |
| Phase 9 | Persistence / Import-Export / Toolbar UI | 50% complete | Auto-save ✅; JSON ✅; GP import ❌; MIDI export ❌; PDF partial; toolbar partially wired |

---

## 10. Recommended Immediate Actions (Before Phase 2)

Ranked by impact:

1. **Delete** `spaces/pack/StaffPreview.tsx` — 214 LOC dead code; no references anywhere
2. **Remove** `opensheetmusicdisplay` from `client/package.json` — 1.9 MB dependency for unused code
3. **Human decision required:** Continue with MusicXML/ScoreDocument path, or migrate to alphaTex AST as the plan specifies? This affects all of Phases 3–4.
4. **Verify** two-digit fret input (press `1` then `2` within 500 ms → fret 12) manually
5. **Refactor** hardcoded colors in `EditSurface.tsx` to CSS custom properties

---

*End of Phase 1 Audit Report. Awaiting human review before Phase 2 begins.*
