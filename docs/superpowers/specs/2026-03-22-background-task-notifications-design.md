# Background Task Notification System — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Scope:** Non-blocking generation UX with macOS-style notification tracking

---

## Problem

When a user triggers song analysis (YouTube → score generation), `SongsPage` renders a full-screen loading spinner. The user cannot leave the page — doing so kills the polling loop and they lose track of the task. There is no way to monitor multiple tasks, no completion notification, and no way to return to results after navigating away.

## Solution

Convert the blocking full-screen wait into a background task system with three layers:

1. **Global task store** — manages task lifecycle independent of any page
2. **Notification UI** — macOS-style stacked cards in the top-right corner
3. **Generation page changes** — "continue in background" affordance + graceful reconnection

---

## 1. Task Management Layer

### New store: `useTaskStore`

**File:** `client/src/stores/taskStore.ts`

```typescript
interface BackgroundTask {
  id: string                    // transcriptionId
  type: 'analysis'             // extensible for future task types
  title: string                // song title / task label
  status: 'active' | 'completed' | 'error'
  stage: AnalysisStatus        // 'downloading' | 'analyzing_chords' | 'analyzing_beats' | 'processing'
  progress: number             // 0-100, derived from stage
  createdAt: number
  completedAt?: number
  result?: AnalysisPollResult  // stored on completion for later consumption
  error?: string
}

interface TaskStore {
  tasks: BackgroundTask[]
  addTask: (id: string, type: string, title: string) => void
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void
  removeTask: (id: string) => void
  getTask: (id: string) => BackgroundTask | undefined
  activeTasks: () => BackgroundTask[]
  completedTasks: () => BackgroundTask[]
}
```

### Polling architecture

- Polling logic moves from `SongsPage` into a global `useTaskPoller` hook
- This hook is mounted once in `AppShell` — it iterates over all `active` tasks and polls each every 2 seconds
- When a task reaches `completed` or `error`, the store updates and polling for that task stops
- The `result` object (score data, audio file reference) is stored in the task so `SongsPage` can consume it without re-fetching

### Progress mapping

Server stages map to approximate progress values:

| Stage | Progress | Display text |
|-------|----------|-------------|
| `downloading` | 10% | Downloading audio... |
| `analyzing_chords` | 35% | Detecting chords... |
| `analyzing_beats` | 65% | Analyzing beats & tempo... |
| `processing` | 85% | Building score... |
| `completed` | 100% | Done |
| `error` | — | Error message |

---

## 2. Notification UI Layer

### Component: `TaskNotifications`

**File:** `client/src/components/ui/TaskNotifications.tsx`

**Mount point:** Inside `AppShell`, outside all page routes — always visible.

### Visual design

- **Position:** Fixed, top-right corner, `top-4 right-4`, `z-50`
- **Style:** macOS notification aesthetic — `bg-surface-1`, `border border-border`, `rounded-lg`, subtle `shadow-lg`
- **Card size (collapsed):** ~280px wide, ~56px tall
- **Card size (expanded):** ~280px wide, ~140px tall

### Card anatomy (collapsed state)

```
┌──────────────────────────────────┐
│  ◎ Song Title            ··· 35% │
│  ░░░░░░░▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░ │
└──────────────────────────────────┘
```

- Left: spinner icon (animated) + truncated task title (max 1 line)
- Right: percentage
- Bottom: thin progress bar using `bg-accent` on `bg-surface-3` track
- No close button while active

### Card anatomy (expanded state — on click)

```
┌──────────────────────────────────┐
│  ◎ Song Title            ··· 35% │
│  ░░░░░░░▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░ │
│                                  │
│  Stage: Detecting chords...      │
│  Elapsed: 0:42                   │
│                                  │
│            [View Page →]         │
└──────────────────────────────────┘
```

- Shows current stage text, elapsed time
- "View Page" button navigates to `/play/:id`
- Click outside or click again to collapse

### Card anatomy (completed state — replaces active card)

```
┌──────────────────────────────────┐
│  ✓ Song Title          Complete  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                  │
│   [View Results]          [✕]    │
└──────────────────────────────────┘
```

- Spinner → check icon, accent color
- "View Results" button → navigates to `/play/:id`
- Close button (✕) to dismiss
- Does NOT auto-dismiss — requires user action

### Error state

```
┌──────────────────────────────────┐
│  ✕ Song Title             Error  │
│                                  │
│  Analysis failed: timeout        │
│   [Retry]                 [✕]    │
└──────────────────────────────────┘
```

- Error icon, `text-error` color
- Shows error message (truncated)
- Retry button → restarts analysis, new task replaces errored one
- Dismissible

### Stacking behavior

- Cards stack vertically, newest on top, `gap-2`
- Maximum 3 visible cards
- If more than 3: bottom area shows "+N more tasks" link — clicking expands to show all (scrollable, max-height capped)
- Enter animation: `translate-x` from right + `opacity` fade, 200ms ease-out
- Expand/collapse: `max-height` + `opacity` transition, 150ms ease-out
- Exit animation: `opacity` fade out, 150ms

