# Agent Live Score Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add granular editing tools that emit `score_patch` SSE events so the agent can make surgical score edits that render live in OSMD, grouped as preview sessions with Apply/Discard.

**Architecture:** Server tools are stateless — each returns `{ success: true }` and emits a `score_patch` SSE event with the operation name + parameters. The client applies each patch to the live MusicXML using `musicXmlEngine` functions. The first patch starts a session; `end_edit_session` finalizes it as a previewable version. `create_version` continues working for wholesale transformations.

**Tech Stack:** TypeScript, Fastify SSE, Zustand, OpenSheetMusicDisplay, `musicXmlEngine` (client-side XML transforms)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/types/agent.ts` | Modify | Add `score_patch` and `score_patch_session_end` to `StreamEventType`, add `ScorePatch` and `ScorePatchSessionEndPayload` types, add `patch` and `patchSessionEndPayload` fields to `StreamEvent` |
| `server/src/agent/tools/definitions/scoreEdit.tool.ts` | Create | All 14 granular tool definitions in one file |
| `server/src/agent/tools/definitions/index.ts` | Modify | Import and register the new tools |
| `server/src/agent/tools/index.ts` | Modify | Add handlers for all 14 tools |
| `server/src/agent/AgentOrchestrator.ts` | Modify | Detect granular tool calls → emit `score_patch` / `score_patch_session_end` SSE events |
| `server/src/agent/prompts/context.ts` | Modify | Add editing strategy guidance to `create` space prompt |
| `client/src/lib/applyPatch.ts` | Create | `applyPatch(xml, patch)` dispatcher that maps `op` → `musicXmlEngine` call |
| `client/src/stores/versionStore.ts` | Modify | Add `patchSessionBaseXml`, `isPatchSession`, `startPatchSession()`, `endPatchSession()`, `rollbackPatchSession()` |
| `client/src/hooks/useAgent.ts` | Modify | Handle `score_patch` and `score_patch_session_end` events in `handleStreamEvent` |

---

### Task 1: Add Shared Types for Score Patch Events

**Files:**
- Modify: `packages/shared/src/types/agent.ts`

- [ ] **Step 1: Add ScorePatch types and new StreamEvent fields**

Open `packages/shared/src/types/agent.ts`. Add the `ScorePatchOp` type, `ScorePatch` interface, and `ScorePatchSessionEndPayload` interface after the existing `VersionCreatedPayload`. Then extend `StreamEventType` and `StreamEvent`:

```typescript
// After the existing VersionCreatedPayload interface (line ~135), add:

export type ScorePatchOp =
  | 'setNotePitch'
  | 'setNoteDuration'
  | 'setChord'
  | 'setKeySig'
  | 'setTimeSig'
  | 'addBars'
  | 'deleteBars'
  | 'transposeBars'
  | 'addAccidental'
  | 'toggleRest'
  | 'toggleTie'
  | 'setAnnotation'
  | 'setLyric'

export interface ScorePatch {
  op: ScorePatchOp
  [key: string]: unknown
}

export interface ScorePatchSessionEndPayload {
  versionId: string
  name: string
  changeSummary: string[]
}
```

Update `StreamEventType` to add the two new event types:

```typescript
export type StreamEventType =
  | 'text_delta'
  | 'tool_start'
  | 'tool_result'
  | 'message_start'
  | 'message_stop'
  | 'error'
  | 'version_created'
  | 'score_patch'
  | 'score_patch_session_end'
