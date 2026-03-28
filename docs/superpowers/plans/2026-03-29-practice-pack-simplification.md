# Practice Pack Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify LAVA AI from 11 spaces / 20+ routes to 4 pages (Home, Pack, My Songs, Profile) with a Lovart-style centered hero homepage and conversational Practice Pack creation flow.

**Architecture:** Surgical simplification — keep agent/audio/score infrastructure, strip routing and shell down to 4 pages, rebuild Home as centered hero with chat input, compose Practice Pack view from existing score/playback/agent components. Follow Simple Design System (light-first, 8px radius, Inter, grayscale).

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3, Zustand, React Router v6, Lucide icons, Fastify 4, Drizzle ORM, tone.js

**Spec:** `docs/superpowers/specs/2026-03-29-practice-pack-simplification-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `client/src/spaces/pack/PackPage.tsx` | Practice Pack view — two-zone layout (score+playback / AI chat) |
| `client/src/spaces/pack/PlayRedirect.tsx` | Redirect `/play/:id` → `/pack/:id` preserving the ID |
| `client/src/spaces/songs/MySongsPage.tsx` | Saved packs list with search/filter |
| `client/src/spaces/profile/ProfilePage.tsx` | Account + preferences |

### Modified Files
| File | Changes |
|------|---------|
| `client/src/router.tsx` | Strip to 4 routes + auth + redirects |
| `client/src/components/layout/AppShell.tsx` | Remove TopBar, AgentPanel, modals; icon-only sidebar |
| `client/src/components/layout/Sidebar.tsx` | Icon-only, 3 nav items + logo + plus button |
| `client/src/components/layout/BottomNav.tsx` | 3 tabs (Home, My Songs, Profile) |
| `client/src/components/layout/MobileHeader.tsx` | Remove agent panel toggle |
| `client/src/components/layout/navItems.ts` | 3 items, remove home sections |
| `client/src/components/agent/ChatInput.tsx` | Wire file attachment upload |
| `client/src/spaces/home/HomePage.tsx` | Complete rewrite — centered hero |
| `client/src/stores/uiStore.ts` | Default theme to 'light', remove agent panel desktop mode |
| `client/src/hooks/useAgent.ts` | Strip jam/calendar/coach/tone routing logic (Task 7) |

### Deleted Files (Task 7)
| Category | Files |
|----------|-------|
| Spaces | `spaces/jam/`, `spaces/editor/`, `spaces/learn/`, `spaces/library/`, `spaces/calendar/`, `spaces/search/`, `spaces/my-projects/`, `spaces/settings/`, `spaces/pricing/` |
| Components | `components/calendar/`, `components/library/`, `components/settings/SubscriptionSection.tsx`, `components/agent/HomeAgentSurface.tsx`, `components/agent/QuickActions.tsx`, `components/layout/TopBar.tsx`, `components/onboarding/` |
| Stores | `stores/calendarStore.ts`, `stores/playlistStore.ts`, `stores/jamStore.ts`, `stores/coachStore.ts`, `stores/practiceAssistStore.ts` |
| Data | `data/chordCharts.ts`, `data/backingTracks.ts`, `data/effectsPresets.ts`, `data/mockSearchResults.ts` |
| Server tools | `server/src/agent/tools/definitions/jam.tool.ts`, `server/src/agent/tools/definitions/calendar.tool.ts`, `server/src/agent/tools/definitions/coach.tool.ts` |

---

## Task 1: Strip Router to 4 Pages

**Files:**
- Modify: `client/src/router.tsx`

- [ ] **Step 1: Rewrite router with new routes**

Replace the entire route config. Keep auth routes outside AppShell. Add 4 main routes + catch-all + `/settings` redirect.

```tsx
// client/src/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/spaces/auth/LoginPage'
import { SignupPage } from '@/spaces/auth/SignupPage'
import { HomePage } from '@/spaces/home/HomePage'

// Lazy placeholders — will be replaced in later tasks
const PackPageStub = () => <div className="p-8 text-text-primary">Pack page stub</div>
const MySongsPageStub = () => <div className="p-8 text-text-primary">My Songs stub</div>
const ProfilePageStub = () => <div className="p-8 text-text-primary">Profile stub</div>

