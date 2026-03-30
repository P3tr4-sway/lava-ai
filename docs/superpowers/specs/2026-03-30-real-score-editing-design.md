# Real Score Editing — Design Spec
_Date: 2026-03-30_

## Problem

The editor agent can call `create_version`, but it has no access to the song's content. The MusicXML is never sent to the server, so the LLM produces placeholder/mocked XML regardless of what the user asks for. Quick-action chips pre-fill the input correctly but don't auto-send.

## Goal

The agent reads the live score, understands its structure, and produces a genuinely transformed MusicXML when the user requests a change (e.g. "make an easier version", "blues arrangement", "simplify bars 3–4").

---

## Data Model

### New `EditorContext` type (`@lava/shared`)

```ts
export interface EditorContext {
  musicXml: string        // full raw MusicXML — the LLM's editing target
  scoreSummary: string    // plain-text digest — structural orientation for the LLM
  selectedBars?: number[] // 0-indexed bars currently selected in the editor
}
```

### `SpaceContext` extension

```ts
export interface SpaceContext {
  currentSpace: SpaceType
  homeMode?: HomeMode
  projectId?: string
  projectName?: string
  coachContext?: CoachContext
  toneContext?: ToneContext
  editorContext?: EditorContext   // NEW
}
```

---

## Score Summary Format

Built client-side by a new `buildScoreSummary(xml: string): string` function in `musicXmlEngine.ts`. Uses the existing `parseXml` / `getMeasures` utilities. Output is a short plain-text string:

```
Key: G major | Tempo: 120 BPM | Time: 4/4 | 16 bars
Chords: Bar 1: G — Bar 2: Em — Bar 3: C — Bar 4: D — Bar 5: G — ...
Sections: Intro (1–4), Verse (5–12), Chorus (13–16)
```

Fields extracted:
- Key and mode from `<key><fifths>` + `<mode>` attributes
- Tempo from `<sound tempo="...">` or default 120
- Time signature from `<time><beats>/<beat-type>`
- Bar count from `getMeasures(doc).length`
- Chords per bar from `<harmony>` elements (root step + alteration + kind)
- Section labels from `<direction><direction-type><rehearsal>` text

If a field is absent from the XML, it is omitted from the summary string.

---

## Client: EditorPage wiring

Two separate triggers both call a shared `syncEditorContext()` helper that reads current state from both stores and calls `setSpaceContext`:

**Trigger 1 — `musicXml` changes** (debounced 500 ms):
- Reads `musicXml` from `useLeadSheetStore`
- Calls `buildScoreSummary(musicXml)` to get the digest
- Reads `selectedBars` from `useEditorStore.getState()` at call time
- Calls `setSpaceContext({ currentSpace: 'create', projectId, projectName, editorContext: { musicXml, scoreSummary, selectedBars } })`

**Trigger 2 — `selectedBars` changes** (immediate, no debounce):
- Reads `musicXml` from `useLeadSheetStore.getState()` and recomputes `buildScoreSummary` (fast, pure, no I/O)
- Calls `setSpaceContext` with the updated `selectedBars`

This ensures that when a user selects bars and immediately sends a message, the server receives the correct `selectedBars` in context.

Initial population happens on mount via Trigger 1 (no debounce for the first call).

---

## Server: Context Prompt Update (`context.ts`)

When `spaceContext.currentSpace === 'create'` and `editorContext` is present, the context prompt includes two blocks after the existing editor mode header:

```
## Current Score
<scoreSummary text>

## Score XML (your editing target)
<musicXml string>
```

If `editorContext.selectedBars` is set, a third line is appended:
```
Selected bars (0-indexed): 2, 3  →  bars 3–4 in the UI
```

### Transform rules (replaces the current "mocked" language)

```
- You have the full score above. Modify it and call `create_version` with the complete transformed XML.
- Preserve all structural elements (<?xml ...?>, <score-partwise>, <part>, measure attributes, <divisions>, <key>, <time>) unless the transformation explicitly requires changing them.
- Only touch the bars, notes, harmony elements, and directions that the transformation requires.
- For transposition requests: update every <pitch> element (step + octave + alter) and every <harmony> root.
- For chord-only changes: update <harmony> elements only; leave <note> pitch/duration untouched.
- For section-specific requests: only modify the measures in the specified bar range.
- Do not add XML comments explaining what you changed — the changeSummary parameter of create_version is the right place for that.
- Always call create_version with a descriptive name and 2–3 changeSummary bullet points.
```

### MusicXML format reminder (appended once in the system prompt)

Added to `system.ts` under a new `## MusicXML` section:

```
A MusicXML harmony element looks like:
  <harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>
A MusicXML note element looks like:
  <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>
A rest looks like:
  <note><rest/><duration>4</duration><type>quarter</type></note>
Measures are wrapped in <part id="P1"><measure number="N">...</measure></part>.
```

---

## Server: Output Validation (`AgentOrchestrator.ts`)

Before firing the `version_created` SSE event, a `isValidMusicXml(xml: string): boolean` helper runs three string checks:

```ts
function isValidMusicXml(xml: string): boolean {
  if (!xml || xml.trim().length === 0) return false
  if (!xml.includes('<score-partwise')) return false
  if (!xml.includes('</score-partwise>')) return false
  if (!xml.includes('<measure')) return false
  return true
}
```

If validation fails, the orchestrator emits an `error` event:
```
"The arrangement couldn't be generated — please try rephrasing your request."
```
No broken version is added to the store.

---

## File Changelist

| File | Change |
|---|---|
| `packages/shared/src/types/agent.ts` | Add `EditorContext` interface; add `editorContext?: EditorContext` to `SpaceContext` |
| `client/src/lib/musicXmlEngine.ts` | Add `buildScoreSummary(xml: string): string` |
| `client/src/spaces/pack/EditorPage.tsx` | Subscribe to `musicXml`; debounce + call `setSpaceContext` with `editorContext` |
| `server/src/agent/prompts/context.ts` | Add `editorContext` block to `create` space prompt; replace mocked-transform rules |
| `server/src/agent/prompts/system.ts` | Add MusicXML format reference section |
| `server/src/agent/AgentOrchestrator.ts` | Add `isValidMusicXml` check before firing `version_created` |

---

## Out of Scope

- Auto-sending quick-action chips (chips pre-fill the input; manual send is intentional UX)
- Server-side XML schema validation (structural check is sufficient for now)
- Streaming the transformed XML progressively
- Undo/redo integration for agent-created versions (handled by existing version store)
