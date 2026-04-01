# Score Page AI Coach Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an agent-driven coaching onboarding to the score page that dynamically reads the generated chart and guides users through the UI, gathers skill context, offers practice plans, and provides contextual coaching tips during practice.

**Architecture:** Agent-first approach — the LLM drives all coaching via a `coach_message` tool that produces structured messages (with subtypes, UI highlight targets, and clickable chips). A new `useCoachStore` manages coaching state. An inline CoachBar sits between the header and score area. Three visit tiers (first/new/revisit) determine the onboarding depth.

**Tech Stack:** React 18, TypeScript, Zustand (persist middleware), Tailwind CSS, Fastify (server), Anthropic/OpenAI streaming

**Spec:** `docs/superpowers/specs/2026-03-26-score-coach-onboarding-design.md`

---

### Task 1: Extend Shared Types

**Files:**
- Modify: `packages/shared/src/types/agent.ts`
- Modify: `packages/shared/src/types/user.ts`

- [ ] **Step 1: Add `skillLevel` to User interface**

In `packages/shared/src/types/user.ts`, add `skillLevel` to the `User` interface after `preferences`:

```typescript
export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  plan: PlanTier
  preferences: UserPreferences
  skillLevel?: 'beginner' | 'intermediate' | 'advanced'
  createdAt: number
}
```

- [ ] **Step 2: Extend AgentMessage with coach fields**

In `packages/shared/src/types/agent.ts`, add new fields to `AgentMessage` and new interfaces after the existing types:

```typescript
export interface AgentMessage {
  id: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  createdAt: number
  subtype?: 'chat' | 'onboarding' | 'highlight' | 'coachingTip'
  targetId?: string
  chips?: MessageChip[]
  hidden?: boolean
}

export interface MessageChip {
  label: string
  value: string
  action?: 'advance' | 'expand' | 'set_style' | 'create_plan' | 'navigate'
}
```

- [ ] **Step 3: Add CoachContext and extend SpaceContext**

In the same file, add `CoachingStyle`, `CoachContext`, and extend `SpaceContext`:

```typescript
export type CoachingStyle = 'passive' | 'active' | 'checkpoint'

export interface CoachContext {
  songTitle: string
  artist?: string
  key: string
  tempo: number
  timeSignature: string
  sectionCount: number
  sectionLabels: string[]
  chordSummary: string
  userSkillLevel?: string
  songSkillAssessment?: string
  coachingStyle: CoachingStyle
  visitTier: 'first' | 'new_song' | 'revisit'
  practiceProgress?: {
    totalSessions: number
    completedSessions: number
    lastSessionTitle?: string
    nextSessionTitle?: string
  }
}

export interface SpaceContext {
  currentSpace: SpaceType
  projectId?: string
  projectName?: string
  coachContext?: CoachContext
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (no downstream consumers use the new optional fields yet)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/agent.ts packages/shared/src/types/user.ts
git commit -m "feat: extend shared types for score coach onboarding"
```

---

### Task 2: Create useCoachStore

**Files:**
- Create: `client/src/stores/coachStore.ts`
- Modify: `client/src/stores/index.ts`

- [ ] **Step 1: Create the coach store**

Create `client/src/stores/coachStore.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CoachingStyle } from '@lava/shared'

interface CoachState {
  coachingStyle: CoachingStyle
  hasSeenScoreOnboarding: boolean
  currentOnboardingStep: number
  visitedSongIds: string[]
  songSkillAssessments: Record<string, string>
  coachBarCollapsed: boolean

  setCoachingStyle: (style: CoachingStyle) => void
  markOnboardingSeen: () => void
  setOnboardingStep: (step: number) => void
  addVisitedSong: (songId: string) => void
  setSongSkillAssessment: (songId: string, assessment: string) => void
  setCoachBarCollapsed: (collapsed: boolean) => void
  getVisitTier: (songId: string) => 'first' | 'new_song' | 'revisit'
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      coachingStyle: 'passive',
      hasSeenScoreOnboarding: false,
      currentOnboardingStep: 0,
      visitedSongIds: [],
      songSkillAssessments: {},
      coachBarCollapsed: false,

      setCoachingStyle: (style) => set({ coachingStyle: style }),

      markOnboardingSeen: () =>
        set({ hasSeenScoreOnboarding: true, currentOnboardingStep: 0 }),

      setOnboardingStep: (step) => set({ currentOnboardingStep: step }),

      addVisitedSong: (songId) =>
        set((state) => ({
          visitedSongIds: state.visitedSongIds.includes(songId)
            ? state.visitedSongIds
            : [...state.visitedSongIds, songId],
        })),

      setSongSkillAssessment: (songId, assessment) =>
        set((state) => ({
          songSkillAssessments: {
            ...state.songSkillAssessments,
            [songId]: assessment,
          },
        })),

      setCoachBarCollapsed: (collapsed) =>
        set({ coachBarCollapsed: collapsed }),

      getVisitTier: (songId) => {
        const state = get()
        if (!state.hasSeenScoreOnboarding) return 'first'
        if (!state.visitedSongIds.includes(songId)) return 'new_song'
        return 'revisit'
      },
    }),
    { name: 'lava-coach' },
  ),
)
```

