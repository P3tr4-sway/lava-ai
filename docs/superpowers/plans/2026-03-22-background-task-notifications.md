# Background Task Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocking full-screen loading spinner in song analysis with a global background task store and macOS-style stacked notification cards in the top-right corner, so users can navigate freely while generation continues.

**Architecture:** A Zustand `useTaskStore` holds all background tasks globally; a `useTaskPoller` hook mounted in `AppShell` handles all polling independently of which page is visible; `TaskCard` / `TaskNotifications` components render the stacked notification UI fixed at `top-4 right-4`. Both `SearchResultsPage` (initiation) and `SongsPage` (result consumer) are updated to read/write through the store.

**Tech Stack:** React 18, TypeScript (strict), Zustand, Tailwind CSS (project tokens from `CLAUDE.md`), `lucide-react`, React Router DOM v6, `youtubeService.ts` (unchanged).

**Spec:** `docs/superpowers/specs/2026-03-22-background-task-notifications-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `client/src/stores/taskStore.ts` | **Create** | Global background task state — add/update/remove tasks |
| `client/src/hooks/useTaskPoller.ts` | **Create** | Global polling loop — iterates active tasks every 2s |
| `client/src/components/ui/TaskCard.tsx` | **Create** | Single notification card — all 4 states (active-collapsed, active-expanded, completed, error) |
| `client/src/components/ui/TaskNotifications.tsx` | **Create** | Stacked card container — fixed top-right, max 3 visible, overflow fold |
| `client/src/stores/index.ts` | **Modify** | Add `useTaskStore` export |
| `client/src/components/ui/index.ts` | **Modify** | Add `TaskNotifications`, `TaskCard` exports |
| `client/src/components/layout/AppShell.tsx` | **Modify** | Mount `TaskNotifications`, call `useTaskPoller()`, wrap with `ToastProvider` |
| `client/src/spaces/search/SearchResultsPage.tsx` | **Modify** | Replace `SongActionModal` polling with `addTask()` + immediate navigate |
| `client/src/spaces/learn/SongsPage.tsx` | **Modify** | Replace local polling with store, add progress bar + "Continue in Background" button |

---

## Task 1: `useTaskStore` — Global Task State

**Files:**
- Create: `client/src/stores/taskStore.ts`

- [ ] **Step 1: Create the store**

```typescript
// client/src/stores/taskStore.ts
import { create } from 'zustand'
import type { AnalysisStatus, AnalysisPollResult } from '@/services/youtubeService'

export interface BackgroundTask {
  id: string               // transcriptionId (server-assigned)
  videoId: string          // original YouTube video ID (needed for retry)
  type: 'analysis'
  title: string
  status: 'active' | 'completed' | 'error'
  stage: AnalysisStatus
  progress: number         // 0-100, derived from stage
  createdAt: number
  completedAt?: number
  result?: AnalysisPollResult
  error?: string
}

export const STAGE_PROGRESS: Record<AnalysisStatus, number> = {
  downloading: 10,
  analyzing_chords: 35,
  analyzing_beats: 65,
  processing: 85,
  completed: 100,
  error: 0,
}

export const STAGE_LABEL: Record<AnalysisStatus, string> = {
  downloading: 'Downloading audio...',
  analyzing_chords: 'Detecting chords...',
  analyzing_beats: 'Analyzing beats & tempo...',
  processing: 'Building score...',
  completed: 'Done',
  error: 'Error',
}