const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pack/:id', element: <PackPageStub /> },
      { path: 'songs', element: <MySongsPageStub /> },
      { path: 'profile', element: <ProfilePageStub /> },
      // Redirects for removed routes
      { path: 'settings', element: <Navigate to="/profile" replace /> },
      // play/:id needs a component to read the param and redirect to /pack/:id
      { path: 'play/:id', lazy: async () => {
        const { PlayRedirect } = await import('@/spaces/pack/PlayRedirect')
        return { Component: PlayRedirect }
      }},
      { path: 'projects', element: <Navigate to="/songs" replace /> },
      { path: 'files', element: <Navigate to="/songs" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`
Expected: May have unused import warnings but no type errors in router.tsx

- [ ] **Step 3: Commit**

```bash
git add client/src/router.tsx
git commit -m "feat: strip router to 4 pages (Home, Pack, Songs, Profile)"
```

---

## Task 2: Simplify Navigation Items

**Files:**
- Modify: `client/src/components/layout/navItems.ts`

- [ ] **Step 1: Rewrite navItems with 3 routes**

```ts
// client/src/components/layout/navItems.ts
import { Home, Music, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const HOME_NAV_RESET_EVENT = 'lava:home-nav-reset'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/songs', label: 'My Songs', icon: Music },
  { to: '/profile', label: 'Profile', icon: User },
]

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/songs', label: 'Songs', icon: Music },
  { to: '/profile', label: 'Profile', icon: User },
]
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/layout/navItems.ts
git commit -m "feat: simplify nav items to 3 routes"
```

---

## Task 3: Rebuild App Shell

**Files:**
- Modify: `client/src/components/layout/AppShell.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`
- Modify: `client/src/components/layout/BottomNav.tsx`
- Modify: `client/src/components/layout/MobileHeader.tsx`

- [ ] **Step 1: Simplify AppShell — remove TopBar, AgentPanel, and all modals**

Strip AppShell to: Sidebar (desktop) or MobileHeader+BottomNav (mobile) + content area. No TopBar, no AgentPanel drawer, no LibraryModal/OnboardingModal/GuestWelcomeModal/AuthPromptModal.

**Important:** Keep these critical hooks/wrappers from the current AppShell:
- `useTheme()` — applies CSS theme class to `<html>`, required for theme switching
- `AudioController.init()` — initializes audio bridge, required for playback
- `ToastProvider` + `TaskNotifications` — needed for notifications

Do NOT keep: `AgentPanel`, `LibraryModal`, `OnboardingModal`, `GuestWelcomeModal`, `AuthPromptModal`, `PracticePlanDialog`, `TopBar`.

```tsx
// client/src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { BottomNav } from './BottomNav'
import { ToastProvider, TaskNotifications } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTheme } from '@/hooks/useTheme'
import { AudioController } from '@/audio/AudioController'
import { useEffect } from 'react'

