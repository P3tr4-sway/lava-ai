# Practice Calendar & Reminder System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-agent-driven practice plan system with a Notion-style preview dialog, a Home page upcoming-practice widget, and a full weekly calendar page.

**Architecture:** Agent-first approach — a new `create_practice_plan` tool lets the LLM generate structured session data as a JSON string. The server handler validates with Zod, assigns IDs, and returns an action envelope. The client opens a preview dialog, and on user confirmation stores the plan in a Zustand store that feeds both the Home widget and the Calendar page.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, Fastify, Zod, lucide-react, nanoid

**Spec:** `docs/superpowers/specs/2026-03-26-practice-calendar-design.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `client/src/stores/calendarStore.ts` | Zustand store — plans, sessions, active preview, all mutations |
| `client/src/components/calendar/index.ts` | Barrel exports for all calendar components |
| `client/src/components/calendar/PracticePlanDialog.tsx` | Notion-style modal to preview a generated plan |
| `client/src/components/calendar/SessionCard.tsx` | Expandable session with subtask list/checkboxes |
| `client/src/components/calendar/UpcomingPractice.tsx` | Home page widget — agenda list of next sessions |
| `client/src/components/calendar/WeekView.tsx` | Week navigation header (arrows, week label) |
| `client/src/components/calendar/DayRow.tsx` | Single day row with session cards |
| `client/src/spaces/calendar/CalendarPage.tsx` | Full `/calendar` route page |
| `server/src/agent/tools/definitions/calendar.tool.ts` | `create_practice_plan` tool definition |

### Modified files

| File | Change |
|---|---|
| `server/src/agent/tools/definitions/index.ts` | Add `createPracticePlanTool` to `ALL_TOOLS` |
| `server/src/agent/tools/index.ts` | Add `create_practice_plan` handler in `getHandler()` |
| `server/src/agent/prompts/system.ts` | Add practice plan capability to system prompt |
| `client/src/hooks/useAgent.ts` | Handle `action === 'practice_plan'` tool result |
| `client/src/components/layout/navItems.ts` | Add Calendar nav item |
| `client/src/router.tsx` | Add `/calendar` route |
| `client/src/components/layout/AppShell.tsx` | Mount `PracticePlanDialog` |
| `client/src/spaces/home/HomePage.tsx` | Render `UpcomingPractice` widget |

---

## Task 1: Calendar Store

**Files:**
- Create: `client/src/stores/calendarStore.ts`

- [ ] **Step 1: Create the calendarStore with types and all actions**

```typescript
// client/src/stores/calendarStore.ts
import { create } from 'zustand'

export interface PracticeSubTask {
  id: string
  title: string
  durationMinutes: number
  completed: boolean
}

export interface PracticeSession {
  id: string
  planId: string
  date: string // "2026-03-27" ISO date
  timeOfDay?: 'morning' | 'afternoon' | 'evening'
  title: string
  totalMinutes: number
  subtasks: PracticeSubTask[]
  completed: boolean
}

export interface PracticePlan {
  id: string
  songTitle: string
  songId?: string
  createdAt: number
  sessions: PracticeSession[]
  goalDescription: string
}

interface CalendarStore {
  plans: PracticePlan[]
  activePlanPreview: PracticePlan | null

  setActivePlanPreview: (plan: PracticePlan) => void
  clearActivePlanPreview: () => void
  addPlan: (plan: PracticePlan) => void
  removePlan: (planId: string) => void
  toggleSessionComplete: (planId: string, sessionId: string) => void
  toggleSubTaskComplete: (planId: string, sessionId: string, subtaskId: string) => void
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  plans: [],
  activePlanPreview: null,

  setActivePlanPreview: (plan) => set({ activePlanPreview: plan }),

  clearActivePlanPreview: () => set({ activePlanPreview: null }),

  addPlan: (plan) => {
    // Dedup by plan.id — replace if exists
    const existing = get().plans.filter((p) => p.id !== plan.id)
    set({ plans: [plan, ...existing], activePlanPreview: null })
  },

  removePlan: (planId) =>
    set((state) => ({ plans: state.plans.filter((p) => p.id !== planId) })),