```

Update `StreamEvent` to add the two new payload fields:

```typescript
export interface StreamEvent {
  type: StreamEventType
  delta?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  error?: string
  versionPayload?: VersionCreatedPayload
  patch?: ScorePatch
  patchSessionEndPayload?: ScorePatchSessionEndPayload
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (shared compiles, client/server may have new type errors — that's fine, we'll fix them in later tasks)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/agent.ts
git commit -m "feat(shared): add ScorePatch types and score_patch SSE event types"
```

---

### Task 2: Create Granular Tool Definitions

**Files:**
- Create: `server/src/agent/tools/definitions/scoreEdit.tool.ts`
- Modify: `server/src/agent/tools/definitions/index.ts`

- [ ] **Step 1: Create scoreEdit.tool.ts with all 14 tool definitions**

Create `server/src/agent/tools/definitions/scoreEdit.tool.ts`:

```typescript
import type { ToolDefinition } from '@lava/shared'

export const editNotePitchTool: ToolDefinition = {
  name: 'edit_note_pitch',
  description: 'Change the pitch of a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar (non-chord notes only)', required: true },
    { name: 'step', type: 'string', description: 'Note name: C, D, E, F, G, A, or B', required: true, enum: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
    { name: 'octave', type: 'number', description: 'Octave number (e.g. 4 for middle C)', required: true },
    { name: 'alter', type: 'number', description: 'Accidental: -1 for flat, 0 for natural, 1 for sharp. Omit for natural.', required: false },
  ],
}

export const editNoteDurationTool: ToolDefinition = {
  name: 'edit_note_duration',
  description: 'Change the duration of a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
    { name: 'type', type: 'string', description: 'Duration type', required: true, enum: ['whole', 'half', 'quarter', 'eighth', '16th'] },
  ],
}

export const editChordTool: ToolDefinition = {
  name: 'edit_chord',
  description: 'Set or change the chord symbol at a specific beat in a bar. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'beat', type: 'number', description: '0-based beat index within the bar', required: true },
    { name: 'chordSymbol', type: 'string', description: 'Chord symbol (e.g. "Am7", "Cmaj7", "F#m")', required: true },
  ],
}

export const editKeySigTool: ToolDefinition = {
  name: 'edit_key_signature',
  description: 'Change the key signature starting from a specific bar. The score re-renders live.',
  parameters: [
    { name: 'fromBar', type: 'number', description: '0-based bar index from which the new key applies', required: true },
    { name: 'key', type: 'string', description: 'Key name (e.g. "C", "G", "Bb", "F#")', required: true },
  ],
}

export const editTimeSigTool: ToolDefinition = {
  name: 'edit_time_signature',
  description: 'Change the time signature starting from a specific bar. The score re-renders live.',
  parameters: [
    { name: 'fromBar', type: 'number', description: '0-based bar index from which the new time signature applies', required: true },
    { name: 'beats', type: 'number', description: 'Number of beats per bar (e.g. 3, 4, 6)', required: true },
    { name: 'beatType', type: 'number', description: 'Beat unit (e.g. 4 for quarter note, 8 for eighth note)', required: true },
  ],
}

export const addBarsTool: ToolDefinition = {
  name: 'add_bars',
  description: 'Insert empty bars (whole rests) after a specific bar position. The score re-renders live.',
  parameters: [
    { name: 'afterIndex', type: 'number', description: '0-based bar index after which to insert. Use 0 to insert after the first bar.', required: true },
    { name: 'count', type: 'number', description: 'Number of bars to insert (1-8)', required: true },
  ],
}

export const deleteBarsTool: ToolDefinition = {
  name: 'delete_bars',
  description: 'Delete one or more bars from the score. The score re-renders live.',
  parameters: [
    { name: 'barIndices', type: 'array', description: 'Array of 0-based bar indices to delete', required: true, items: { type: 'number' } },
  ],
}

export const transposeBarsTool: ToolDefinition = {
  name: 'transpose_bars',
  description: 'Transpose all notes in specified bars by a number of semitones. The score re-renders live.',
  parameters: [
    { name: 'barIndices', type: 'array', description: 'Array of 0-based bar indices to transpose', required: true, items: { type: 'number' } },
    { name: 'semitones', type: 'number', description: 'Number of semitones to transpose (positive = up, negative = down)', required: true },
  ],
}

export const addAccidentalTool: ToolDefinition = {
  name: 'add_accidental',
  description: 'Add or change the accidental on a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
    { name: 'type', type: 'string', description: 'Accidental type', required: true, enum: ['sharp', 'flat', 'natural'] },
  ],
}

export const toggleRestTool: ToolDefinition = {
  name: 'toggle_rest',
  description: 'Toggle a note between a sounding note and a rest. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
  ],
}