- [ ] **Step 2: Add barrel export**

In `client/src/stores/index.ts`, add:

```typescript
export { useCoachStore } from './coachStore'
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/coachStore.ts client/src/stores/index.ts
git commit -m "feat: add useCoachStore for coaching state"
```

---

### Task 3: Update Auth Store and OnboardingModal

**Files:**
- Modify: `client/src/stores/authStore.ts`
- Modify: `client/src/components/onboarding/OnboardingModal.tsx`

- [ ] **Step 1: Add setSkillLevel to authStore**

In `client/src/stores/authStore.ts`, add `setSkillLevel` to the `AuthState` interface (after `completeOnboarding`):

```typescript
setSkillLevel: (level: 'beginner' | 'intermediate' | 'advanced') => void
```

Add the action implementation inside the `create` call (after `completeOnboarding`):

```typescript
setSkillLevel: (level) => {
  set((state) => {
    if (!state.user) return {}
    const updated = { ...state.user, skillLevel: level }
    persistAuth(updated)
    return { user: updated }
  })
},
```

- [ ] **Step 2: Call setSkillLevel from OnboardingModal**

In `client/src/components/onboarding/OnboardingModal.tsx`, the modal already has `skillLevel` local state and `useAuthStore`. Add `setSkillLevel` to the destructured actions from the store.

The step 1 "Next" button uses `onClick={handleNext}` where `handleNext` calls `setStep((prev) => prev + 1)`. Replace the step 1 button's onClick with an inline handler that persists the skill level before advancing:

```tsx
onClick={() => {
  setSkillLevel(skillLevel)
  handleNext()
}}
```

Note: `createMockUser()` in authStore does not need changes — `skillLevel` is optional on the `User` type, so omitting it defaults to `undefined`.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/authStore.ts client/src/components/onboarding/OnboardingModal.tsx
git commit -m "feat: persist skillLevel from onboarding to auth store"
```

---

### Task 4: Add coach_message Tool (Server)

**Files:**
- Create: `server/src/agent/tools/definitions/coach.tool.ts`
- Modify: `server/src/agent/tools/definitions/index.ts`
- Modify: `server/src/agent/tools/index.ts` (tool handler)

- [ ] **Step 1: Create coach.tool.ts**

Create `server/src/agent/tools/definitions/coach.tool.ts` following the pattern from `calendar.tool.ts`:

```typescript
import type { ToolDefinition } from '@lava/shared'