  toggleSessionComplete: (planId, sessionId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              sessions: p.sessions.map((s) =>
                s.id !== sessionId ? s : { ...s, completed: !s.completed },
              ),
            },
      ),
    })),

  toggleSubTaskComplete: (planId, sessionId, subtaskId) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p
        return {
          ...p,
          sessions: p.sessions.map((s) => {
            if (s.id !== sessionId) return s
            const updatedSubtasks = s.subtasks.map((st) =>
              st.id !== subtaskId ? st : { ...st, completed: !st.completed },
            )
            // Auto-derive session completion
            const allDone = updatedSubtasks.every((st) => st.completed)
            return { ...s, subtasks: updatedSubtasks, completed: allDone }
          }),
        }
      }),
    })),
}))
```

- [ ] **Step 2: Verify the store compiles**

Run: `cd client && npx tsc --noEmit src/stores/calendarStore.ts`
If tsc has issues with isolated file check, just run `pnpm typecheck` from root.

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/calendarStore.ts
git commit -m "feat: add calendarStore for practice plans and sessions"
```

---

## Task 2: Server Tool Definition + Handler

**Files:**
- Create: `server/src/agent/tools/definitions/calendar.tool.ts`
- Modify: `server/src/agent/tools/definitions/index.ts`
- Modify: `server/src/agent/tools/index.ts`

- [ ] **Step 1: Create the tool definition**

```typescript
// server/src/agent/tools/definitions/calendar.tool.ts
import type { ToolDefinition } from '@lava/shared'

export const createPracticePlanTool: ToolDefinition = {
  name: 'create_practice_plan',
  description:
    'Creates a structured practice plan for learning a song. Generate a sessionsJson parameter containing an array of daily practice sessions, each with subtasks and time estimates. Adapt the detail level to the song complexity.',
  parameters: [
    {
      name: 'songTitle',
      type: 'string',
      description: 'The song title to practice',
      required: true,
    },
    {
      name: 'songId',
      type: 'string',
      description: 'The song/project ID if the user is viewing a known song',
      required: false,
    },
    {
      name: 'goalDescription',
      type: 'string',
      description: 'A one-line goal, e.g. "Learn to play Autumn Leaves in 7 days"',
      required: true,
    },
    {
      name: 'durationDays',
      type: 'number',
      description: 'Number of days the plan spans (1-30, default 7)',
      required: false,
      default: 7,
    },
    {
      name: 'minutesPerDay',
      type: 'number',
      description: 'Approximate minutes per session (10-120, default 30)',
      required: false,
      default: 30,
    },
    {
      name: 'skillLevel',
      type: 'string',
      description: 'Player skill level',
      required: false,
      enum: ['beginner', 'intermediate', 'advanced'],
    },
    {
      name: 'focusAreas',
      type: 'string',
      description: 'Comma-separated focus areas, e.g. "chords,rhythm,melody"',
      required: false,
    },
    {
      name: 'sessionsJson',
      type: 'string',
      description:
        'JSON string: array of objects with { title: string, totalMinutes: number, timeOfDay?: "morning"|"afternoon"|"evening", subtasks: [{ title: string, durationMinutes: number }] }. One object per day.',
      required: true,
    },
  ],
}
```

- [ ] **Step 2: Register the tool in definitions/index.ts**

In `server/src/agent/tools/definitions/index.ts`, add the import and entry:

```typescript
// Add import at top:
import { createPracticePlanTool } from './calendar.tool.js'

// Add to ALL_TOOLS array:
createPracticePlanTool,
```

- [ ] **Step 3: Add the handler in tools/index.ts**

In `server/src/agent/tools/index.ts`, add inside the `handlers` object in `getHandler()`. Also add the `nanoid` import at the top (or use `v4 as uuidv4` which is already imported):

