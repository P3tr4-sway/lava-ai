# Score Page AI Coach Onboarding

## Summary

When a user opens an AI-generated score, the agent automatically coaches them through the page and offers to build a personalized practice plan. The agent reads the actual generated score data (chords, key, tempo, sections) to produce all messages dynamically — nothing is canned. A persistent inline coach bar provides contextual tips during practice.

## Approach

Agent-first: the agent drives every step. No separate tooltip system. The agent narrates UI areas, gathers context, generates plans, and coaches — all through natural chat. An inline coach bar mirrors the agent's latest tip for glanceable guidance.

## Tone

Concise. One idea per message. No filler. Speak like a direct, friendly teacher — not a chatbot.

- Good: "Chord grid up top — your roadmap. Tap any bar to edit."
- Bad: "Let me show you around! The chord grid above is where you'll find your roadmap for the song. You can tap on any bar to edit the chords if something looks off."

No markdown formatting in agent messages (no backticks, no bold). Plain speech.

---

## Visit Tiers

Three tiers based on visit context. All detection state lives in `useCoachStore` (persisted to `lava-coach` localStorage key). No raw localStorage reads outside the store.

- `coachStore.hasSeenScoreOnboarding` → first-ever vs returning
- `coachStore.visitedSongIds` → new song vs revisit
- `useCalendarStore` plans for songId → progress data for revisits

### Tier 1: First AI-Generated Score (Full Onboarding)

**Trigger:** After chart data has loaded and the score is rendered (not during the loading/analysis state), `SongsPage` checks `coachStore.hasSeenScoreOnboarding === false`. If so, it calls `useUIStore.setAgentPanelOpen(true)` and dispatches the initial coaching message via the agent.

Six-step flow:

**Step 1 — Score summary**
Agent reads `useLeadSheetStore` + chart metadata. One message:
> "Your chart's ready. G minor, 120 BPM, 4 sections."

**Step 2 — UI highlights (3 messages)**
Each message is produced by the LLM calling the `coach_message` tool (see Structured Message Mechanism below), which includes `subtype: 'highlight'`, a `targetId`, and `chips`. This triggers a CSS pulse on the matching `data-coach-target` element. User advances with "Got it" or "Tell me more" chips.

1. `targetId: "chord-grid"` — "Chord grid up top — your roadmap. Tap any bar to edit."
2. `targetId: "daw-panel"` — "Recording studio down below. Red button to record yourself."
3. `targetId: "metadata-bar"` — "Key, time sig, tempo — all adjustable. Slow it down to practice."

"Tell me more" triggers one follow-up sentence. After the follow-up renders, a 1.5s delay auto-advances to the next highlight. No additional chip is shown.

**Step 3 — Skill merge**
The existing OnboardingModal collects skill level in local state (step 2). To persist it: add a `setSkillLevel(level)` action to `useAuthStore` that writes to `user.skillLevel`, and call it from the OnboardingModal when the user selects their level (before `completeOnboarding()`). The `User` type must be extended with `skillLevel?: 'beginner' | 'intermediate' | 'advanced'` (see Affected Files). The `createMockUser()` helper should default `skillLevel` to `undefined`. The agent pulls this value from the coach context. If no skill level was set (e.g., guest user), the agent asks directly instead.

> "You said intermediate — how are you with jazz voicings like these?"

Chips: "Comfortable" / "Need help" / "New to me"

Stores response as `songSkillAssessment` in `useCoachStore.songSkillAssessments[songId]`. The singular `coachContext.songSkillAssessment` passed to the server is derived from this plural Record lookup.

**Step 4 — Coaching style**
> "How should I coach you?"

Chips:
- "Just be around" → passive
- "Section by section" → checkpoint
- "Follow along" → active

Stored in `useCoachStore.coachingStyle`.

**Step 5 — Practice plan offer**
> "Want a practice plan for this song?"

Chips: "Yes" / "Later"

If yes: asks minutes per day + number of days (two quick inputs or chips), then the LLM calls the existing `create_practice_plan` tool (defined in `server/src/agent/tools/definitions/calendar.tool.ts`) with real song data. No changes needed to this tool's schema — the LLM already receives song context via the coaching prompt and can populate all required fields.

