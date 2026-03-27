import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePenLine,
  Headphones,
  Heart,
  Monitor,
  Music2,
  Moon,
  Search,
  Sun,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/components/ui/utils'
import { HomeAgentSurface } from '@/components/agent/HomeAgentSurface'
import { PlaylistPickerDialog } from '@/components/library/PlaylistPickerDialog'
import { SongActionModal } from '@/components/score'
import { CHORD_CHARTS, type ChordChart } from '@/data/chordCharts'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useAgentStore } from '@/stores/agentStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useAgent } from '@/hooks/useAgent'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'
import { useTheme } from '@/hooks/useTheme'
import {
  DEFAULT_HOME_SECTION,
  getHomeSectionFromSearch,
  HOME_NAV_RESET_EVENT,
  HOME_SECTION_ITEMS,
  HOME_SECTION_QUERY_PARAM,
  type HomeSectionId,
} from '@/components/layout/navItems'

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type SongStatus = 'New' | 'In Progress' | 'Saved'
type HomeInputTab = Exclude<HomeSectionId, 'agent'>
type CoverPattern = 'studio' | 'sunrise' | 'grid' | 'spotlight' | 'duo' | 'night'

interface HomeSongMeta {
  difficulty: Difficulty
  status: SongStatus
  badge: string
  pattern: CoverPattern
  playlistIds: string[]
}

interface PlaylistDefinition {
  id: string
  title: string
  songIds: string[]
}

interface StyleCategoryDefinition {
  id: string
  title: string
  badge: string
  subtitle: string
  query: string
  pattern: CoverPattern
}

interface ContinueCardData {
  id: string
  section: string
  progress: number
}

interface ToolCardData {
  icon: LucideIcon
  title: string
  meta: string
  description?: string
  action: 'plan' | 'tools' | 'editor'
}

interface HomeInputConfig {
  label: string
  placeholder: string
  chipPrefix: string
  suggestions: string[]
}

interface SongCardProps {
  song: ChordChart
  meta: HomeSongMeta
  saved: boolean
  progress?: number
  section?: string
  onClick: () => void
  onSave: () => void
}

interface PlaylistCardProps {
  playlist: PlaylistDefinition
  songs: ChordChart[]
  onClick: () => void
}

const HOME_INPUT_CONFIG: Record<HomeInputTab, HomeInputConfig> = {
  songs: {
    label: 'Song',
    placeholder: 'Search songs, artists, or paste a YouTube link',
    chipPrefix: 'Trending:',
    suggestions: ['Wonderwall', 'Hotel California', 'Easy beginner songs', 'Fingerstyle acoustic songs'],
  },
  playlists: {
    label: 'Chord chart',
    placeholder: 'Search chord charts, keys, artists, or playlists',
    chipPrefix: 'Browse by:',
    suggestions: ['Starter Pack', 'Key G', 'Beginner', 'Rock'],
  },
  tools: {
    label: 'Tool command',
    placeholder: 'Describe what you want to do, like a tone, backing track, or plan',
    chipPrefix: 'Try:',
    suggestions: ['Metronome at 90 BPM', 'Tune to standard EADGBE', 'Build a practice plan', 'Open chart editor'],
  },
}

const HOME_LIBRARY_IDS = [
  'wonderwall',
  'let-her-go',
  'wish-you-were-here',
  'hotel-california',
  'anjo-de-mim',
  '1',
  '2',
  '4',
  '6',
  '7',
  '8',
  '9',
]

const HOME_SONG_META: Record<string, HomeSongMeta> = {
  wonderwall: {
    difficulty: 'Beginner',
    status: 'In Progress',
    badge: 'Picked',
    pattern: 'studio',
    playlistIds: ['recently-saved', 'starter-pack', 'singalong'],
  },
  'let-her-go': {
    difficulty: 'Beginner',
    status: 'Saved',
    badge: 'Easy',
    pattern: 'sunrise',
    playlistIds: ['recently-saved', 'starter-pack', 'late-night'],
  },
  'wish-you-were-here': {
    difficulty: 'Intermediate',
    status: 'In Progress',
    badge: 'Popular',
    pattern: 'duo',
    playlistIds: ['recently-saved', 'acoustic-night', 'late-night'],
  },
  'hotel-california': {
    difficulty: 'Advanced',
    status: 'Saved',
    badge: 'Focus',
    pattern: 'spotlight',
    playlistIds: ['acoustic-night', 'singalong'],
  },
  'anjo-de-mim': {
    difficulty: 'Intermediate',
    status: 'New',
    badge: 'New',
    pattern: 'night',
    playlistIds: ['acoustic-night'],
  },
  '1': {
    difficulty: 'Intermediate',
    status: 'New',
    badge: 'Jazz',
    pattern: 'grid',
    playlistIds: ['starter-pack'],
  },
  '2': {
    difficulty: 'Beginner',
    status: 'New',
    badge: 'Starter',
    pattern: 'sunrise',
    playlistIds: ['starter-pack'],
  },
  '4': {
    difficulty: 'Beginner',
    status: 'New',
    badge: 'Slow',
    pattern: 'studio',
    playlistIds: ['starter-pack'],
  },
  '6': {
    difficulty: 'Advanced',
    status: 'Saved',
    badge: 'Tech',
    pattern: 'duo',
    playlistIds: ['acoustic-night'],
  },
  '7': {
    difficulty: 'Intermediate',
    status: 'New',
    badge: 'Groove',
    pattern: 'grid',
    playlistIds: ['singalong'],
  },
  '8': {
    difficulty: 'Intermediate',
    status: 'New',
    badge: 'Upbeat',
    pattern: 'spotlight',
    playlistIds: ['singalong'],
  },
  '9': {
    difficulty: 'Advanced',
    status: 'New',
    badge: 'Late',
    pattern: 'night',
    playlistIds: ['late-night'],
  },
}