export const coachMessageTool: ToolDefinition = {
  name: 'coach_message',
  description:
    'Send a structured coaching message with optional UI highlights and user choice chips. Use this for all onboarding and coaching messages instead of plain text.',
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The message text. Concise, plain speech. No markdown.',
      required: true,
    },
    {
      name: 'subtype',
      type: 'string',
      description: 'Message type: onboarding (flow steps), highlight (UI tour with pulse), coachingTip (practice tips).',
      required: true,
      enum: ['onboarding', 'highlight', 'coachingTip'],
    },
    {
      name: 'targetId',
      type: 'string',
      description:
        'UI element to highlight with a pulse animation. Only used when subtype is highlight.',
      required: false,
      enum: ['chord-grid', 'daw-panel', 'metadata-bar'],
    },
    {
      name: 'chipsJson',
      type: 'string',
      description:
        'JSON array of choice chips. Each chip: { "label": "Got it", "value": "got_it", "action": "advance" }. Actions: advance (next onboarding step), expand (show more detail), set_style (set coaching style), create_plan (trigger practice plan), navigate (go to route).',
      required: false,
    },
  ],
}
```

- [ ] **Step 2: Register in definitions/index.ts**

In `server/src/agent/tools/definitions/index.ts`, add the import and include in `ALL_TOOLS`:

```typescript
import { coachMessageTool } from './coach.tool.js'
```

Add `coachMessageTool` to the `ALL_TOOLS` array.

- [ ] **Step 3: Add tool handler**

In `server/src/agent/tools/index.ts`, add a handler for `coach_message` in the handlers map. The handler must be `async` (matching the `ToolHandler` type) and return a plain object (not `JSON.stringify` — `ToolExecutor.execute()` handles serialization). Use Zod to validate `chipsJson` (same pattern as `calendar.tool.ts`):

```typescript
import { z } from 'zod'

const chipSchema = z.array(z.object({
  label: z.string(),
  value: z.string(),
  action: z.enum(['advance', 'expand', 'set_style', 'create_plan', 'navigate']).optional(),
}))

// In the handlers map:
coach_message: async (input) => {
  const { content, subtype, targetId, chipsJson } = input as {
    content: string
    subtype: string
    targetId?: string
    chipsJson?: string
  }

  let chips = undefined
  if (chipsJson) {
    const parsed = JSON.parse(chipsJson)
    chips = chipSchema.parse(parsed)
  }

  return {
    action: 'coach_message',
    content,
    subtype,
    targetId,
    chips,
  }
},
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/agent/tools/definitions/coach.tool.ts server/src/agent/tools/definitions/index.ts server/src/agent/tools/index.ts
git commit -m "feat: add coach_message server tool for structured coaching messages"
```

---

### Task 5: Update Server Prompts

**Files:**
- Modify: `server/src/agent/prompts/context.ts`

- [ ] **Step 1: No changes to system.ts**

The coaching prompt rules must only appear when `coachContext` is present (to avoid wasting tokens and confusing the LLM in non-coaching contexts). All coaching-specific prompt content goes in `context.ts` (Step 2), not in the static `SYSTEM_PROMPT`.

- [ ] **Step 2: Extend context prompt to include coachContext and coaching rules**

In `server/src/agent/prompts/context.ts`, update the `buildContextPrompt` function. After the existing project context lines, add coach context rendering:

Preserve the existing function structure (including the `\n## Current context\n` prefix). Only add the coach context block after the existing project context lines. Do not rewrite the function — append to it:

