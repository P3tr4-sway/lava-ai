# LAVA AI — Design System Rules

This file governs how AI coding agents implement Figma designs in this repository. Follow every rule here before generating any UI code.

---

## Project Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Class merging | `cn()` from `@/components/ui/utils` |
| Variants | `class-variance-authority` (cva) |
| Icons | `lucide-react` |
| State | Zustand |
| Routing | React Router DOM v6 |
| Audio synthesis | tone.js |
| Audio waveforms | wavesurfer.js |
| Path alias | `@/*` → `client/src/*` |

---

## Commands

```bash
pnpm dev          # Start client (port 5173) + server (port 3001) concurrently
pnpm build        # Build all workspaces
pnpm lint         # Lint all workspaces
pnpm typecheck    # Type-check all workspaces
pnpm clean        # Remove all dist/ and node_modules/
```

> `pnpm dev` runs `scripts/dev.mjs` which kills any processes on ports 3001/5173 then starts both services together.

---

## Monorepo Structure

pnpm workspace with three packages:

```
client/    @lava/client  — React + Vite frontend (port 5173)
server/    @lava/server  — Fastify API server (port 3001)
packages/
  shared/  @lava/shared  — shared types/utils consumed by both
```

Import shared code: `import { ... } from '@lava/shared'`

### Spaces (page organization)

Pages live in `client/src/spaces/<folder>/`. Each space maps to a route group:

| Product name | Folder | Route(s) | Pages |
|---|---|---|---|
| Home | `home` | `/` | `HomePage` — search-first hero, centered `max-w-3xl pt-[22vh]` layout |
| Play | `jam` | `/jam`, `/jam/new`, `/jam/:id` | `PlayHubPage` (hub), `TonePage` (effect pedals editor), `JamPage` (free play) |
| Player | `learn` | `/play/:id` | `SongsPage` — score + accompaniment player |
| Editor | `editor` | `/editor`, `/editor/:id` | `LeadSheetPage` — blank project editor |

New entrance/hub pages should follow the HomePage pattern: centered hero with `max-w-3xl mx-auto px-6 pt-[22vh] flex flex-col gap-10`.

### DAW Panel reuse

`DawPanel` from `@/components/daw/DawPanel` is the shared DAW component. Seed tracks with `useDawPanelStore` + `makeTrack()` on mount, then render at the bottom of a `flex flex-col h-full` layout with `showRecordButton={true} totalBars={16} beatsPerBar={4}`.

### Agent input components

- `ChatInput` — general search input with `forwardRef` and `ChatInputRef.setValue()`
- `SpaceAgentInput` — wraps `ChatInput` for space-specific agent context, also supports `forwardRef` via `SpaceAgentInputRef`
- Both support suggestion-tag patterns: `ref.current?.setValue(text)` to prefill the input

---

## Environment Setup

Copy `.env.example` to `.env` at the repo root before running `pnpm dev`:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (`sk-ant-...`) |
| `LLM_PROVIDER` | `"claude"` or `"openai"` |
| `OPENAI_API_KEY` | Optional, only if using OpenAI |
| `TENCENT_VOD_SECRET_ID` | Tencent Cloud SecretId — enables VOD AIGC mode when set |
| `TENCENT_VOD_SECRET_KEY` | Tencent Cloud SecretKey |
| `TENCENT_VOD_SUB_APP_ID` | Tencent VOD SubAppId (integer) |
| `TENCENT_VOD_CHAT_BASE_URL` | VOD chat endpoint, default `https://text-aigc.vod-qcloud.com/v1` |
| `DATABASE_URL` | SQLite path, default `./data/lava.db` |
| `CLIENT_ORIGIN` | CORS origin, default `http://localhost:5173` |
| `PORT` | Server port, default `3001` |

---

## Server Stack

`server/` runs on **Fastify 4** with the following:

| Layer | Technology |
|---|---|
| HTTP framework | Fastify 4 + @fastify/cors, multipart, rate-limit |
| AI providers | @anthropic-ai/sdk, openai |
| Database | better-sqlite3 + Drizzle ORM |
| Schema validation | Zod |
| Logging | Pino |
| Runtime | tsx watch (dev), compiled JS (prod) |

Source layout: `server/src/` → `agent/`, `config/`, `db/`, `routes/`, `utils/`

### AI Provider routing

- `LLM_PROVIDER=claude` → `ClaudeProvider` (Anthropic SDK)
- `LLM_PROVIDER=openai` → `OpenAIProvider` (OpenAI Node SDK)
  - If `TENCENT_VOD_*` vars are set, auto-exchanges them for an `ApiToken` via `CreateAigcApiToken` (TC3-HMAC-SHA256) then calls the VOD OpenAI-compatible endpoint
  - Freshly issued tokens take ~35 s to activate — first request after server start will be slow; subsequent requests reuse the cached token
  - `stream_options: { include_usage: true }` is incompatible with the Tencent endpoint and is automatically omitted in VOD mode
- `AgentOrchestrator` is a singleton (instantiated once at route registration, not per-request) — token state persists across requests

---

## Figma MCP Integration — Required Workflow

Follow these steps in order for every Figma-driven change. Do not skip steps.

1. Run `get_design_context` with the exact `nodeId` and `fileKey` from the Figma URL
2. If the response is truncated, run `get_metadata` first to get a node map, then re-fetch specific nodes with `get_design_context`
3. Run `get_screenshot` for a visual reference of the node variant being implemented
4. Only after you have both `get_design_context` output and the screenshot, start implementation
5. Translate the output (React + Tailwind with `--sds-*` variables) into this project's conventions (see token mapping below)
6. Validate the final UI against the Figma screenshot for 1:1 visual parity before marking complete

---

## Component Organization

- **Base UI components:** `client/src/components/ui/` — always check here before creating new components
- **Layout components:** `client/src/components/layout/`
- **Feature components:** `client/src/components/agent/`, `client/src/components/daw/`, `client/src/components/library/`, `client/src/components/auth/`, `client/src/components/marketing/`, `client/src/components/onboarding/`, `client/src/components/score/`, `client/src/components/settings/`
- **New UI components:** place in `client/src/components/ui/`
- **New feature components:** place in the closest matching feature subdirectory

### Existing reusable components

Always reuse these before building from scratch:

```tsx
import { Button } from '@/components/ui'
// variants: 'default' | 'ghost' | 'outline' | 'destructive' | 'link'
// sizes: 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm'

import { Card } from '@/components/ui'
// props: hoverable?: boolean

import { Input } from '@/components/ui'
import { Slider } from '@/components/ui'
import { Toggle } from '@/components/ui'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { Badge } from '@/components/ui'
import { Dialog } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui'
import { TaskCard } from '@/components/ui'
import { TaskNotifications } from '@/components/ui'
```

Layout primitives:
```tsx
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { MobileHeader } from '@/components/layout/MobileHeader'
```

---

## Styling Rules

### Class merging — always use `cn()`

```tsx
import { cn } from '@/components/ui/utils'

// Correct
<div className={cn('flex items-center gap-2', isActive && 'bg-surface-2', className)} />
```

### IMPORTANT: Never hardcode colors

All colors are CSS custom properties defined in `client/src/styles/tokens.css`. Reference them through Tailwind's semantic color names:

| Tailwind class | CSS variable | Dark value | Light value |
|---|---|---|---|
| `bg-surface-0` | `--surface-0` | `#000000` | `#ffffff` |
| `bg-surface-1` | `--surface-1` | `#0a0a0a` | `#f7f7f7` |
| `bg-surface-2` | `--surface-2` | `#141414` | `#efefef` |
| `bg-surface-3` | `--surface-3` | `#1e1e1e` | `#e5e5e5` |
| `bg-surface-4` | `--surface-4` | `#282828` | `#d9d9d9` |
| `text-text-primary` | `--text-primary` | `#ffffff` | `#0d0d0d` |
| `text-text-secondary` | `--text-secondary` | `#888888` | `#555555` |
| `text-text-muted` | `--text-muted` | `#555555` | `#ababab` |
| `text-accent` / `bg-accent` | `--accent` | `#e5e5e5` | `#0d0d0d` |
| `text-accent-dim` | `--accent-dim` | `#a0a0a0` | `#444444` |
| `border-border` | `--border` | `#1e1e1e` | `#e5e5e5` |
| `border-border-hover` | `--border-hover` | `#333333` | `#cccccc` |
| `text-error` / `bg-error` | `--error` | `#ef4444` | `#ef4444` |
| `text-success` | `--success` | `#22c55e` | `#22c55e` |
| `text-warning` | `--warning` | `#f59e0b` | `#f59e0b` |

### Border radius — use project tokens

| Tailwind | CSS variable | Value |
|---|---|---|
| `rounded` | `--radius` | `4px` |
| `rounded-md` | `--radius-md` | `6px` |
| `rounded-lg` | `--radius-lg` | `8px` |

### Typography — project fonts

| Tailwind class | Font |
|---|---|
| `font-sans` | Inter, system-ui, sans-serif |
| `font-mono` | JetBrains Mono, Fira Code, monospace |

---

## Figma `--sds-*` Token → Project Token Mapping

The Figma design uses Figma's Standard Design System (`--sds-*`) tokens. Always translate them to this project's equivalents:

### Colors

| Figma `--sds-*` token | Figma fallback | Project equivalent |
|---|---|---|
| `--sds-color-background-default-default` | `white` | `bg-surface-0` |
| `--sds-color-background-default-secondary` | `#f5f5f5` | `bg-surface-1` |
| `--sds-color-background-neutral-tertiary` | `#e3e3e3` | `bg-surface-3` |
| `--sds-color-background-brand-default` | `#2c2c2c` | `bg-surface-4` (dark) / `bg-accent` |
| `--sds-color-background-brand-tertiary` | `#f5f5f5` | `bg-surface-1` |
| `--sds-color-text-default-default` | `#1e1e1e` | `text-text-primary` |
| `--sds-color-text-default-secondary` | `#757575` | `text-text-secondary` |
| `--sds-color-text-brand-on-brand` | `#f5f5f5` | `text-accent` |
| `--sds-color-text-brand-on-brand-secondary` | `#1e1e1e` | `text-text-primary` |
| `--sds-color-border-default-default` | `#d9d9d9` | `border-border` |
| `--sds-color-border-neutral-secondary` | `#767676` | `border-border-hover` |
| `--sds-color-border-brand-default` | `#2c2c2c` | `border-border` |
| `--sds-color-slate-200` | `#e3e3e3` | `bg-surface-3` |

### Spacing (`--sds-size-space-*`)

| Figma token | Value | Tailwind |
|---|---|---|
| `--sds-size-space-200` | 8px | `p-2` / `gap-2` / `m-2` |
| `--sds-size-space-300` | 12px | `p-3` / `gap-3` |
| `--sds-size-space-400` | 16px | `p-4` / `gap-4` |
| `--sds-size-space-600` | 24px | `p-6` / `gap-6` |
| `--sds-size-space-800` | 32px | `p-8` / `gap-8` |
| `--sds-size-space-1200` | 48px | `p-12` / `gap-12` |
| `--sds-size-space-1600` | 64px | `p-16` / `gap-16` |
| `--sds-size-space-4000` | 160px | `py-40` |

### Border radius

| Figma token | Value | Tailwind |
|---|---|---|
| `--sds-size-radius-200` | 8px | `rounded-lg` |
| `--sds-size-radius-full` | 9999px | `rounded-full` |

### Typography (`--sds-typography-*`)