const DEFAULT_COLLECTION_META: HomeSongMeta = {
  difficulty: 'Intermediate',
  status: 'Saved',
  badge: 'Chart',
  pattern: 'studio',
  playlistIds: [],
}

const CONTINUE_PRACTICE: ContinueCardData[] = [
  { id: 'wish-you-were-here', section: 'Chorus', progress: 45 },
  { id: 'wonderwall', section: 'Verse', progress: 68 },
  { id: 'let-her-go', section: 'Intro', progress: 24 },
]

const SONG_SHELVES = [
  {
    id: 'practice-now',
    title: 'Start now',
    songIds: ['wonderwall', 'hotel-california', '2', '7', 'anjo-de-mim', '1'],
  },
  {
    id: 'beginner',
    title: 'Beginner picks',
    songIds: ['wonderwall', 'let-her-go', '2', '4', '7', '8'],
  },
] as const

const STYLE_CATEGORIES: StyleCategoryDefinition[] = [
  {
    id: 'blues-rock',
    title: 'Blues Rock',
    badge: 'Drive',
    subtitle: 'Warm gain, bends, and expressive phrasing.',
    query: 'blues rock guitar songs',
    pattern: 'studio',
  },
  {
    id: 'classic-rock',
    title: 'Classic Rock',
    badge: 'Riffs',
    subtitle: 'Big hooks, open chords, and timeless solo language.',
    query: 'classic rock guitar songs',
    pattern: 'spotlight',
  },
  {
    id: 'hard-rock',
    title: 'Hard Rock',
    badge: 'Gain',
    subtitle: 'Power chords, punchy rhythm, and heavier attitude.',
    query: 'hard rock guitar songs',
    pattern: 'night',
  },
  {
    id: 'funk',
    title: 'Funk',
    badge: 'Rhythm',
    subtitle: 'Tight muting, syncopation, and clean groove playing.',
    query: 'funk guitar songs',
    pattern: 'grid',
  },
  {
    id: 'indie-rock',
    title: 'Indie Rock',
    badge: 'Texture',
    subtitle: 'Chimey layers, pedals, and melodic rhythm parts.',
    query: 'indie rock guitar songs',
    pattern: 'duo',
  },
  {
    id: 'metal',
    title: 'Metal',
    badge: 'Precision',
    subtitle: 'Palm mutes, fast attack, and tight heavy picking.',
    query: 'metal guitar songs',
    pattern: 'spotlight',
  },
]

const GUEST_PLAYLISTS: PlaylistDefinition[] = [
  {
    id: 'starter-pack',
    title: 'Starter Pack',
    songIds: ['wonderwall', '2', '4'],
  },
  {
    id: 'singalong',
    title: 'Singalong Favorites',
    songIds: ['hotel-california', '8', '7'],
  },
  {
    id: 'late-night',
    title: 'Late Night Acoustic',
    songIds: ['let-her-go', 'wish-you-were-here', '9'],
  },
]

const RANDOM_SONG_POOL = HOME_LIBRARY_IDS
  .map((songId) => CHORD_CHARTS.find((chart) => chart.id === songId))
  .filter((song): song is ChordChart => Boolean(song))
  .filter((song) => Boolean(song.artist))

const PRACTICE_TOOLS: ToolCardData[] = [
  {
    icon: Clock3,
    title: 'Metronome',
    meta: 'Tempo',
    action: 'tools',
  },
  {
    icon: Music2,
    title: 'Tuner',
    meta: 'Tune',
    action: 'tools',
  },
  {
    icon: CalendarDays,
    title: 'Practice Plan',
    meta: 'Coach',
    action: 'plan',
  },
  {
    icon: Waves,
    title: 'Backing Track Jam',
    meta: 'Groove',
    action: 'tools',
  },
  {
    icon: Headphones,
    title: 'Tone Builder',
    meta: 'Sound',
    action: 'tools',
  },
  {
    icon: FilePenLine,
    title: 'Quick Notes',
    meta: 'Capture',
    action: 'editor',
  },
]