export function AppShell() {
  useTheme()
  const isMobile = useIsMobile()

  useEffect(() => {
    AudioController.init()
  }, [])

  if (isMobile) {
    return (
      <ToastProvider>
        <div className="flex flex-col h-dvh bg-surface-0">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
          <BottomNav />
        </div>
        <TaskNotifications />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="flex h-dvh bg-surface-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <TaskNotifications />
    </ToastProvider>
  )
}
```

- [ ] **Step 2: Rebuild Sidebar as icon-only rail**

Replace the full Sidebar with a slim 56px icon-only rail. Logo at top, plus button, 3 nav icons, no labels, no collapsible behavior.

```tsx
// client/src/components/layout/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SIDEBAR_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { LavaLogo } from './LavaLogo'
import { cn } from '@/components/ui/utils'

export function Sidebar() {
  const { pathname } = useLocation()

  const handleNavClick = (to: string) => {
    if (to === '/' && pathname === '/') {
      window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
    }
  }

  return (
    <nav className="flex flex-col items-center w-14 border-r border-border bg-surface-0 py-4 gap-2">
      {/* Logo */}
      <Link to="/" className="mb-4">
        <LavaLogo className="size-7" />
      </Link>

      {/* New pack shortcut */}
      <Link
        to="/"
        className="flex items-center justify-center size-10 rounded-lg bg-accent text-surface-0 hover:opacity-90 transition-opacity mb-2"
        title="New Pack"
      >
        <Plus className="size-5" />
      </Link>

      {/* Nav items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => handleNavClick(to)}
              className={cn(
                'flex items-center justify-center size-10 rounded-lg transition-colors',
                isActive
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'
              )}
              title={label}
            >
              <Icon className="size-5" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Simplify BottomNav to 3 tabs**

```tsx
// client/src/components/layout/BottomNav.tsx
import { Link, useLocation } from 'react-router-dom'
import { MOBILE_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { cn } from '@/components/ui/utils'

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="flex items-center justify-around border-t border-border bg-surface-0 h-14 px-2">
      {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            onClick={() => {
              if (to === '/' && pathname === '/') {
                window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors',
              isActive ? 'text-text-primary' : 'text-text-muted'
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px] leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Simplify MobileHeader — remove agent panel toggle**

```tsx
// client/src/components/layout/MobileHeader.tsx
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { LavaLogo } from './LavaLogo'

export function MobileHeader() {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  return (
    <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-surface-0">
      <button
        onClick={() => setSidebarOpen(true)}
        className="flex items-center justify-center size-8 text-text-secondary"
      >
        <Menu className="size-5" />
      </button>
      <Link to="/">
        <LavaLogo className="size-6" />
      </Link>
      <div className="size-8" /> {/* Spacer for symmetry */}
    </header>
  )
}
```

- [ ] **Step 5: Verify the app compiles and renders**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm typecheck`

- [ ] **Step 6: Commit**

```bash
git add client/src/components/layout/AppShell.tsx client/src/components/layout/Sidebar.tsx client/src/components/layout/BottomNav.tsx client/src/components/layout/MobileHeader.tsx
git commit -m "feat: rebuild shell with icon-only sidebar, remove TopBar and AgentPanel"
```

---

## Task 4: Rebuild Home Page

**Files:**
- Modify: `client/src/spaces/home/HomePage.tsx`
- Modify: `client/src/components/agent/ChatInput.tsx`

- [ ] **Step 1: Rewrite HomePage as centered hero with chat input**

Complete rewrite. Centered layout, heading, subtitle, ChatInput with attachment, chips, recent packs, loading state.

```tsx
// client/src/spaces/home/HomePage.tsx
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip, X } from 'lucide-react'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/components/ui/utils'

const STYLE_CHIPS = ['Simplified', 'Fingerpicking'] as const

type SubmitPhase = 'idle' | 'analyzing' | 'arranging' | 'building'

const PHASE_LABELS: Record<SubmitPhase, string> = {
  idle: '',
  analyzing: 'Analyzing your song...',
  arranging: 'Creating arrangement...',
  building: 'Building practice pack...',
}

export function HomePage() {
  const navigate = useNavigate()
  const chatRef = useRef<ChatInputRef>(null)
  const projects = useProjectStore((s) => s.projects)
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const handleChipClick = (style: string) => {
    chatRef.current?.setValue(`Convert to ${style.toLowerCase()} arrangement`)
    chatRef.current?.focus()
  }

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*,.pdf,.musicxml,.mxl,.xml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) setAttachedFile(file)
    }
    input.click()
  }

  const handleSend = useCallback(async (message: string) => {
    if (!message.trim() && !attachedFile) return

    // Simulated loading phases — will be wired to real agent in later iteration
    setPhase('analyzing')
    setTimeout(() => setPhase('arranging'), 1500)
    setTimeout(() => setPhase('building'), 3000)
    setTimeout(() => {
      setPhase('idle')
      // TODO: navigate to real pack ID from agent response
      navigate('/pack/demo')
    }, 4500)
  }, [attachedFile, navigate])

  const recentPacks = projects.slice(0, 6)

  if (phase !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="size-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-lg text-text-secondary animate-pulse">
          {PHASE_LABELS[phase]}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-[22vh] pb-12 flex flex-col gap-10">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-3">
        <h1 className="text-[48px] font-bold leading-none tracking-tight text-text-primary">
          Practice any song your way
        </h1>
        <p className="text-base text-text-secondary">
          Upload a song, get a practice pack in seconds
        </p>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-3">
        {/* File chip */}
        {attachedFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 rounded-lg w-fit text-sm text-text-primary">
            <Paperclip className="size-3.5 text-text-secondary" />
            <span className="truncate max-w-[200px]">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="text-text-muted hover:text-text-primary">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Chat input with attachment */}
        <div className="relative">
          <ChatInput
            ref={chatRef}
            onSend={handleSend}
            placeholder="Describe what you want to practice..."
            density="roomy"
            onAttachClick={handleFileSelect}
          />
        </div>

        {/* Style chips */}
        <div className="flex items-center gap-2 justify-center">
          {STYLE_CHIPS.map((style) => (
            <button
              key={style}
              onClick={() => handleChipClick(style)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-1 hover:text-text-primary transition-colors"
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Recent packs */}
      {recentPacks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text-primary">Recent</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentPacks.map((pack) => (
              <button
                key={pack.id}
                onClick={() => navigate(`/pack/${pack.id}`)}
                className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-surface-0 hover:bg-surface-1 transition-colors min-w-[180px] text-left"
              >
                <span className="text-sm font-medium text-text-primary truncate">
                  {pack.name}
                </span>
                <span className="text-xs text-text-muted">
                  {new Date(pack.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentPacks.length === 0 && (
        <p className="text-center text-sm text-text-muted">
          Your practice packs will appear here.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `onAttachClick` prop to ChatInput**

Add an optional `onAttachClick` callback to the existing ChatInput. When provided, the attachment button calls it instead of being a no-op.

In `client/src/components/agent/ChatInput.tsx`, add `onAttachClick?: () => void` to the props interface (around line 10), and wire it to the existing attachment `IconButton` (around line 84).

```tsx
// Add to ChatInputProps interface:
onAttachClick?: () => void

// Change the attachment IconButton's onClick:
// From: onClick={() => {}} (or whatever no-op)
// To:   onClick={() => onAttachClick?.()}
```

- [ ] **Step 3: Verify the app renders the new Home page**

Run: `cd /Users/p3tr4/Documents/LavaAI-demo && pnpm dev`

Open http://localhost:5173 — should see centered hero with heading, subtitle, chat input, and two chips.

- [ ] **Step 4: Commit**

```bash
git add client/src/spaces/home/HomePage.tsx client/src/components/agent/ChatInput.tsx
git commit -m "feat: rebuild HomePage as centered hero with chat input and style chips"
```

---

## Task 5: Build Practice Pack Page

**Files:**
- Create: `client/src/spaces/pack/PackPage.tsx`
- Modify: `client/src/router.tsx` (replace stub)

- [ ] **Step 1: Create PackPage with two-zone layout**

Compose from existing score/agent components. Top zone: MetadataBar + ScoreVersionRail + score viewer + playback controls. Bottom zone: AI chat.

```tsx
// client/src/spaces/pack/PackPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, Share2, ArrowLeft } from 'lucide-react'
import { MetadataBar, LeadSheetPlaybackBar, ScoreVersionRail, PdfViewer, FollowView } from '@/components/score'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { ChatMessage } from '@/components/agent/ChatMessage'
import { Button } from '@/components/ui'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useProjectStore } from '@/stores/projectStore'
import { useAgentStore } from '@/stores/agentStore'
import { useAgent } from '@/hooks/useAgent'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/components/ui/utils'
import type { AgentMessage } from '@lava/shared'
import { useRef } from 'react'

