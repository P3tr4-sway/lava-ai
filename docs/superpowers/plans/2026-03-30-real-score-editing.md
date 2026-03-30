# Real Score Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the editor's live MusicXML + a structural summary into the agent context so the LLM produces genuinely transformed scores instead of mocked placeholders.

**Architecture:** Add `EditorContext` to `SpaceContext` (shared types). Client builds a plain-text score summary via a new `buildScoreSummary` function in `musicXmlEngine.ts` and pushes both the summary and raw XML into the agent store. Server injects both into the LLM system prompt and validates the LLM's output XML before creating a version.

**Tech Stack:** TypeScript, Zustand, Vitest, MusicXML (DOM API)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/shared/src/types/agent.ts` | Modify | Add `EditorContext` interface, extend `SpaceContext` |
| `client/src/lib/musicXmlEngine.ts` | Modify | Add `buildScoreSummary(xml): string` + reverse fifths map |
| `client/src/lib/musicXmlEngine.test.ts` | Modify | Add tests for `buildScoreSummary` |
| `client/src/spaces/pack/EditorPage.tsx` | Modify | Sync `editorContext` to agent store on musicXml/selectedBars change |
| `server/src/agent/prompts/context.ts` | Modify | Inject score summary + XML + transform rules |
| `server/src/agent/prompts/system.ts` | Modify | Add MusicXML format reference section |
| `server/src/agent/AgentOrchestrator.ts` | Modify | Add `isValidMusicXml` gate before `version_created` |

---

### Task 1: Add `EditorContext` to shared types

**Files:**
- Modify: `packages/shared/src/types/agent.ts:82-89`

- [ ] **Step 1: Add the `EditorContext` interface and extend `SpaceContext`**

In `packages/shared/src/types/agent.ts`, add the interface directly above `SpaceContext` and add the new field:

```ts
export interface EditorContext {
  musicXml: string
  scoreSummary: string
  selectedBars?: number[]
}
```

Add `editorContext?: EditorContext` to `SpaceContext`:

```ts
export interface SpaceContext {
  currentSpace: SpaceType
  homeMode?: HomeMode
  projectId?: string
  projectName?: string
  coachContext?: CoachContext
  toneContext?: ToneContext
  editorContext?: EditorContext
}
```

- [ ] **Step 2: Verify the build**

Run: `pnpm typecheck`
Expected: PASS — no consumers reference `editorContext` yet, so nothing breaks.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/agent.ts
git commit -m "feat(shared): add EditorContext to SpaceContext type"
```

---

### Task 2: Add `buildScoreSummary` to the MusicXML engine (TDD)

**Files:**
- Test: `client/src/lib/musicXmlEngine.test.ts`
- Modify: `client/src/lib/musicXmlEngine.ts`

- [ ] **Step 1: Write the failing test**

Append to the bottom of `client/src/lib/musicXmlEngine.test.ts`:

```ts
describe('buildScoreSummary', () => {
  // Need to import it at the top of the file too
  const SUMMARY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>1</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction placement="above"><direction-type><rehearsal>Intro</rehearsal></direction-type></direction>
      <harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <harmony><root><root-step>E</root-step></root><kind>minor</kind></harmony>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <direction placement="above"><direction-type><rehearsal>Verse</rehearsal></direction-type></direction>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <sound tempo="120"/>
      <harmony><root><root-step>D</root-step></root><kind>dominant</kind></harmony>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

  it('extracts key, time sig, bar count, and chords', () => {
    const summary = buildScoreSummary(SUMMARY_XML)
    expect(summary).toContain('Key: G major')
    expect(summary).toContain('Time: 4/4')
    expect(summary).toContain('4 bars')
    expect(summary).toContain('Bar 1: G')
    expect(summary).toContain('Bar 2: Em')
    expect(summary).toContain('Bar 3: C')
    expect(summary).toContain('Bar 4: D7')
  })

  it('extracts tempo from <sound> element', () => {
    const summary = buildScoreSummary(SUMMARY_XML)
    expect(summary).toContain('Tempo: 120 BPM')
  })

  it('extracts section labels from rehearsal marks', () => {
    const summary = buildScoreSummary(SUMMARY_XML)
    expect(summary).toContain('Intro (1)')
    expect(summary).toContain('Verse (3)')
  })

  it('handles XML with no harmony elements', () => {
    const summary = buildScoreSummary(SIMPLE_XML)
    expect(summary).toContain('3 bars')
    expect(summary).not.toContain('Chords:')
  })

  it('handles XML with no key signature', () => {
    const noKeyXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`
    const summary = buildScoreSummary(noKeyXml)
    expect(summary).toContain('1 bars')
    expect(summary).not.toContain('Key:')
  })
})
```

Also add `buildScoreSummary` to the import at the top of the test file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && pnpm vitest run src/lib/musicXmlEngine.test.ts`
Expected: FAIL — `buildScoreSummary` is not exported from `musicXmlEngine`.