| Figma style | Size | Weight | Tailwind |
|---|---|---|---|
| Title Hero | 72px, bold, lh 1.2, ls -3 | Bold | `text-[72px] font-bold leading-tight tracking-tighter` |
| Subtitle | 32px, regular, lh 1.2 | Regular | `text-3xl leading-tight` |
| Heading | 24px, semi-bold, lh 1.2, ls -0.48 | SemiBold | `text-2xl font-semibold leading-tight tracking-tight` |
| Subheading | 20px, regular, lh 1.2 | Regular | `text-xl leading-tight` |
| Body Base | 16px, regular, lh 1.4 | Regular | `text-base leading-normal` |
| Body Strong | 16px, semi-bold, lh 1.4 | SemiBold | `text-base font-semibold leading-normal` |
| Single Line Body | 16px, regular, lh 1 | Regular | `text-base leading-none` |

---

## Icons

- **IMPORTANT:** Use `lucide-react` for all icons. Do not install other icon libraries.
- Search lucide for the matching icon before creating custom SVGs.

```tsx
import { ChevronDown, Search, X, Menu } from 'lucide-react'
// Default icon size: className="size-4" or "size-5"
```

- Only use Figma asset URLs (from `get_design_context`) for non-icon images (photos, illustrations, brand marks).

---

## Asset Handling

- **IMPORTANT:** If `get_design_context` returns a `https://www.figma.com/api/mcp/asset/...` URL for an image or SVG, use that source directly — do not create placeholders.
- Static assets belong in `client/public/`
- Do not import or install new image/icon packages

```tsx
// Correct — use Figma MCP asset URL directly
const imgHero = "https://www.figma.com/api/mcp/asset/..."
<img src={imgHero} alt="Hero" className="w-full object-cover" />
```

---

## Layout Tokens

Use CSS variables for app shell dimensions (already defined in `tokens.css`):

```css
var(--sidebar-width)           /* 240px */
var(--sidebar-collapsed-width) /* 56px  */
var(--topbar-height)           /* 48px  */
var(--agent-panel-width)       /* 360px */
var(--bottom-nav-height)       /* 56px  */
```

---

## Animations

Use the two project animations for UI transitions:

```tsx
// Fade in  — className="animate-fade-in"   (150ms ease-out)
// Slide in — className="animate-slide-in-right" (200ms ease-out)
```

---

## TypeScript Conventions

- Strict mode — no `any`
- All component props typed with interfaces
- Always accept and spread `className?: string` for composability
- Export components as named exports from barrel `index.ts`

```tsx
interface MyComponentProps {
  className?: string;
  variant?: 'default' | 'secondary';
  children?: React.ReactNode;
}

export function MyComponent({ className, variant = 'default', children }: MyComponentProps) {
  return (
    <div className={cn('...', variant === 'secondary' && '...', className)}>
      {children}
    </div>
  );
}
```

---

## Figma Design Patterns — Component Notes

From the design file (`5kHaKzGmOD9Qr74lYmI6p5`):

- **Card** — use `flex-1` / `min-w-[240px]` when placed in grids so width is driven by parent auto layout (not fixed 440px as in the component set)
- **Button Group** — renders action sets; map to `<Button>` variants from `@/components/ui`
- **Navigation Pill** — active state uses `bg-surface-1` background; inactive is transparent
- **Header layout** — `flex flex-wrap items-center justify-between gap-6 px-8 py-8 border-b border-border`
- **Hero section** — centered content with `py-40`, secondary background `bg-surface-1`
- **Card Grid** — `flex flex-wrap gap-12` at section level; cards use `flex-1 min-w-[240px]`
- **Footer** — `flex flex-wrap gap-4 px-8 pt-8 border-t border-border`

---

## What NOT to do

- Do not place static routes after dynamic `:id` routes — e.g. `/jam/new` must come before `/jam/:id` in `router.tsx`
- Do not hardcode hex colors — always use Tailwind tokens above
- Do not install Tailwind (already configured)
- Do not install Radix UI, Headless UI, or shadcn/ui — components are custom
- Do not use `style={{ }}` inline styles for colors or spacing
- Do not create absolute pixel sizes from Figma without first checking if a Tailwind scale value matches
- Do not copy `--sds-*` variable names directly into the codebase — always translate to project tokens