---

## 3. Generation Page Changes

### SongsPage loading state modification

**Current:** Full-screen centered spinner, no escape.

**New:** Keep the spinner and status text, but add:

```
┌─────────────────────────────────────────┐
│                                         │
│            ◎ (spinner)                  │
│         Analyzing song...               │
│   Detecting chords, beats & tempo       │
│                                         │
│   ░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░  │
│         Detecting chords... (35%)       │
│                                         │
│      [ ← Continue in Background ]       │
│                                         │
└─────────────────────────────────────────┘
```

- Progress bar + stage text (same data from `useTaskStore`)
- "Continue in Background" button (ghost variant): navigates back (`router.navigate(-1)` or to `/projects`)
- Task notification card appears simultaneously in top-right

### Navigation-away detection

- When `SongsPage` unmounts while a task is `active`, the store keeps polling (already global)
- No special detection needed — the notification UI is always mounted in `AppShell`

### Return-to-page behavior

- `SongsPage` checks `useTaskStore.getTask(id)` on mount
- If `completed` → load result from store directly (no re-fetch needed)
- If `active` → show loading state with progress (connected to store), same as before but now with progress detail
- If no task AND `?generate=1` in URL → check server status first via `pollAnalysis(id)`. If server reports active task, register it in store and resume tracking. If server has no record, trigger fresh analysis. This prevents duplicate analyses after page refresh.

### Duplicate task prevention

Before starting a new analysis, `useTaskStore` checks if an active task already targets the same `transcriptionId`. If found, the existing task is reused instead of creating a duplicate. Deduplication by YouTube video ID is not enforced in MVP — the same song analyzed twice gets two separate tasks.

---

## 4. SearchResultsPage Migration

`SearchResultsPage` has its own independent polling loop inside the generate-score modal. This is the primary initiation point — users click "Generate" in search results, polling starts in the modal, and on completion it navigates to `/play/:id?generate=1`.

### Changes

- When user clicks "Generate": call `useTaskStore.addTask()` instead of local state, then immediately navigate to `/play/:id?generate=1`
- Remove the modal's internal polling loop — the global `useTaskPoller` handles it
- The notification card appears as soon as the task is registered, whether the user is on `SongsPage` or still browsing search results
- If the user stays on `SearchResultsPage`, the notification card tracks progress. Clicking "View Results" on completion navigates to `/play/:id`

This ensures both entry points (search results and direct URL) use the same background task system.

---

## 5. Integration with existing Toast system

The existing `Toast.tsx` component remains for general app toasts (save success, errors, etc.). The `TaskNotifications` component is a separate system specifically for long-running background tasks. They occupy different screen positions (toast = bottom-right, task notifications = top-right) and serve different purposes.

**Action needed:** Wire `ToastProvider` into `AppShell` to activate the existing toast system (currently exported but not mounted).

---

## 6. Accessibility

- `TaskNotifications` container: `role="region"`, `aria-label="Background tasks"`
- Each `TaskCard`: `role="status"`, `aria-live="polite"` for progress updates
- Completion/error state changes announced via `aria-live` — screen readers will read "Song Title — Complete" or "Song Title — Error"
- "View Results", "Retry", and close buttons are focusable with visible focus rings
- Expanded card is keyboard-dismissible via `Escape`
- Stacked cards are tab-navigable in order (newest first)

---

## 7. Files to create / modify

### New files

| File | Purpose |
|------|---------|
| `client/src/stores/taskStore.ts` | Global background task state |
| `client/src/hooks/useTaskPoller.ts` | Global polling hook, mounted in AppShell |
| `client/src/components/ui/TaskNotifications.tsx` | Notification card stack UI |
| `client/src/components/ui/TaskCard.tsx` | Individual notification card (collapsed/expanded/completed/error) |

### Modified files

| File | Change |
|------|--------|
| `client/src/components/layout/AppShell.tsx` | Mount `TaskNotifications` + `useTaskPoller` + `ToastProvider` |
| `client/src/spaces/learn/SongsPage.tsx` | Use `useTaskStore` for polling, add progress bar + "Continue in Background" button, consume stored results on return |
| `client/src/spaces/search/SearchResultsPage.tsx` | Replace modal polling with `useTaskStore.addTask()` + immediate navigation |
| `client/src/stores/index.ts` | Re-export `useTaskStore` |
| `client/src/components/ui/index.ts` | Export new components |

---

## 8. Out of scope

- Browser Notification API (native OS notifications) — not needed for MVP
- Persistent task history (tasks are in-memory only, cleared on page refresh)
- WebSocket/SSE for real-time updates — polling is sufficient for current scale
- Task cancellation UI — server doesn't support cancellation yet
- Sound/audio notification on completion