```typescript
  // Add after the existing projectId/projectName block, before `return prompt`:
  if (ctx.coachContext) {
    const c = ctx.coachContext
    prompt += `\n\n## Coaching Context`
    prompt += `\nSong: "${c.songTitle}"${c.artist ? ` by ${c.artist}` : ''}`
    prompt += `\nKey: ${c.key}, Tempo: ${c.tempo} BPM, Time: ${c.timeSignature}`
    prompt += `\nSections (${c.sectionCount}): ${c.sectionLabels.join(', ')}`
    prompt += `\nChords used: ${c.chordSummary}`
    prompt += `\nUser skill: ${c.userSkillLevel ?? 'unknown'} (global)${c.songSkillAssessment ? `, ${c.songSkillAssessment} (this song)` : ''}`
    prompt += `\nCoaching style: ${c.coachingStyle}`
    prompt += `\nVisit tier: ${c.visitTier}`
    if (c.practiceProgress) {
      prompt += `\nProgress: ${c.practiceProgress.completedSessions}/${c.practiceProgress.totalSessions} sessions done`
      if (c.practiceProgress.lastSessionTitle) {
        prompt += ` (last: ${c.practiceProgress.lastSessionTitle})`
      }
      if (c.practiceProgress.nextSessionTitle) {
        prompt += ` (next: ${c.practiceProgress.nextSessionTitle})`
      }
    }

    // Coaching rules — only included when coachContext is present
    prompt += `\n\n## Coaching Rules`
    prompt += `\n- Use the coach_message tool for ALL coaching and onboarding messages. Never send plain text during coaching.`
    prompt += `\n- Be concise. One idea per message. No filler words.`
    prompt += `\n- No markdown formatting in message content. Plain speech only.`
    prompt += `\n- Reference actual chords and sections from the song.`
    prompt += `\n- Match coaching depth to the user's skill assessment.`
    prompt += `\n- For highlight messages, include the targetId for the UI element being described.`
    prompt += `\n- Include chips when the user needs to make a choice or advance.`
    prompt += `\n\nVisit tiers:`
    prompt += `\n- "first": Full onboarding. Greet with score summary, highlight UI areas one at a time, ask skill merge question, offer coaching style choice, offer practice plan.`
    prompt += `\n- "new_song": Light greeting with score summary. Offer practice plan.`
    prompt += `\n- "revisit": Reference progress. Offer to continue where they left off.`
    prompt += `\n\nCoaching styles:`
    prompt += `\n- "passive": Only respond when the user asks.`
    prompt += `\n- "active": Send coachingTip messages when section boundaries are crossed during playback.`
    prompt += `\n- "checkpoint": Set mini-goals from the practice plan. Wait for user to signal completion.`
  }

  return prompt
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/agent/prompts/context.ts
git commit -m "feat: add coaching context and rules to context prompt"
```

---

### Task 6: Update AgentStore and useAgent Hook

**Files:**
- Modify: `client/src/stores/agentStore.ts`
- Modify: `client/src/hooks/useAgent.ts`

- [ ] **Step 1: Update agentStore to handle hidden messages and coach messages**

In `client/src/stores/agentStore.ts`, the store already handles `AgentMessage` which now has optional `subtype`, `targetId`, `chips`, and `hidden` fields. No interface changes needed in the store itself since `AgentMessage` is imported from `@lava/shared`. The existing `addMessage` action already accepts the full `AgentMessage` type.

Add a `coachHighlightTarget` state field and action to track which UI element should pulse:

```typescript
coachHighlightTarget: null as string | null,
setCoachHighlightTarget: (target: string | null) => set({ coachHighlightTarget: target }),
```

Add these to the `AgentStore` interface and implementation.

- [ ] **Step 2: Update useAgent to handle coach_message tool results**

In `client/src/hooks/useAgent.ts`, update the `handleToolResult` function to handle `coach_message` results alongside the existing `navigate_to_space` and `practice_plan` handlers:

```typescript
// Inside handleToolResult, after parsing the JSON result:
if (parsed.action === 'coach_message') {
  const coachMsg: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: parsed.content,
    createdAt: Date.now(),
    subtype: parsed.subtype,
    targetId: parsed.targetId,
    chips: parsed.chips,
  }
  addMessage(coachMsg)

  // Trigger UI highlight if applicable
  if (parsed.subtype === 'highlight' && parsed.targetId) {
    setCoachHighlightTarget(parsed.targetId)
    // Auto-clear after animation (1.5s)
    setTimeout(() => setCoachHighlightTarget(null), 1500)
  }
}
```

Also add a `sendHiddenMessage` function for the section tracker to use. First, extract the shared event handling logic from `sendMessage` into a reusable helper so both functions use the same stream processing:

```typescript
// Extract from sendMessage's existing event callback:
const handleStreamEvent = useCallback((event: StreamEvent) => {
  if (event.type === 'text_delta' && event.delta) {
    appendStreamDelta(event.delta)
  } else if (event.type === 'tool_result' && event.toolResult) {
    handleToolResult(event.toolResult)
  } else if (event.type === 'message_stop') {
    finalizeStream()
  }
}, [appendStreamDelta, finalizeStream])

const sendHiddenMessage = useCallback(async (content: string) => {
  const hiddenMsg: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    createdAt: Date.now(),
    hidden: true,
  }
  addMessage(hiddenMsg)
  setStreaming(true)
  try {
    await agentService.streamChat(
      [...useAgentStore.getState().messages],
      spaceContext,
      handleStreamEvent,
    )
  } catch {
    finalizeStream()
  }
}, [spaceContext, handleStreamEvent])
```

Update `sendMessage` to also use `handleStreamEvent` instead of its inline callback. Return `sendHiddenMessage` from the hook alongside `sendMessage`.

- [ ] **Step 3: Handle chip click actions**

Add a `handleChipClick` function in `useAgent`:

```typescript
const VALID_STYLES: CoachingStyle[] = ['passive', 'active', 'checkpoint']

