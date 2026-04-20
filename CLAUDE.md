# LAVA AI — Agent Rules

How AI coding agents work in this repo. Follow these rules, not just during Figma-driven changes.

---

## Stack

| Layer | Technology |
|---|---|
| Client | React 18 + Vite 5, TypeScript 5 strict, Tailwind 3 + CSS custom properties |
| Server | Fastify 4, better-sqlite3 + Drizzle, Zod, Pino, tsx watch (dev) |
| State | Zustand |
| Routing | React Router DOM v6 |
| Audio | tone.js (synth), wavesurfer.js (waveforms) |
| Icons | `lucide-react` (never install other icon libs) |
| Class merging | `cn()` from `@/components/ui/utils` |
| Variants | `class-variance-authority` (cva) |
| Path alias | `@/*` → `client/src/*` |

---

## Commands

```bash
pnpm dev          # Client (5173) + server (3001) concurrently
pnpm build        # Build all workspaces
pnpm lint         # Lint all workspaces
pnpm typecheck    # Type-check all workspaces
```

`pnpm dev` runs `scripts/dev.mjs` — kills existing processes on 3001/5173, then starts both.

---

## Monorepo

pnpm workspace, three packages:

```
client/    @lava/client  — React + Vite frontend (5173)
server/    @lava/server  — Fastify API (3001)
packages/shared/ @lava/shared — shared types/utils
```

Import shared: `import { ... } from '@lava/shared'`

### Spaces (page organization)

Pages live in `client/src/spaces/<folder>/`:

| Product | Folder | Routes |
|---|---|---|
| Home | `home` | `/` |
| Play | `jam` | `/jam`, `/jam/new`, `/jam/:id` |
| Player | `learn` | `/play/:id` |
| Editor | `pack` | `/editor`, `/editor/:id` |

Entrance/hub pages follow the HomePage pattern: `max-w-3xl mx-auto px-6 pt-[22vh] flex flex-col gap-10`.

### Reuse patterns

- **`DawPanel`** (`@/components/daw/DawPanel`) — seed tracks with `useDawPanelStore` + `makeTrack()` on mount, render at bottom of `flex flex-col h-full` layout.
- **`ChatInput` / `SpaceAgentInput`** — both support `forwardRef`; use `ref.current?.setValue(text)` to prefill.
- Always check `client/src/components/ui/` (barrel `index.ts`) before creating new primitives.

---

## Environment

Copy `.env.example` to `.env` before `pnpm dev`.

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic key |
| `LLM_PROVIDER` | `"claude"` or `"openai"` |
| `OPENAI_API_KEY` | Only if `LLM_PROVIDER=openai` |
| `TENCENT_VOD_SECRET_ID` / `_SECRET_KEY` / `_SUB_APP_ID` | Setting these enables VOD AIGC mode |
| `TENCENT_VOD_CHAT_BASE_URL` | Default `https://text-aigc.vod-qcloud.com/v1` |
| `DATABASE_URL` | Default `./data/lava.db` |
| `CLIENT_ORIGIN` | CORS origin, default `http://localhost:5173` |
| `PORT` | Server port, default `3001` |

### AI provider gotchas

- `LLM_PROVIDER=openai` + `TENCENT_VOD_*` set → auto-exchanges creds for an `ApiToken` via `CreateAigcApiToken` (TC3-HMAC-SHA256) and calls the VOD OpenAI-compatible endpoint.
- **Fresh VOD tokens take ~35 s to activate** — first request after server start is slow; subsequent requests reuse the cached token.
- `stream_options: { include_usage: true }` is incompatible with the Tencent endpoint and is auto-stripped in VOD mode.
- `AgentOrchestrator` is a singleton (instantiated once at route registration) — token state persists across requests.

---

## Styling

