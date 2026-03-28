# LAVA AI — Practice Pack Simplification

**Date:** 2026-03-29
**Approach:** Surgical Simplification (Approach B) — keep core infrastructure, remove unused spaces, rebuild shell + home, compose Practice Pack view from existing components.

---

## Product Vision

Turn any song a user brings in into a playable, shareable Practice Pack within 30 seconds. The product becomes a single-purpose conversion tool: "I want to turn X into Y."

**User stories:**
- "Just learned Don't Look Back in Anger, want to see what it'd sound like as Blues style"
- "Need to play a song at a family gathering but online tabs are too hard"
- "Want to turn a song into fingerpicking arpeggios"
- "Content creator needs high-frequency chart updates"

**Input formats (day one):** Audio files (MP3, WAV, FLAC) and scores (PDF, MusicXML).

**Core flow:** User uploads file + optional text prompt → brief loading → auto-redirect to completed Practice Pack.

---

## Pages

4 pages total. Down from 13 spaces / 20+ routes.

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Centered hero with chat input + file upload |
| New (Practice Pack) | `/new/:id` | View, play, edit a completed pack |
| My Songs | `/songs` | List of saved packs |
| Profile | `/profile` | Account + preferences |

---

## 1. App Shell & Navigation

### Desktop
- **Icon-only sidebar** — ~56px wide, vertically centered icons, no labels.
  - Logo at top of sidebar
  - Plus button (quick shortcut to create — same as Home input)
  - Home (house icon) — `/`
  - My Songs (music icon) — `/songs`
  - Profile (user icon) — `/profile`
- **No global TopBar.** Each page owns its top area.
- **No global AgentPanel side drawer.** The agent lives contextually — in the Home input and inline in the Practice Pack view.

### Mobile
- Sidebar collapses to a bottom tab bar (3 tabs: Home, My Songs, Profile).

### What gets removed
- `TopBar` component
- Sidebar labels, collapsible behavior, settings item in sidebar
- Global `AgentPanel` side drawer
- All nav items for removed pages

---

## 2. Home Page

**Route:** `/`

**Reference:** Lovart.ai home — light background, centered hero, chat input, category chips.

**Layout:** Centered content within icon sidebar area. `max-w-3xl mx-auto`, top padding ~22vh.

### Structure (top to bottom)

1. **Heading** — "Practice any song your way" (48px bold, Title Page style per Simple Design System)
2. **Subtitle** — "Upload a song, get a practice pack in seconds" (16px regular, secondary text color)
3. **Chat input** — full-width textarea within the max-w-3xl container
   - Placeholder: "Describe what you want to practice..."
   - Attachment button (paperclip icon) on the left — file picker for audio (MP3, WAV, FLAC) or score (PDF, MusicXML)
   - Send button on the right
   - File chip shown inside input when file is attached (filename + remove X)
   - Reuses existing `ChatInput` component, extended with attachment support
4. **Chips row** — two pills below input: "Simplified", "Fingerpicking"
   - Tapping prefills the input using existing `ref.current?.setValue()` pattern
5. **Loading state** — after submit, input area transforms into progress indicator
   - Animated states: "Analyzing your song..." → "Creating arrangement..." → "Building practice pack..."
   - Auto-redirects to `/new/:id` when complete
6. **Recent packs** — "Recent" heading with horizontal row of pack cards
   - Each card: thumbnail + song title + style badge
   - Click → `/new/:id`
   - Empty state: "Your practice packs will appear here."

### What gets removed from current HomePage
- Tabs (Songs, Playlists, Tools, Agent)
- Song grid with mock data, playlist picker, cover patterns
- Tool cards, HomeAgentSurface, style category filtering
- All `chordCharts` mock data references

---

## 3. Practice Pack View ("New" page)

**Route:** `/new/:id`

**The core of the product.** Users spend most of their time here.

### Layout — two-zone vertical split

#### Top zone — Score & Playback (~70% of height)
- **Metadata bar** — song title, key, tempo, time signature, style badge. Reuses existing `MetadataBar`.
- **Score viewer** — rendered sheet music, center stage. Reuses `PdfViewer` / score rendering. Real-time cursor/highlight tracks playback position (existing `FollowView` pattern).
- **Version rail** — horizontal pills above the score: "Original", "Simplified", "Fingerpicking", or whatever versions the AI generated. Tapping switches the displayed score. Reuses `ScoreVersionRail` concept restyled as Simple Design System pills.
- **Playback controls** — fixed bar at bottom of score zone. Play/pause, scrub bar, tempo slider, key transpose (+/- semitones). Reuses `LeadSheetPlaybackBar` logic.

#### Bottom zone — AI Editor & Tools (~30% of height, resizable)
- **Chat interface** — conversational AI editing. User types "Make the bridge easier" or "Convert to fingerpicking" or "Change to key of G". AI responds and updates the score in-place.
- Reuses agent streaming infrastructure (`agentService`, `useAgent`, `ChatMessage`, `ChatInput`).
- Tool results appear inline — new arrangement versions show as new tabs in the version rail.

#### Right side actions (small toolbar or menu)
- **Export** — PDF download, shareable link, embed code
- **Share** — copy link, social share
- **Save** — saves to My Songs (auto-saves by default)

#### Mobile layout
- Stacks vertically: score on top (scrollable), playback controls fixed, AI chat in collapsible bottom sheet (swipe up to chat, swipe down to minimize).