```typescript
create_practice_plan: async (input) => {
  const songTitle = String(input.songTitle)
  const goalDescription = String(input.goalDescription ?? `Practice ${songTitle}`)
  // Note: durationDays, minutesPerDay, skillLevel, focusAreas are LLM-guidance
  // parameters — they inform how the LLM generates sessionsJson but are not
  // consumed by this handler directly.
  const planId = uuidv4()
  const now = Date.now()

  // Parse and validate sessionsJson
  let rawSessions: Array<{
    title: string
    totalMinutes: number
    timeOfDay?: string
    subtasks: Array<{ title: string; durationMinutes: number }>
  }>
  try {
    rawSessions = JSON.parse(String(input.sessionsJson))
    if (!Array.isArray(rawSessions)) throw new Error('sessionsJson must be an array')
  } catch {
    return { error: 'Invalid sessionsJson — must be a JSON array of session objects' }
  }

  // Build sessions with IDs and dates starting from today
  // Use local date formatting to avoid UTC timezone mismatch
  const today = new Date()
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const sessions = rawSessions.map((raw, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dateStr = toDateStr(date)

    return {
      id: uuidv4(),
      planId,
      date: dateStr,
      timeOfDay: raw.timeOfDay,
      title: raw.title,
      totalMinutes: raw.totalMinutes,
      completed: false,
      subtasks: (raw.subtasks ?? []).map((st) => ({
        id: uuidv4(),
        title: st.title,
        durationMinutes: st.durationMinutes,
        completed: false,
      })),
    }
  })

  return {
    action: 'practice_plan',
    plan: {
      id: planId,
      songTitle,
      songId: input.songId ? String(input.songId) : undefined,
      createdAt: now,
      goalDescription,
      sessions,
    },
  }
},
```

- [ ] **Step 4: Verify server compiles**

Run: `cd server && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add server/src/agent/tools/definitions/calendar.tool.ts server/src/agent/tools/definitions/index.ts server/src/agent/tools/index.ts
git commit -m "feat: add create_practice_plan tool definition and handler"
```

---

## Task 3: System Prompt Update

**Files:**
- Modify: `server/src/agent/prompts/system.ts`

- [ ] **Step 1: Add practice plan capability to system prompt**

In `server/src/agent/prompts/system.ts`, add to the capabilities list and add a new section:

After the line `- Access standalone tools`, add:
```
- Create structured practice plans for songs with daily sessions and subtask breakdowns
```

After the `## Guidelines` section, add:

```
## Practice Plans
When users ask about practicing a song, learning a song, creating a schedule, or "how to learn X":
- Call create_practice_plan with appropriate parameters
- Adapt durationDays and minutesPerDay to the request (default: 7 days, 30 min/day)
- Generate sessionsJson with detailed subtasks including warm-up, focused practice, and review
- Adjust detail and difficulty based on skillLevel if mentioned
- Always include the goalDescription summarizing what the plan achieves
```

- [ ] **Step 2: Commit**

```bash
git add server/src/agent/prompts/system.ts
git commit -m "feat: add practice plan instructions to agent system prompt"
```

---

## Task 4: Client Tool Result Handler

**Files:**
- Modify: `client/src/hooks/useAgent.ts`

- [ ] **Step 1: Update handleToolResult to handle practice_plan action**

In `client/src/hooks/useAgent.ts`, add the import and the new action branch:

Add import at top:
```typescript
import { useCalendarStore } from '@/stores/calendarStore'
```

Update `handleToolResult` to add a new case after the `navigate` check:

```typescript
const handleToolResult = (resultContent: string) => {
  try {
    const result = JSON.parse(resultContent)
    if (result.action === 'navigate' && result.space) {
      const route = SPACE_ROUTES[result.space as keyof typeof SPACE_ROUTES]
      if (route) navigate(route)
    }
    if (result.action === 'practice_plan' && result.plan) {
      useCalendarStore.getState().setActivePlanPreview(result.plan)
    }
  } catch {
    // not a JSON result, ignore
  }
}
```