interface TaskStore {
  tasks: BackgroundTask[]
  // addTask: transcriptionId, YouTube videoId, display title
  addTask: (id: string, videoId: string, title: string) => void
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void
  removeTask: (id: string) => void
  getTask: (id: string) => BackgroundTask | undefined
  activeTasks: () => BackgroundTask[]
  completedTasks: () => BackgroundTask[]
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],

  addTask: (id, videoId, title) => {
    // Dedup: if task already active, don't add again
    if (get().tasks.find((t) => t.id === id && t.status === 'active')) return
    const task: BackgroundTask = {
      id,
      videoId,
      type: 'analysis',
      title,
      status: 'active',
      stage: 'downloading',
      progress: STAGE_PROGRESS.downloading,
      createdAt: Date.now(),
    }
    set((state) => ({ tasks: [task, ...state.tasks] }))
  },

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  getTask: (id) => get().tasks.find((t) => t.id === id),
  activeTasks: () => get().tasks.filter((t) => t.status === 'active'),
  completedTasks: () => get().tasks.filter((t) => t.status === 'completed'),
}))
```

- [ ] **Step 2: Add to barrel export**

Edit `client/src/stores/index.ts` — append:
```typescript
export { useTaskStore } from './taskStore'
export type { BackgroundTask } from './taskStore'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors related to `taskStore.ts`

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/taskStore.ts client/src/stores/index.ts
git commit -m "feat: add useTaskStore for global background task state"
```

---

## Task 2: `useTaskPoller` — Global Polling Hook

**Files:**
- Create: `client/src/hooks/useTaskPoller.ts`

- [ ] **Step 1: Create the hook**

```typescript
// client/src/hooks/useTaskPoller.ts
import { useEffect, useRef } from 'react'
import { useTaskStore, STAGE_PROGRESS } from '@/stores/taskStore'
import { youtubeService } from '@/services/youtubeService'

const POLL_INTERVAL = 2000

/**
 * Mount this once in AppShell.
 * Polls all active tasks every 2s, regardless of which page is visible.
 */