export function PackPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const chatRef = useRef<ChatInputRef>(null)

  // Score state — leadSheetStore has individual fields, not a metadata object
  const arrangements = useLeadSheetStore((s) => s.arrangements)
  const selectedArrangementId = useLeadSheetStore((s) => s.selectedArrangementId)
  const selectArrangement = useLeadSheetStore((s) => s.selectArrangement)
  const key = useLeadSheetStore((s) => s.key)
  const tempo = useLeadSheetStore((s) => s.tempo)
  const timeSignature = useLeadSheetStore((s) => s.timeSignature)

  // Agent — messages/streaming live on agentStore, not useAgent return
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const { sendMessage } = useAgent()

  // Chat panel visibility (mobile)
  const [chatOpen, setChatOpen] = useState(false)

  const handleSend = (text: string) => {
    if (!text.trim()) return
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with back + actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" title="Export">
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Share">
            <Share2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Score zone */}
      <div className={cn('flex flex-col', isMobile ? 'flex-1' : 'h-[70%]', 'overflow-hidden')}>
        {/* Metadata — individual store fields, not a metadata object */}
        <MetadataBar
          keyValue={key || 'C'}
          timeSignature={timeSignature || '4/4'}
          tempo={tempo || 120}
          className="px-4 py-2 border-b border-border"
        />

        {/* Version rail */}
        {arrangements.length > 1 && (
          <ScoreVersionRail
            arrangements={arrangements}
            selectedArrangementId={selectedArrangementId}
            onSelect={(arrId) => selectArrangement(arrId)}
            className="px-4 py-2 border-b border-border"
          />
        )}

        {/* Score viewer */}
        <div className="flex-1 overflow-y-auto p-4">
          <FollowView />
        </div>

        {/* Playback controls */}
        <LeadSheetPlaybackBar
          totalBars={16}
          beatsPerBar={4}
          className="border-t border-border"
        />
      </div>

      {/* AI Chat zone */}
      {isMobile ? (
        <>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center justify-center py-2 border-t border-border bg-surface-1 text-sm text-text-secondary"
          >
            {chatOpen ? 'Hide AI Editor' : 'AI Editor'}
          </button>
          {chatOpen && (
            <div className="h-[40vh] flex flex-col border-t border-border">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: AgentMessage, i: number) => (
                  <ChatMessage key={i} message={msg} />
                ))}
              </div>
              <div className="p-3 border-t border-border">
                <ChatInput ref={chatRef} onSend={handleSend} disabled={isStreaming} compact placeholder="Edit arrangement..." />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="h-[30%] flex flex-col border-t border-border">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg: AgentMessage, i: number) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">
                Ask the AI to edit your arrangement — change key, simplify, restyle...
              </p>
            )}
          </div>
          <div className="p-3 border-t border-border">
            <ChatInput ref={chatRef} onSend={handleSend} disabled={isStreaming} compact placeholder="Edit arrangement..." />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create PlayRedirect for /play/:id → /pack/:id**

