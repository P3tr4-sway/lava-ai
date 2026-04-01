# Agent Live Score Editing — Design Spec

**Date:** 2026-03-30
**Status:** Approved design, pending implementation

## Problem

The AI agent currently edits the score by generating a complete replacement MusicXML file via the `create_version` tool. This works for wholesale transformations ("make a blues version") but feels sluggish and opaque — the user waits for the full XML to generate, then sees a single atomic swap. There's no Sibelius-like experience of watching edits appear in real-time.

## Goal

Add granular editing tools so the agent can make surgical edits (change a pitch, add a chord, transpose a section) that render live in the score as SSE events stream in. Keep `create_version` for wholesale transformations. All granular edits within one agent turn are grouped as a "preview session" — the user can Apply or Discard the batch, same UX as today's version preview.

## Approach

**Option 1 — Client-applied patches (chosen)**. Server tools emit `score_patch` SSE events with operation name + parameters. The client applies each patch to the live XML using the existing `musicXmlEngine` functions. The server is stateless — tools return `{ success: true }` immediately. The agent works from the full XML it received at turn start.

---

## 1. New Server Tools

Granular editing tools mapped 1:1 to `musicXmlEngine` functions. The agent picks whichever strategy fits the request.

| Tool | Parameters | Maps to |
|------|-----------|---------|
| `edit_note_pitch` | `barIndex`, `noteIndex`, `step`, `octave`, `alter?` | `setNotePitch` |
| `edit_note_duration` | `barIndex`, `noteIndex`, `type` (`whole`/`half`/`quarter`/`eighth`/`16th`) | `setNoteDuration` |
| `edit_chord` | `barIndex`, `beat`, `chordSymbol` (e.g. `"Am7"`) | `setChord` |
| `edit_key_signature` | `fromBar`, `key` | `setKeySig` |
| `edit_time_signature` | `fromBar`, `beats`, `beatType` | `setTimeSig` |
| `add_bars` | `afterIndex`, `count` | `addBars` |
| `delete_bars` | `barIndices[]` | `deleteBars` |
| `transpose_bars` | `barIndices[]`, `semitones` | `transposeBars` |
| `add_accidental` | `barIndex`, `noteIndex`, `type` (`sharp`/`flat`/`natural`) | `addAccidental` |
| `toggle_rest` | `barIndex`, `noteIndex` | `toggleRest` |
| `toggle_tie` | `barIndex`, `noteIndex` | `toggleTie` |
| `set_annotation` | `barIndex`, `text` | `setAnnotation` |
| `set_lyric` | `barIndex`, `noteIndex`, `syllable` | `setLyric` |
| `end_edit_session` | `name`, `changeSummary[]` | Finalizes patch session |

Each tool (except `end_edit_session`) returns `{ success: true }` to the agent. `end_edit_session` returns `{ success: true, versionId }`.

---

## 2. SSE Protocol

### `score_patch` event

Emitted per granular tool call. The first one in a turn implicitly starts a patch session on the client.

```json
{
  "type": "score_patch",
  "patch": {
    "op": "set_note_pitch",
    "barIndex": 2,
    "noteIndex": 0,
    "step": "E",
    "octave": 4
  }
}
```

The `op` field is the musicXmlEngine function name (camelCase). Remaining fields are passed as arguments.

### `score_patch_session_end` event

Emitted when the agent calls `end_edit_session`. Always the last event in a granular editing turn.

```json
{
  "type": "score_patch_session_end",
  "versionPayload": {
    "versionId": "uuid",
    "name": "Transposed melody",
    "changeSummary": ["Raised melody one octave in bars 5-8", "Changed chord in bar 3 to Dm7"]
  }
}
```

### Error / abort handling

If the SSE stream errors or aborts mid-session (before `score_patch_session_end`), the client rolls back to `patchSessionBaseXml`.

### Coexistence with `create_version`

`create_version` continues to emit `version_created` events unchanged. The agent never mixes granular tools and `create_version` in the same turn.

---

## 3. Client-Side Patch Application

### Patch session lifecycle (`useAgent.ts`)

1. **First `score_patch`** → save current `musicXml` as `patchSessionBaseXml` (rollback point), set `isPatchSession = true`
2. **Each `score_patch`** → read current `musicXml` from `leadSheetStore`, call `applyPatch(xml, patch)`, write back → OSMD re-renders live
3. **`score_patch_session_end`** → take the final `musicXml`, create a version in `versionStore`, enter preview mode (PreviewBar with Apply/Discard)
4. **Stream error/abort** → restore `patchSessionBaseXml` to `leadSheetStore`, clear session state

### `applyPatch` dispatcher (`musicXmlEngine/index.ts`)

A switch on `patch.op` that maps to the corresponding engine function:

```ts
export type ScorePatchOp =
  | 'set_note_pitch' | 'set_note_duration' | 'set_chord'
  | 'set_key_sig' | 'set_time_sig' | 'add_bars' | 'delete_bars'
  | 'transpose_bars' | 'add_accidental' | 'toggle_rest' | 'toggle_tie'
  | 'set_annotation' | 'set_lyric'

export interface ScorePatch {
  op: ScorePatchOp
  [key: string]: unknown
}

export function applyPatch(xml: string, patch: ScorePatch): string {
  switch (patch.op) {
    case 'set_note_pitch':
      return setNotePitch(xml, patch.barIndex, patch.noteIndex, {
        step: patch.step, octave: patch.octave, alter: patch.alter
      })
    case 'set_chord':
      return setChord(xml, patch.barIndex, patch.beat, patch.chordSymbol)
    // ... one case per op
    default:
      console.warn(`Unknown patch op: ${patch.op}`)
      return xml
  }
}
```

