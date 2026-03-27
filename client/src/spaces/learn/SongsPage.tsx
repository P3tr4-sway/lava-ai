import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useTaskStore, STAGE_LABEL } from '@/stores/taskStore'
import { useCoachStore } from '@/stores/coachStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useAuthStore } from '@/stores/authStore'
import { useDawSetup } from '@/hooks/useDawSetup'
import { useProjectSave } from '@/hooks/useProjectSave'
import { useCoachSectionTracker } from '@/hooks/useCoachSectionTracker'
import { usePracticeAssist } from '@/hooks/usePracticeAssist'
import { useAgent } from '@/hooks/useAgent'
import { useAgentPanelControls } from '@/hooks/useAgentPanelControls'
import { useAgentThreadPersistence } from '@/hooks/useAgentThreadPersistence'
import { Music, FileMusic, ArrowLeft, Loader2 } from 'lucide-react'
import { SaveButton } from '@/components/ui/SaveButton'
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog'
import { CHORD_CHARTS, type ChordChart } from '@/data/chordCharts'
import {
  ChordGrid,
  PdfViewer,
  MetadataBar,
  LeadSheetPlaybackBar,
  ScorePickerDrawer,
  PlaybackStylePickerDrawer,
  type PlaybackStyleOption,
} from '@/components/score'
import { youtubeService } from '@/services/youtubeService'
import { ToneEngine } from '@/audio/ToneEngine'
import type { Clip } from '@/audio/types'
import type { CoachContext, ArrangementId } from '@lava/shared'

const issuedCoachInitKeys = new Set<string>()

const PROGRESS_SECTIONS = [
  { id: 1, label: 'Intro',   type: 'intro',  barCount: 2, status: 'done'    as const, accuracy: 96 },
  { id: 2, label: 'Verse 1', type: 'verse',  barCount: 4, status: 'done'    as const, accuracy: 88 },
  { id: 3, label: 'Chorus',  type: 'chorus', barCount: 3, status: 'current' as const, accuracy: 71 },
  { id: 4, label: 'Verse 2', type: 'verse',  barCount: 4, status: 'locked'  as const, accuracy: 0  },
  { id: 5, label: 'Bridge',  type: 'bridge', barCount: 2, status: 'locked'  as const, accuracy: 0  },
  { id: 6, label: 'Outro',   type: 'outro',  barCount: 1, status: 'locked'  as const, accuracy: 0  },
]

const PLAYBACK_STYLE_OPTIONS: PlaybackStyleOption[] = [
  {
    id: 'studio-clean',
    label: 'Studio Clean',
    subtitle: 'Default',
    description: 'Clean guitar.',
    category: 'acoustic',
  },
  {
    id: 'warm-nylon',
    label: 'Warm Nylon',
    subtitle: 'Soft',
    description: 'Soft nylon tone.',
    category: 'acoustic',
  },
  {
    id: 'bright-piano',
    label: 'Bright Piano',
    subtitle: 'Clear',
    description: 'Clear piano.',
    category: 'keys',
  },
  {
    id: 'dream-keys',
    label: 'Dream Keys',
    subtitle: 'Airy',
    description: 'Airy keys.',
    category: 'keys',
  },
  {
    id: 'full-band',
    label: 'Full Band',
    subtitle: 'Demo',
    description: 'Band feel.',
    category: 'ensemble',
  },
  {
    id: 'fingerstyle-glow',
    label: 'Fingerstyle Glow',
    subtitle: 'Rich',
    description: 'Rich fingerstyle.',
    category: 'ensemble',
  },
  {
    id: 'practice-guide',
    label: 'Practice Guide',
    subtitle: 'Focus',
    description: 'Practice focus.',
    category: 'practice',
  },
  {
    id: 'metronome-support',
    label: 'Metronome Support',
    subtitle: 'Tight',
    description: 'Tight timing.',
    category: 'practice',
  },
]