- [ ] **Step 3: Implement `buildScoreSummary`**

Add to the bottom of `client/src/lib/musicXmlEngine.ts`:

```ts
// --- Score summary for agent context ---

const FIFTHS_TO_KEY: Record<number, string> = {
  '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
  '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#',
}

function harmonyToChordName(harmony: Element): string {
  const rootStep = harmony.querySelector('root > root-step')?.textContent ?? ''
  const rootAlterEl = harmony.querySelector('root > root-alter')
  const rootAlter = rootAlterEl ? parseInt(rootAlterEl.textContent ?? '0', 10) : 0
  const kind = harmony.querySelector('kind')?.textContent ?? 'major'

  let name = rootStep
  if (rootAlter === 1) name += '#'
  else if (rootAlter === -1) name += 'b'

  const kindSuffix: Record<string, string> = {
    'major': '', 'minor': 'm', 'dominant': '7', 'major-seventh': 'maj7',
    'minor-seventh': 'm7', 'diminished': 'dim', 'diminished-seventh': 'dim7',
    'augmented': 'aug', 'suspended-second': 'sus2', 'suspended-fourth': 'sus4',
    'major-sixth': '6', 'minor-sixth': 'm6', 'dominant-ninth': '9',
    'major-ninth': 'maj9', 'minor-ninth': 'm9', 'power': '5',
  }
  name += kindSuffix[kind] ?? ''
  return name
}

export function buildScoreSummary(xml: string): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const parts: string[] = []

  // Key
  const fifthsEl = doc.querySelector('key > fifths')
  const modeEl = doc.querySelector('key > mode')
  if (fifthsEl) {
    const fifths = parseInt(fifthsEl.textContent ?? '0', 10)
    const keyName = FIFTHS_TO_KEY[fifths] ?? 'C'
    const mode = modeEl?.textContent ?? 'major'
    parts.push(`Key: ${keyName} ${mode}`)
  }

  // Tempo
  const soundEl = doc.querySelector('sound[tempo]')
  if (soundEl) {
    parts.push(`Tempo: ${soundEl.getAttribute('tempo')} BPM`)
  }

  // Time signature
  const beatsEl = doc.querySelector('time > beats')
  const beatTypeEl = doc.querySelector('time > beat-type')
  if (beatsEl && beatTypeEl) {
    parts.push(`Time: ${beatsEl.textContent}/${beatTypeEl.textContent}`)
  }

  // Bar count
  parts.push(`${measures.length} bars`)

  const header = parts.join(' | ')

  // Chords per bar
  const chordLines: string[] = []
  for (let i = 0; i < measures.length; i++) {
    const harmonies = measures[i].querySelectorAll('harmony')
    if (harmonies.length > 0) {
      const names = Array.from(harmonies).map(harmonyToChordName).join(', ')
      chordLines.push(`Bar ${i + 1}: ${names}`)
    }
  }

  // Sections from rehearsal marks
  const sectionLabels: string[] = []
  for (let i = 0; i < measures.length; i++) {
    const rehearsal = measures[i].querySelector('direction > direction-type > rehearsal')
    if (rehearsal?.textContent) {
      sectionLabels.push(`${rehearsal.textContent} (${i + 1})`)
    }
  }

  let summary = header
  if (chordLines.length > 0) {
    summary += '\nChords: ' + chordLines.join(' — ')
  }
  if (sectionLabels.length > 0) {
    summary += '\nSections: ' + sectionLabels.join(', ')
  }

  return summary
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd client && pnpm vitest run src/lib/musicXmlEngine.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/musicXmlEngine.ts client/src/lib/musicXmlEngine.test.ts
git commit -m "feat(client): add buildScoreSummary to musicXmlEngine"
```