```tsx
// client/src/spaces/pack/PlayRedirect.tsx
import { Navigate, useParams } from 'react-router-dom'

export function PlayRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/pack/${id}`} replace />
}
```

- [ ] **Step 3: Wire PackPage into router**

In `client/src/router.tsx`, replace the `PackPageStub` with the real import:

```tsx
// Replace stub:
// const PackPageStub = () => <div>...</div>
// With:
import { PackPage } from '@/spaces/pack/PackPage'

// And in routes:
{ path: 'pack/:id', element: <PackPage /> },
```

- [ ] **Step 4: Verify the page renders at /pack/demo**

Run: `pnpm dev`, navigate to http://localhost:5173/pack/demo
Expected: Two-zone layout with score area (may show empty/demo state) and chat area below.

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/pack/PackPage.tsx client/src/spaces/pack/PlayRedirect.tsx client/src/router.tsx
git commit -m "feat: build Practice Pack page with score/playback/AI chat zones"
```

---

## Task 6: Build My Songs and Profile Pages

**Files:**
- Create: `client/src/spaces/songs/MySongsPage.tsx`
- Create: `client/src/spaces/profile/ProfilePage.tsx`
- Modify: `client/src/router.tsx` (replace stubs)

- [ ] **Step 1: Create MySongsPage**