export const toggleTieTool: ToolDefinition = {
  name: 'toggle_tie',
  description: 'Toggle a tie on a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
  ],
}

export const setAnnotationTool: ToolDefinition = {
  name: 'set_annotation',
  description: 'Add a text annotation (direction text) to a bar. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'text', type: 'string', description: 'Annotation text (e.g. "D.C. al Coda", "ritardando")', required: true },
  ],
}

export const setLyricTool: ToolDefinition = {
  name: 'set_lyric',
  description: 'Set a lyric syllable on a specific note. The score re-renders live.',
  parameters: [
    { name: 'barIndex', type: 'number', description: '0-based bar index', required: true },
    { name: 'noteIndex', type: 'number', description: '0-based note index within the bar', required: true },
    { name: 'syllable', type: 'string', description: 'Lyric text for this note', required: true },
  ],
}

export const endEditSessionTool: ToolDefinition = {
  name: 'end_edit_session',
  description: 'Finalize the current editing session as a named version the user can Apply or Discard. Always call this after making granular edits.',
  parameters: [
    { name: 'name', type: 'string', description: 'Display name for the version (e.g. "Chord fix", "Transposed melody")', required: true },
    { name: 'changeSummary', type: 'array', description: '1-3 bullet points describing what changed', required: true, items: { type: 'string' } },
  ],
}

export const SCORE_EDIT_TOOLS: ToolDefinition[] = [
  editNotePitchTool,
  editNoteDurationTool,
  editChordTool,
  editKeySigTool,
  editTimeSigTool,
  addBarsTool,
  deleteBarsTool,
  transposeBarsTool,
  addAccidentalTool,
  toggleRestTool,
  toggleTieTool,
  setAnnotationTool,
  setLyricTool,
  endEditSessionTool,
]

/** Set of tool names that are granular score edit operations (not end_edit_session). */
export const SCORE_PATCH_TOOL_NAMES = new Set(
  SCORE_EDIT_TOOLS.filter((t) => t.name !== 'end_edit_session').map((t) => t.name),
)
```

- [ ] **Step 2: Update definitions/index.ts to include the new tools**

In `server/src/agent/tools/definitions/index.ts`, add the import and spread:

```typescript
import { navigateToSpaceTool, openSearchResultsTool } from './navigation.tool.js'
import { createProjectTool, listProjectsTool, loadProjectTool } from './project.tool.js'
import { startTranscriptionTool, getTranscriptionStatusTool } from './transcription.tool.js'
import { addTrackTool, aiComposeTool } from './create.tool.js'
import { uploadAudioTool, processAudioTool } from './audio.tool.js'
import { createVersionTool } from './version.tool.js'
import { SCORE_EDIT_TOOLS } from './scoreEdit.tool.js'
import type { ToolDefinition } from '@lava/shared'

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
  ...SCORE_EDIT_TOOLS,
]
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS for `shared` and `server` (client may still fail — will fix later)

- [ ] **Step 4: Commit**

```bash
git add server/src/agent/tools/definitions/scoreEdit.tool.ts server/src/agent/tools/definitions/index.ts
git commit -m "feat(server): add 14 granular score editing tool definitions"
```

---

### Task 3: Add Tool Handlers

**Files:**
- Modify: `server/src/agent/tools/index.ts`

- [ ] **Step 1: Add handlers for all 14 granular tools**

In `server/src/agent/tools/index.ts`, inside the `handlers` record in `getHandler()`, add entries for every new tool. All granular tools (except `end_edit_session`) return `{ success: true }` — the orchestrator handles SSE emission separately. `end_edit_session` also generates a `versionId`.

Add these entries inside the `handlers` record, after the `create_version` handler (line ~148):