- Use `cn()` for all class merging: `<div className={cn('flex gap-2', isActive && 'bg-surface-2', className)} />`
- **Never hardcode hex colors.** All colors are Tailwind semantic tokens backed by CSS variables in [tokens.css](client/src/styles/tokens.css). Use `bg-surface-{0-4}`, `text-text-{primary,secondary,muted}`, `text-accent`, `border-border`, `text-{error,success,warning}`.
- **Never use `style={{ }}`** for colors or spacing.
- **Never copy Figma `--sds-*` variables** into source — translate to project tokens. Most are mechanical: `--sds-color-background-default-default` → `bg-surface-0`, `--sds-color-text-default-default` → `text-text-primary`, `--sds-size-space-400` (16px) → `p-4`/`gap-4`, `--sds-size-radius-200` (8px) → `rounded-lg`.
- Layout shell dimensions: `var(--sidebar-width)`, `var(--topbar-height)`, `var(--agent-panel-width)`, etc. — see [tokens.css](client/src/styles/tokens.css).
- Animations: `animate-fade-in` (150 ms) and `animate-slide-in-right` (200 ms).
- Icon size default: `size-4` or `size-5`.

---

## Figma MCP Workflow

Do these in order, no skipping:

1. `get_design_context` with exact `nodeId` + `fileKey` from the Figma URL.
2. If truncated → `get_metadata` first for a node map, then refetch specific nodes.
3. `get_screenshot` for visual reference.
4. Only now start implementation. Translate `--sds-*` tokens → project tokens (see Styling).
5. Validate final UI against the screenshot for 1:1 parity before marking complete.

If `get_design_context` returns a `figma.com/api/mcp/asset/...` URL for a non-icon image, use it directly — do not create placeholders. Static assets → `client/public/`.

---

## TypeScript

- Strict — no `any`. All component props typed with interfaces.
- Always accept and spread `className?: string`.
- Export components as named exports from barrel `index.ts`.

---

## Editor Space (`client/src/spaces/pack/`)

Key files:
- `EditorPage.tsx` — top-level; owns `handleAddBar`, `handleDeleteBars`, keyboard hook.
- `EditorCanvas.tsx` — score render, event handlers, overlays.
- `EditorToolbar.tsx` — toolbar + training-wheel toggles.
- `useEditorKeyboard.ts` — keyboard shortcut dispatcher (dispatches `lava-*` events).
- `useScoreSync.ts` — DOM sync for highlights, beat markers, playhead.

### MusicXML engine

`@/lib/musicXmlEngine` — pure functions, no side effects:
`addBars`, `deleteBars`, `clearBars`, `copyBars`, `pasteBars`, `duplicateBars`, `transposeBars`, `setNotePitch`, `setNoteDuration`, `addAccidental`, `toggleTie`, `toggleRest`, `setLyric`, `setAnnotation`, `parseXml`, `getMeasures`.

### Stores

- `useEditorStore` — selection, toolMode, undo/redo, saveStatus, showChordDiagrams, showBeatMarkers.
- `useLeadSheetStore` — `musicXml`, `setMusicXml`.
- `useAudioStore` — `transportState`, `setCurrentBar`.

### Undo/Redo pattern

Call `pushUndo(xml)` **after** the engine call succeeds, inside the `try`:

```ts
try {
  const newXml = engineFn(xml, ...)   // engine first
  pushUndo(xml)                        // then undo
  setMusicXml(newXml)                  // then persist
} catch (err) { ... }
```

### Zustand callbacks — read fresh state

Use `useStore.getState()` inside callbacks; hook subscriptions become stale closures:

```ts
const handleFoo = useCallback(() => {
  const { selectedBars } = useEditorStore.getState()  // fresh
}, [])
```

### Custom event bus

Keyboard shortcuts dispatch `window.dispatchEvent(new CustomEvent('lava-*'))`. EditorCanvas registers all listeners in one `useEffect` (with cleanup). Events: `lava-pitch-step`, `lava-duration-key`, `lava-accidental`, `lava-toggle-tie`, `lava-toggle-rest`, `lava-copy`, `lava-paste`, `lava-duplicate`, `lava-transpose`, `lava-toggle-dot`, `lava-toggle-triplet`, `lava-bar-delete`, `lava-open-fretboard`, `lava-open-duration`.

### Pitch utilities

`@/lib/pitchUtils` — `Pitch { step, octave, alter? }`, `pitchToMidi`, `midiToPitch(midi, preferFlat?)`, `stepDiatonic`.

