# LAVA AI

AI-powered music learning and creation platform. Monorepo: React client + Express server.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5 (strict) |
| Styling | Tailwind CSS 3, CSS custom properties (`tokens.css`), `cn()` (clsx + twMerge) |
| State | Zustand |
| Audio | Tone.js, wavesurfer.js |
| Routing | React Router DOM v6 |
| Server | Express, better-sqlite3 |
| Monorepo | pnpm workspaces — `client/`, `server/`, `packages/shared/` |
| Path alias | `@/*` → `client/src/*` |

## Commands

- `pnpm dev` — client (5173) + server concurrently
- `pnpm build` / `pnpm lint` / `pnpm typecheck`
- Claude Code: use `preview_start("dev")` (config in `.claude/launch.json`)

## Project Structure

```
client/src/
  spaces/           ← page-level components (one dir per route)
  components/
    ui/             ← primitives — check index.ts barrel before creating new ones
    layout/         ← AppShell, Sidebar, TopBar, BottomNav, MobileHeader
    agent/          ← AI agent panel and chat
    daw/            ← DAW components
    score/          ← ChordGrid, MetadataBar, PdfViewer
  stores/           ← Zustand stores — check existing before adding
  hooks/            ← useQuery, useMutation, useAutoSave, useRequireAuth, etc.
  audio/            ← AudioController, ToneEngine, Recorder
  services/         ← API helpers (api.get/post), caches, YouTube service
  styles/           ← tokens.css (design tokens)
server/src/
  routes/           ← agent, audio, jam, pdf, project, transcription, youtube, tools
packages/shared/    ← shared TypeScript types
```

## Active Routes & Navigation

Sidebar nav: **Home** (`/`) · **Play** (`/jam`) · **My Projects** (`/projects`) · **New Sheet** (`/editor`)

| Route | Page | Space dir |
|---|---|---|
| `/` | HomePage | `home/` |
| `/play/:id` | SongsPage (unified player) | `learn/SongsPage` |
| `/jam` | PlayHubPage (play hub) | `jam/` |
| `/jam/:id` | JamPage (jam session) | `jam/` |
| `/editor`, `/editor/:id` | LeadSheetPage | `editor/` |
| `/projects` | MyProjectsPage | `my-projects/` |
| `/search` | SearchResultsPage | `search/` |
| `/settings` | SettingsPage | `settings/` |
| `/pricing` | PricingPage | `pricing/` |
| `/login`, `/signup` | Auth pages (outside AppShell) | `auth/` |

**Redirects:** `/learn` → `/`, `/create` → `/`, `/library` → `/projects`

### Dead / inactive spaces — DO NOT build on these

These directories exist in `spaces/` but are **not routed or navigable**. They are leftover from earlier iterations. Do not reference, extend, or link to them:

`learn/LearnPage` · `create/` · `library/` · `tools/` · `backing-tracks/` · `chord-charts/`

> **Note:** `learn/SongsPage.tsx` is still actively used as the player at `/play/:id`, but `learn/LearnPage.tsx` is dead.

## Stores (`client/src/stores/`)

`audioStore` · `authStore` · `dawPanelStore` · `dawStore` · `leadSheetStore` · `jamStore` · `taskStore` · `projectStore` · `uiStore` · `agentStore`

## Data Fetching

Use `useQuery(key, fetcher)` and `useMutation(fn)` from `hooks/`. Never use raw `fetch` — use `api.get()` / `api.post()` from `@/services/api`.

Other hooks: `useRequireAuth()` (auth guard) · `useAutoSave` · `useProjectSave` · `useLeadSheetAutoSave` · `useTaskPoller` (global, mounted in AppShell)

## UI Components (`@/components/ui`)

Import from barrel. Reuse before creating new ones:

`Button` (variants: default/ghost/outline/destructive/link, sizes: sm/default/lg/icon/icon-sm) · `Card` · `Input` · `Slider` · `Toggle` · `Tabs` · `Dialog` · `Avatar` · `Badge` · `TaskCard` · `TaskNotifications` · `ToastProvider` / `useToast`

## Styling

### Design tokens (use these, never hardcode colors)

**Surfaces:** `bg-surface-0` → `bg-surface-4`
**Text:** `text-text-primary` · `text-text-secondary` · `text-text-muted`
**Accent:** `text-accent` / `bg-accent` · `text-accent-dim`
**Border:** `border-border` · `border-border-hover`
**Status:** `text-error` · `text-success` · `text-warning`
**Radius:** `rounded` (8px) · `rounded-md` (12px) · `rounded-lg` (16px)

### Layout tokens

`--sidebar-width: 240px` · `--sidebar-collapsed-width: 56px` · `--topbar-height: 48px` · `--agent-panel-width: 360px` · `--bottom-nav-height: 56px`

### Class merging — always use `cn()`

```tsx
import { cn } from '@/components/ui/utils'
<div className={cn('flex gap-2', isActive && 'bg-surface-2', className)} />
```

## Icons

`lucide-react` only. Default: `className="size-4"` or `"size-5"`.

## TypeScript

- Strict mode, no `any`
- Props typed with `interface`, always accept `className?: string`
- Named exports from barrel `index.ts`

## Figma

File key: `5kHaKzGmOD9Qr74lYmI6p5`. Always translate `--sds-*` tokens to project tokens. Get design context + screenshot before implementing.

## Don'ts

- No hardcoded hex colors — use Tailwind tokens
- No `style={{ }}` for colors/spacing
- No raw `fetch` — use `api` service
- No new stores without checking existing ones
- No installing Tailwind/Radix/shadcn/Headless UI — already configured
- No building on dead spaces (learn/LearnPage, create, library, tools, backing-tracks, chord-charts)
