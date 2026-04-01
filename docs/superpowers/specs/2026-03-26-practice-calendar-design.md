# Practice Calendar & Reminder System — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Approach:** Agent-First (Approach A)

---

## Overview

A client-side mock calendar and reminder system for LavaAI. The AI agent generates structured practice plans via a tool call, presents them in a Notion-style minimal dialog, and persists them in-memory. A Home widget shows upcoming sessions; a full `/calendar` page provides a weekly timeline with interactive subtask tracking.

No server persistence, no push notifications. All state lives in a Zustand store and resets on page refresh.

---

## Design Decisions

| Question | Choice |
|---|---|
| Persistence | Client-side only (Zustand, in-memory) |
| Plan popup | Standalone Dialog/Modal, Notion-like minimalism |
| Calendar location | Home widget (agenda list) + full `/calendar` page (weekly timeline) |
| Home widget format | Minimal agenda list — chronological sessions grouped by day |
| Full calendar format | Weekly timeline — vertical list of days with session cards |
| Plan structure | Detailed sessions with sub-tasks and durations; agent decides detail level adaptively |

---

## Data Model

All state in `calendarStore.ts` (Zustand).

```typescript
interface PracticeSubTask {
  id: string
  title: string
  durationMinutes: number
  completed: boolean
}

interface PracticeSession {
  id: string
  planId: string
  date: string              // "2026-03-27" ISO date
  timeOfDay?: 'morning' | 'afternoon' | 'evening'
  title: string             // "Day 1: Intro & Verse"
  totalMinutes: number
  subtasks: PracticeSubTask[]
  completed: boolean
}

interface PracticePlan {
  id: string
  songTitle: string
  songId?: string
  createdAt: number
  sessions: PracticeSession[]
  goalDescription: string   // "Learn to play Autumn Leaves in 7 days"
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
```

---

## Agent Tool — `create_practice_plan`

### Server-side

New tool definition in `server/src/agent/tools/definitions/calendar.tool.ts`.

The existing `ToolParameter` type only supports flat primitives. To avoid extending the shared schema system, the LLM generates the full session structure as a JSON string, which the handler parses and validates with Zod.

```
Tool name: create_practice_plan
Description: Creates a structured practice plan for a song.
             Generates sessions across multiple days with subtasks and time estimates.

Input schema (flat parameters only — compatible with existing ToolParameter):
  songTitle: string (required)
  songId?: string
  durationDays: number (default 7, range 1-30)
  minutesPerDay: number (default 30, range 10-120)
  skillLevel?: "beginner" | "intermediate" | "advanced"
  focusAreas?: string (comma-separated, e.g. "chords,rhythm,melody")
  sessionsJson: string (JSON string of session array — see schema below)

sessionsJson schema (validated by Zod in handler):
  Array of {
    title: string,
    totalMinutes: number,
    subtasks: Array of { title: string, durationMinutes: number }
  }

Handler return format (action envelope for client routing):
  { action: 'practice_plan', plan: PracticePlan }
```

The handler parses `sessionsJson` with Zod, assigns IDs (nanoid), computes absolute dates starting from today, sets `completed: false` on all sessions/subtasks, and wraps the result in the action envelope.

### Client-side

In `useAgent.ts` tool result handler (alongside existing `action === 'navigate'` check):

```typescript
if (action === 'practice_plan') {
  calendarStore.getState().setActivePlanPreview(result.plan)
}
```

### System prompt addition

When users ask about practice plans, schedules, or "how to learn/practice X," call `create_practice_plan`. Decide `durationDays`, `minutesPerDay`, and subtask detail level adaptively based on song complexity and user request.

---

## UI Components

### Practice Plan Dialog (`PracticePlanDialog.tsx`)

Notion-style minimal modal for previewing a generated plan.

**Visual structure:**