### Version store additions (`versionStore.ts`)

```ts
// New state
patchSessionBaseXml: string | null    // XML before session started
isPatchSession: boolean               // true while patches are streaming

// New actions
startPatchSession(): void             // saves current XML as base, sets flag
endPatchSession(versionId, name, changeSummary): void  // creates version, enters preview
rollbackPatchSession(): void          // restores base XML, clears session
```

### Undo/redo interaction

- Individual patches do NOT push to the undo stack
- On Apply: `patchSessionBaseXml` is pushed as one undo entry (the pre-session state)
- On Discard: score reverts to `patchSessionBaseXml` — nothing enters undo stack

---

## 4. Agent Prompt Updates

Added to the Create space context block in `server/src/agent/prompts/context.ts`:

```
### Editing Strategy
- For WHOLESALE transformations (new arrangement, complete restyle, full reharmonization):
  → Use `create_version` with the complete modified MusicXML.
- For SURGICAL edits (change a chord, adjust a few notes, transpose a section, fix a pitch):
  → Use the granular editing tools (edit_note_pitch, edit_chord, transpose_bars, etc.)
  → Each edit renders live in the score — the user watches changes appear in real-time.
  → Always call `end_edit_session` when done to finalize the version.
- Prefer granular tools when the user's request targets specific bars or notes.
- Prefer create_version when the change touches most of the score.
- Never mix both in the same turn — pick one strategy per response.
```

---

## 5. File Changes

### Server — new files

| File | Purpose |
|------|---------|
| `server/src/agent/tools/definitions/editNotePitch.ts` | Tool definition + handler |
| `server/src/agent/tools/definitions/editNoteDuration.ts` | " |
| `server/src/agent/tools/definitions/editChord.ts` | " |
| `server/src/agent/tools/definitions/editKeySig.ts` | " |
| `server/src/agent/tools/definitions/editTimeSig.ts` | " |
| `server/src/agent/tools/definitions/addBars.ts` | " |
| `server/src/agent/tools/definitions/deleteBars.ts` | " |
| `server/src/agent/tools/definitions/transposeBars.ts` | " |
| `server/src/agent/tools/definitions/addAccidental.ts` | " |
| `server/src/agent/tools/definitions/toggleRest.ts` | " |
| `server/src/agent/tools/definitions/toggleTie.ts` | " |
| `server/src/agent/tools/definitions/setAnnotation.ts` | " |
| `server/src/agent/tools/definitions/setLyric.ts` | " |
| `server/src/agent/tools/definitions/endEditSession.ts` | Emits `score_patch_session_end` |

### Server — modify

| File | Change |
|------|--------|
| `server/src/agent/tools/index.ts` | Register all new tools |
| `server/src/agent/AgentOrchestrator.ts` | Detect granular tool calls → emit `score_patch` SSE events |
| `server/src/agent/prompts/context.ts` | Add editing strategy guidance |

### Client — modify

| File | Change |
|------|--------|
| `client/src/hooks/useAgent.ts` | Handle `score_patch` and `score_patch_session_end` events |
| `client/src/stores/versionStore.ts` | Add patch session state + start/end/rollback methods |
| `client/src/lib/musicXmlEngine/index.ts` | Export `applyPatch` dispatcher + `ScorePatch` type |

### Unchanged

EditorCanvas, EditorToolbar, useScoreSync, tokens.css — live rendering already works because `setMusicXml()` triggers OSMD reload.

---

## 6. Interaction Examples

### Surgical edit: "Change the chord in bar 3 to Dm7"

```
Agent reasoning: User wants a single chord change → use granular tools
Agent calls: edit_chord(barIndex=2, beat=0, chordSymbol="Dm7")
  → SSE: score_patch { op: "set_chord", barIndex: 2, beat: 0, chordSymbol: "Dm7" }
  → Client applies, score re-renders with new chord
Agent calls: end_edit_session(name="Chord change", changeSummary=["Changed bar 3 chord to Dm7"])
  → SSE: score_patch_session_end { versionPayload: {...} }
  → Client enters preview mode
```

### Multi-edit: "Raise the melody an octave in bars 5-8"

```
Agent reasoning: Need to modify multiple notes → granular tools, loop over bars
Agent calls: edit_note_pitch(barIndex=4, noteIndex=0, step="C", octave=5)
  → SSE: score_patch → client re-renders
Agent calls: edit_note_pitch(barIndex=4, noteIndex=1, step="E", octave=5)
  → SSE: score_patch → client re-renders
  ... (continues for all notes in bars 5-8)
Agent calls: end_edit_session(name="Octave up", changeSummary=["Raised melody one octave in bars 5-8"])
  → Client enters preview mode with all changes bundled
```

### Wholesale: "Make a bossa nova arrangement"

```
Agent reasoning: Wholesale transformation → use create_version
Agent calls: create_version(name="Bossa Nova", musicXml="<score-partwise>...", changeSummary=[...])
  → SSE: version_created (existing path, unchanged)
  → Client enters preview mode
```