### OSMD DOM conventions

- Measures: `.vf-measure[id="N"]` (1-indexed).
- Notes: `#note-{barIndex}-{noteIndex}` (0-indexed).
- Beat markers: SVG `<line class="lava-beat-marker">` injected inside measure SVG.

---

## Planning discipline

### Tiering — decide in 5 seconds which level applies

Judge by **touch surface**, not line count. One-line change to a React `key` can be tier C; 500-line refactor inside one pure function can be tier A.

| Tier | When | Plan format |
|---|---|---|
| **A** | Copy / styling / logs / typo / single-file pure-function internals / mechanical repeat of existing pattern | Just do it, no plan |
| **B** | New self-contained component / 2–3 files, single concern / local signature change | 3–5 line preamble: goal + surface + how to verify |
| **C** | Touches store / global listener / selection / routing / new `<input>` or `<select>` / changes a React `key` or memo dep / 3+ files crossing interaction modes | Full five-section plan + boundary grep |

Red flags — seeing any of these in the task or surrounding code bumps to **at least C**:

- `window.addEventListener` / `document.addEventListener` in scope
- `setPointerCapture` / `.focus()` / `onKeyDown` / `onKeyUp`
- Adding `<input>` / `<textarea>` / `<select>` / `contenteditable` anywhere under the editor
- Changing what goes into a React `key={...}`
- Writing to `cursor` / `selection` / `ast` or touching undo/redo

If none of the above apply, default to tier A. Don't write plan sections nobody will read.

### Plan template (tier C)

Write these five short sections per task — one-liners, no code blocks:

| Section | Contents |
|---|---|
| Contract | Input/output signature + runtime invariants |
| Surface | Stores / events / DOM this reads and writes |
| Boundary audit | Interactions with existing global listeners, commands, selection consumers |
| Traps | 1–5 project-specific pitfalls (not generic React advice) |
| Gate | Browser evidence required to exit this task — **not** "tests pass" |

### Boundary grep (before confirming any plan)

```bash
grep -rn "window.addEventListener" client/src
grep -rn "document.addEventListener" client/src
grep -rn "setPointerCapture\|\.focus()" client/src
```

For each hit, answer: does this change affect it, or does it affect this change? Paste relevant hits into the plan's Boundary audit section.

Known landmine: `useTabEditorInput.ts` registers a `window` keydown handler — any new `<input>` / `<textarea>` / `<select>` in the editor subtree requires the global handler to early-return when `e.target` is editable, otherwise digit / letter keys get hijacked.

### Completion reporting

- **Pure logic / data layer** — unit tests + typecheck passing is sufficient to report "complete".
- **Interactive changes** (UI / pointer / focus / keyboard / selection / drag) — never report complete on unit tests alone. Either run Claude Preview / Playwright MCP end-to-end, or explicitly hand off: *"Unit tests pass. Please verify in browser: [specific actions]."*

jsdom no-ops `setPointerCapture`, skips real focus routing, and doesn't route window keydown the way a real browser does. Static checks are necessary but not sufficient for interaction code.

### React event-time reasoning

Before writing code that mixes pointer events, `key={}`, controlled inputs, or effects that dispatch commands, mentally walk the timeline:

> T0 user action → T1 React handler → T2 setState → T3 re-render → T4 DOM diff (what keys change?) → T5 next event (where does it go?)

If step T4 or T5 is unclear, the code is risky. Classic foot-gun: putting mutable values inside a React `key` while holding `setPointerCapture` — key change remounts the node and drops the capture.

---

## What NOT to do

- Don't edit root `eslint.config.js` for client rules — client ESLint lives in `client/eslint.config.js`.
- Don't place static routes after dynamic `:id` routes — e.g. `/jam/new` must come before `/jam/:id` in `router.tsx`.
- Don't hardcode hex colors or use `style={{ }}` for colors/spacing.
- Don't install Tailwind, Radix UI, Headless UI, or shadcn/ui — components are custom.
- Don't create absolute pixel sizes without first checking a matching Tailwind scale.
- Don't copy `--sds-*` variable names into source.