```typescript
    // ── Granular score edit tools ──
    // All return { success: true }. The orchestrator emits score_patch SSE events.
    edit_note_pitch: async () => ({ success: true }),
    edit_note_duration: async () => ({ success: true }),
    edit_chord: async () => ({ success: true }),
    edit_key_signature: async () => ({ success: true }),
    edit_time_signature: async () => ({ success: true }),
    add_bars: async () => ({ success: true }),
    delete_bars: async () => ({ success: true }),
    transpose_bars: async () => ({ success: true }),
    add_accidental: async () => ({ success: true }),
    toggle_rest: async () => ({ success: true }),
    toggle_tie: async () => ({ success: true }),
    set_annotation: async () => ({ success: true }),
    set_lyric: async () => ({ success: true }),

    end_edit_session: async (input) => {
      const versionId = crypto.randomUUID()
      const name = String(input.name)
      const rawSummary = input.changeSummary
      const changeSummary = Array.isArray(rawSummary)
        ? rawSummary.map((item: unknown) => String(item))
        : []
      return {
        action: 'score_patch_session_end',
        versionId,
        name,
        changeSummary,
      }
    },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/agent/tools/index.ts
git commit -m "feat(server): add handlers for granular score editing tools"
```

---

### Task 4: Emit score_patch SSE Events from Orchestrator

**Files:**
- Modify: `server/src/agent/AgentOrchestrator.ts`

- [ ] **Step 1: Import the SCORE_PATCH_TOOL_NAMES set**

At the top of `server/src/agent/AgentOrchestrator.ts`, add:

```typescript
import { SCORE_PATCH_TOOL_NAMES } from './tools/definitions/scoreEdit.tool.js'
```

- [ ] **Step 2: Add score_patch and score_patch_session_end emission logic**

Inside the `for (const toolCall of pendingToolCalls)` loop (after the existing `create_version` block, around line ~87), add a new block for granular tools:

```typescript
      // ── Granular score editing tools → score_patch SSE ──
      if (SCORE_PATCH_TOOL_NAMES.has(toolCall.name) && !result.isError) {
        onEvent({
          type: 'score_patch',
          patch: toolCallToPatch(toolCall),
        })
      }

      // ── end_edit_session → score_patch_session_end SSE ──
      if (toolCall.name === 'end_edit_session' && !result.isError) {
        try {
          const parsed = JSON.parse(result.content) as {
            versionId: string
            name: string
            changeSummary: string[]
          }
          onEvent({
            type: 'score_patch_session_end',
            patchSessionEndPayload: {
              versionId: parsed.versionId,
              name: parsed.name,
              changeSummary: parsed.changeSummary,
            },
          })
        } catch (err) {
          logger.warn({ err }, '[AgentOrchestrator] end_edit_session SSE: malformed tool result JSON')
        }
      }
```

- [ ] **Step 3: Add the toolCallToPatch helper function**

At the bottom of the file (after `isValidMusicXml`), add:

```typescript
/** Map tool name + input to a ScorePatch with the correct `op` field. */
function toolCallToPatch(toolCall: ToolCall): import('@lava/shared').ScorePatch {
  const TOOL_TO_OP: Record<string, import('@lava/shared').ScorePatchOp> = {
    edit_note_pitch: 'setNotePitch',
    edit_note_duration: 'setNoteDuration',
    edit_chord: 'setChord',
    edit_key_signature: 'setKeySig',
    edit_time_signature: 'setTimeSig',
    add_bars: 'addBars',
    delete_bars: 'deleteBars',
    transpose_bars: 'transposeBars',
    add_accidental: 'addAccidental',
    toggle_rest: 'toggleRest',
    toggle_tie: 'toggleTie',
    set_annotation: 'setAnnotation',
    set_lyric: 'setLyric',
  }
  const op = TOOL_TO_OP[toolCall.name]
  if (!op) throw new Error(`No patch op mapping for tool: ${toolCall.name}`)
  return { op, ...toolCall.input }
}
```

- [ ] **Step 4: Also suppress follow-up for score edit tools**

In the `shouldSendToolFollowUp` function, add a check: skip follow-up if the only tools used were granular score edits (the follow-up is sent for `end_edit_session` only):

