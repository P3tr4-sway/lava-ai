import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useTaskStore, STAGE_LABEL } from '@/stores/taskStore'
import { useCoachStore } from '@/stores/coachStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores'
import { useDawSetup } from '@/hooks/useDawSetup'
import { useProjectSave } from '@/hooks/useProjectSave'
import { useCoachSectionTracker } from '@/hooks/useCoachSectionTracker'
import { useAgent } from '@/hooks/useAgent'
import { Music, FileMusic, ArrowLeft, AlignLeft, NotebookPen, Loader2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { SaveButton } from '@/components/ui/SaveButton'
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog'
import { CHORD_CHARTS, type ChordChart } from '@/data/chordCharts'
import { DawPanel } from '@/components/daw/DawPanel'
import type { DawSectionLabel } from '@/components/daw/DawPanel'
import { ChordGrid, PdfViewer, MetadataBar, CoachBar } from '@/components/score'
import { youtubeService } from '@/services/youtubeService'
import { ToneEngine } from '@/audio/ToneEngine'
import type { Clip } from '@/audio/types'
import type { CoachContext } from '@lava/shared'

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
  const coachStore = useCoachStore()
  const { sendHiddenMessage } = useAgent()
  const coachHighlightTarget = useAgentStore((s) => s.coachHighlightTarget)
  const messages = useAgentStore((s) => s.messages)
  const [showCoachBar, setShowCoachBar] = useState(false)
  const [latestCoachTip, setLatestCoachTip] = useState<string | null>(null)

  // Audio store — bpm used in buildProjectData
  const bpm = useAudioStore((s) => s.bpm)
  const setBpm = useAudioStore((s) => s.setBpm)
  const setDuration = useAudioStore((s) => s.setDuration)

  // Static chart lookup
  const staticChart = CHORD_CHARTS.find((c) => c.id === id)

  // Analysis result (from YouTube → ChordMiniApp pipeline)
  const [analysisChart, setAnalysisChart] = useState<ChordChart | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const loadFromAnalysis = useLeadSheetStore((s) => s.loadFromAnalysis)

  // Pending audio import — resolved after useDawSetup resets tracks
  const [pendingAudioImport, setPendingAudioImport] = useState<{
    audioFileId: string
    totalBars: number
    duration: number
    title: string
    setAt: number  // timestamp to detect stale tracks
  } | null>(null)
  const [analysisTotalBars, setAnalysisTotalBars] = useState(16)

  // Fetch / poll analysis result when navigating with ?generate=1 and no static chart
  const [analysisError, setAnalysisError] = useState<string | null>(null)

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
      setLoadingAnalysis(true)
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

    // If the static chart has predefined sections with chords, load them directly
    if (staticChart.sections?.length) {
      loadFromAnalysis({
        projectName: staticChart.title,
        key: staticChart.key,
        tempo: staticChart.tempo ?? 120,
        timeSignature: staticChart.timeSignature ?? '4/4',
        sections: staticChart.sections,
      })
    } else {
      resetLeadSheet()
      setLeadSheetKey(staticChart.key)
      setLeadSheetTempo(staticChart.tempo ?? 120)
      setLeadSheetTimeSig(staticChart.timeSignature ?? '4/4')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticChart?.id])

  // Auto-import audio to first DAW track once useDawSetup has reset the tracks.
  // Guard: track IDs are `track-{timestamp}-{index}`, so compare creation time
  // against `pendingAudioImport.setAt` to skip stale (pre-reset) tracks.
  const updateTrackRef = useRef(updateTrack)
  updateTrackRef.current = updateTrack

  useEffect(() => {
    if (!pendingAudioImport || tracks.length === 0) return

    const trackCreatedAt = parseInt(tracks[0].id.split('-')[1] ?? '0', 10)
    if (trackCreatedAt <= pendingAudioImport.setAt) return  // useDawSetup hasn't reset yet
    if (tracks[0].clips.length > 0) { setPendingAudioImport(null); return }

    const { audioFileId, totalBars, duration, title } = pendingAudioImport
    const trackId = tracks[0].id
    const trackColor = tracks[0].color.accent

    setPendingAudioImport(null)
    setDuration(duration)

    const clip: Clip = {
      id: `clip-yt-${Date.now()}`,
      trackId,
      startBar: 0,
      lengthInBars: totalBars,
      trimStart: 0,
      trimEnd: 0,
      audioFileId,
      committedAudioFileId: audioFileId,
      name: title,
      color: trackColor,
      status: 'committed',
    }

    ToneEngine.getInstance().loadBuffer(audioFileId)
      .then((audioBuffer) => {
        updateTrackRef.current(trackId, { clips: [{ ...clip, audioBuffer }], hasRecording: true })
      })
      .catch(() => {
        updateTrackRef.current(trackId, { clips: [clip], hasRecording: true })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAudioImport, tracks])

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

  // DAW timeline section labels — derived from analysis, static chart, or fallback
  const leadSheetSections = useLeadSheetStore((s) => s.sections)
  const dawSections = useMemo<DawSectionLabel[]>(() => {
    // Use lead sheet store sections (populated from analysis or static chart data)
    if (leadSheetSections?.length) {
      let barStart = 0
      return leadSheetSections.map((s) => {
        const barCount = s.measures.length
        const section = { label: s.label, type: s.type, barStart, barCount }
        barStart += barCount
        return section
      })
    }
    // Fallback to static progress sections
    let barStart = 0
    return PROGRESS_SECTIONS.map((s) => {
      const section = { label: s.label, type: s.type, barStart, barCount: s.barCount }
      barStart += s.barCount
      return section
    })
  }, [leadSheetSections])

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn', projectId: id })
  }, [id, setSpaceContext])

  // ── Coach context effect — fires after chart + sections are loaded ──
  useEffect(() => {
    if (!chart || leadSheetSections.length === 0) return

    const allChords = leadSheetSections.flatMap((s) =>
      s.measures.flatMap((m) => m.chords),
    )
    const uniqueChords = [...new Set(allChords)].filter(Boolean)

    const visitTier = coachStore.getVisitTier(id ?? '')
    const calendarPlans = useCalendarStore.getState().plans.filter(
      (p) => p.songId === id,
    )
    const allSessions = calendarPlans.flatMap((p) => p.sessions)
    const completedSessions = allSessions.filter((s) => s.completed).length

    const coachContext: CoachContext = {
      songTitle: chart.title,
      artist: chart.artist,
      key: chart.key,
      tempo: chart.tempo ?? 120,
      timeSignature: chart.timeSignature ?? '4/4',
      sectionCount: leadSheetSections.length,
      sectionLabels: leadSheetSections.map((s) => s.label),
      chordSummary: uniqueChords.join(', '),
      userSkillLevel: useAuthStore.getState().user?.skillLevel,
      songSkillAssessment: coachStore.songSkillAssessments[id ?? ''],
      coachingStyle: coachStore.coachingStyle,
      visitTier,
      practiceProgress: allSessions.length > 0
        ? {
            totalSessions: allSessions.length,
            completedSessions,
            lastSessionTitle: allSessions.filter((s) => s.completed).slice(-1)[0]?.title,
            nextSessionTitle: allSessions.find((s) => !s.completed)?.title,
          }
        : undefined,
    }

    setSpaceContext({
      currentSpace: 'learn',
      projectId: id,
      coachContext,
    })

    if (visitTier === 'first') {
      coachStore.markOnboardingSeen()
      coachStore.addVisitedSong(id ?? '')
      useUIStore.getState().setAgentPanelOpen(true)
      void sendHiddenMessage('[Coach init: first visit. Run full onboarding flow.]')
    } else if (visitTier === 'new_song') {
      useUIStore.getState().setAgentPanelOpen(true)
      void sendHiddenMessage('[Coach init: new song. Send light greeting with practice plan offer.]')
      coachStore.addVisitedSong(id ?? '')
    } else {
      void sendHiddenMessage('[Coach init: revisit. Reference progress and offer to continue.]')
      coachStore.addVisitedSong(id ?? '')
    }

    setShowCoachBar(visitTier !== 'first')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, leadSheetSections.length])

  // ── Watch for latest coaching tip ──
  useEffect(() => {
    const lastCoachTip = [...messages]
      .reverse()
      .find((m) => m.subtype === 'coachingTip')
    if (lastCoachTip) {
      setLatestCoachTip(lastCoachTip.content)
    }
  }, [messages])

  // ── Apply highlight pulse ──
  useEffect(() => {
    if (!coachHighlightTarget) return

    const el = document.querySelector(
      `[data-coach-target="${coachHighlightTarget}"]`,
    ) as HTMLElement | null
    if (!el) return

    el.classList.add('coach-pulse')
    const handleEnd = () => el.classList.remove('coach-pulse')
    el.addEventListener('animationend', handleEnd, { once: true })

    return () => {
      el.classList.remove('coach-pulse')
      el.removeEventListener('animationend', handleEnd)
    }
  }, [coachHighlightTarget])

  useCoachSectionTracker(sendHiddenMessage)

  // Loading state for analysis
  if (loadingAnalysis) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-5 max-w-xs">
          <Loader2 size={28} className="text-text-muted animate-spin" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-text-primary">Breaking down song...</p>
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

  // Analysis error
  if (analysisError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <FileMusic size={40} className="text-text-muted" />
          <p className="text-sm font-medium text-text-primary">Song breakdown failed</p>
          <p className="text-xs text-text-muted max-w-xs">{analysisError}</p>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Go back
          </button>
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
              AI Breakdown
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

      </div>

      {showCoachBar && (
        <CoachBar tip={latestCoachTip} />
      )}

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
        totalBars={analysisTotalBars}
      />

      {/* ── Unsaved-changes dialog ───────────────────────────────── */}
      <UnsavedChangesDialog
        blocker={blocker}
        onSave={() => void handleDialogSave()}
        saving={saving}
        message="You have a practice recording that hasn't been saved. Save it before leaving?"
      />
    </div>
  )
}