const handleChipClick = useCallback((chip: MessageChip) => {
  // Send chip value as a user message
  sendMessage(chip.value)

  // Execute local actions based on chip.action
  if (chip.action === 'set_style' && VALID_STYLES.includes(chip.value as CoachingStyle)) {
    useCoachStore.getState().setCoachingStyle(chip.value as CoachingStyle)
  }
}, [sendMessage])
```

Return `handleChipClick` from the hook.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/agentStore.ts client/src/hooks/useAgent.ts
git commit -m "feat: handle coach_message tool results and chip actions in agent hook"
```

---

### Task 7: Update ChatMessage to Render Chips

**Files:**
- Modify: `client/src/components/agent/ChatMessage.tsx`

- [ ] **Step 1: Add chip rendering to ChatMessage**

Update `ChatMessage` to accept an `onChipClick` prop and render chips below the message content:

```typescript
import type { AgentMessage, MessageChip } from '@lava/shared'
import { cn } from '@/components/ui/utils'
import { Bot, User } from 'lucide-react'

interface ChatMessageProps {
  message: AgentMessage
  isStreaming?: boolean
  onChipClick?: (chip: MessageChip) => void
}

export function ChatMessage({ message, isStreaming, onChipClick }: ChatMessageProps) {
  const isUser = message.role === 'user'

  // Don't render hidden messages
  if (message.hidden) return null

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center mt-0.5',
          isUser ? 'bg-surface-3' : 'bg-surface-2',
        )}
      >
        {isUser ? (
          <User size={12} className="text-text-secondary" />
        ) : (
          <Bot size={12} className="text-text-secondary" />
        )}
      </div>
      <div className={cn('max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded px-3 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-surface-3 text-text-primary'
              : 'bg-surface-2 text-text-primary border border-border',
          )}
        >
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1 h-3.5 bg-text-primary/60 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        {message.chips && message.chips.length > 0 && onChipClick && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.chips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => onChipClick(chip)}
                className="px-2.5 py-1 text-2xs font-medium text-text-secondary bg-surface-2 border border-border rounded-full hover:bg-surface-3 hover:border-border-hover hover:text-text-primary transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/agent/ChatMessage.tsx
git commit -m "feat: render chip buttons on coaching messages"
```

---

### Task 8: Update AgentPanel to Pass Chip Handler

**Files:**
- Modify: `client/src/components/agent/AgentPanel.tsx`

- [ ] **Step 1: Wire onChipClick through AgentPanel**

In `AgentPanel.tsx`, get `handleChipClick` from the `useAgent()` hook and pass it to each `ChatMessage`:

```typescript
const { sendMessage, handleChipClick } = useAgent()
```

In the messages map, update the `ChatMessage` rendering:

```tsx
<ChatMessage
  key={msg.id}
  message={msg}
  isStreaming={isStreaming && i === messages.length - 1}
  onChipClick={handleChipClick}
/>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/agent/AgentPanel.tsx
git commit -m "feat: pass chip click handler to chat messages in agent panel"
```

---

### Task 9: Add CSS Coach Pulse Animation

**Files:**
- Modify: `client/src/styles/tokens.css`

- [ ] **Step 1: Add coach-pulse keyframes**

Append to the end of `client/src/styles/tokens.css` (after the light theme block):

```css
/* ── Coach highlight pulse ─────────────────────────────── */
@keyframes coach-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }
}

.coach-pulse {
  animation: coach-pulse 0.75s ease-in-out 2;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/styles/tokens.css
git commit -m "feat: add coach-pulse CSS animation for UI highlights"
```

---

### Task 10: Add data-coach-target Attributes to Score Components

**Files:**
- Modify: `client/src/components/score/ChordGrid.tsx`
- Modify: `client/src/components/score/MetadataBar.tsx`
- Modify: `client/src/components/daw/DawPanel.tsx`

- [ ] **Step 1: Add data-coach-target to ChordGrid**