---

### Task 3: Wire EditorPage to sync `editorContext` into agent store

**Files:**
- Modify: `client/src/spaces/pack/EditorPage.tsx:1-109`

- [ ] **Step 1: Add the import for `buildScoreSummary`**

In `EditorPage.tsx`, update the import from `musicXmlEngine`:

```ts
import { addBars, deleteBars, parseXml, getMeasures, buildScoreSummary } from '@/lib/musicXmlEngine'
```

- [ ] **Step 2: Replace the existing space context effect with two triggers**

Replace the existing effect at lines 102-109:

```ts
  // Set agent space context
  useEffect(() => {
    useAgentStore.getState().setSpaceContext({
      currentSpace: 'create',
      projectId: id,
      projectName,
    })
  }, [id, projectName])
```

With:

```ts
  // Sync editor context to agent store — Trigger 1: musicXml changes (debounced)
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevXmlRef = useRef<string | null>(null)
  useEffect(() => {
    const sync = () => {
      const xml = useLeadSheetStore.getState().musicXml
      const selectedBars = useEditorStore.getState().selectedBars
      const name = useLeadSheetStore.getState().projectName
      if (xml) {
        const scoreSummary = buildScoreSummary(xml)
        useAgentStore.getState().setSpaceContext({
          currentSpace: 'create',
          projectId: id,
          projectName: name,
          editorContext: { musicXml: xml, scoreSummary, selectedBars },
        })
      } else {
        useAgentStore.getState().setSpaceContext({
          currentSpace: 'create',
          projectId: id,
          projectName: name,
        })
      }
    }

    // Immediate sync on mount / when xml first loads
    sync()
    prevXmlRef.current = useLeadSheetStore.getState().musicXml

    // Debounced sync on subsequent changes (Zustand subscribe takes a single listener)
    const unsub = useLeadSheetStore.subscribe((state) => {
      if (state.musicXml !== prevXmlRef.current) {
        prevXmlRef.current = state.musicXml
        if (contextTimerRef.current) clearTimeout(contextTimerRef.current)
        contextTimerRef.current = setTimeout(sync, 500)
      }
    })
    return () => {
      unsub()
      if (contextTimerRef.current) clearTimeout(contextTimerRef.current)
    }
  }, [id])

  // Sync editor context to agent store — Trigger 2: selectedBars changes (immediate)
  const prevBarsRef = useRef<number[]>([])
  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (state.selectedBars !== prevBarsRef.current) {
        prevBarsRef.current = state.selectedBars
        const prev = useAgentStore.getState().spaceContext
        if (prev.editorContext) {
          useAgentStore.getState().setSpaceContext({
            ...prev,
            editorContext: { ...prev.editorContext, selectedBars: state.selectedBars },
          })
        }
      }
    })
    return unsub
  }, [])
```