```
┌─────────────────────────────────────────────┐
│                                         ✕   │
│  [Music icon] Autumn Leaves                 │
│  Learn to play Autumn Leaves in 7 days      │
│  7 sessions · ~30 min each                  │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Thu, Mar 27                                │
│  Day 1: Intro & Verse · 30 min             │
│    ○ Warm up · 5 min                        │
│    ○ Learn intro chords · 15 min            │
│    ○ Slow practice · 10 min                 │
│                                             │
│  Fri, Mar 28                                │
│  Day 2: Verse & Chorus · 30 min            │
│    ○ Review Day 1 · 5 min                   │
│    ○ Learn chorus progression · 15 min      │
│    ○ Connect sections · 10 min              │
│                                             │
│  Sat, Mar 29                                │
│  Day 3: Bridge & Transitions · 30 min      │
│    ▸ 3 subtasks                             │
│                                             │
│  ... (remaining days collapsed)             │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  [ Add to Calendar ]              [ Close ] │
│                                             │
└─────────────────────────────────────────────┘
```

**Behavior:**
- First 2 sessions expanded, rest collapsed (click to expand)
- Subtask circles are not interactive in preview mode
- "Add to Calendar" = primary (`bg-accent`), "Close" = ghost
- Uses existing `Dialog` from `@/components/ui` (pass `className="max-w-lg"` to override default `max-w-md`)
- `animate-fade-in`, backdrop `bg-black/50`
- Escape / backdrop click calls `clearActivePlanPreview()`
- Max width: `max-w-lg`, max height: `max-h-[70vh]` with scroll on session list

**Typography:**
- Song title: `text-xl font-semibold text-text-primary`
- Goal: `text-sm text-text-secondary`
- Session summary: `text-xs text-text-muted`
- Day headings: `text-xs font-medium text-text-muted uppercase tracking-wide`
- Session titles: `text-base font-medium text-text-primary`
- Subtasks: `text-sm text-text-secondary`

---

### Home Widget — Upcoming Practice (`UpcomingPractice.tsx`)

Compact agenda list on HomePage, below hero search, before quick-start cards.

**Visual structure:**

```
  Upcoming Practice
  ─────────────────────────────────────────

  Today · Thu, Mar 27
  ● Day 1: Intro & Verse         30 min →
    Autumn Leaves

  Tomorrow · Fri, Mar 28
  ○ Day 2: Verse & Chorus        30 min →
    Autumn Leaves

  Sat, Mar 29
  ○ Day 3: Bridge & Transitions  30 min →
    Autumn Leaves

                          View full calendar →
```

**Behavior:**
- Shows next 3-5 upcoming sessions across all plans
- `●` filled = today, `○` = future; completed sessions hidden
- Clicking a row opens plan dialog scrolled to that session
- "View full calendar →" navigates to `/calendar`
- Hidden entirely when no upcoming sessions exist
- Song title as secondary text under session title

**Typography:**
- Heading: `text-sm font-medium text-text-muted uppercase tracking-wide`
- Day label: `text-xs text-text-muted`
- Session title: `text-sm font-medium text-text-primary`
- Song subtitle: `text-xs text-text-muted`
- Duration: `text-xs text-text-secondary`

**Placement:** Inside HomePage's `max-w-3xl mx-auto` layout.

---

### Full Calendar Page (`CalendarPage.tsx`)

Weekly timeline at `/calendar`.

**Visual structure:**