const ARTWORK_VARIANTS: Record<
  CoverPattern,
  {
    container: CSSProperties
    glow: CSSProperties
  }
> = {
  studio: {
    container: { background: 'color-mix(in srgb, var(--warning) 74%, white 26%)' },
    glow: { background: 'color-mix(in srgb, white 42%, var(--warning) 58%)' },
  },
  sunrise: {
    container: { background: 'color-mix(in srgb, var(--error) 72%, white 28%)' },
    glow: { background: 'color-mix(in srgb, white 46%, var(--error) 54%)' },
  },
  grid: {
    container: { background: 'color-mix(in srgb, var(--success) 76%, white 24%)' },
    glow: { background: 'color-mix(in srgb, white 44%, var(--success) 56%)' },
  },
  spotlight: {
    container: { background: 'color-mix(in srgb, var(--accent) 84%, white 16%)' },
    glow: { background: 'color-mix(in srgb, white 22%, var(--accent) 78%)' },
  },
  duo: {
    container: { background: 'color-mix(in srgb, var(--success) 48%, var(--warning) 52%)' },
    glow: { background: 'color-mix(in srgb, white 38%, var(--success) 62%)' },
  },
  night: {
    container: { background: 'color-mix(in srgb, var(--error) 42%, var(--surface-0) 58%)' },
    glow: { background: 'color-mix(in srgb, white 12%, var(--error) 88%)' },
  },
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function songMatchesQuery(song: ChordChart, query: string, meta?: HomeSongMeta) {
  if (!query) return true

  const haystack = [
    song.title,
    song.artist,
    song.style,
    song.key,
    song.tempo ? `${song.tempo}` : undefined,
    meta?.difficulty,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function playlistMatchesQuery(playlist: PlaylistDefinition, songs: ChordChart[], query: string) {
  if (!query) return true

  if (playlist.title.toLowerCase().includes(query)) {
    return true
  }

  return songs.some((song) => songMatchesQuery(song, query, HOME_SONG_META[song.id] ?? DEFAULT_COLLECTION_META))
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function SongArtwork({
  song,
  meta,
  saved,
  onSave,
}: {
  song: ChordChart
  meta: HomeSongMeta
  saved: boolean
  onSave: () => void
}) {
  const art = ARTWORK_VARIANTS[meta.pattern]

  return (
    <div className="relative aspect-[1.14/1] overflow-hidden rounded-lg border border-border" style={art.container}>
      <div
        className="absolute inset-x-8 top-8 h-24 rounded-full opacity-60 blur-3xl"
        style={art.glow}
      />

      <div className="absolute left-3 top-3 rounded-full border border-border bg-surface-0 px-2.5 py-1 text-2xs font-medium text-text-secondary">
        {meta.badge}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onSave()
        }}
        className={cn(
          'absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border bg-surface-0 transition-colors md:size-8',
          saved
            ? 'border-text-primary text-text-primary'
            : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
        )}
        aria-label={saved ? 'Saved to collection' : 'Save to collection'}
      >
        <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
      </button>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="rounded-full border border-border bg-surface-0 px-2 py-0.5 text-2xs font-medium text-text-secondary shadow-sm">
          Key {song.key}
        </span>
        <span className="rounded-full border border-border bg-surface-0 px-2 py-0.5 text-2xs font-medium text-text-secondary shadow-sm">
          {song.tempo ?? '--'} BPM
        </span>
      </div>
    </div>
  )
}

function SongActionCover({
  song,
  meta,
}: {
  song: ChordChart
  meta: HomeSongMeta
}) {
  const art = ARTWORK_VARIANTS[meta.pattern]

  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
      style={art.container}
    >
      <div
        className="absolute inset-x-2 top-2 h-8 rounded-full opacity-60 blur-2xl"
        style={art.glow}
      />
      <Music2 size={20} className="relative text-surface-0" />
      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-surface-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-text-primary">
        {song.key}
      </span>
    </div>
  )
}

function SongCard({ song, meta, saved, progress, section, onClick, onSave }: SongCardProps) {
  const detailLine = song.artist ?? song.style
  const metaLine = progress && section
    ? `${section} · ${progress}%`
    : `${meta.difficulty} · Key ${song.key} · ${song.tempo ?? '--'} BPM`

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      role="button"
      className="group min-w-[216px] max-w-[216px] shrink-0 cursor-pointer text-left transition-transform hover:-translate-y-0.5 md:min-w-[224px] md:max-w-[224px]"
    >
      <SongArtwork song={song} meta={meta} saved={saved} onSave={onSave} />
      <div className="space-y-0.5 pt-2">
        <p className="truncate text-[15px] font-semibold text-text-primary">{song.title}</p>
        <p className="truncate text-[13px] text-text-secondary">{detailLine}</p>
        <p className="truncate text-[13px] text-text-secondary">{metaLine}</p>
      </div>
    </div>
  )
}