- [ ] **Step 3: Verify the build**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/pack/EditorPage.tsx
git commit -m "feat(client): sync editorContext (musicXml + summary + selectedBars) to agent store"
```

---

### Task 4: Update server context prompt with score data and real transform rules

**Files:**
- Modify: `server/src/agent/prompts/context.ts:33-41`

- [ ] **Step 1: Replace the `create` space block**

Replace lines 33–41 in `context.ts`:

```ts
  if (ctx.currentSpace === 'create') {
    prompt += `\n\n## Editor Transform Mode`
    prompt += `\nWhen the user is in the editor, you have access to the \`create_version\` tool. Use it to:`
    prompt += `\n- Generate new song versions when the user asks for transformations ("easier", "blues version", "fingerpicking", "open chords", etc.)`
    prompt += `\n- Respond to section-specific requests when bar numbers are provided (e.g., "simplify bars 3-4")`
    prompt += `\n- Always call \`create_version\` with a descriptive name, the modified MusicXML, and 2-3 bullet points summarizing what changed`
    prompt += `\n- Do NOT describe manual notation editing steps — use \`create_version\` to show the result directly`
    prompt += `\n- For now, MusicXML transformations are mocked: take the user's request, return a brief explanatory message, and call \`create_version\` with a placeholder version of the MusicXML (you can add an XML comment to the original explaining what would change)`
  }
```

With:

```ts
  if (ctx.currentSpace === 'create') {
    prompt += `\n\n## Editor Transform Mode`

    if (ctx.editorContext) {
      const ec = ctx.editorContext
      prompt += `\n\n### Current Score`
      prompt += `\n${ec.scoreSummary}`
      prompt += `\n\n### Score XML (your editing target)`
      prompt += `\n${ec.musicXml}`

      if (ec.selectedBars && ec.selectedBars.length > 0) {
        const uiBars = ec.selectedBars.map((b) => b + 1).join(', ')
        prompt += `\n\nSelected bars (0-indexed): ${ec.selectedBars.join(', ')}  →  bars ${uiBars} in the UI`
      }
    }

    prompt += `\n\n### Transform Rules`
    prompt += `\n- You have the full score above. Modify it and call \`create_version\` with the complete transformed XML.`
    prompt += `\n- Preserve all structural elements (\`<?xml ...?>\`, \`<score-partwise>\`, \`<part>\`, measure attributes, \`<divisions>\`, \`<key>\`, \`<time>\`) unless the transformation explicitly requires changing them.`
    prompt += `\n- Only touch the bars, notes, harmony elements, and directions that the transformation requires.`
    prompt += `\n- For transposition requests: update every \`<pitch>\` element (step + octave + alter) and every \`<harmony>\` root.`
    prompt += `\n- For chord-only changes: update \`<harmony>\` elements only; leave \`<note>\` pitch/duration untouched.`
    prompt += `\n- For section-specific requests: only modify the measures in the specified bar range.`
    prompt += `\n- Do not add XML comments explaining what you changed — the changeSummary parameter of create_version is the right place for that.`
    prompt += `\n- Always call \`create_version\` with a descriptive name and 2-3 changeSummary bullet points.`
    prompt += `\n- Do NOT describe manual notation editing steps — use \`create_version\` to show the result directly.`
  }
```

- [ ] **Step 2: Verify the build**

Run: `cd server && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/agent/prompts/context.ts
git commit -m "feat(server): inject real score context and transform rules into agent prompt"
```

---

### Task 5: Add MusicXML format reference to system prompt

**Files:**
- Modify: `server/src/agent/prompts/system.ts`

- [ ] **Step 1: Append MusicXML section to SYSTEM_PROMPT**

Add the following before the closing backtick of `SYSTEM_PROMPT` in `system.ts`:

```ts

## MusicXML Reference
When generating or modifying MusicXML, follow this structure:
- A harmony element: \`<harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>\`
- A note: \`<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note>\`
- A rest: \`<note><rest/><duration>4</duration><type>quarter</type></note>\`
- Measures are wrapped in \`<part id="P1"><measure number="N">...</measure></part>\`
- The root document element is \`<score-partwise>\`
- Always preserve the \`<?xml ...?>\` declaration and \`<part-list>\` block from the original
```