export function useTaskPoller() {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const activeTasks = tasks.filter((t) => t.status === 'active')
  const activeTasksRef = useRef(activeTasks)
  activeTasksRef.current = activeTasks

  useEffect(() => {
    const poll = async () => {
      const current = activeTasksRef.current
      if (current.length === 0) return

      await Promise.allSettled(
        current.map(async (task) => {
          try {
            const result = await youtubeService.pollAnalysis(task.id)

            if (result.status === 'completed') {
              updateTask(task.id, {
                status: 'completed',
                stage: 'completed',
                progress: 100,
                completedAt: Date.now(),
                result,
              })
            } else if (result.status === 'error') {
              updateTask(task.id, {
                status: 'error',
                stage: 'error',
                error: result.error ?? 'Analysis failed',
              })
            } else {
              // In progress — update stage + progress
              updateTask(task.id, {
                stage: result.status,
                progress: STAGE_PROGRESS[result.status],
              })
            }
          } catch {
            // Network error — keep polling, don't update state
          }
        }),
      )
    }

    const timer = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [updateTask])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useTaskPoller.ts
git commit -m "feat: add useTaskPoller global polling hook"
```

---

## Task 3: `TaskCard` — Notification Card Component

**Files:**
- Create: `client/src/components/ui/TaskCard.tsx`

This is the individual card with 4 visual states. Uses only project tokens — no hardcoded colors.

- [ ] **Step 1: Create the component**

```typescript
// client/src/components/ui/TaskCard.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, RotateCcw, X, ChevronRight } from 'lucide-react'
import { cn } from './utils'
import { useTaskStore, STAGE_LABEL } from '@/stores/taskStore'
import type { BackgroundTask } from '@/stores/taskStore'
import { youtubeService } from '@/services/youtubeService'

interface TaskCardProps {
  task: BackgroundTask
  className?: string
}

export function TaskCard({ task, className }: TaskCardProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const removeTask = useTaskStore((s) => s.removeTask)
  const addTask = useTaskStore((s) => s.addTask)
  const cardRef = useRef<HTMLDivElement>(null)

  // Collapse on outside click when expanded
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // Keyboard dismiss
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

  const elapsed = task.completedAt
    ? null
    : `${Math.floor((Date.now() - task.createdAt) / 60000)}:${String(Math.floor(((Date.now() - task.createdAt) % 60000) / 1000)).padStart(2, '0')}`

  const handleViewResults = useCallback(() => {
    navigate(`/play/${task.id}?generate=1`)
    removeTask(task.id)
  }, [navigate, task.id, removeTask])

  const handleRetry = useCallback(async () => {
    removeTask(task.id)
    try {
      // Use task.videoId (original YouTube video ID), NOT task.id (transcriptionId)
      const newId = await youtubeService.startAnalysis(task.videoId, task.title)
      addTask(newId, task.videoId, task.title)
    } catch {
      // Swallow — user can try again
    }
  }, [task.id, task.videoId, task.title, removeTask, addTask])

  const isActive = task.status === 'active'
  const isCompleted = task.status === 'completed'
  const isError = task.status === 'error'

  return (
    <div
      ref={cardRef}
      role="status"
      aria-live="polite"
      aria-label={`${task.title} — ${isCompleted ? 'Complete' : isError ? 'Error' : STAGE_LABEL[task.stage]}`}
      className={cn(
        'w-72 bg-surface-1 border border-border rounded-lg shadow-lg overflow-hidden',
        'transition-all duration-200 ease-out',
        className,
      )}
    >
      {/* Header row */}
      <button
        onClick={() => isActive && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 pt-3',
          isActive ? 'cursor-pointer pb-2' : 'cursor-default pb-3',
        )}
        disabled={!isActive}
      >
        {/* Status icon */}
        <span className="shrink-0">
          {isActive && <Loader2 size={14} className="animate-spin text-text-secondary" />}
          {isCompleted && <CheckCircle2 size={14} className="text-success" />}
          {isError && <XCircle size={14} className="text-error" />}
        </span>

        {/* Title */}
        <span className="flex-1 text-xs font-medium text-text-primary truncate text-left">
          {task.title}
        </span>

        {/* Right label */}
        {isActive && (
          <span className="shrink-0 text-xs text-text-muted tabular-nums">
            {task.progress}%
          </span>
        )}
        {isCompleted && (
          <span className="shrink-0 text-xs text-success font-medium">Complete</span>
        )}
        {isError && (
          <span className="shrink-0 text-xs text-error font-medium">Error</span>
        )}
        {isActive && (
          <ChevronRight
            size={12}
            className={cn(
              'shrink-0 text-text-muted transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
      </button>

      {/* Progress bar — active only */}
      {isActive && (
        <div className="px-3 pb-2.5">
          <div className="w-full h-0.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Full progress bar — completed */}
      {isCompleted && (
        <div className="px-3 pb-3">
          <div className="w-full h-0.5 bg-accent rounded-full" />
        </div>
      )}

      {/* Expanded detail — active only */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-150 ease-out',
          expanded && isActive ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-2">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>{STAGE_LABEL[task.stage]}</span>
            {elapsed && <span className="text-text-muted tabular-nums">{elapsed}</span>}
          </div>
          <button
            onClick={() => navigate(`/play/${task.id}?generate=1`)}
            className="self-end flex items-center gap-1 text-xs font-medium text-text-primary hover:text-accent transition-colors"
          >
            View Page <ChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* Completed actions */}
      {isCompleted && (
        <div className="px-3 pb-3 flex items-center justify-between gap-2 border-t border-border pt-2">
          <button
            onClick={handleViewResults}
            className="flex-1 text-xs font-medium text-text-primary bg-surface-3 hover:bg-surface-4 rounded px-2 py-1.5 transition-colors text-center"
          >
            View Results
          </button>
          <button
            onClick={() => removeTask(task.id)}
            aria-label="Dismiss"
            className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Error actions */}
      {isError && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-xs text-error truncate">{task.error}</p>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-xs font-medium text-text-primary bg-surface-3 hover:bg-surface-4 rounded px-2 py-1.5 transition-colors"
            >
              <RotateCcw size={11} /> Retry
            </button>
            <button
              onClick={() => removeTask(task.id)}
              aria-label="Dismiss"
              className="p-1.5 rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ui/TaskCard.tsx
git commit -m "feat: add TaskCard notification card component"
```

---

## Task 4: `TaskNotifications` — Stacked Container

**Files:**
- Create: `client/src/components/ui/TaskNotifications.tsx`

- [ ] **Step 1: Create the container**

```typescript
// client/src/components/ui/TaskNotifications.tsx
import { useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { TaskCard } from './TaskCard'
import { cn } from './utils'

const MAX_VISIBLE = 3

export function TaskNotifications({ className }: { className?: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const [showAll, setShowAll] = useState(false)

  if (tasks.length === 0) return null

  const visible = showAll ? tasks : tasks.slice(0, MAX_VISIBLE)
  const overflow = tasks.length - MAX_VISIBLE

  return (
    <div
      role="region"
      aria-label="Background tasks"
      className={cn(
        'fixed top-4 right-4 z-50 flex flex-col gap-2',
        className,
      )}
    >
      {visible.map((task) => (
        <div
          key={task.id}
          className="animate-slide-in-right"
        >
          <TaskCard task={task} />
        </div>
      ))}

      {!showAll && overflow > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="self-end text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1"
        >
          +{overflow} more
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add exports to barrels**

Edit `client/src/components/ui/index.ts` — append two lines:
```typescript
export { TaskCard } from './TaskCard'
export { TaskNotifications } from './TaskNotifications'
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ui/TaskNotifications.tsx client/src/components/ui/index.ts
git commit -m "feat: add TaskNotifications stacked container"
```

---

## Task 5: Wire `AppShell`

**Files:**
- Modify: `client/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add imports**

At the top of `AppShell.tsx`, add these imports after the existing ones:

```typescript
import { TaskNotifications } from '@/components/ui/TaskNotifications'
import { ToastProvider } from '@/components/ui/Toast'
import { useTaskPoller } from '@/hooks/useTaskPoller'
```

- [ ] **Step 2: Call `useTaskPoller` inside `AppShell`**

Add this line directly after `useTheme()` (line 19 in the current file):

```typescript
useTaskPoller()
```

- [ ] **Step 3: Add `TaskNotifications` to both branches**

In the **mobile branch** (inside the `if (isMobile)` return), add `<TaskNotifications />` just before the closing `</div>`:

```tsx
        <TaskNotifications />
      </div>
```

In the **desktop branch** (the second return), add `<TaskNotifications />` just before `<LibraryModal />`:

```tsx
      <TaskNotifications />
      <LibraryModal />
```

- [ ] **Step 4: Wrap the entire return with `ToastProvider`**

The `AppShell` function currently returns JSX directly. Wrap both branches by adding `<ToastProvider>` at the top level. The simplest approach: wrap the final `return` statement. Since there are two returns (mobile + desktop), apply `ToastProvider` by restructuring slightly:

```tsx
export function AppShell() {
  useTheme()
  useTaskPoller()

  // ... all existing hooks ...

  return (
    <ToastProvider>
      {isMobile ? (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-1">
          {/* ... all existing mobile JSX ... */}
          <TaskNotifications />
        </div>
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-surface-1">
          {/* ... all existing desktop JSX ... */}
          <TaskNotifications />
          <LibraryModal />
          <OnboardingModal />
          <GuestWelcomeModal />
          <AuthPromptModal />
        </div>
      )}
    </ToastProvider>
  )
}
```

**Note:** The existing code has two separate `return` statements (one `if (isMobile)` early return and a second). Merge them into a single ternary to allow `ToastProvider` to wrap both. Keep all existing JSX unchanged — only restructure the conditional.

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add client/src/components/layout/AppShell.tsx
git commit -m "feat: mount TaskNotifications and useTaskPoller in AppShell"
```

---

## Task 6: Migrate `SearchResultsPage` — Replace Modal Polling

**Files:**
- Modify: `client/src/spaces/search/SearchResultsPage.tsx`

The `SongActionModal` component (around line 393) has its own polling loop. Replace it with `useTaskStore.addTask()` + immediate navigation.

- [ ] **Step 1: Add `useTaskStore` import**

At the top of `SearchResultsPage.tsx`, find existing imports and add:

```typescript
import { useTaskStore } from '@/stores/taskStore'
```

- [ ] **Step 2: Update `SongActionModal` — remove polling state and loop**

Inside `SongActionModal`, remove these lines:
```typescript
// Remove:
const [generating, setGenerating] = useState(false)
const [status, setStatus] = useState<AnalysisStatus | null>(null)
const [errorMsg, setErrorMsg] = useState<string | null>(null)
const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

// Remove:
useEffect(() => {
  return () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }
}, [])
```

And replace `handleGenerate` with:

```typescript
const addTask = useTaskStore((s) => s.addTask)

const handleGenerate = useCallback(async () => {
  if (!requireAuth('AI Score Generation')) return
  try {
    // result.id is the YouTube video ID; transcriptionId is server-assigned
    const transcriptionId = await youtubeService.startAnalysis(result.id, result.title)
    addTask(transcriptionId, result.id, result.title)
    navigate(`/play/${transcriptionId}?generate=1`)
    onClose()
  } catch (err) {
    console.error('Failed to start analysis:', err)
  }
}, [result.id, result.title, navigate, requireAuth, addTask, onClose])
```

- [ ] **Step 3: Simplify modal — remove progress UI**

Since analysis is now background-tracked, the modal no longer needs the progress view. Remove the `{generating ? ( ... ) : ( ... )}` conditional — keep only the action buttons branch (the `else` side). The modal now shows options and closes immediately when Generate is clicked.

The `Escape` key handler: change `&& !generating` condition to `true` (always allow close):
```typescript
if (e.key === 'Escape') onClose()
```

The `STATUS_LABELS`, `STATUS_ORDER` constants and `currentStepIdx`, `progress` variables above the return can be removed.

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors. Any unused import warnings (e.g. `AnalysisStatus`, `Loader2`, `AlertCircle`, `RotateCcw`) should also be cleaned up.

- [ ] **Step 5: Manual smoke test**

Start the dev server:
```bash
cd /Users/p3tr4/Documents/LavaAI-demo && npm run dev
```
1. Go to Search → search for a song
2. Click a result → modal opens with the two action buttons
3. Click "AI Score + Backing Track"
4. Modal closes immediately, notification card appears top-right with "Downloading audio..." and 10%
5. Navigate to Projects — notification card still visible and updating

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/search/SearchResultsPage.tsx
git commit -m "feat: replace SearchResultsPage modal polling with useTaskStore"
```

---

## Task 7: Migrate `SongsPage` — Connect to Store

**Files:**
- Modify: `client/src/spaces/learn/SongsPage.tsx`

Current behavior: local `useEffect` (lines 62–150) starts its own polling loop on mount when `?generate=1`. Replace with store consumption + add progress UI + "Continue in Background" button.

- [ ] **Step 1: Add import**

```typescript
import { useTaskStore, STAGE_LABEL } from '@/stores/taskStore'
```

Also add `ArrowLeft` to existing lucide imports if not already there (it is already imported at line 8).

- [ ] **Step 2: Replace the polling `useEffect`**

Remove the entire `useEffect` block from lines 62–150.

Replace with this logic block (add after the existing `useState` declarations):

```typescript
const getTask = useTaskStore((s) => s.getTask)
const addTask = useTaskStore((s) => s.addTask)

// Derive task data reactively
const task = id ? getTask(id) : undefined
const taskProgress = task?.progress ?? 0
const taskStage = task?.stage ?? 'downloading'

useEffect(() => {
  if (!isGenerateMode || !id || staticChart) return

  const existingTask = getTask(id)

  if (existingTask?.status === 'completed' && existingTask.result) {
    // Already done — load immediately from store
    loadResult(existingTask.result)
    return
  }

  if (existingTask?.status === 'active') {
    // Already polling globally — nothing to do here
    return
  }

  // No task in store — check server (handles page refresh case)
  setLoadingAnalysis(true)
  setAnalysisError(null)

  youtubeService.pollAnalysis(id).then((result) => {
    if (result.status === 'completed') {
      loadResult(result)
    } else if (result.status === 'error') {
      setAnalysisError(result.error ?? 'Analysis failed')
      setLoadingAnalysis(false)
    } else {
      // Server still processing — register in store so global poller takes over
      // Note: when arriving via page refresh we don't know the original videoId,
      // so we pass id as a placeholder. Retry from this context is unlikely (user
      // would re-search), but the field is required by the interface.
      const title = document.title || 'Song'
      addTask(id, id, title)
    }
  }).catch(() => {
    // Network error — register optimistically, global poller will catch up
    addTask(id, id, 'Song')
  })
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [id, isGenerateMode])

// React to task completing while page is open
useEffect(() => {
  if (!task || task.status !== 'completed' || !task.result) return
  if (analysisChart) return // already loaded
  loadResult(task.result)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [task?.status])
```

The `loadResult` function (currently defined inside the old `useEffect`) needs to be extracted as a `useCallback` *above* the new effects:

```typescript
const loadResult = useCallback((result: import('@/services/youtubeService').AnalysisPollResult) => {
  if (!result.scoreJson) {
    setAnalysisError('Analysis completed but no score was generated.')
    setLoadingAnalysis(false)
    return
  }
  const score = result.scoreJson
  setAnalysisChart({
    id: id!,
    title: score.title || 'Untitled',
    artist: '',
    style: 'Auto-detected',
    key: score.key,
    tempo: score.tempo,
    timeSignature: score.timeSignature,
  })
  loadFromAnalysis({
    projectName: score.title || 'Untitled',
    key: score.key,
    tempo: score.tempo,
    timeSignature: score.timeSignature,
    sections: score.sections.map((s) => ({
      ...s,
      type: s.type as 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom',
    })),
  })
  setBpm(score.tempo)
  if (result.audioFileId) {
    const beatsPerMeasure = parseInt(score.timeSignature?.split('/')[0] ?? '4', 10) || 4
    const bars = Math.max(16, Math.ceil((score.duration! * score.tempo) / (60 * beatsPerMeasure)))
    setAnalysisTotalBars(bars)
    setPendingAudioImport({
      audioFileId: result.audioFileId,
      totalBars: bars,
      duration: score.duration!,
      title: score.title || 'Audio',
      setAt: Date.now(),
    })
  }
  setLoadingAnalysis(false)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [id, loadFromAnalysis, setBpm])
// Note: setAnalysisTotalBars, setPendingAudioImport, setLoadingAnalysis are stable useState
// setters — safe to omit from deps per React docs, but listed here to suppress any lint rules
```

- [ ] **Step 3: Update the loading state UI**

Find the `if (loadingAnalysis)` return block (currently lines 303–313). Replace its inner content:

```tsx
if (loadingAnalysis) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-5 max-w-xs">
        <Loader2 size={28} className="text-text-muted animate-spin" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary">Analyzing song...</p>
          <p className="text-xs text-text-muted">{STAGE_LABEL[taskStage]}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-0.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${taskProgress}%` }}
          />
        </div>
        <p className="text-xs text-text-muted tabular-nums">{taskProgress}%</p>

        {/* Continue in background */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors mt-1"
        >
          <ArrowLeft size={13} />
          Continue in Background
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

- [ ] **Step 5: Manual smoke test**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo && npm run dev
```

Verify the full round trip:
1. Search → click "AI Score + Backing Track" → modal closes, notification card appears
2. While on notification card page: progress updates every ~2s
3. Click notification card → expands showing stage + elapsed time
4. Click "View Page →" → navigates to `/play/:id?generate=1` which shows the loading view with progress bar + "Continue in Background" button
5. Click "Continue in Background" → navigates back, notification card stays and continues updating
6. When analysis completes → notification card changes to completed state with "View Results" button
7. Click "View Results" → navigates to song page, score loads immediately from store (no re-fetch)

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/learn/SongsPage.tsx
git commit -m "feat: migrate SongsPage to useTaskStore, add progress UI and Continue in Background"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/p3tr4/Documents/LavaAI-demo/client && npx tsc --noEmit
```
Expected: zero errors

- [ ] **Step 2: Verify animation tokens exist**

```bash
grep -r "animate-slide-in-right\|animate-fade-in" /Users/p3tr4/Documents/LavaAI-demo/client/src/styles/ /Users/p3tr4/Documents/LavaAI-demo/client/tailwind.config*
```
Expected: `animate-slide-in-right` is defined (used in `TaskNotifications`). If missing, check `client/src/styles/tokens.css` or `tailwind.config.ts` — the spec says this animation is available. If not, add to tailwind config:
```js
animation: {
  'slide-in-right': 'slideInRight 200ms ease-out',
},
keyframes: {
  slideInRight: {
    from: { transform: 'translateX(100%)', opacity: '0' },
    to:   { transform: 'translateX(0)',    opacity: '1' },
  },
},
```

- [ ] **Step 3: End-to-end test scenarios**

With dev server running, test each scenario:

| Scenario | Expected |
|----------|----------|
| Start analysis → stay on notification page | Card updates every 2s through stages |
| Start analysis → navigate away | Card persists and updates |
| Start analysis → refresh page | `SongsPage` reconnects to server, re-registers task in store |
| Two analyses running simultaneously | Two stacked cards, both update independently |
| Analysis errors | Card shows error state + Retry button |
| Retry error → starts new task | Old card replaced by new active card |
| Complete → click View Results | Navigates to score page, loads immediately |
| Complete → close notification | Card dismissed, navigate manually to `/play/:id?generate=1` still works |

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: background task notification system — all tasks complete"
```