function PlaylistArtwork({ songs }: { songs: ChordChart[] }) {
  return (
    <div className="relative aspect-[1.04/1] overflow-hidden rounded-lg border border-border bg-surface-1 p-3">
      <div className="absolute inset-0 bg-surface-1" />
      <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-surface-3 opacity-50 blur-3xl" />
      {songs.slice(0, 3).map((song, index) => (
        <div
          key={song.id}
          className={cn(
            'absolute rounded-lg border border-border bg-surface-0 p-3',
            index === 0 && 'left-3 top-3 right-12 h-[42%]',
            index === 1 && 'left-7 top-[36%] right-7 h-[34%]',
            index === 2 && 'left-12 bottom-3 right-3 h-[28%]',
          )}
        >
          <p className="truncate text-2xs uppercase tracking-[0.18em] text-text-muted">{song.style}</p>
          <p className="mt-1 truncate text-sm font-semibold text-text-primary">{song.title}</p>
        </div>
      ))}
    </div>
  )
}

function PlaylistCard({ playlist, songs, onClick }: PlaylistCardProps) {
  return (
    <button onClick={onClick} className="group min-w-[248px] max-w-[248px] shrink-0 text-left transition-transform hover:-translate-y-0.5">
      <PlaylistArtwork songs={songs} />

      <div className="space-y-1 pt-3">
        <p className="text-base font-semibold text-text-primary">{playlist.title}</p>
        <p className="text-sm text-text-secondary">{songs.length} charts</p>
      </div>
    </button>
  )
}

function StyleCategoryCard({
  category,
  onClick,
}: {
  category: StyleCategoryDefinition
  onClick: () => void
}) {
  const art = ARTWORK_VARIANTS[category.pattern]

  return (
    <button onClick={onClick} className="group min-w-[216px] max-w-[216px] shrink-0 text-left transition-transform hover:-translate-y-0.5 md:min-w-[224px] md:max-w-[224px]">
      <div className="relative aspect-[1.14/1] overflow-hidden rounded-lg border border-border" style={art.container}>
        <div
          className="absolute inset-x-8 top-8 h-24 rounded-full opacity-60 blur-3xl"
          style={art.glow}
        />

        <div className="absolute left-3 top-3 rounded-full border border-border bg-surface-0 px-2.5 py-1 text-2xs font-medium text-text-secondary">
          {category.badge}
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span className="rounded-full border border-border bg-surface-0 px-2 py-0.5 text-2xs font-medium text-text-secondary shadow-sm">
            Style
          </span>
          <span className="rounded-full border border-border bg-surface-0 px-2 py-0.5 text-2xs font-medium text-text-secondary shadow-sm">
            Electric
          </span>
        </div>
      </div>

      <div className="space-y-0.5 pt-2">
        <p className="truncate text-[15px] font-semibold text-text-primary">{category.title}</p>
        <p className="text-[13px] text-text-secondary">{category.subtitle}</p>
      </div>
    </button>
  )
}

function PlaylistDetail({
  playlist,
  songs,
  savedSongIds,
  emptyMessage = 'No charts in this collection yet.',
  onBack,
  onOpenSong,
  onManage,
  onSaveSong,
}: {
  playlist: PlaylistDefinition
  songs: ChordChart[]
  savedSongIds: Set<string>
  emptyMessage?: string
  onBack: () => void
  onOpenSong: (song: ChordChart) => void
  onManage: () => void
  onSaveSong: (song: ChordChart) => void
}) {
  return (
    <section className="flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft size={16} />
          Back to chord charts
        </button>
        <Button variant="outline" onClick={onManage}>
          Manage in Library
        </Button>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-end">
        <div className="w-full max-w-[248px] shrink-0">
          <PlaylistArtwork songs={songs} />
        </div>
        <div className="space-y-2 pb-1">
          <p className="text-2xl font-semibold text-text-primary">{playlist.title}</p>
          <p className="text-sm text-text-secondary">{songs.length} charts</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {songs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            meta={HOME_SONG_META[song.id] ?? DEFAULT_COLLECTION_META}
            saved={savedSongIds.has(song.id)}
            onClick={() => onOpenSong(song)}
            onSave={() => onSaveSong(song)}
          />
        ))}

        {songs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-1 px-4 py-12 text-center text-sm text-text-secondary">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  )
}

function ToolCard({ icon: Icon, title, meta, description, onClick }: ToolCardData & { onClick: () => void }) {
  return (
    <button onClick={onClick} className="group min-w-[280px] max-w-[280px] shrink-0 text-left transition-transform hover:-translate-y-0.5">
      <div className="relative flex aspect-[1.18/1] flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full border border-border bg-surface-0 px-2.5 py-1 text-2xs font-medium text-text-secondary">
            {meta}
          </span>
          <div className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-0 text-text-primary">
            <Icon size={18} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-0 p-4">
          <p className="text-base font-semibold text-text-primary">{title}</p>
          {description ? <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p> : null}
        </div>
      </div>
    </button>
  )
}

function FeaturedCreateScoreCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-[28px] border border-border p-6 text-left transition-transform hover:-translate-y-0.5 md:p-7"
      style={{
        background: 'color-mix(in srgb, white 90%, var(--accent) 10%)',
        borderColor: 'color-mix(in srgb, var(--accent) 18%, var(--border) 82%)',
      }}
    >
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span
            className="inline-flex rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-[0.18em]"
            style={{
              border: '1px solid color-mix(in srgb, var(--accent) 16%, var(--border) 84%)',
              background: 'rgba(255,255,255,0.72)',
              color: 'color-mix(in srgb, var(--text-primary) 72%, var(--accent) 28%)',
            }}
          >
            Start here
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 md:text-[2rem]">
            Create my own score
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700 md:text-base">
            Open a blank score and write your own chords, sections, and structure from scratch.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition-transform duration-300 group-hover:translate-x-0.5">
          Create now
          <ArrowRight size={16} />
        </div>
      </div>
    </button>
  )
}

function ShelfSection({
  title,
  showDivider = true,
  scrollable = true,
  children,
}: {
  title: string
  showDivider?: boolean
  scrollable?: boolean
  children: React.ReactNode
}) {
  const railRef = useRef<HTMLDivElement>(null)

  const scrollRail = (direction: 'left' | 'right') => {
    railRef.current?.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    })
  }

  return (
    <section className={cn('flex flex-col gap-4 pt-6', showDivider && 'border-t border-border')}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary md:text-[1.65rem]">{title}</h2>
          <ArrowRight size={16} className="text-text-secondary" />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" size="icon-sm" onClick={() => scrollRail('left')} aria-label={`Scroll ${title} left`}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => scrollRail('right')} aria-label={`Scroll ${title} right`}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div
        ref={railRef}
        className={cn(
          'pb-1',
          scrollable
            ? 'flex gap-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            : 'flex flex-col gap-4',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const pageRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, requireAuth } = useRequireAuth()
  const { sendMessage } = useAgent()
  const { showPanel } = useAgentPanelControls()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const storedPlaylists = usePlaylistStore((s) => s.playlists)
  const setSelectedPlaylist = usePlaylistStore((s) => s.setSelectedPlaylist)
  const [searchParams, setSearchParams] = useSearchParams()

  const [queryByTab, setQueryByTab] = useState<Record<HomeInputTab, string>>({
    songs: '',
    playlists: '',
    tools: '',
  })
  const [playlistDialogSong, setPlaylistDialogSong] = useState<ChordChart | null>(null)
  const [selectedSongAction, setSelectedSongAction] = useState<ChordChart | null>(null)
  const [focusedPlaylistId, setFocusedPlaylistId] = useState<string | null>(null)
  const activeTab = getHomeSectionFromSearch(searchParams)

  const setHomeSectionSearch = (section: HomeSectionId) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set(HOME_SECTION_QUERY_PARAM, section)
    setSearchParams(nextSearchParams)
  }

  const resetHomeSection = (section: HomeSectionId = DEFAULT_HOME_SECTION) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (section === DEFAULT_HOME_SECTION) {
      nextSearchParams.delete(HOME_SECTION_QUERY_PARAM)
    } else {
      nextSearchParams.set(HOME_SECTION_QUERY_PARAM, section)
    }
    setSearchParams(nextSearchParams)
  }

  useEffect(() => {
    setSpaceContext({
      currentSpace: 'home',
      homeMode: activeTab === 'agent' ? 'agent' : 'discovery',
    })
  }, [activeTab, setSpaceContext])

  useEffect(() => {
    if (activeTab !== 'playlists') {
      setFocusedPlaylistId(null)
    }
  }, [activeTab])

  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeTab])

  useEffect(() => {
    const handleHomeReset = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { section?: HomeSectionId } | undefined : undefined
      const section = detail?.section ?? DEFAULT_HOME_SECTION
      setFocusedPlaylistId(null)
      resetHomeSection(section)
    }

    window.addEventListener(HOME_NAV_RESET_EVENT, handleHomeReset)
    return () => window.removeEventListener(HOME_NAV_RESET_EVENT, handleHomeReset)
  }, [resetHomeSection])

  const librarySongs = useMemo(
    () =>
      HOME_LIBRARY_IDS.reduce<Array<{ song: ChordChart; meta: HomeSongMeta }>>((acc, songId) => {
        const song = CHORD_CHARTS.find((chart) => chart.id === songId)
        const meta = HOME_SONG_META[songId]
        if (!song || !meta) return acc
        acc.push({ song, meta })
        return acc
      }, []),
    [],
  )

  const continueSongs = useMemo(
    () =>
      CONTINUE_PRACTICE.reduce<
        Array<{ song: ChordChart; meta: HomeSongMeta; section: string; progress: number }>
      >((acc, item) => {
        const match = librarySongs.find((entry) => entry?.song.id === item.id)
        if (!match) return acc
        acc.push({ ...match, section: item.section, progress: item.progress })
        return acc
      }, []),
    [librarySongs],
  )

  const playlists: PlaylistDefinition[] = isAuthenticated ? storedPlaylists : GUEST_PLAYLISTS
  const savedSongIds = useMemo(
    () => new Set(storedPlaylists.flatMap((playlist) => playlist.songIds)),
    [storedPlaylists],
  )
  const focusedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === focusedPlaylistId) ?? null,
    [focusedPlaylistId, playlists],
  )
  const focusedPlaylistSongs = useMemo(
    () =>
      (focusedPlaylist?.songIds ?? [])
        .map((songId) => CHORD_CHARTS.find((chart) => chart.id === songId))
        .filter(Boolean) as ChordChart[],
    [focusedPlaylist],
  )

  const activeInputTab = activeTab === 'agent' ? null : activeTab
  const activeInputConfig = activeInputTab ? HOME_INPUT_CONFIG[activeInputTab] : null
  const activeQuery = activeInputTab ? queryByTab[activeInputTab] : ''
  const playlistQuery = normalizeQuery(queryByTab.playlists)

  const filteredPlaylists = useMemo(
    () =>
      playlists.filter((playlist) => {
        const songs = playlist.songIds
          .map((songId) => CHORD_CHARTS.find((chart) => chart.id === songId))
          .filter(Boolean) as ChordChart[]

        return playlistMatchesQuery(playlist, songs, playlistQuery)
      }),
    [playlistQuery, playlists],
  )

  const filteredFocusedPlaylistSongs = useMemo(
    () =>
      focusedPlaylistSongs.filter((song) =>
        songMatchesQuery(song, playlistQuery, HOME_SONG_META[song.id] ?? DEFAULT_COLLECTION_META),
      ),
    [focusedPlaylistSongs, playlistQuery],
  )

  const updateTabQuery = (tab: HomeInputTab, value: string) => {
    setQueryByTab((current) => ({ ...current, [tab]: value }))
  }

  const submitSongSearch = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const handleOpenPracticePlan = (prompt = 'Start a practice plan') => {
    showPanel()
    void sendMessage(prompt)
  }

  const handleSaveSong = (song: ChordChart) => {
    if (!requireAuth('saving chord charts')) return
    setPlaylistDialogSong(song)
  }

  const handleRandomSong = () => {
    const pool = RANDOM_SONG_POOL.length > 0 ? RANDOM_SONG_POOL : CHORD_CHARTS
    const randomSong = pool[Math.floor(Math.random() * pool.length)]
    if (!randomSong) return

    const searchQuery = [randomSong.title, randomSong.artist].filter(Boolean).join(' ')
    navigate(`/search?q=${encodeURIComponent(searchQuery)}&open=random`)
  }

  const handleOpenSongActions = (song: ChordChart) => {
    setSelectedSongAction(song)
  }

  const handleGenerateSong = ({
    arrangement,
    view,
  }: {
    arrangement: 'original' | 'simplified' | 'sing_play' | 'solo_focus' | 'low_position' | 'capo'
    view: 'lead_sheet' | 'staff' | 'tab'
  }) => {
    if (!selectedSongAction) return
    navigate(`/play/${selectedSongAction.id}?view=${view}&arrangement=${arrangement}`)
    setSelectedSongAction(null)
  }

  const handleTrackOnlySong = () => {
    if (!selectedSongAction) return
    navigate(`/play/${selectedSongAction.id}`)
    setSelectedSongAction(null)
  }

  const openPlaylistFocus = (playlistId: string) => {
    setHomeSectionSearch('playlists')
    setFocusedPlaylistId(playlistId)
    if (isAuthenticated) setSelectedPlaylist(playlistId)
  }

  const handlePlaylistSubmit = () => {
    if (!playlistQuery) return

    if (focusedPlaylist && filteredFocusedPlaylistSongs.length === 1) {
      navigate(`/play/${filteredFocusedPlaylistSongs[0].id}`)
      return
    }

    if (!focusedPlaylist && filteredPlaylists.length === 1) {
      openPlaylistFocus(filteredPlaylists[0].id)
    }
  }

  const handleToolsSubmit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const normalized = trimmed.toLowerCase()

    if (includesAny(normalized, ['chart editor', 'lead sheet', 'editor', 'write chords', 'chord chart'])) {
      navigate('/editor')
      return
    }

    if (includesAny(normalized, ['practice plan', 'practice routine', 'plan', 'schedule'])) {
      handleOpenPracticePlan(trimmed)
      return
    }

    if (includesAny(normalized, ['tuner', 'tuning', 'standard tuning', 'drop d', 'dadgad', 'open g'])) {
      navigate('/?tab=tools')
      return
    }

    if (includesAny(normalized, ['tone', 'amp', 'pedal', 'reverb', 'distortion', 'clean', 'overdrive', 'fingerpicking'])) {
      navigate('/tools/new', { state: aiToneState })
      return
    }

    if (includesAny(normalized, ['backing track', 'jam', 'metronome', 'bpm', 'tempo', 'drum', 'groove'])) {
      navigate('/?tab=tools')
      return
    }

    showPanel()
    void sendMessage(trimmed)
  }

  const handleHomeInputSubmit = (event?: FormEvent) => {
    event?.preventDefault()

    if (activeTab === 'songs') {
      submitSongSearch(queryByTab.songs)
      return
    }

    if (activeTab === 'playlists') {
      handlePlaylistSubmit()
      return
    }

    if (activeTab === 'tools') {
      handleToolsSubmit(queryByTab.tools)
    }
  }

  const handleSuggestionSelect = (suggestion: string) => {
    if (!activeInputTab) return

    updateTabQuery(activeInputTab, suggestion)

    if (activeInputTab === 'songs') {
      submitSongSearch(suggestion)
      return
    }

    if (activeInputTab === 'tools') {
      handleToolsSubmit(suggestion)
    }
  }

  useEffect(() => {
    if (!focusedPlaylistId) return
    const exists = playlists.some((playlist) => playlist.id === focusedPlaylistId)
    if (!exists) setFocusedPlaylistId(null)
  }, [focusedPlaylistId, playlists])

  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  const themeLabel = theme === 'system' ? 'Theme: Auto' : theme === 'light' ? 'Theme: Light' : 'Theme: Dark'
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon
  const aiToneState = { from: `${location.pathname}${location.search}${location.hash}` }
  const selectedSongActionMeta = selectedSongAction
    ? HOME_SONG_META[selectedSongAction.id] ?? DEFAULT_COLLECTION_META
    : null

  const renderActiveSection = () => {
    if (activeTab === 'songs') {
      return (
        <div className="space-y-6">
          {isAuthenticated && continueSongs.length > 0 && (
            <ShelfSection title="Continue" showDivider={false}>
              {continueSongs.map((entry) => (
                <SongCard
                  key={entry.song.id}
                  song={entry.song}
                  meta={entry.meta}
                  saved={savedSongIds.has(entry.song.id)}
                  progress={entry.progress}
                  section={entry.section}
                  onClick={() => navigate(`/play/${entry.song.id}`)}
                  onSave={() => handleSaveSong(entry.song)}
                />
              ))}
            </ShelfSection>
          )}

          {SONG_SHELVES.map((shelf) => (
            <ShelfSection
              key={shelf.id}
              title={shelf.title}
              showDivider={isAuthenticated && continueSongs.length > 0 ? true : shelf.id !== SONG_SHELVES[0].id}
            >
              {shelf.songIds.map((songId) => {
                const entry = librarySongs.find((candidate) => candidate?.song.id === songId)
                if (!entry) return null

                return (
                  <SongCard
                    key={entry.song.id}
                    song={entry.song}
                    meta={entry.meta}
                    saved={savedSongIds.has(entry.song.id)}
                    onClick={() => handleOpenSongActions(entry.song)}
                    onSave={() => handleSaveSong(entry.song)}
                  />
                )
              })}
            </ShelfSection>
          ))}

          <ShelfSection title="Styles">
            {STYLE_CATEGORIES.map((category) => (
              <StyleCategoryCard
                key={category.id}
                category={category}
                onClick={() => navigate(`/search?q=${encodeURIComponent(category.query)}`)}
              />
            ))}
          </ShelfSection>

          <section className="border-t border-border pt-6">
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-6 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-medium text-text-secondary">
                {isAuthenticated ? 'More AI when you need it.' : 'Save chord charts and keep practicing.'}
              </p>
              <Link
                to={isAuthenticated ? '/pricing' : '/signup'}
                className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                {isAuthenticated ? 'Upgrade' : 'Sign Up Free'}
              </Link>
            </div>
          </section>
        </div>
      )
    }

    if (activeTab === 'playlists') {
      return (
        <div className="space-y-6">
          <ShelfSection
            title="Chord Charts"
            showDivider={false}
            scrollable={!focusedPlaylist}
          >
            {focusedPlaylist ? (
              <PlaylistDetail
                playlist={focusedPlaylist}
                songs={filteredFocusedPlaylistSongs}
                savedSongIds={savedSongIds}
                emptyMessage={
                  playlistQuery
                    ? 'No chord charts match that filter in this collection.'
                    : 'No charts in this collection yet.'
                }
                onBack={() => setFocusedPlaylistId(null)}
                onOpenSong={handleOpenSongActions}
                onManage={() => navigate(`/projects?view=playlists&playlist=${focusedPlaylist.id}`)}
                onSaveSong={handleSaveSong}
              />
            ) : (
              filteredPlaylists.map((playlist) => {
                const songs = playlist.songIds
                  .map((songId) => CHORD_CHARTS.find((chart) => chart.id === songId))
                  .filter(Boolean) as ChordChart[]

                return (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    songs={songs}
                    onClick={() => openPlaylistFocus(playlist.id)}
                  />
                )
              })
            )}

            {!focusedPlaylist && filteredPlaylists.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-surface-1 px-4 py-12 text-center text-sm text-text-secondary">
                No playlists or chord charts match that filter yet.
              </div>
            )}
          </ShelfSection>
        </div>
      )
    }

    if (activeTab === 'tools') {
      return (
        <div className="space-y-6">
          <FeaturedCreateScoreCard onClick={() => navigate('/editor')} />

          <ShelfSection title="Tools" showDivider={false}>
            {PRACTICE_TOOLS.map((tool) => (
              <ToolCard
                key={tool.title}
                {...tool}
                onClick={() => {
                  if (tool.action === 'plan') {
                    handleOpenPracticePlan()
                    return
                  }
                  navigate(tool.action === 'tools' ? '/?tab=tools' : '/editor')
                }}
              />
            ))}
          </ShelfSection>
        </div>
      )
    }

    return <HomeAgentSurface />
  }

  return (
    <div ref={pageRef} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1480px] flex-col px-6 pb-16 pt-8 md:px-8 md:pt-10">
        {activeTab !== 'agent' && activeTab !== 'tools' && (
          <section className="flex flex-col gap-7 pb-8">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
              <form
                onSubmit={handleHomeInputSubmit}
                className="flex flex-1 items-center overflow-hidden rounded-[32px] border border-border bg-surface-0 shadow-sm"
              >
                <label className="flex flex-1 flex-col gap-1.5 px-6 py-4 md:px-7 md:py-5">
                  <span className="text-xs font-semibold text-text-primary">{activeInputConfig?.label}</span>
                  <input
                    value={activeQuery}
                    onChange={(e) => {
                      if (!activeInputTab) return
                      updateTabQuery(activeInputTab, e.target.value)
                    }}
                    placeholder={activeInputConfig?.placeholder}
                    className="bg-transparent text-[15px] leading-7 text-text-primary outline-none placeholder:text-text-muted md:text-base"
                  />
                </label>

                <div className="flex items-center justify-center px-3 py-3 md:px-4 md:py-4">
                  {activeTab === 'songs' ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRandomSong}
                      className="mr-2 h-11 rounded-full px-4 text-sm font-semibold"
                    >
                      Random Songs
                    </Button>
                  ) : null}
                  <Button type="submit" size="icon" className="size-11 rounded-full">
                    <Search size={18} />
                  </Button>
                </div>
              </form>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigate('/calendar')}
                className="size-11 shrink-0 rounded-full"
                aria-label="Open calendar and plans"
                title="Open calendar and plans"
              >
                <CalendarDays size={18} />
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs md:text-sm">
              <span className="text-text-muted">{activeInputConfig?.chipPrefix}</span>
              {activeInputConfig?.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="rounded-full border border-border bg-surface-1 px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary md:text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </section>
        )}

        <div key={activeTab}>
          {renderActiveSection()}
        </div>

        <section className="border-t border-border pt-10">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setTheme(nextTheme)}
              className="inline-flex items-center gap-3 rounded-full border border-border bg-surface-1 px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-surface-2"
            >
              <span className="flex size-8 items-center justify-center rounded-full border border-border bg-surface-0">
                <ThemeIcon size={16} />
              </span>
              <span>{themeLabel}</span>
              <ArrowRight size={16} className="text-text-secondary" />
            </button>
          </div>
        </section>

        <PlaylistPickerDialog
          open={!!playlistDialogSong}
          song={playlistDialogSong}
          onClose={() => setPlaylistDialogSong(null)}
          onSavedChange={(playlistId, action) => {
            const playlist = usePlaylistStore.getState().playlists.find((item) => item.id === playlistId)
            const title = playlist?.title ?? 'collection'

            if (action === 'saved') {
              toast(`Saved to ${title}`, 'success', {
                actionLabel: 'View collection',
                onAction: () => openPlaylistFocus(playlistId),
              })
              setSelectedPlaylist(playlistId)
              setFocusedPlaylistId(playlistId)
              return
            }

            toast(`Removed from ${title}`, 'default')
          }}
        />

        <SongActionModal
          open={Boolean(selectedSongAction && selectedSongActionMeta)}
          title={selectedSongAction?.title ?? ''}
          subtitle={selectedSongAction?.artist ?? selectedSongAction?.style}
          cover={
            selectedSongAction && selectedSongActionMeta ? (
              <SongActionCover song={selectedSongAction} meta={selectedSongActionMeta} />
            ) : undefined
          }
          onClose={() => setSelectedSongAction(null)}
          onGenerate={handleGenerateSong}
          onTrackOnly={handleTrackOnlySong}
        />
      </div>
    </div>
  )
}