- [ ] **Step 2: Verify the build**

Run: `cd server && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/agent/prompts/system.ts
git commit -m "feat(server): add MusicXML format reference to system prompt"
```

---

### Task 6: Add output validation before `version_created` event

**Files:**
- Modify: `server/src/agent/AgentOrchestrator.ts:52-74`

- [ ] **Step 1: Add the `isValidMusicXml` helper**

Add this function at the bottom of `AgentOrchestrator.ts`, after `parseToolResultContent`:

```ts
function isValidMusicXml(xml: string): boolean {
  if (!xml || xml.trim().length === 0) return false
  if (!xml.includes('<score-partwise')) return false
  if (!xml.includes('</score-partwise>')) return false
  if (!xml.includes('<measure')) return false
  return true
}
```

- [ ] **Step 2: Gate the `version_created` event on validation**

Replace lines 52-74 in the `run` method (the `create_version` handling block):

```ts
      if (toolCall.name === 'create_version' && !result.isError) {
        try {
          const parsed = JSON.parse(result.content) as {
            versionId: string
            name: string
            changeSummary: string[]
          }
          // musicXml is read from the original tool call input — not from the
          // handler result — so it is never echoed into the LLM's context window.
          const musicXml = String(toolCall.input?.['musicXml'] ?? '')
          onEvent({
            type: 'version_created',
            versionPayload: {
              versionId: parsed.versionId,
              name: parsed.name,
              musicXml,
              changeSummary: parsed.changeSummary,
            },
          })
        } catch (err) {
          logger.warn({ err }, '[AgentOrchestrator] create_version SSE: malformed tool result JSON')
        }
      }
```

With:

```ts
      if (toolCall.name === 'create_version' && !result.isError) {
        try {
          const parsed = JSON.parse(result.content) as {
            versionId: string
            name: string
            changeSummary: string[]
          }
          // musicXml is read from the original tool call input — not from the
          // handler result — so it is never echoed into the LLM's context window.
          const musicXml = String(toolCall.input?.['musicXml'] ?? '')

          if (isValidMusicXml(musicXml)) {
            onEvent({
              type: 'version_created',
              versionPayload: {
                versionId: parsed.versionId,
                name: parsed.name,
                musicXml,
                changeSummary: parsed.changeSummary,
              },
            })
          } else {
            logger.warn('[AgentOrchestrator] create_version: invalid MusicXML output, skipping version')
            onEvent({
              type: 'error',
              error: "The arrangement couldn't be generated — please try rephrasing your request.",
            })
          }
        } catch (err) {
          logger.warn({ err }, '[AgentOrchestrator] create_version SSE: malformed tool result JSON')
        }
      }
```

- [ ] **Step 3: Verify the build**

Run: `cd server && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/agent/AgentOrchestrator.ts
git commit -m "feat(server): validate MusicXML output before emitting version_created event"
```

---

### Task 7: Full integration verification

- [ ] **Step 1: Run all type checks**

Run: `pnpm typecheck`
Expected: PASS across all workspaces.

- [ ] **Step 2: Run client tests**

Run: `cd client && pnpm vitest run`
Expected: ALL PASS (including new `buildScoreSummary` tests).

- [ ] **Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS (no new lint errors).

- [ ] **Step 4: Manual smoke test**

Run: `pnpm dev`

1. Open the editor at `http://localhost:5173/editor/<some-project-id>` with a loaded score
2. Open the chat panel
3. Type "Make an easier version of this song" and send
4. Verify: the agent responds with actual MusicXML modifications (not comments/placeholders)
5. Verify: a version card appears in the chat with Preview/Apply buttons
6. Click Preview — the score should update to show the new version
7. Click Apply or Discard — both should work as before

- [ ] **Step 5: Final commit (if any lint/type fixes were needed)**

```bash
git add -A
git commit -m "chore: fix lint/type issues from real score editing integration"
```