```typescript
function shouldSendToolFollowUp(
  spaceContext: SpaceContext,
  toolResults: Array<{ name: string; content: string; isError?: boolean }>,
) {
  if (toolResults.length === 0) return false
  if (spaceContext.coachContext) return false
  if (toolResults.some((result) => result.name === 'coach_message')) return false
  // Skip follow-up if all tools are granular score edits (not end_edit_session)
  if (toolResults.every((result) => SCORE_PATCH_TOOL_NAMES.has(result.name))) return false
  return true
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/agent/AgentOrchestrator.ts
git commit -m "feat(server): emit score_patch SSE events for granular editing tools"
```

---

### Task 5: Update Agent Prompt with Editing Strategy

**Files:**
- Modify: `server/src/agent/prompts/context.ts`

- [ ] **Step 1: Add editing strategy guidance**

In `server/src/agent/prompts/context.ts`, inside the `if (ctx.currentSpace === 'create')` block, after the `### MusicXML` section (line ~64), add a new section before the closing brace:

```typescript
    prompt += `\n\n### Editing Strategy`
    prompt += `\n- For WHOLESALE transformations (new arrangement, complete restyle, full reharmonization):`
    prompt += `\n  → Use \`create_version\` with the complete modified MusicXML.`
    prompt += `\n- For SURGICAL edits (change a chord, adjust a few notes, transpose a section, fix a pitch):`
    prompt += `\n  → Use the granular editing tools (\`edit_note_pitch\`, \`edit_chord\`, \`transpose_bars\`, etc.)`
    prompt += `\n  → Each edit renders live in the score — the user watches changes appear in real-time.`
    prompt += `\n  → Always call \`end_edit_session\` when done to finalize the version.`
    prompt += `\n- Prefer granular tools when the user's request targets specific bars or notes.`
    prompt += `\n- Prefer \`create_version\` when the change touches most of the score.`
    prompt += `\n- Never mix both strategies in the same response — pick one.`
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/agent/prompts/context.ts
git commit -m "feat(server): add editing strategy guidance to agent prompt"
```

---

### Task 6: Create Client-Side Patch Dispatcher

**Files:**
- Create: `client/src/lib/applyPatch.ts`

- [ ] **Step 1: Create applyPatch.ts**

Create `client/src/lib/applyPatch.ts`:

```typescript
import type { ScorePatch } from '@lava/shared'
import {
  setNotePitch,
  setNoteDuration,
  setChord,
  setKeySig,
  setTimeSig,
  addBars,
  deleteBars,
  transposeBars,
  addAccidental,
  toggleRest,
  toggleTie,
  setAnnotation,
  setLyric,
} from '@/lib/musicXmlEngine'

/** Duration type → divisions value mapping (assumes divisions=1 from the engine). */
const DURATION_MAP: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
}

/**
 * Apply a single ScorePatch to a MusicXML string, returning the modified XML.
 * Each `op` maps directly to a `musicXmlEngine` function.
 */
