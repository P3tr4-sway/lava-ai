import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useDawSetup } from '@/hooks/useDawSetup'
import { useProjectSave } from '@/hooks/useProjectSave'
import { Music, FileMusic, ArrowLeft, AlignLeft, NotebookPen, Loader2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { SaveButton } from '@/components/ui/SaveButton'
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog'
import { CHORD_CHARTS, type ChordChart } from '@/data/chordCharts'
import { DawPanel } from '@/components/daw/DawPanel'
import type { DawSectionLabel } from '@/components/daw/DawPanel'
import { ChordGrid, PdfViewer, MetadataBar } from '@/components/score'
import { youtubeService, type AnalysisScore } from '@/services/youtubeService'

const PARTS = [
  { id: 'lead', label: 'Lead Guitar' },
  { id: 'rhythm', label: 'Rhythm Guitar' },
  { id: 'bass', label: 'Bass Line' },
]

const PROGRESS_SECTIONS = [
  { id: 1, label: 'Intro',   type: 'intro',  barCount: 2, status: 'done'    as const, accuracy: 96 },
  { id: 2, label: 'Verse 1', type: 'verse',  barCount: 4, status: 'done'    as const, accuracy: 88 },
  { id: 3, label: 'Chorus',  type: 'chorus', barCount: 3, status: 'current' as const, accuracy: 71 },
  { id: 4, label: 'Verse 2', type: 'verse',  barCount: 4, status: 'locked'  as const, accuracy: 0  },
  { id: 5, label: 'Bridge',  type: 'bridge', barCount: 2, status: 'locked'  as const, accuracy: 0  },
  { id: 6, label: 'Outro',   type: 'outro',  barCount: 1, status: 'locked'  as const, accuracy: 0  },
]

export function SongsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isGenerateMode = searchParams.get('generate') === '1'
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  const [selectedPart, setSelectedPart] = useState('lead')

  // Audio store — bpm used in buildProjectData
  const bpm = useAudioStore((s) => s.bpm)

  // Static chart lookup
  const staticChart = CHORD_CHARTS.find((c) => c.id === id)

  // Analysis result (from YouTube → ChordMiniApp pipeline)
  const [analysisChart, setAnalysisChart] = useState<ChordChart | null>(null)
  const [analysisScore, setAnalysisScore] = useState<AnalysisScore | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const loadFromAnalysis = useLeadSheetStore((s) => s.loadFromAnalysis)

  // Fetch analysis result when navigating with ?generate=1 and no static chart
  useEffect(() => {
    if (!isGenerateMode || !id || staticChart) return

    let cancelled = false
    setLoadingAnalysis(true)

    youtubeService.pollAnalysis(id)
      .then((result) => {
        if (cancelled || !result.scoreJson) return

        const score = result.scoreJson
        setAnalysisScore(score)

        // Build a synthetic ChordChart for the header
        setAnalysisChart({
          id,
          title: score.title || 'Untitled',
          artist: '',
          style: 'Auto-detected',
          key: score.key,
          tempo: score.tempo,
          timeSignature: score.timeSignature,
        })

        // Populate the lead sheet store with analyzed sections
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
      })
      .catch(() => {
        // Analysis not ready or failed — will show "not found"
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalysis(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isGenerateMode])

  // Use static chart or analysis chart
  const chart = staticChart ?? analysisChart

  // DAW setup — handles track seeding, duration, and committed clip tracking
  const { tracks, addTrack, updateTrack, committedClipIds, hasCommittedClips } = useDawSetup({
    initTrackName: chart?.title ?? '',
    initDuration: chart?.tempo ? (16 * 4 * 60) / chart.tempo : 240,
    resetKey: chart?.id,
  })

  // Lead sheet store — populated from chart so ChordGrid can read it (for static charts only)
  const resetLeadSheet = useLeadSheetStore((s) => s.reset)
  const setLeadSheetKey = useLeadSheetStore((s) => s.setKey)
  const setLeadSheetTempo = useLeadSheetStore((s) => s.setTempo)
  const setLeadSheetTimeSig = useLeadSheetStore((s) => s.setTimeSignature)

  useEffect(() => {
    if (!staticChart) return // Skip for analysis charts — already loaded via loadFromAnalysis
    resetLeadSheet()
    setLeadSheetKey(staticChart.key)
    setLeadSheetTempo(staticChart.tempo ?? 120)
    setLeadSheetTimeSig(staticChart.timeSignature ?? '4/4')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticChart?.id])

  // View mode — default to 'pdf' when a pdfUrl is present, else 'leadsheet'
  const [mode, setMode] = useState<'leadsheet' | 'pdf'>(() => chart?.pdfUrl ? 'pdf' : 'leadsheet')

  useEffect(() => {
    setMode(chart?.pdfUrl ? 'pdf' : 'leadsheet')
  }, [chart?.id])

  // Shared save logic
  const buildProjectData = useCallback(() => {
    const serializedTracks = tracks.map((t) => ({
      name: t.name,
      color: t.color,
      clips: t.clips
        .filter((c) => c.status === 'committed' && c.audioFileId)
        .map((c) => ({
          audioFileId: c.audioFileId,
          startBar: c.startBar,
          lengthInBars: c.lengthInBars,
          name: c.name,
        })),
    }))
    return {
      name: `${chart?.title ?? 'Untitled'} — Recording`,
      description: `${chart?.artist ? chart.artist + ' · ' : ''}${bpm} BPM`,
      space: 'learn' as const,
      metadata: {
        type: 'recording-session',
        songId: chart?.id,
        songTitle: chart?.title,
        bpm,
        tracks: serializedTracks,
      },
    }
  }, [tracks, chart, bpm])

  const {
    saving, isSaved, showSavedBadge, blocker, handleSave, handleDialogSave,
  } = useProjectSave({
    hasContent: hasCommittedClips,
    contentFingerprint: committedClipIds,
    buildProjectData,
  })

  // DAW timeline section labels
  const dawSections = useMemo<DawSectionLabel[]>(() => {
    // If we have analysis sections, use those for DAW labels
    if (analysisScore?.sections?.length) {
      let barStart = 0
      return analysisScore.sections.map((s) => {
        const barCount = s.measures.length
        const section = { label: s.label, type: s.type, barStart, barCount }
        barStart += barCount
        return section
      })
    }
    // Otherwise use static progress sections
    let barStart = 0
    return PROGRESS_SECTIONS.map((s) => {
      const section = { label: s.label, type: s.type, barStart, barCount: s.barCount }
      barStart += s.barCount
      return section
    })
  }, [analysisScore])

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn', projectId: id })
  }, [id, setSpaceContext])

  // Loading state for analysis
  if (loadingAnalysis) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-text-muted animate-spin" />
          <p className="text-sm font-medium text-text-primary">Loading score...</p>
        </div>
      </div>
    )
  }

  if (!chart) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <FileMusic size={40} className="text-text-muted" />
          <p className="text-sm font-medium text-text-primary">Song not found</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Header toolbar ──────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-0/90 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-7 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5">
          <Music size={15} className="text-text-muted shrink-0" />
          <span className="text-sm font-semibold text-text-primary">{chart.title}</span>
          {chart.artist && <span className="text-xs text-text-muted">— {chart.artist}</span>}
          {analysisChart && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success">
              AI Generated
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Key / Time / Tempo metadata */}
        <MetadataBar
          keyValue={chart.key}
          timeSignature={chart.timeSignature ?? '4/4'}
          tempo={chart.tempo ?? 120}
        />

        <div className="flex-1" />

        {/* Save button */}
        <SaveButton
          saving={saving}
          hasContent={hasCommittedClips}
          isSaved={isSaved}
          showSavedBadge={showSavedBadge}
          onSave={() => void handleSave()}
        />

        {/* View mode toggle — only when a PDF score is available */}
        {chart.pdfUrl && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-border">
            <button
              onClick={() => setMode('leadsheet')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                mode === 'leadsheet'
                  ? 'bg-surface-0 text-text-primary shadow-sm border border-border'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <AlignLeft size={11} />
              Lead Sheet
            </button>
            <button
              onClick={() => setMode('pdf')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                mode === 'pdf'
                  ? 'bg-surface-0 text-text-primary shadow-sm border border-border'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <NotebookPen size={11} />
              Score
            </button>
          </div>
        )}

        {/* Part picker */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-border">
          {PARTS.map((part) => (
            <button
              key={part.id}
              onClick={() => setSelectedPart(part.id)}
              className={cn(
                'flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                selectedPart === part.id
                  ? 'bg-surface-0 text-text-primary shadow-sm border border-border'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {part.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Score area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {mode === 'pdf' && chart.pdfUrl ? (
          <PdfViewer pdfUrl={chart.pdfUrl} />
        ) : (
          <ChordGrid />
        )}
      </div>

      {/* ── DAW Panel ───────────────────────────────────────────── */}
      <DawPanel
        tracks={tracks}
        onUpdateTrack={updateTrack}
        onAddTrack={() => addTrack()}
        showRecordButton={true}
        sections={dawSections}
      />

      {/* ── Unsaved-changes dialog ───────────────────────────────── */}
      <UnsavedChangesDialog
        blocker={blocker}
        onSave={() => void handleDialogSave()}
        saving={saving}
        message="You have a recording that hasn't been saved to Projects. Save it before leaving?"
      />
    </div>
  )
}
