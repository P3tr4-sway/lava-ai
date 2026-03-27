import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import type { BackingTrackAsset } from '@/data/backingTracks'
import type { ChordChart } from '@/data/chordCharts'
import type { EffectsPreset } from '@/data/effectsPresets'
import { BackingTrackGrid } from './BackingTrackGrid'
import { ChordChartGrid } from './ChordChartGrid'
import { EffectsPresetGrid } from './EffectsPresetGrid'

type FilesTabId = 'chordcharts' | 'backingtracks' | 'effectspresets'

interface FilesSearchConfig {
  placeholder: string
}

const FILES_SEARCH_CONFIG: Record<FilesTabId, FilesSearchConfig> = {
  chordcharts: {
    placeholder: 'Search charts, artists, keys, or BPM',
  },
  backingtracks: {
    placeholder: 'Search tracks, styles, keys, or BPM',
  },
  effectspresets: {
    placeholder: 'Search presets, styles, or modules',
  },
}

const FILES_CHARTS: ChordChart[] = []
const FILES_TRACKS: BackingTrackAsset[] = []
const FILES_PRESETS: EffectsPreset[] = []

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function backingTrackMatchesQuery(track: BackingTrackAsset, query: string) {
  if (!query) return true

  const haystack = [
    track.title,
    track.style,
    track.key,
    `${track.bpm} bpm`,
    track.description,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function chordChartMatchesQuery(chart: ChordChart, query: string) {
  if (!query) return true

  const haystack = [
    chart.title,
    chart.artist,
    chart.style,
    chart.key,
    chart.tempo ? `${chart.tempo} bpm` : undefined,
    chart.timeSignature,
    chart.tuning,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function effectsPresetMatchesQuery(preset: EffectsPreset, query: string) {
  if (!query) return true

  const haystack = [
    preset.name,
    preset.style,
    preset.description,
    preset.chain.join(' '),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function EmptyResults({
  query,
  label,
}: {
  query: string
  label: string
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-1 px-6 py-12 text-center">
      <p className="text-base font-medium text-text-primary">No {label} found for “{query}”.</p>
      <p className="mt-2 text-sm text-text-secondary">Try a different keyword.</p>
    </div>
  )
}

function EmptyLibraryState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-1 px-6 py-12 text-center">
      <p className="text-base font-medium text-text-primary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </div>
  )
}

function SectionHeader({
  title,
  meta,
}: {
  title: string
  meta: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <span className="inline-flex rounded-full bg-surface-1 px-2.5 py-1 text-xs font-medium text-text-secondary">
        {meta}
      </span>
    </div>
  )
}

export function FilesContent() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<FilesTabId>('chordcharts')
  const [queryByTab, setQueryByTab] = useState<Record<FilesTabId, string>>({
    chordcharts: '',
    backingtracks: '',
    effectspresets: '',
  })

  const activeConfig = FILES_SEARCH_CONFIG[activeTab]
  const activeQuery = queryByTab[activeTab]
  const deferredQuery = useDeferredValue(activeQuery)
  const normalizedQuery = normalizeQuery(deferredQuery)
  const filteredCharts = useMemo(
    () =>
      [...FILES_CHARTS]
        .filter((chart) => chordChartMatchesQuery(chart, normalizedQuery))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [normalizedQuery],
  )
  const filteredTracks = useMemo(
    () => FILES_TRACKS.filter((track) => backingTrackMatchesQuery(track, normalizedQuery)),
    [normalizedQuery],
  )
  const filteredPresets = useMemo(
    () => FILES_PRESETS.filter((preset) => effectsPresetMatchesQuery(preset, normalizedQuery)),
    [normalizedQuery],
  )

  const activeCollectionIsEmpty =
    (activeTab === 'chordcharts' && FILES_CHARTS.length === 0) ||
    (activeTab === 'backingtracks' && FILES_TRACKS.length === 0) ||
    (activeTab === 'effectspresets' && FILES_PRESETS.length === 0)

  const counts = useMemo(
    () => ({
      charts: normalizedQuery ? `${filteredCharts.length} of ${FILES_CHARTS.length} charts` : `${FILES_CHARTS.length} charts`,
      tracks: normalizedQuery ? `${filteredTracks.length} of ${FILES_TRACKS.length} tracks` : `${FILES_TRACKS.length} tracks`,
      presets: normalizedQuery ? `${filteredPresets.length} of ${FILES_PRESETS.length} presets` : `${FILES_PRESETS.length} presets`,
    }),
    [filteredCharts.length, filteredPresets.length, filteredTracks.length, normalizedQuery],
  )

  return (
    <Tabs defaultValue="chordcharts" value={activeTab} onValueChange={(value) => setActiveTab(value as FilesTabId)} className="gap-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <TabsList className="w-full overflow-x-auto md:w-auto">
            <TabsTrigger value="chordcharts">Chord Charts</TabsTrigger>
            <TabsTrigger value="backingtracks">Backing Tracks</TabsTrigger>
            <TabsTrigger value="effectspresets">Effects Presets</TabsTrigger>
          </TabsList>

          <label className="relative block md:w-[360px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={activeQuery}
              onChange={(event) =>
                setQueryByTab((current) => ({
                  ...current,
                  [activeTab]: event.target.value,
                }))
              }
              placeholder={activeConfig.placeholder}
              disabled={activeCollectionIsEmpty}
              className="h-9 w-full rounded-md border border-border bg-surface-0 pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border-hover focus:bg-surface-1"
            />
          </label>
        </div>

        <Button variant="ghost" onClick={() => navigate('/projects')}>
          Projects
        </Button>
      </section>

      <TabsContent value="chordcharts" className="mt-0 flex flex-col gap-4">
        <SectionHeader title="Chord Charts" meta={counts.charts} />
        {filteredCharts.length > 0 ? (
          <ChordChartGrid charts={filteredCharts} onSelect={(chart) => navigate(`/learn/songs/${chart.id}`)} />
        ) : FILES_CHARTS.length === 0 ? (
          <EmptyLibraryState
            title="No chord charts yet."
            description="Mockup charts have been removed from Files. Real library items will appear here when they are available."
          />
        ) : (
          <EmptyResults query={deferredQuery.trim()} label="chord charts" />
        )}
      </TabsContent>

      <TabsContent value="backingtracks" className="mt-0 flex flex-col gap-4">
        <SectionHeader title="Backing Tracks" meta={counts.tracks} />
        {filteredTracks.length > 0 ? (
          <BackingTrackGrid
            tracks={filteredTracks}
            onSelect={() => navigate('/?tab=tools', { state: { from: '/files' } })}
          />
        ) : FILES_TRACKS.length === 0 ? (
          <EmptyLibraryState
            title="No backing tracks yet."
            description="Mockup tracks have been removed from Files. Real library items will appear here when they are available."
          />
        ) : (
          <EmptyResults query={deferredQuery.trim()} label="backing tracks" />
        )}
      </TabsContent>

      <TabsContent value="effectspresets" className="mt-0 flex flex-col gap-4">
        <SectionHeader title="Effects Presets" meta={counts.presets} />
        {filteredPresets.length > 0 ? (
          <EffectsPresetGrid
            presets={filteredPresets}
            onSelect={(preset) => navigate('/tools/new', { state: { from: '/files', presetId: preset.id } })}
          />
        ) : FILES_PRESETS.length === 0 ? (
          <EmptyLibraryState
            title="No effects presets yet."
            description="Mockup presets have been removed from Files. Real library items will appear here when they are available."
          />
        ) : (
          <EmptyResults query={deferredQuery.trim()} label="effects presets" />
        )}
      </TabsContent>
    </Tabs>
  )
}