**Step 6 — Handoff**
> "All set. Hit play when you're ready."

Agent panel minimizes. Inline coach bar appears.

Calls `coachStore.markOnboardingSeen()` and `coachStore.addVisitedSong(songId)`.

### Interruption Behavior

The current onboarding step is tracked in `useCoachStore.currentOnboardingStep` (0-5, persisted).

- **User closes agent panel mid-onboarding:** On reopen, agent resumes from the last completed step. A system message provides context: "Resuming onboarding at step {N}."
- **User sends free-text message mid-onboarding:** Agent answers the question, then offers to continue: "Want to keep going with the tour?" Chips: "Yes" / "Skip to practice"
- **User navigates away and returns:** If `hasSeenScoreOnboarding` is still false and `currentOnboardingStep > 0`, resume. If `currentOnboardingStep === 0`, restart.
- **"Skip to practice" at any point:** Marks onboarding as seen, shows coach bar, agent goes to selected coaching mode (defaults to passive if not yet chosen).

### Tier 2: New Song (Light)

One auto-message:
> "[Title] — [key], [tempo] BPM, [N] sections. Want a practice plan?"

Chips: "Yes" / "No" / "Change coaching style"

Calls `coachStore.addVisitedSong(songId)`.

### Tier 3: Revisit

Agent reads `useCalendarStore` for this songId's plan progress:
> "Back to [Title]. 3 of 5 sessions done — left off at the bridge. Pick up there?"

Chips: "Let's go" / "Show progress" / "Start over"

"Show progress" displays completed/remaining sessions inline as a brief summary (not a separate UI).

---

## Inline Coach Bar

Slim strip rendered between the header toolbar and the score content area — as a sibling element in the `SongsPage` `flex flex-col` layout, after the header `<div>` and before the score `<div>`.

### Layout
- Left: bot avatar icon (16px)
- Center: single-line text, ellipsis overflow
- Right: "Chat" button (opens AgentPanel) + collapse chevron

### Behavior by coaching mode

| Mode | Inline bar content | Agent proactivity |
|---|---|---|
| Passive | "Ask me anything about this song." | Responds only to user messages |
| Active | Updates at section boundaries during playback | Sends `coachingTip` when playback crosses sections |
| Checkpoint | Shows current mini-goal from practice plan subtask | Waits for "Done" chip, then gives feedback + next goal |

### Visibility
- Hidden during onboarding (agent panel is the focus)
- Appears after onboarding handoff
- Collapsible — remembers collapsed state via `useCoachStore.coachBarCollapsed`
- On revisits: appears immediately with progress-aware tip

### Responsive behavior
On mobile (< 768px), CoachBar text truncates aggressively. The "Chat" button is hidden — tapping the bar itself opens the agent panel. The bar sits above the score content and does not interfere with `BottomNav`.

---

## Structured Message Mechanism

The LLM produces structured coaching messages via a new `coach_message` tool. This is how the agent outputs `subtype`, `targetId`, and `chips` fields — the LLM calls the tool instead of sending plain text.

### Tool: `coach_message`

```typescript
// Tool definition (server-side)
// Follows the existing ToolParameter pattern. Chips use stringified JSON
// (same convention as sessionsJson in calendar.tool.ts).
{
  name: 'coach_message',
  description: 'Send a structured coaching message with optional UI highlights and user choice chips.',
  parameters: [
    { name: 'content', type: 'string', description: 'The message text. Concise, plain speech.', required: true },
    { name: 'subtype', type: 'string', description: 'Message type.', enum: ['onboarding', 'highlight', 'coachingTip'], required: true },
    { name: 'targetId', type: 'string', description: 'UI element to highlight. Only for subtype=highlight.', enum: ['chord-grid', 'daw-panel', 'metadata-bar'], required: false },
    { name: 'chipsJson', type: 'string', description: 'JSON array of chips: [{ "label": "Got it", "value": "got_it", "action": "advance" }]. Each chip has label (display text), value (sent as user message), and optional action (advance|expand|set_style|create_plan|navigate).', required: false }
  ]
}
```

The tool handler parses `chipsJson` with Zod validation (same pattern as `calendar.tool.ts`) and returns the structured result.

### Client-side handling