interface ToolbarActionButtonProps {
  label: string
  onClick: () => void
}

function ToolbarActionButton({ label, onClick }: ToolbarActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-full bg-[#111111] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-88"
    >
      <span>{label}</span>
    </button>
  )
}

export function SongsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isGenerateMode = searchParams.get('generate') === '1'
  const requestedView = searchParams.get('view')
  const requestedArrangement = searchParams.get('arrangement')
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const agentMessages = useAgentStore((s) => s.messages)
  const coachStore = useCoachStore()
  const { sendHiddenMessage } = useAgent()
  const { showPanel } = useAgentPanelControls()
  const { hasPersistedThread } = useAgentThreadPersistence(id)
  const coachHighlightTarget = useAgentStore((s) => s.coachHighlightTarget)

  // Audio store — bpm used in buildProjectData
  const bpm = useAudioStore((s) => s.bpm)
  const setBpm = useAudioStore((s) => s.setBpm)
  const setDuration = useAudioStore((s) => s.setDuration)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)

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
  const [playbackStylePickerOpen, setPlaybackStylePickerOpen] = useState(false)
  const [selectedPlaybackStyleId, setSelectedPlaybackStyleId] = useState(PLAYBACK_STYLE_OPTIONS[0].id)
  const hasAppliedRequestedArrangementRef = useRef(false)
  const hasAppliedRequestedViewRef = useRef(false)

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
      arrangements: score.arrangements,
      defaultArrangementId: score.defaultArrangementId,
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
      arrangements: score.arrangements,
      defaultArrangementId: score.defaultArrangementId,
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

  // 直接订阅当前任务，避免只拿到 getTask 函数本身导致进度更新后页面不重渲染。
  const task = useTaskStore((s) => (id ? s.tasks.find((item) => item.id === id) : undefined))
  const addTask = useTaskStore((s) => s.addTask)

  // Derive task data reactively
  const taskProgress = task?.progress ?? 0
  const taskStage = task?.stage ?? 'downloading'

  useEffect(() => {
    if (!isGenerateMode || !id || staticChart) return

    const existingTask = useTaskStore.getState().getTask(id)

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
  const { tracks, updateTrack, committedClipIds, hasCommittedClips } = useDawSetup({
    initTrackName: chart?.title ?? '',
    initDuration: chart?.tempo ? (16 * 4 * 60) / chart.tempo : 240,
    resetKey: chart?.id,
  })

  // Lead sheet store — populated from chart so ChordGrid can read it (for static charts only)
  const resetLeadSheet = useLeadSheetStore((s) => s.reset)
  const setLeadSheetKey = useLeadSheetStore((s) => s.setKey)
  const setLeadSheetTempo = useLeadSheetStore((s) => s.setTempo)
  const setLeadSheetTimeSig = useLeadSheetStore((s) => s.setTimeSignature)
  const arrangements = useLeadSheetStore((s) => s.arrangements)
  const selectedArrangementId = useLeadSheetStore((s) => s.selectedArrangementId)
  const selectArrangement = useLeadSheetStore((s) => s.selectArrangement)
  const scoreView = useLeadSheetStore((s) => s.scoreView)
  const setScoreView = useLeadSheetStore((s) => s.setScoreView)
  const arrangementPickerOpen = useLeadSheetStore((s) => s.arrangementPickerOpen)
  const openArrangementPicker = useLeadSheetStore((s) => s.openArrangementPicker)
  const closeArrangementPicker = useLeadSheetStore((s) => s.closeArrangementPicker)

  useEffect(() => {
    if (!staticChart) return // Skip for analysis charts — already loaded via loadFromAnalysis

    // 优先走 arrangement-aware 数据；旧的静态谱仍兼容到单版 original。
    if (staticChart.arrangements?.length || staticChart.sections?.length) {
      loadFromAnalysis({
        projectName: staticChart.title,
        key: staticChart.key,
        tempo: staticChart.tempo ?? 120,
        timeSignature: staticChart.timeSignature ?? '4/4',
        sections: staticChart.sections ?? [],
        arrangements: staticChart.arrangements,
        defaultArrangementId: staticChart.defaultArrangementId,
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
  const leadSheetTimeSignature = useLeadSheetStore((s) => s.timeSignature)
  const setActiveCell = useLeadSheetStore((s) => s.setActiveCell)
  const selectedArrangement = useMemo(
    () => arrangements.find((arrangement) => arrangement.id === selectedArrangementId) ?? arrangements[0],
    [arrangements, selectedArrangementId],
  )
  useEffect(() => {
    if (selectedArrangement?.tempo) {
      setBpm(selectedArrangement.tempo)
    }
  }, [selectedArrangement?.id, selectedArrangement?.tempo, setBpm])

  const dawSections = useMemo(() => {
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
  const totalBars = useMemo(() => {
    if (leadSheetSections.length > 0) {
      return leadSheetSections.reduce((sum, section) => sum + section.measures.length, 0)
    }
    return Math.max(
      analysisTotalBars,
      PROGRESS_SECTIONS.reduce((sum, section) => sum + section.barCount, 0),
    )
  }, [analysisTotalBars, leadSheetSections])
  const beatsPerBar = parseInt(leadSheetTimeSignature?.split('/')[0] ?? chart?.timeSignature?.split('/')[0] ?? '4', 10) || 4
  const barDuration = beatsPerBar * (60 / (bpm || chart?.tempo || 120))

  const handleSeek = useCallback((globalBarIndex: number) => {
    setCurrentTime(globalBarIndex * barDuration)
    setCurrentBar(globalBarIndex)
  }, [barDuration, setCurrentBar, setCurrentTime])

  const handleBarSelect = useCallback((bar: number) => {
    handleSeek(bar)

    let remaining = bar
    for (const section of leadSheetSections) {
      if (remaining < section.measures.length) {
        const measure = section.measures[remaining]
        if (measure) setActiveCell(section.id, measure.id)
        break
      }
      remaining -= section.measures.length
    }
  }, [handleSeek, leadSheetSections, setActiveCell])

  usePracticeAssist(id, leadSheetSections)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn', projectId: id })
  }, [id, setSpaceContext])

  useEffect(() => {
    if (hasAppliedRequestedArrangementRef.current || arrangements.length === 0) return
    if (requestedArrangement && arrangements.some((arrangement) => arrangement.id === requestedArrangement)) {
      hasAppliedRequestedArrangementRef.current = true
      selectArrangement(requestedArrangement as ArrangementId)
    }
  }, [arrangements, requestedArrangement, selectArrangement])

  useEffect(() => {
    if (hasAppliedRequestedViewRef.current || !requestedView) return
    if (requestedView === 'lead_sheet' || requestedView === 'staff' || requestedView === 'tab') {
      hasAppliedRequestedViewRef.current = true
      setScoreView(requestedView)
    }
  }, [requestedView, setScoreView])

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

    const coachInitKey = `${id ?? 'unknown'}:${visitTier}`
    const hasExistingCoachConversation = agentMessages.some((message) =>
      (message.role === 'user' && message.hidden && message.content.startsWith('[Coach init:')) ||
      (message.role === 'assistant' && (
        message.subtype === 'onboarding' ||
        message.subtype === 'highlight' ||
        message.subtype === 'coachingTip'
      )),
    )

    // 这些场景都不应该再次自动注入欢迎/回访消息：
    // 1. 已从本地恢复 thread
    // 2. 当前 thread 已经有 coach 对话
    // 3. 同一浏览器会话内该歌曲的同一 visit tier 已触发过一次（防 StrictMode / 重挂载）
    if (hasPersistedThread || hasExistingCoachConversation || issuedCoachInitKeys.has(coachInitKey)) {
      return
    }
    issuedCoachInitKeys.add(coachInitKey)

    if (visitTier === 'first') {
      coachStore.markOnboardingSeen()
      coachStore.addVisitedSong(id ?? '')
      showPanel()
      void sendHiddenMessage('[Coach init: first visit. Run full onboarding flow.]')
    } else if (visitTier === 'new_song') {
      showPanel()
      void sendHiddenMessage('[Coach init: new song. Send light greeting with practice plan offer.]')
      coachStore.addVisitedSong(id ?? '')
    } else {
      void sendHiddenMessage('[Coach init: revisit. Reference progress and offer to continue.]')
      coachStore.addVisitedSong(id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentMessages, chart, hasPersistedThread, id, leadSheetSections.length, showPanel])

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
      <div className="shrink-0 border-b border-border bg-surface-0/90 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-2 md:flex-nowrap">
          <button
            onClick={() => navigate(-1)}
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-0 text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <ArrowLeft size={14} />
          </button>

          <div className="min-w-0 flex items-center gap-1.5 shrink">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
              <Music size={13} />
            </span>
            <span className="truncate text-sm font-semibold text-text-primary">{chart.title}</span>
            {chart.artist && <span className="truncate text-xs text-text-muted">— {chart.artist}</span>}
            {analysisChart && (
              <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-success">
                AI Breakdown
              </span>
            )}
          </div>

          <div className="hidden h-4 w-px bg-border lg:block" />

          <MetadataBar
            keyValue={selectedArrangement?.concertKey ?? chart.key}
            timeSignature={selectedArrangement?.timeSignature ?? chart.timeSignature ?? '4/4'}
            tempo={selectedArrangement?.tempo ?? chart.tempo ?? 120}
            capoFret={selectedArrangement?.capoFret}
            fretRange={selectedArrangement?.fretRange}
            shapeKey={selectedArrangement?.displayKey}
            className="min-w-0 flex-1 gap-1 md:flex-nowrap"
          />

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SaveButton
              saving={saving}
              hasContent={hasCommittedClips}
              isSaved={isSaved}
              showSavedBadge={showSavedBadge}
              onSave={() => void handleSave()}
              className="h-8 rounded-full px-3 text-xs font-semibold"
            />

            <ToolbarActionButton
              label="Score Styles"
              onClick={openArrangementPicker}
            />

            <ToolbarActionButton
              label="Playback Styles"
              onClick={() => setPlaybackStylePickerOpen(true)}
            />
          </div>
        </div>
      </div>
      {/* ── Score area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {scoreView === 'staff' && chart.pdfUrl && selectedArrangementId === 'original' ? (
          <PdfViewer pdfUrl={chart.pdfUrl} />
        ) : scoreView === 'staff' ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-sm text-text-muted">No staff.</p>
          </div>
        ) : scoreView === 'tab' ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-sm text-text-muted">No tab yet.</p>
          </div>
        ) : (
          <ChordGrid onSeek={handleSeek} />
        )}
      </div>

      <ScorePickerDrawer
        open={arrangementPickerOpen}
        onClose={closeArrangementPicker}
        arrangements={arrangements}
        selectedArrangementId={selectedArrangementId}
        onSelectArrangement={(nextId) => {
          selectArrangement(nextId)
          closeArrangementPicker()
        }}
        scoreView={scoreView}
        onSelectScoreView={(nextView) => {
          setScoreView(nextView)
          closeArrangementPicker()
        }}
      />

      <PlaybackStylePickerDrawer
        open={playbackStylePickerOpen}
        onClose={() => setPlaybackStylePickerOpen(false)}
        options={PLAYBACK_STYLE_OPTIONS}
        selectedPlaybackStyleId={selectedPlaybackStyleId}
        onSelectPlaybackStyle={setSelectedPlaybackStyleId}
      />

      <LeadSheetPlaybackBar
        totalBars={totalBars}
        beatsPerBar={beatsPerBar}
        sections={dawSections}
        onBarSelect={handleBarSelect}
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