- [ ] **Step 2: Verify client compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useAgent.ts
git commit -m "feat: handle practice_plan tool result in useAgent"
```

---

## Task 5: SessionCard Component

**Files:**
- Create: `client/src/components/calendar/SessionCard.tsx`

- [ ] **Step 1: Create the SessionCard component**

```typescript
// client/src/components/calendar/SessionCard.tsx
import { useState } from 'react'
import { ChevronRight, Circle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import type { PracticeSession } from '@/stores/calendarStore'

interface SessionCardProps {
  session: PracticeSession
  defaultExpanded?: boolean
  interactive?: boolean // subtask checkboxes clickable
  onToggleSubTask?: (subtaskId: string) => void
  className?: string
}

export function SessionCard({
  session,
  defaultExpanded = false,
  interactive = false,
  onToggleSubTask,
  className,
}: SessionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={cn('rounded-lg', className)}>
      {/* Session header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {session.completed ? (
            <CheckCircle2 size={14} className="text-success shrink-0" />
          ) : (
            <Circle size={14} className="text-text-muted shrink-0" />
          )}
          <span
            className={cn(
              'text-base font-medium truncate',
              session.completed ? 'text-text-muted line-through' : 'text-text-primary',
            )}
          >
            {session.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-secondary">{session.totalMinutes} min</span>
          <ChevronRight
            size={14}
            className={cn(
              'text-text-muted transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </div>
      </button>

      {/* Subtasks */}
      {expanded && session.subtasks.length > 0 && (
        <div className="mt-2 ml-5 flex flex-col gap-1.5">
          {session.subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2">
              {interactive ? (
                <button
                  onClick={() => onToggleSubTask?.(st.id)}
                  className="shrink-0"
                >
                  {st.completed ? (
                    <CheckCircle2 size={12} className="text-success" />
                  ) : (
                    <Circle size={12} className="text-text-muted hover:text-text-secondary transition-colors" />
                  )}
                </button>
              ) : (
                <Circle size={12} className="text-text-muted shrink-0" />
              )}
              <span
                className={cn(
                  'text-sm',
                  st.completed ? 'text-text-muted line-through' : 'text-text-secondary',
                )}
              >
                {st.title}
              </span>
              <span className="text-xs text-text-muted">{st.durationMinutes} min</span>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed subtask count */}
      {!expanded && session.subtasks.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 ml-5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {session.subtasks.length} subtasks
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/calendar/SessionCard.tsx
git commit -m "feat: add SessionCard component with expandable subtasks"
```

---

## Task 6: PracticePlanDialog Component

**Files:**
- Create: `client/src/components/calendar/PracticePlanDialog.tsx`

- [ ] **Step 1: Create the PracticePlanDialog component**

```typescript
// client/src/components/calendar/PracticePlanDialog.tsx
import { Music, X } from 'lucide-react'
import { Dialog } from '@/components/ui'
import { Button } from '@/components/ui'
import { SessionCard } from './SessionCard'
import { useCalendarStore } from '@/stores/calendarStore'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PracticePlanDialog() {
  const plan = useCalendarStore((s) => s.activePlanPreview)
  const clearPreview = useCalendarStore((s) => s.clearActivePlanPreview)
  const addPlan = useCalendarStore((s) => s.addPlan)

  if (!plan) return null

  const avgMinutes = plan.sessions.length
    ? Math.round(plan.sessions.reduce((sum, s) => sum + s.totalMinutes, 0) / plan.sessions.length)
    : 0

  const handleAdd = () => {
    addPlan(plan)
    // clearActivePlanPreview is called inside addPlan
  }

  return (
    <Dialog open={!!plan} onClose={clearPreview} className="max-w-lg max-h-[70vh] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Music size={18} className="text-text-secondary shrink-0" />
          <h2 className="text-xl font-semibold text-text-primary">{plan.songTitle}</h2>
        </div>
        <button onClick={clearPreview} className="text-text-muted hover:text-text-secondary transition-colors shrink-0">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-text-secondary mb-1">{plan.goalDescription}</p>
      <p className="text-xs text-text-muted mb-4">
        {plan.sessions.length} sessions · ~{avgMinutes} min each
      </p>

      <div className="border-t border-border my-2" />

      {/* Session list — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2 flex flex-col gap-4">
        {plan.sessions.map((session, i) => (
          <div key={session.id}>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
              {formatDate(session.date)}
            </p>
            <SessionCard
              session={session}
              defaultExpanded={i < 2}
              interactive={false}
            />
          </div>
        ))}
      </div>

      <div className="border-t border-border my-2" />

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={clearPreview}>
          Close
        </Button>
        <Button size="sm" onClick={handleAdd}>
          Add to Calendar
        </Button>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/calendar/PracticePlanDialog.tsx
git commit -m "feat: add PracticePlanDialog with Notion-style plan preview"
```

---

## Task 7: Mount PracticePlanDialog in AppShell

**Files:**
- Modify: `client/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add PracticePlanDialog to AppShell**

In `client/src/components/layout/AppShell.tsx`:

Add import:
```typescript
import { PracticePlanDialog } from '@/components/calendar/PracticePlanDialog'
```

Add `<PracticePlanDialog />` right after `<TaskNotifications />` in both the mobile and desktop branches. It renders based on its own store state (`activePlanPreview !== null`).

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/layout/AppShell.tsx
git commit -m "feat: mount PracticePlanDialog in AppShell"
```

---

## Task 8: UpcomingPractice Home Widget

**Files:**
- Create: `client/src/components/calendar/UpcomingPractice.tsx`

- [ ] **Step 1: Create the UpcomingPractice component**

```typescript
// client/src/components/calendar/UpcomingPractice.tsx
import { useNavigate } from 'react-router-dom'
import { Circle, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useCalendarStore } from '@/stores/calendarStore'
import type { PracticeSession, PracticePlan } from '@/stores/calendarStore'

function formatDayLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(dateStr: string): boolean {
  return dateStr === todayStr()
}

interface UpcomingSession {
  session: PracticeSession
  plan: PracticePlan
}

export function UpcomingPractice() {
  const navigate = useNavigate()
  const plans = useCalendarStore((s) => s.plans)
  const setActivePlanPreview = useCalendarStore((s) => s.setActivePlanPreview)

  // Collect upcoming incomplete sessions across all plans
  const today = todayStr()
  const upcoming: UpcomingSession[] = []

  for (const plan of plans) {
    for (const session of plan.sessions) {
      if (!session.completed && session.date >= today) {
        upcoming.push({ session, plan })
      }
    }
  }

  // Sort by date, then timeOfDay priority
  const timeOrder = { morning: 0, afternoon: 1, evening: 2 }
  upcoming.sort((a, b) => {
    const dateCmp = a.session.date.localeCompare(b.session.date)
    if (dateCmp !== 0) return dateCmp
    const aTime = timeOrder[a.session.timeOfDay as keyof typeof timeOrder] ?? 1
    const bTime = timeOrder[b.session.timeOfDay as keyof typeof timeOrder] ?? 1
    return aTime - bTime
  })

  const visible = upcoming.slice(0, 5)

  if (visible.length === 0) return null

  // Group by date for day labels
  let lastDate = ''

  return (
    <section>
      <p className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
        Upcoming Practice
      </p>
      <div className="border-t border-border pt-3 flex flex-col gap-1">
        {visible.map(({ session, plan }) => {
          const showDayLabel = session.date !== lastDate
          lastDate = session.date

          return (
            <div key={session.id}>
              {showDayLabel && (
                <p className="text-xs text-text-muted mt-2 first:mt-0 mb-1">
                  {formatDayLabel(session.date)}
                </p>
              )}
              <button
                onClick={() => setActivePlanPreview(plan)}
                className="w-full flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-surface-1 transition-colors text-left group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Circle
                    size={8}
                    className={cn(
                      'shrink-0',
                      isToday(session.date) ? 'text-text-primary fill-current' : 'text-text-muted',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{session.title}</p>
                    <p className="text-xs text-text-muted truncate">{plan.songTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-text-secondary">{session.totalMinutes} min</span>
                  <ChevronRight size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => navigate('/calendar')}
        className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        View full calendar →
      </button>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/calendar/UpcomingPractice.tsx
git commit -m "feat: add UpcomingPractice home widget"
```

---

## Task 9: Add UpcomingPractice to HomePage

**Files:**
- Modify: `client/src/spaces/home/HomePage.tsx`

- [ ] **Step 1: Import and render UpcomingPractice**

In `client/src/spaces/home/HomePage.tsx`:

Add import:
```typescript
import { UpcomingPractice } from '@/components/calendar/UpcomingPractice'
```

Insert `<UpcomingPractice />` between the hero section and the Quick Start section. Find the closing `</section>` of section 1 (hero) and add right after it:

```tsx
{/* ── 1.5. Upcoming practice (only shown when plans exist) ── */}
<UpcomingPractice />
```

This goes between the `{/* ── 1. Hero — search-first */}` section closing tag and the `{/* ── 2. Quick start */}` section.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add client/src/spaces/home/HomePage.tsx
git commit -m "feat: add UpcomingPractice widget to HomePage"
```

---

## Task 10: WeekView + DayRow Components

**Files:**
- Create: `client/src/components/calendar/WeekView.tsx`
- Create: `client/src/components/calendar/DayRow.tsx`

- [ ] **Step 1: Create WeekView (week navigation header)**

```typescript
// client/src/components/calendar/WeekView.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'

interface WeekViewProps {
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
}

function formatWeekRange(start: Date): string {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

function isCurrentWeek(start: Date): boolean {
  const now = new Date()
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return now >= start && now <= end
}

export function WeekView({ weekStart, onPrevWeek, onNextWeek }: WeekViewProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold text-text-primary">Calendar</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={onPrevWeek}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNextWeek}>
          <ChevronRight size={16} />
        </Button>
        <div className="text-sm text-text-secondary ml-1">
          {isCurrentWeek(weekStart) && <span className="mr-1.5">This Week</span>}
          <span>{formatWeekRange(weekStart)}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DayRow component**

```typescript
// client/src/components/calendar/DayRow.tsx
import { cn } from '@/components/ui/utils'
import { SessionCard } from './SessionCard'
import { Trash2 } from 'lucide-react'
import type { PracticeSession, PracticePlan } from '@/stores/calendarStore'
import { useCalendarStore } from '@/stores/calendarStore'

interface SessionWithPlan {
  session: PracticeSession
  plan: PracticePlan
}

interface DayRowProps {
  date: Date
  sessions: SessionWithPlan[]
  isToday: boolean
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() + ' ' + date.getDate()
}

export function DayRow({ date, sessions, isToday }: DayRowProps) {
  const toggleSubTaskComplete = useCalendarStore((s) => s.toggleSubTaskComplete)
  const setActivePlanPreview = useCalendarStore((s) => s.setActivePlanPreview)
  const removePlan = useCalendarStore((s) => s.removePlan)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPast = date < today

  return (
    <div className={cn('py-2', isToday && 'bg-surface-1 -mx-6 px-6 rounded-lg')}>
      <p className={cn(
        'text-xs font-medium uppercase tracking-wide mb-2',
        isToday ? 'text-text-primary' : 'text-text-muted',
        isPast && !isToday && 'text-warning',
      )}>
        {formatDayLabel(date)}
        {isToday && <span className="ml-1.5 normal-case">· Today</span>}
      </p>

      {sessions.length === 0 ? (
        <div className="h-1" />
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(({ session, plan }) => (
            <div
              key={session.id}
              className="bg-surface-2 border border-border rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <button
                  onClick={() => setActivePlanPreview(plan)}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors truncate"
                >
                  {plan.songTitle}
                </button>
                <button
                  onClick={() => removePlan(plan.id)}
                  className="text-text-muted hover:text-error transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Remove plan"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <SessionCard
                session={session}
                defaultExpanded={isToday}
                interactive={true}
                onToggleSubTask={(subtaskId) =>
                  toggleSubTaskComplete(plan.id, session.id, subtaskId)
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/calendar/WeekView.tsx client/src/components/calendar/DayRow.tsx
git commit -m "feat: add WeekView and DayRow calendar components"
```

---

## Task 11: CalendarPage

**Files:**
- Create: `client/src/spaces/calendar/CalendarPage.tsx`

- [ ] **Step 1: Create the CalendarPage**

```typescript
// client/src/spaces/calendar/CalendarPage.tsx
import { useState } from 'react'
import { WeekView } from '@/components/calendar/WeekView'
import { DayRow } from '@/components/calendar/DayRow'
import { useCalendarStore } from '@/stores/calendarStore'

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

export function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const plans = useCalendarStore((s) => s.plans)

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Build 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return date
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toDateStr(today)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-12">
        <WeekView weekStart={weekStart} onPrevWeek={prevWeek} onNextWeek={nextWeek} />

        <div className="flex flex-col gap-1">
          {days.map((date) => {
            const dateStr = toDateStr(date)
            const isToday = dateStr === todayStr

            // Collect sessions for this day across all plans
            const sessionsForDay = plans.flatMap((plan) =>
              plan.sessions
                .filter((s) => s.date === dateStr)
                .map((session) => ({ session, plan })),
            )

            // Sort by timeOfDay
            const timeOrder = { morning: 0, afternoon: 1, evening: 2 }
            sessionsForDay.sort((a, b) => {
              const aT = timeOrder[a.session.timeOfDay as keyof typeof timeOrder] ?? 1
              const bT = timeOrder[b.session.timeOfDay as keyof typeof timeOrder] ?? 1
              return aT - bT
            })

            return (
              <DayRow
                key={dateStr}
                date={date}
                sessions={sessionsForDay}
                isToday={isToday}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/spaces/calendar/CalendarPage.tsx
git commit -m "feat: add CalendarPage with weekly timeline view"
```

---

## Task 12: Barrel Exports

**Files:**
- Create: `client/src/components/calendar/index.ts`

- [ ] **Step 1: Create barrel file**

```typescript
// client/src/components/calendar/index.ts
export { PracticePlanDialog } from './PracticePlanDialog'
export { SessionCard } from './SessionCard'
export { UpcomingPractice } from './UpcomingPractice'
export { WeekView } from './WeekView'
export { DayRow } from './DayRow'
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/calendar/index.ts
git commit -m "feat: add barrel exports for calendar components"
```

---

## Task 13: Navigation + Routing

**Files:**
- Modify: `client/src/components/layout/navItems.ts`
- Modify: `client/src/router.tsx`

- [ ] **Step 1: Add Calendar to navItems**

In `client/src/components/layout/navItems.ts`:

Add `CalendarDays` to the lucide import:
```typescript
import { Home, FolderOpen, Music, FilePlus2, Settings, Search, CalendarDays } from 'lucide-react'
```

Insert the Calendar item after the Play item in `NAV_ITEMS`:
```typescript
export const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/jam', icon: Music, label: 'Play' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/projects', icon: FolderOpen, label: 'My Library' },
]
```

- [ ] **Step 2: Add /calendar route**

In `client/src/router.tsx`:

Add import:
```typescript
import { CalendarPage } from '@/spaces/calendar/CalendarPage'
```

Add route inside the AppShell children, after the `projects` route:
```typescript
{ path: 'calendar', element: <CalendarPage /> },
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/layout/navItems.ts client/src/router.tsx
git commit -m "feat: add Calendar nav item and /calendar route"
```

---

## Task 14: Full Integration Smoke Test

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

Verify both client (port 5173) and server (port 3001) start without errors.

- [ ] **Step 2: Verify Calendar page loads**

Navigate to `http://localhost:5173/calendar`. Verify:
- Page renders with "Calendar" heading and week navigation arrows
- Week shows 7 day rows with current week dates
- Today's row has `bg-surface-1` highlight
- No console errors

- [ ] **Step 3: Verify sidebar navigation**

Check that "Calendar" appears in the sidebar between "Play" and "My Library" with the CalendarDays icon.

- [ ] **Step 4: Test agent flow**

Open the agent panel and type: "Give me a practice plan for Autumn Leaves"

Verify:
- Agent calls `create_practice_plan` tool
- PracticePlanDialog opens with the generated plan
- First 2 sessions are expanded, rest collapsed
- Clicking "Add to Calendar" closes the dialog
- HomePage shows UpcomingPractice widget with the sessions
- CalendarPage shows the sessions on the correct days

- [ ] **Step 5: Test subtask interaction on CalendarPage**

On the CalendarPage:
- Click to expand today's session
- Click subtask circles — they should toggle to checkmarks
- Complete all subtasks — session should show strikethrough

- [ ] **Step 6: Final commit if any fixes needed**

If any bugs were found and fixed during smoke testing, commit the fixes.