When `useAgent` receives a `tool_result` for `coach_message`, it:
1. Creates an `AgentMessage` with the structured fields (`subtype`, `targetId`, `chips`)
2. If `subtype === 'highlight'`, dispatches a `coach-pulse` event to the score page
3. Renders chips as clickable pill buttons below the message in `ChatMessage`

This keeps the LLM in control of message structure while giving the client typed data to act on.

---

## Agent Message Types

Extend `AgentMessage` with optional fields:

```typescript
// In packages/shared/src/types/agent.ts
interface AgentMessage {
  // ... existing fields
  subtype?: 'chat' | 'onboarding' | 'highlight' | 'coachingTip'
  targetId?: string
  chips?: MessageChip[]
  hidden?: boolean                // True for system-injected messages (e.g., section boundary hints) that should not render in chat UI
}

interface MessageChip {
  label: string        // "Got it", "Yes", "Comfortable"
  value: string        // Machine-readable, sent as user message on click
  action?: 'advance' | 'expand' | 'set_style' | 'create_plan' | 'navigate'
}
```

Default `subtype` is `'chat'` when not set. Existing messages are unaffected.

---

## UI Highlight System

Score page components add `data-coach-target` attributes:

| Target ID | Component | Element |
|---|---|---|
| `chord-grid` | ChordGrid | Root container |
| `daw-panel` | DawPanel | Root container |
| `metadata-bar` | MetadataBar | Root container |

When agent sends a `highlight` message, the score page applies a `coach-pulse` CSS class to the matching element. The pulse is a subtle border glow animation (2 cycles, ~1.5s).

```css
@keyframes coach-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }
}
.coach-pulse {
  animation: coach-pulse 0.75s ease-in-out 2;
}
```

Highlight auto-clears after animation completes (CSS `animation-fill-mode: none` is default).

---

## Data Flow

### New state: `useCoachStore`

```typescript
type CoachingStyle = 'passive' | 'active' | 'checkpoint'

interface CoachState {
  coachingStyle: CoachingStyle
  hasSeenScoreOnboarding: boolean
  currentOnboardingStep: number              // 0-5, for resume-on-interrupt
  visitedSongIds: string[]
  songSkillAssessments: Record<string, string>  // songId → assessment value
  coachBarCollapsed: boolean

  setCoachingStyle: (style: CoachingStyle) => void
  markOnboardingSeen: () => void
  setOnboardingStep: (step: number) => void
  addVisitedSong: (songId: string) => void
  setSongSkillAssessment: (songId: string, assessment: string) => void
  setCoachBarCollapsed: (collapsed: boolean) => void
}
```

Persisted to `lava-coach` localStorage key via Zustand `persist` middleware.

### Extending shared types

`SpaceContext` in `packages/shared/src/types/agent.ts` must be extended:

```typescript
interface SpaceContext {
  currentSpace: SpaceType
  projectId?: string
  projectName?: string
  coachContext?: CoachContext       // NEW
}

interface CoachContext {
  songTitle: string
  artist?: string
  key: string
  tempo: number
  timeSignature: string
  sectionCount: number
  sectionLabels: string[]
  chordSummary: string              // unique chords, comma-separated
  userSkillLevel?: string           // from authStore.user.skillLevel
  songSkillAssessment?: string      // from coachStore.songSkillAssessments[songId]
  coachingStyle: CoachingStyle
  visitTier: 'first' | 'new_song' | 'revisit'
  practiceProgress?: {
    totalSessions: number
    completedSessions: number
    lastSessionTitle?: string
    nextSessionTitle?: string
  }
}
```

### Context enrichment

`SongsPage` builds the `coachContext` after chart data loads and passes it via `setSpaceContext`. The server-side context prompt (`context.ts`) reads `coachContext` and appends the coaching prompt section to the system message.

### Active coaching: section boundary detection

For active mode, a `useCoachSectionTracker` hook watches `useAudioStore.currentBar` against section bar ranges from `useLeadSheetStore`. When a section boundary is crossed during playback, the hook sends a lightweight user-role message to the agent:

```
[Section change: now entering "Bridge", chords: Dm7, G7, Cmaj7. Previous section: "Verse 2"]
```