In `client/src/components/score/ChordGrid.tsx`, add `data-coach-target="chord-grid"` to the root container element.

- [ ] **Step 2: Add data-coach-target to MetadataBar**

In `client/src/components/score/MetadataBar.tsx`, add `data-coach-target="metadata-bar"` to the root container element.

- [ ] **Step 3: Add data-coach-target to DawPanel**

In `client/src/components/daw/DawPanel.tsx`, add `data-coach-target="daw-panel"` to the root container element.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/score/ChordGrid.tsx client/src/components/score/MetadataBar.tsx client/src/components/daw/DawPanel.tsx
git commit -m "feat: add data-coach-target attributes for UI highlight system"
```

---

### Task 11: Create CoachBar Component

**Files:**
- Create: `client/src/components/score/CoachBar.tsx`
- Modify: `client/src/components/score/index.ts`

- [ ] **Step 1: Create CoachBar**

Create `client/src/components/score/CoachBar.tsx`:

```typescript
import { Bot, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useCoachStore } from '@/stores/coachStore'
import { useUIStore } from '@/stores'

interface CoachBarProps {
  className?: string
  tip: string | null
}

export function CoachBar({ className, tip }: CoachBarProps) {
  const { coachBarCollapsed, setCoachBarCollapsed, coachingStyle } =
    useCoachStore()
  const setAgentPanelOpen = useUIStore((s) => s.setAgentPanelOpen)

  const displayText =
    tip ?? (coachingStyle === 'passive'
      ? 'Ask me anything about this song.'
      : coachingStyle === 'checkpoint'
        ? 'Working on your current goal...'
        : 'Following along...')

  if (coachBarCollapsed) {
    return (
      <button
        onClick={() => setCoachBarCollapsed(false)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 bg-surface-1 border-b border-border text-text-muted text-xs hover:text-text-secondary transition-colors',
          className,
        )}
      >
        <Bot size={14} />
        <ChevronUp size={12} />
      </button>
    )
  }

  const handleBarClick = (e: React.MouseEvent) => {
    // On mobile, tapping the bar itself opens the agent panel
    // Only if the click wasn't on an interactive child (collapse button)
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    setAgentPanelOpen(true)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-surface-1 border-b border-border cursor-pointer md:cursor-default',
        className,
      )}
      onClick={handleBarClick}
    >
      <Bot size={16} className="flex-shrink-0 text-text-secondary" />
      <span className="flex-1 text-sm text-text-primary truncate">
        {displayText}
      </span>
      <button
        onClick={() => setAgentPanelOpen(true)}
        className="hidden md:flex items-center gap-1 px-2 py-0.5 text-2xs font-medium text-text-secondary bg-surface-2 border border-border rounded-full hover:bg-surface-3 hover:text-text-primary transition-colors"
      >
        <MessageCircle size={10} />
        Chat
      </button>
      <button
        onClick={() => setCoachBarCollapsed(true)}
        className="text-text-muted hover:text-text-secondary transition-colors"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
```

Note: On mobile, tapping the bar area opens the agent panel. The "Chat" button is hidden (`hidden md:flex`) but tapping anywhere on the bar (except the collapse chevron) opens the panel. On desktop, the explicit "Chat" button is shown.

- [ ] **Step 2: Add barrel export**

In `client/src/components/score/index.ts`, add:

```typescript
export { CoachBar } from './CoachBar'
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/components/score/CoachBar.tsx client/src/components/score/index.ts
git commit -m "feat: add CoachBar inline coaching tip component"
```

---

### Task 12: Create useCoachSectionTracker Hook

**Files:**
- Create: `client/src/hooks/useCoachSectionTracker.ts`

- [ ] **Step 1: Create the hook**

Create `client/src/hooks/useCoachSectionTracker.ts`:

```typescript
import { useEffect, useRef } from 'react'
import { useAudioStore } from '@/stores'
import { useCoachStore } from '@/stores/coachStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'

interface SectionRange {
  label: string
  type: string
  barStart: number
  barEnd: number
  chords: string[]
}