```tsx
// client/src/spaces/songs/MySongsPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { Button, Card, Input, Badge, Dialog } from '@/components/ui'
import { cn } from '@/components/ui/utils'

export function MySongsPage() {
  const navigate = useNavigate()
  const projects = useProjectStore((s) => s.projects)
  const loadProjects = useProjectStore((s) => s.loadProjects)
  const removeProject = useProjectStore((s) => s.removeProject)
  const [filter, setFilter] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-primary">My Songs</h1>

      {/* Search */}
      <Input
        placeholder="Search songs..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* Pack list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((pack) => (
            <button
              key={pack.id}
              onClick={() => navigate(`/pack/${pack.id}`)}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-0 hover:bg-surface-1 transition-colors text-left group"
            >
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-text-primary">
                  {pack.name}
                </span>
                <span className="text-sm text-text-muted">
                  {new Date(pack.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteId(pack.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-2 text-text-muted hover:text-error transition-all"
                title="Delete"
              >
                <Trash2 className="size-4" />
              </button>
            </button>
          ))}
        </div>
      ) : filter ? (
        <p className="text-sm text-text-muted text-center py-8">
          No songs match "{filter}"
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-text-muted">
            No songs yet. Head home to create your first practice pack.
          </p>
          <Button onClick={() => navigate('/')}>Create a pack</Button>
        </div>
      )}

      {/* Delete confirmation — Dialog uses onClose + children, not onConfirm */}
      {deleteId && (
        <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete this song?">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { removeProject(deleteId); setDeleteId(null) }}>
                Delete
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ProfilePage**

```tsx
// client/src/spaces/profile/ProfilePage.tsx
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui'
import { Moon, Sun } from 'lucide-react'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  return (
    <div className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-text-primary">Profile</h1>

      {/* Account */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Account</h2>
        <div className="flex flex-col gap-2 p-4 rounded-lg border border-border">
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Name</span>
            <span className="text-sm text-text-primary">{user?.name || 'Guest'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-text-secondary">Email</span>
            <span className="text-sm text-text-primary">{user?.email || '—'}</span>
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Preferences</h2>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <span className="text-sm text-text-primary">Theme</span>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-1 transition-colors"
          >
            {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </section>

      {/* Sign out */}
      <Button variant="outline" onClick={logout} className="w-fit">
        Sign out
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Wire both pages into router**

In `client/src/router.tsx`, replace stubs with real imports:

```tsx
import { MySongsPage } from '@/spaces/songs/MySongsPage'
import { ProfilePage } from '@/spaces/profile/ProfilePage'

// In routes:
{ path: 'songs', element: <MySongsPage /> },
{ path: 'profile', element: <ProfilePage /> },
```

Remove all remaining stubs.

- [ ] **Step 4: Verify all pages render**

Run: `pnpm dev`
- http://localhost:5173/ → Home hero
- http://localhost:5173/songs → My Songs (empty state)
- http://localhost:5173/profile → Profile with theme toggle

- [ ] **Step 5: Commit**

```bash
git add client/src/spaces/songs/MySongsPage.tsx client/src/spaces/profile/ProfilePage.tsx client/src/router.tsx
git commit -m "feat: add My Songs and Profile pages, remove router stubs"
```

---

## Task 7: Delete Removed Code

**Files:** See deletion list in spec Section 6.

This task removes all dead code. Do it in sub-steps to keep commits reviewable.

- [ ] **Step 1: Delete removed spaces**

```bash
rm -rf client/src/spaces/jam
rm -rf client/src/spaces/editor
rm -rf client/src/spaces/learn
rm -rf client/src/spaces/library
rm -rf client/src/spaces/calendar
rm -rf client/src/spaces/search
rm -rf client/src/spaces/my-projects
rm -rf client/src/spaces/settings
rm -rf client/src/spaces/pricing
```

- [ ] **Step 2: Delete removed components**

```bash
rm -rf client/src/components/calendar
rm -rf client/src/components/library
rm -rf client/src/components/onboarding
rm -f client/src/components/settings/SubscriptionSection.tsx
rm -f client/src/components/agent/HomeAgentSurface.tsx
rm -f client/src/components/agent/QuickActions.tsx
rm -f client/src/components/layout/TopBar.tsx
```

- [ ] **Step 3: Delete removed stores**

```bash
rm -f client/src/stores/calendarStore.ts
rm -f client/src/stores/playlistStore.ts
rm -f client/src/stores/jamStore.ts
rm -f client/src/stores/coachStore.ts
rm -f client/src/stores/practiceAssistStore.ts
```

- [ ] **Step 4: Delete removed data files**

```bash
rm -f client/src/data/chordCharts.ts
rm -f client/src/data/backingTracks.ts
rm -f client/src/data/effectsPresets.ts
rm -f client/src/data/mockSearchResults.ts
```

- [ ] **Step 5: Delete removed server tools**

```bash
rm -f server/src/agent/tools/definitions/jam.tool.ts
rm -f server/src/agent/tools/definitions/calendar.tool.ts
rm -f server/src/agent/tools/definitions/coach.tool.ts
```

- [ ] **Step 6: Rewrite `useAgent` hook to remove deleted dependencies**

This is the hardest cleanup step. `client/src/hooks/useAgent.ts` (~450 lines) imports from deleted stores and spaces:
- `useCalendarStore` (deleted)
- `useJamStore` (deleted)
- `useCoachStore` (deleted)
- `useToneStore` (may be deleted)
- `buildToneAssistantReply` from `@/spaces/jam/toneAssistant` (deleted)

Strip all jam/calendar/coach/tone routing logic from the hook. The hook should only handle:
- Sending messages via `agentService.streamChat()`
- Managing message state via `useAgentStore`
- Navigation tool handling (kept)
- Project tool handling (kept)

Remove all `case` branches in any tool-routing switch that reference jam, calendar, coach, or tone tools. Remove the corresponding imports. This is a substantial rewrite — do NOT just delete import lines.

- [ ] **Step 7: Fix all remaining broken imports**

Run `pnpm typecheck` and fix every remaining import error:
- Remove imports of deleted stores from `AgentPanel.tsx` (`usePracticeAssistStore`, `useToneStore`, `useCoachStore`)
- Remove imports of deleted components from barrel `index.ts` files
- Update `ToolRegistry.ts` / `ToolExecutor.ts` to not register removed tools
- Remove references to deleted data files

Keep fixing until `pnpm typecheck` passes clean.

- [ ] **Step 8: Verify the app builds and runs**

Run: `pnpm build && pnpm dev`
Expected: Clean build, all 4 pages work, no console errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: delete removed spaces, components, stores, data, and server tools"
```

---

## Task 8: Design System Polish

**Files:**
- Modify: `client/src/stores/uiStore.ts`
- Modify: `client/src/styles/tokens.css` (if needed)

- [ ] **Step 1: Default theme to light**

In `client/src/stores/uiStore.ts`, find the `readTheme()` function (around line 5-12) and change the fallback from `'system'` to `'light'`:

```ts
// Change:
return (stored as 'light' | 'dark' | 'system') || 'system'
// To:
return (stored as 'light' | 'dark' | 'system') || 'light'
```

- [ ] **Step 2: Verify light mode is default**

Clear localStorage (`localStorage.removeItem('lava-theme')`), refresh the page. App should render in light mode.

- [ ] **Step 3: Commit**

```bash
git add client/src/stores/uiStore.ts
git commit -m "feat: default theme to light mode per Simple Design System"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `/` — Shows centered hero, heading, subtitle, chat input with attachment button, two chips, recent packs (or empty state)
- [ ] `/pack/demo` — Shows two-zone layout with score area and AI chat
- [ ] `/songs` — Shows pack list or empty state with create button
- [ ] `/profile` — Shows account info, theme toggle, sign out
- [ ] `/settings` — Redirects to `/profile`
- [ ] `/projects` — Redirects to `/songs`
- [ ] `/play/123` — Redirects to `/pack/123`
- [ ] `/anything-else` — Redirects to `/`
- [ ] Sidebar — Icon-only, 3 nav items + logo + plus button
- [ ] Mobile — Bottom tab bar with 3 tabs
- [ ] Light mode is the default
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