```
┌─────────────────────────────────────────────────┐
│  Calendar                          ← →  This Week│
│                                    Mar 24 – 30   │
│                                                   │
│  MON 24                                           │
│  (thin empty row)                                 │
│                                                   │
│  THU 27 · Today                                   │
│  ┌──────────────────────────────────────────┐     │
│  │ ● Day 1: Intro & Verse          30 min  │     │
│  │   Autumn Leaves                          │     │
│  │   ○ Warm up · 5 min                     │     │
│  │   ○ Learn intro chords · 15 min         │     │
│  │   ○ Slow practice · 10 min              │     │
│  └──────────────────────────────────────────┘     │
│                                                   │
│  FRI 28                                           │
│  ┌──────────────────────────────────────────┐     │
│  │ ○ Day 2: Verse & Chorus          30 min │     │
│  │   Autumn Leaves                          │     │
│  │   ▸ 3 subtasks                           │     │
│  └──────────────────────────────────────────┘     │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- `← →` arrows navigate weeks
- Today's row has subtle `bg-surface-1` highlight
- Session cards: `bg-surface-2`, `border-border`, `rounded-lg`
- Today's sessions expanded, future collapsed (click to expand)
- Subtask checkboxes are **interactive** — `toggleSubTaskComplete()`
- All subtasks checked → `toggleSubTaskComplete` auto-sets `session.completed = true` in the store (and auto-unsets if a subtask is unchecked)
- Empty days = thin row with day label only
- Clicking session title opens full plan dialog
- Layout: `max-w-3xl mx-auto px-6 pt-8` (uses `pt-8` instead of hub-standard `pt-[22vh]` because this is a data-dense timeline, not a search-first hero)

**Header:**
- Title: `text-2xl font-semibold`
- Week label + arrows: `text-sm text-text-secondary`, ghost icon buttons

**Navigation:** New sidebar item between "Play" and "My Library":
```typescript
// Updated NAV_ITEMS:
{ to: '/', icon: Home, label: 'Home' },
{ to: '/search', icon: Search, label: 'Search' },
{ to: '/jam', icon: Music, label: 'Play' },
{ to: '/calendar', icon: CalendarDays, label: 'Calendar' },  // NEW
{ to: '/projects', icon: FolderOpen, label: 'My Library' },
```

**Mobile bottom nav:** Calendar does not appear in `BottomNav` (limited to 4 items). On mobile, Calendar is accessible via the sidebar overlay and the "View full calendar" link in the Home widget.

---

## File Organization

### New files

```
client/src/stores/calendarStore.ts
client/src/components/calendar/index.ts              (barrel exports)
client/src/components/calendar/UpcomingPractice.tsx
client/src/components/calendar/PracticePlanDialog.tsx
client/src/components/calendar/WeekView.tsx
client/src/components/calendar/DayRow.tsx
client/src/components/calendar/SessionCard.tsx
client/src/spaces/calendar/CalendarPage.tsx
server/src/agent/tools/definitions/calendar.tool.ts
```

### Modified files

| File | Change |
|---|---|
| `client/src/components/layout/navItems.ts` | Add Calendar nav item |
| `client/src/router.tsx` | Add `/calendar` route |
| `client/src/components/layout/AppShell.tsx` | Mount `PracticePlanDialog` |
| `client/src/hooks/useAgent.ts` | Handle `practice_plan` tool result |
| `client/src/spaces/home/HomePage.tsx` | Render `UpcomingPractice` widget |
| `server/src/agent/tools/registry` | Register `create_practice_plan` |
| `server/src/agent/prompts/` | Add practice plan instructions |

### Unchanged

- Existing UI components (Button, Dialog, Card — reused)
- Existing stores (agentStore, taskStore)
- Existing pages (no layout changes beyond HomePage widget)

---

## Data Flow

```
User message
  → Agent (Claude) decides to call create_practice_plan
  → Tool handler validates, assigns IDs, computes dates
  → Returns PracticePlan JSON

Client receives tool result
  → useAgent handler: calendarStore.setActivePlanPreview(plan)
  → PracticePlanDialog opens reactively

User clicks "Add to Calendar"
  → calendarStore.addPlan(plan)
  → clearActivePlanPreview() closes dialog

HomePage UpcomingPractice widget
  → Reads calendarStore.plans, filters upcoming sessions
  → Renders agenda list

CalendarPage
  → Reads calendarStore.plans, groups sessions by day
  → Renders weekly timeline with interactive subtasks
  → toggleSubTaskComplete() / toggleSessionComplete()
```

---

## Edge Cases & Behavioral Notes

### Multiple plans / overlapping days

- Sessions from different plans on the same day are sorted by: `timeOfDay` priority (morning < afternoon < evening), then `createdAt` ascending.
- Each session card already shows the song title as secondary text, which distinguishes plans visually.
- No limit on concurrent active plans.

### Past sessions

- Past incomplete sessions appear with a subtle `text-warning` color on the date label (overdue indicator).
- Users can still toggle past sessions/subtasks as complete retroactively.
- CalendarPage shows all sessions when navigating to past weeks.

### Deduplication

- `addPlan()` deduplicates by `plan.id` — if a plan with the same ID already exists, it is replaced rather than duplicated.

### Session auto-completion

- `toggleSubTaskComplete()` checks if all subtasks in the session are now complete and auto-sets `session.completed = true`. If a subtask is later unchecked, `session.completed` reverts to `false`.

### Remove plan

- CalendarPage header for each plan includes a subtle trash icon (`Trash2`) to remove a plan via `removePlan()`. This is a ghost icon button, only visible on hover.