export function useCoachSectionTracker(
  sendHiddenMessage: ((content: string) => Promise<void>) | null,
) {
  const currentBar = useAudioStore((s) => s.currentBar)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const sections = useLeadSheetStore((s) => s.sections)
  const coachingStyle = useCoachStore((s) => s.coachingStyle)
  const lastSectionRef = useRef<string | null>(null)

  useEffect(() => {
    if (coachingStyle !== 'active' || !isPlaying || !sendHiddenMessage) return

    // Build section bar ranges
    const ranges: SectionRange[] = []
    let barOffset = 0
    for (const section of sections) {
      const chords = section.measures.flatMap((m) => m.chords)
      const uniqueChords = [...new Set(chords)].filter(Boolean)
      ranges.push({
        label: section.label,
        type: section.type,
        barStart: barOffset,
        barEnd: barOffset + section.measures.length - 1,
        chords: uniqueChords,
      })
      barOffset += section.measures.length
    }

    // Find current section
    const currentSection = ranges.find(
      (r) => currentBar >= r.barStart && currentBar <= r.barEnd,
    )
    if (!currentSection) return

    // Only fire on section change
    if (currentSection.label === lastSectionRef.current) return
    const previousLabel = lastSectionRef.current
    lastSectionRef.current = currentSection.label

    // Don't fire for the very first section on play start
    if (!previousLabel) return

    sendHiddenMessage(
      `[Section change: now entering "${currentSection.label}", chords: ${currentSection.chords.join(', ')}. Previous section: "${previousLabel}"]`,
    )
  }, [currentBar, isPlaying, sections, coachingStyle, sendHiddenMessage])

  // Reset tracking when playback stops
  useEffect(() => {
    if (!isPlaying) {
      lastSectionRef.current = null
    }
  }, [isPlaying])
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useCoachSectionTracker.ts
git commit -m "feat: add useCoachSectionTracker for active coaching mode"
```

---

### Task 13: Integrate Coaching into SongsPage

**Files:**
- Modify: `client/src/spaces/learn/SongsPage.tsx`

This is the main integration task. SongsPage needs to:
1. Build and set coach context after chart loads
2. Render CoachBar between header and score area
3. Apply highlight pulse to targeted elements
4. Trigger onboarding for first-time visits
5. Use the section tracker hook

- [ ] **Step 1: Add imports and coach state**

At the top of `SongsPage.tsx`, add imports:

```typescript
import { useCoachStore } from '@/stores/coachStore'
import { CoachBar } from '@/components/score'
import { useCoachSectionTracker } from '@/hooks/useCoachSectionTracker'
import { useAgent } from '@/hooks/useAgent'
import type { CoachContext } from '@lava/shared'
```

Inside the component, add coach state reads:

```typescript
const coachStore = useCoachStore()
const { sendMessage, sendHiddenMessage } = useAgent()
const { coachHighlightTarget } = useAgentStore()
const [showCoachBar, setShowCoachBar] = useState(false)
const [latestCoachTip, setLatestCoachTip] = useState<string | null>(null)
```

- [ ] **Step 2: Build and set coach context after chart data loads**

Add a `useEffect` that fires after chart data is populated (after lead sheet sections are available). This builds the `CoachContext` and passes it via `setSpaceContext`:

```typescript
useEffect(() => {
  if (!chart || sections.length === 0) return

  const allChords = sections.flatMap((s) =>
    s.measures.flatMap((m) => m.chords),
  )
  const uniqueChords = [...new Set(allChords)].filter(Boolean)

  const visitTier = coachStore.getVisitTier(id ?? '')
  const calendarPlans = useCalendarStore.getState().plans.filter(
    (p) => p.songId === id,
  )
  const allSessions = calendarPlans.flatMap((p) => p.sessions)
  const completedSessions = allSessions.filter((s) => s.completed).length

  const coachContext: CoachContext = {
    songTitle: chart.title,
    artist: chart.artist,
    key: chart.key,
    tempo: chart.tempo ?? 120,
    timeSignature: chart.timeSignature ?? '4/4',
    sectionCount: sections.length,
    sectionLabels: sections.map((s) => s.label),
    chordSummary: uniqueChords.join(', '),
    userSkillLevel: useAuthStore.getState().user?.skillLevel,
    songSkillAssessment: coachStore.songSkillAssessments[id ?? ''],
    coachingStyle: coachStore.coachingStyle,
    visitTier,
    practiceProgress: allSessions.length > 0
      ? {
          totalSessions: allSessions.length,
          completedSessions,
          lastSessionTitle: allSessions.filter((s) => s.completed).at(-1)?.title,
          nextSessionTitle: allSessions.find((s) => !s.completed)?.title,
        }
      : undefined,
  }

  setSpaceContext({
    currentSpace: 'learn',
    projectId: id,
    coachContext,
  })

  // Trigger coaching via hidden init messages (not shown in chat)
  if (visitTier === 'first') {
    useUIStore.getState().setAgentPanelOpen(true)
    sendHiddenMessage('[Coach init: first visit. Run full onboarding flow.]')
  } else if (visitTier === 'new_song') {
    useUIStore.getState().setAgentPanelOpen(true)
    sendHiddenMessage('[Coach init: new song. Send light greeting with practice plan offer.]')
    coachStore.addVisitedSong(id ?? '')
  } else {
    sendHiddenMessage('[Coach init: revisit. Reference progress and offer to continue.]')
    coachStore.addVisitedSong(id ?? '')
  }

  setShowCoachBar(visitTier !== 'first')
}, [chart, sections.length])
```

- [ ] **Step 3: Watch for coaching tips from agent messages**

Subscribe to agent messages via Zustand's hook (not `getState()`) so React re-renders on changes. Add a derived value that watches for the latest coaching tip:

```typescript
const messages = useAgentStore((s) => s.messages)

useEffect(() => {
  const lastCoachTip = [...messages]
    .reverse()
    .find((m) => m.subtype === 'coachingTip')
  if (lastCoachTip) {
    setLatestCoachTip(lastCoachTip.content)
  }
}, [messages])
```

Note: `messages` is subscribed via the Zustand hook so the effect re-fires when the array changes.

- [ ] **Step 4: Apply highlight pulse via data-coach-target**

Add a `useEffect` that applies/removes the `coach-pulse` class:

```typescript
useEffect(() => {
  if (!coachHighlightTarget) return

  const el = document.querySelector(
    `[data-coach-target="${coachHighlightTarget}"]`,
  )
  if (!el) return

  el.classList.add('coach-pulse')
  const handleEnd = () => el.classList.remove('coach-pulse')
  el.addEventListener('animationend', handleEnd, { once: true })

  return () => {
    el.classList.remove('coach-pulse')
    el.removeEventListener('animationend', handleEnd)
  }
}, [coachHighlightTarget])
```

- [ ] **Step 5: Wire up section tracker**

Call the hook:

```typescript
useCoachSectionTracker(sendHiddenMessage)
```

- [ ] **Step 6: Render CoachBar in the layout**

In the JSX, add CoachBar between the header and score content area (after the header `<div>` and before the score `<div>` inside the root `flex flex-col`):

```tsx
{showCoachBar && (
  <CoachBar tip={latestCoachTip} />
)}
```

No wrapper div needed — CoachBar handles its own mobile tap behavior internally (see Task 11).

- [ ] **Step 7: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/spaces/learn/SongsPage.tsx
git commit -m "feat: integrate coaching onboarding into SongsPage"
```

---

### Task 14: Update QuickActions for Coaching

**Files:**
- Modify: `client/src/components/agent/QuickActions.tsx`

- [ ] **Step 1: Add coaching style change to learn space actions**

In `client/src/components/agent/QuickActions.tsx`, add a "Change coaching style" action to the `learn` space actions array:

```typescript
{ label: 'Coaching style', prompt: 'I want to change my coaching style' },
```

Add it after the existing learn actions.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/agent/QuickActions.tsx
git commit -m "feat: add coaching style quick action for learn space"
```

---

### Task 15: Final Integration Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS across all workspaces

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS (fix any lint issues if they arise)

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Run: `pnpm dev`

1. Navigate to a pre-defined song (e.g., `/play/autumn-leaves`)
2. Verify: Agent panel auto-opens with a greeting message
3. Verify: UI elements pulse when highlighted
4. Verify: Chip buttons appear and are clickable
5. Verify: CoachBar appears after onboarding completes
6. Navigate to the same song again — verify Tier 3 (revisit) greeting
7. Navigate to a different song — verify Tier 2 (new song) greeting

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix: address lint and integration issues from smoke test"
```