### What gets reused
- `MetadataBar`, `PdfViewer`/score rendering, `FollowView`, `LeadSheetPlaybackBar`, `ScoreVersionRail`
- Agent streaming (`agentService.ts`, `useAgent` hook, `ChatInput`, `ChatMessage`)
- `projectStore`, `leadSheetStore` for state

### What's new
- Two-zone layout composition
- Export/share functionality
- File attachment flow (upload → transcription → score)
- Loading/redirect bridge from Home

---

## 4. My Songs Page

**Route:** `/songs`

### Layout
- Page heading: "My Songs" (24px semibold, Heading style)
- **Search input** — single text field to filter by song name
- **Pack list** — vertical list of cards:
  - Song title (primary text)
  - Style badge(s) — "Simplified", "Fingerpicking", etc.
  - Date created (secondary text)
  - Click → `/new/:id`
- **Empty state:** "No songs yet. Head home to create your first practice pack." + button to `/`
- **Delete** — swipe on mobile, hover menu on desktop. Confirmation dialog.

### What gets reused
- `Card` component (restyled)
- `projectStore` (same CRUD, conceptually renamed to packs)
- Project list/load server routes

### What gets removed
- `LibraryPage`, `FilesContent`, `ChordChartGrid`, `BackingTrackGrid`, `EffectsPresetGrid`
- `MyProjectsPage`
- Playlist system

---

## 5. Profile Page

**Route:** `/profile`

### Sections
- **Account** — display name, email. Reuses `AccountSection`.
- **Preferences** — theme toggle (light/dark), default instrument preference. Simplified from current `PreferencesSection`.
- **Sign out** button.

### What gets removed
- `SubscriptionSection`
- Practice plan / calendar preferences

---

## 6. Removal Scope

### Pages/Spaces removed (9 of 13)
- `spaces/jam/` — JamPage, TonePage, tone assistant/model
- `spaces/editor/` — LeadSheetPage (editing capability lives in Practice Pack view now)
- `spaces/library/` — LibraryPage
- `spaces/calendar/` — CalendarPage
- `spaces/search/` — SearchResultsPage
- `spaces/my-projects/` — MyProjectsPage (replaced by My Songs)
- `spaces/pricing/` — PricingPage

### Components removed
- `components/calendar/` — all 5 components
- `components/library/` — all library/file browser components
- `components/settings/SubscriptionSection`
- `components/agent/HomeAgentSurface`
- `components/agent/QuickActions`
- `TopBar`
- `components/onboarding/` — simplified or removed for v1

### Stores removed
- `calendarStore`
- `playlistStore`
- `jamStore`
- `toneStore` (unless needed for playback — evaluate during implementation)
- `coachStore` (coaching merges into AI chat)

### Routes removed
- `/tools/*`, `/editor/*`, `/files`, `/calendar`, `/search`, `/pricing`, `/projects`
- All legacy redirects

### Data files removed
- `chordCharts.ts`, `backingTracks.ts`, `effectsPresets.ts`, `mockSearchResults.ts`

### Server tools simplified
- **Remove:** `jam.tool.ts`, `calendar.tool.ts`, `coach.tool.ts`
- **Keep:** `project.tool.ts`, `audio.tool.ts`, `transcription.tool.ts`, `navigation.tool.ts`
- **Evolve:** `create.tool.ts` handles arrangement generation

### What stays intact
- Agent core (AgentOrchestrator, ConversationManager, ProviderFactory, streaming)
- Audio engine (AudioController, ToneEngine, LoopEngine, Recorder)
- Score components (PdfViewer, ChordGrid, FollowView, MetadataBar, ScoreVersionRail, LeadSheetPlaybackBar)
- DAW panel (playback in Practice Pack view)
- Auth system
- Database schema (projects, audio files, transcriptions)
- Server routes for audio upload + transcription

---

## 7. Design System Alignment

**Source:** Simple Design System (Figma `Cn5QWdJER1ooUKWNMUIAbI`)

### Strategy
Keep existing `tokens.css` dual-theme system. Align light theme to Simple Design System values. Make light mode the default.

### Colors
No major changes needed — existing light theme is close to SDS:
- `--surface-0` = `#ffffff` (matches SDS `background-default`)
- `--surface-1` = `#f7f7f7` (close to SDS `#f5f5f5`)
- `--text-primary` = `#0d0d0d` (close to SDS `#1e1e1e`)
- `--text-secondary` = `#555555` (close to SDS `#757575`)
- Dark mode preserved for user toggle in Profile

### Typography
No change. Already Inter + JetBrains Mono.

### Border radius
SDS uses 8px everywhere. Default new components to `rounded-lg` (8px) instead of `rounded` (4px).

### Spacing
No change. SDS spacing maps directly to Tailwind utilities.

### Buttons
- Primary: dark fill (`bg-accent`), light text — already matches
- Secondary/outline: align to SDS `#e3e3e3` bg + `#767676` border

### Input fields
White bg, `border-border`, `rounded-lg`, `px-4 py-3`. Placeholder in `text-text-muted`.

### Cards
White bg, 1px `border-border`, `rounded-lg`, `p-6` internal padding.

### Key change
**Light mode becomes the default.** Current app defaults to dark. The Simple Design System is light-first, matching the Lovart reference.