export function applyPatch(xml: string, patch: ScorePatch): string {
  switch (patch.op) {
    case 'setNotePitch':
      return setNotePitch(xml, patch.barIndex as number, patch.noteIndex as number, {
        step: patch.step as string,
        octave: patch.octave as number,
        alter: patch.alter as number | undefined,
      })

    case 'setNoteDuration': {
      const durType = patch.type as string
      const durValue = DURATION_MAP[durType] ?? 1
      return setNoteDuration(xml, patch.barIndex as number, patch.noteIndex as number, durType, durValue)
    }

    case 'setChord':
      return setChord(xml, patch.barIndex as number, patch.beat as number, patch.chordSymbol as string)

    case 'setKeySig':
      return setKeySig(xml, patch.fromBar as number, patch.key as string)

    case 'setTimeSig':
      return setTimeSig(xml, patch.fromBar as number, patch.beats as number, patch.beatType as number)

    case 'addBars':
      return addBars(xml, patch.afterIndex as number, patch.count as number)

    case 'deleteBars':
      return deleteBars(xml, patch.barIndices as number[])

    case 'transposeBars':
      return transposeBars(xml, patch.barIndices as number[], patch.semitones as number)

    case 'addAccidental':
      return addAccidental(
        xml,
        patch.barIndex as number,
        patch.noteIndex as number,
        patch.type as 'sharp' | 'flat' | 'natural',
      )

    case 'toggleRest':
      return toggleRest(xml, patch.barIndex as number, patch.noteIndex as number)

    case 'toggleTie':
      return toggleTie(xml, patch.barIndex as number, patch.noteIndex as number)

    case 'setAnnotation':
      return setAnnotation(xml, patch.barIndex as number, patch.text as string)

    case 'setLyric':
      return setLyric(xml, patch.barIndex as number, patch.noteIndex as number, patch.syllable as string)

    default:
      console.warn(`[applyPatch] Unknown op: ${patch.op}`)
      return xml
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/applyPatch.ts
git commit -m "feat(client): add applyPatch dispatcher mapping ScorePatch ops to musicXmlEngine"
```

---

### Task 7: Add Patch Session State to Version Store

**Files:**
- Modify: `client/src/stores/versionStore.ts`

- [ ] **Step 1: Add patch session state and methods**

In `client/src/stores/versionStore.ts`, add three new state fields and three new methods.

Add to the `VersionStore` interface (after `reset: () => void`):

```typescript
  // Patch session (live agent editing)
  patchSessionBaseXml: string | null
  isPatchSession: boolean
  startPatchSession: () => void
  endPatchSession: (versionId: string, name: string, changeSummary: string[]) => void
  rollbackPatchSession: () => void
```

Add the initial state values (after `previewVersionId: null,`):

```typescript
  patchSessionBaseXml: null,
  isPatchSession: false,
```

Add the three method implementations (before the `loadFromArrangements` method):

```typescript
  startPatchSession: () => {
    const currentXml = useLeadSheetStore.getState().musicXml
    set({ patchSessionBaseXml: currentXml, isPatchSession: true })
  },

  endPatchSession: (versionId, name, changeSummary) => {
    const { patchSessionBaseXml } = get()
    const finalXml = useLeadSheetStore.getState().musicXml ?? ''

    // Create the version from the current (patched) XML
    const version: Version = {
      id: versionId,
      name,
      source: 'ai-transform',
      musicXml: finalXml,
      createdAt: Date.now(),
    }

    set((s) => ({
      versions: [...s.versions, version],
      isPatchSession: false,
      // Keep patchSessionBaseXml — needed for undo if user applies
    }))

    // Enter preview mode (shows PreviewBar with Apply/Discard)
    get().startPreview(versionId)
  },

  rollbackPatchSession: () => {
    const { patchSessionBaseXml } = get()
    if (patchSessionBaseXml !== null) {
      useLeadSheetStore.getState().setMusicXml(patchSessionBaseXml)
    }
    set({ patchSessionBaseXml: null, isPatchSession: false })
  },
```

Also update `applyPreview` to push the patch session base XML as an undo entry when applying a patch session result. Replace the existing `applyPreview`:

```typescript
  applyPreview: () => {
    const { previewVersionId, versions, patchSessionBaseXml } = get()
    if (!previewVersionId) return
    const version = versions.find((v) => v.id === previewVersionId)
    if (version) {
      useLeadSheetStore.getState().setMusicXml(version.musicXml)
    }
    // If this was a patch session, push the pre-session XML as a single undo entry
    if (patchSessionBaseXml !== null) {
      const { pushUndo } = await_import_editor_store()
      pushUndo(patchSessionBaseXml)
    }
    set({ activeVersionId: previewVersionId, previewVersionId: null, patchSessionBaseXml: null })
  },
```

Wait — we can't use async imports in Zustand. Instead, use a direct import. Add at the top of the file:

```typescript
import { useEditorStore } from '@/stores/editorStore'
```

And update `applyPreview`:

```typescript
  applyPreview: () => {
    const { previewVersionId, versions, patchSessionBaseXml } = get()
    if (!previewVersionId) return
    const version = versions.find((v) => v.id === previewVersionId)
    if (version) {
      useLeadSheetStore.getState().setMusicXml(version.musicXml)
    }
    // If this was a patch session, push the pre-session XML as a single undo entry
    if (patchSessionBaseXml !== null) {
      useEditorStore.getState().pushUndo(patchSessionBaseXml)
    }
    set({ activeVersionId: previewVersionId, previewVersionId: null, patchSessionBaseXml: null })
  },
```

Also update `discardPreview` to clear patch session state:

```typescript
  discardPreview: () => {
    const { previewVersionId, versions, activeVersionId, patchSessionBaseXml } = get()
    if (!previewVersionId) return

    // If this was a patch session, restore the pre-session XML
    if (patchSessionBaseXml !== null) {
      useLeadSheetStore.getState().setMusicXml(patchSessionBaseXml)
    } else {
      const activeVersion = versions.find((v) => v.id === activeVersionId)
      if (activeVersion) {
        useLeadSheetStore.getState().setMusicXml(activeVersion.musicXml)
      }
    }

    set({
      previewVersionId: null,
      patchSessionBaseXml: null,
      isPatchSession: false,
      versions: versions.filter((v) => v.id !== previewVersionId),
    })
  },
```

And update `reset` to clear patch session state:

```typescript
  reset: () => set({ versions: [], activeVersionId: 'original', previewVersionId: null, patchSessionBaseXml: null, isPatchSession: false }),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/versionStore.ts
git commit -m "feat(client): add patch session lifecycle to versionStore"
```

---

### Task 8: Handle score_patch Events in useAgent

**Files:**
- Modify: `client/src/hooks/useAgent.ts`

- [ ] **Step 1: Import applyPatch and add score_patch handling**

Add the import at the top of `client/src/hooks/useAgent.ts`:

```typescript
import { applyPatch } from '@/lib/applyPatch'
```

In the `handleStreamEvent` function, add two new cases in the switch statement. Add them after the `version_created` case (line ~177) and before the `error` case:

```typescript
      case 'score_patch': {
        const patch = event.patch
        if (patch) {
          // Start a patch session on the first patch in a turn
          const versionState = useVersionStore.getState()
          if (!versionState.isPatchSession) {
            versionState.startPatchSession()
          }
          // Apply the patch to the current score XML
          const currentXml = useLeadSheetStore.getState().musicXml
          if (currentXml) {
            try {
              const newXml = applyPatch(currentXml, patch)
              useLeadSheetStore.getState().setMusicXml(newXml)
            } catch (err) {
              console.error('[score_patch] Failed to apply patch:', err)
            }
          }
        }
        break
      }
      case 'score_patch_session_end': {
        const payload = event.patchSessionEndPayload
        if (payload) {
          useVersionStore.getState().endPatchSession(
            payload.versionId,
            payload.name,
            payload.changeSummary,
          )
          // Add a synthetic message showing the version card (same as version_created)
          useAgentStore.getState().addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            subtype: 'versionCreated',
            versionAction: {
              versionId: payload.versionId,
              name: payload.name,
              changeSummary: payload.changeSummary,
            },
            createdAt: Date.now(),
          })
        }
        break
      }
```

- [ ] **Step 2: Add rollback on error during patch session**

Update the `error` case to also roll back any active patch session:

```typescript
      case 'error':
        // Rollback any active patch session on stream error
        if (useVersionStore.getState().isPatchSession) {
          useVersionStore.getState().rollbackPatchSession()
        }
        finalizeStream()
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: event.error || 'Sorry, I encountered an error. Please try again.',
          createdAt: Date.now(),
        })
        break
```

Also add rollback in the `sendMessage` catch block (line ~205):

```typescript
    } catch (err) {
      // Rollback any active patch session on network error
      if (useVersionStore.getState().isPatchSession) {
        useVersionStore.getState().rollbackPatchSession()
      }
      finalizeStream()
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: 0 errors (warnings are acceptable if pre-existing)

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useAgent.ts
git commit -m "feat(client): handle score_patch SSE events with live rendering and rollback"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: PASS for all three workspaces (shared, server, client)

- [ ] **Step 2: Full lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS for all workspaces

- [ ] **Step 4: Commit any final fixes**

If any fixes were needed:

```bash
git add -A
git commit -m "fix: address typecheck/lint issues from live score editing integration"
```