This message is tagged with `{ hidden: true }` so it does not render in the chat UI. The agent responds with a `coachingTip` via the `coach_message` tool. This is a normal chat round-trip, not a separate tool — the section context is injected as a system-level hint that the LLM responds to.

The hook is disabled when coaching mode is not `'active'` or when playback is stopped.

---

## Server-Side Changes

### New system prompt section

Appended to existing system prompt when `coachContext` is present:

```
You are coaching the user on "{songTitle}" by {artist}.
Key: {key}, Tempo: {tempo} BPM, Time: {timeSignature}
Sections: {sectionLabels}
Chords used: {chordSummary}

User skill: {skillLevel} (global), {songSkillAssessment} (this song)
Coaching style: {coachingStyle}
Visit: {visitTier}
Progress: {completedSessions}/{totalSessions} sessions done

Rules:
- Be concise. One idea per message. No filler.
- No markdown formatting. Plain speech only.
- Reference actual chords and sections from this song.
- Match coaching depth to skill assessment.
- Use the coach_message tool for all coaching and onboarding messages.
- For highlight messages, include the targetId for the UI element being described.
- Include chips when the user needs to make a choice.
```

### New tool: `coach_message`

Defined in `server/src/agent/tools/definitions/coach.tool.ts`. See "Structured Message Mechanism" section above for the full definition. The tool handler formats the structured message and returns it as a tool result, which the client parses into an enriched `AgentMessage`.

### Existing tool: `create_practice_plan`

No changes needed. The existing tool in `calendar.tool.ts` accepts `songTitle`, `songId`, `goalDescription`, `durationDays`, `minutesPerDay`, `skillLevel`, `focusAreas`, and `sessionsJson`. The LLM receives all necessary song context via the coaching prompt and can populate these fields directly.

---

## Affected Files

### New files
- `client/src/stores/coachStore.ts` — coaching state (CoachingStyle, onboarding step, visited songs, skill assessments)
- `client/src/hooks/useCoachSectionTracker.ts` — active mode section boundary detection
- `client/src/components/score/CoachBar.tsx` — inline coach bar component
- `server/src/agent/tools/definitions/coach.tool.ts` — `coach_message` tool definition

### Modified files
- `packages/shared/src/types/agent.ts` — extend `AgentMessage` with `subtype`, `targetId`, `chips`; extend `SpaceContext` with `coachContext`; add `CoachContext`, `MessageChip`, `CoachingStyle` types
- `packages/shared/src/types/user.ts` — add `skillLevel?: 'beginner' | 'intermediate' | 'advanced'` to `User` interface
- `client/src/spaces/learn/SongsPage.tsx` — mount coach context after chart loads, render CoachBar, add data-coach-target attrs, trigger onboarding flow
- `client/src/components/score/ChordGrid.tsx` — add `data-coach-target="chord-grid"` to root
- `client/src/components/score/MetadataBar.tsx` — add `data-coach-target="metadata-bar"` to root
- `client/src/components/daw/DawPanel.tsx` — add `data-coach-target="daw-panel"` to root
- `client/src/components/agent/AgentPanel.tsx` — render chips on messages, handle highlight pulse dispatch
- `client/src/components/agent/ChatMessage.tsx` — render chip buttons for messages with `chips` array
- `client/src/components/agent/QuickActions.tsx` — add "Change coaching style" action for learn space
- `client/src/stores/index.ts` — re-export `coachStore` from barrel
- `client/src/stores/agentStore.ts` — support `hidden` flag on messages (for section boundary hints)
- `client/src/stores/authStore.ts` — add `setSkillLevel(level)` action, update `createMockUser()` to default `skillLevel` to `undefined`
- `client/src/hooks/useAgent.ts` — handle `coach_message` tool results, chip click actions, coaching tip flow
- `client/src/styles/tokens.css` — add `coach-pulse` keyframes
- `client/src/components/onboarding/OnboardingModal.tsx` — persist `skillLevel` to user object on step 2
- `server/src/agent/prompts/system.ts` — add coaching prompt section (conditional on coachContext)
- `server/src/agent/prompts/context.ts` — include coachContext fields in context prompt
- `server/src/agent/tools/definitions/index.ts` — register `coach_message` tool
