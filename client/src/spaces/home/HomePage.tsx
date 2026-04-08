import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOME_NAV_RESET_EVENT } from '@/components/layout/navItems'
import { CheckCircle2, Loader2, Paperclip, X } from 'lucide-react'
import { ChatInput, type ChatInputRef } from '@/components/agent/ChatInput'
import { NewPackDialog } from '@/components/projects/NewPackDialog'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { projectService } from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'
import {
  buildNewPackProjectPayload,
  createSectionsForBars,
  NEW_PACK_TUNINGS,
  type NewPackDraft,
} from '@/spaces/pack/newPack'
import { cn } from '@/components/ui/utils'
import { ExportPdfDialog } from '@/spaces/pack/ExportPdfDialog'
import './HomePage.css'

const QUICK_ACTIONS = [
  {
    label: 'Create a new style',
    prompt: 'I just learned a song and want to hear how it would feel in a softer singer-songwriter style on guitar.',
  },
  {
    label: 'Turn vocals into guitar',
    prompt: 'Turn this rap melody line into an electric guitar version.',
  },
  {
    label: 'Adapt for guitar',
    prompt: 'I love this section of a film score. Make it into a playable guitar arrangement.',
  },
  {
    label: 'Make it easier to play',
    prompt: 'I need a version for a family gathering. Make this song easier than the tabs online.',
  },
  {
    label: 'Create a student version',
    prompt: 'This song is too hard for my current level. Turn it into a simpler guitar version.',
  },
  {
    label: 'Generate tabs from scratch',
    prompt: 'I want to play someone a favorite song, but it is obscure and there is no guitar tab. Make one for me.',
  },
  {
    label: 'Clarify the fingerings',
    prompt: 'Rewrite this passage so I can practice position shifts more clearly.',
  },
  {
    label: 'Make it fingerstyle',
    prompt: 'Turn this song into a fingerpicking arrangement.',
  },
  {
    label: 'Create a creator version',
    prompt: 'Make a version for a cover video that feels different from what everyone else is playing.',
  },
  {
    label: 'Make a fresh content version',
    prompt: 'I need fresh arrangements regularly for content. Give me a new playable version of this song.',
  },
] as const

const EXPLORE_USE_CASES = [
  {
    title: 'Build a lesson version',
    prompt: 'This song is too hard for me right now. Make it easier to play on guitar.',
    image:
      'https://images.pexels.com/photos/7520982/pexels-photo-7520982.jpeg?cs=srgb&dl=pexels-pavel-danilyuk-7520982.jpg&fm=jpg',
  },
  {
    title: 'Make it teachable',
    prompt: 'Simplify this song and reduce the chord changes so it is easier to practice.',
    image:
      'https://images.pexels.com/photos/7447919/pexels-photo-7447919.jpeg?cs=srgb&dl=pexels-ravi-roshan-2875998-7447919.jpg&fm=jpg',
  },
  {
    title: 'Create a softer version',
    prompt: 'Keep the song, but change it into a softer acoustic style.',
    image:
      'https://images.pexels.com/photos/14870727/pexels-photo-14870727.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  {
    title: 'Try a new style',
    prompt: 'Turn this song into a different style that fits guitar better.',
    image:
      'https://images.pexels.com/photos/28994341/pexels-photo-28994341.jpeg?auto=compress&cs=tinysrgb&w=1200',
  },
  {
    title: 'Match a student level',
    prompt: 'Make a version of this song that fits my current playing level.',
    image:
      'https://images.pexels.com/photos/8472850/pexels-photo-8472850.jpeg?cs=srgb&dl=pexels-mart-production-8472850.jpg&fm=jpg',
  },
  {
    title: 'Tailor it to my audience',
    prompt: 'Make a custom version of this song for my voice and playing style.',
    image:
      'https://images.pexels.com/photos/8472908/pexels-photo-8472908.jpeg?cs=srgb&dl=pexels-mart-production-8472908.jpg&fm=jpg',
  },
] as const

const INTRO_MODAL_IMAGE =
  'https://images.pexels.com/photos/6671422/pexels-photo-6671422.jpeg?cs=srgb&dl=pexels-tima-miroshnichenko-6671422.jpg&fm=jpg'

const INTRO_SLOGAN_POSITIONS = [
  { left: '36px', top: 'calc(100% - 36px - 104px)' },
  { left: '36px', top: 'calc(50% - 52px)' },
  { left: '36px', top: '36px' },
] as const

type ImportSourceKind = 'audio' | 'youtube' | 'musicxml' | 'pdf-image'

type ProcessingState = {
  source: ImportSourceKind
  title: string
  stages: string[]
  stageIndex: number
  draft: NewPackDraft
  fileName?: string
  sourceLabel: string
  requestSummary: string
}

type SetupState = {
  draft: NewPackDraft
  source: ImportSourceKind
  sourceLabel: string
  detectedFields: Array<{ label: string; value: string }>
  requestSummary: string
  queueItemId?: string
  previewVersion: number
}

type WaitingState = {
  visible: boolean
  status: 'running' | 'success' | 'error'
  draft: NewPackDraft
  source: ImportSourceKind
  stageIndex: number
  stages: string[]
  sourceLabel: string
  requestSummary: string
  projectId?: string
  errorMessage?: string
  shouldFail: boolean
  entryMode: 'play' | 'edit'
  showReadyBar: boolean
}

type ExportDialogState = {
  open: boolean
  packName: string
  defaultLayout: 'tab' | 'staff' | 'split'
  keyValue?: string
  tempo?: number
  timeSignature?: string
  tuningLabel?: string
  capo?: number
  sections: Array<{ label: string; bars: number }>
}

type ImportQueueItem = {
  id: string
  fileName: string
  source: ImportSourceKind
  draft: NewPackDraft
  requestSummary: string
  stageIndex: number
  status: 'queued' | 'processing' | 'ready' | 'error'
  projectId?: string
  errorMessage?: string
}

const IMPORT_PROCESSING_STAGES: Record<ImportSourceKind, string[]> = {
  audio: ['Upload audio', 'Detect tempo and pitch', 'Build draft score'],
  youtube: ['Fetch audio', 'Detect melody', 'Build draft score'],
  musicxml: ['Read score data'],
  'pdf-image': ['Scan page', 'Read symbols', 'Build draft score'],
}

const WAITING_STAGES: Record<ImportSourceKind, string[]> = {
  audio: ['Read audio', 'Generate score', 'Prepare pack'],
  youtube: ['Read audio', 'Generate score', 'Prepare pack'],
  musicxml: ['Import score', 'Build play view', 'Prepare pack'],
  'pdf-image': ['Generate score', 'Prepare pack', 'Finish pack'],
}

function detectImportSource(file: File | null, message: string): ImportSourceKind | null {
  if (file) {
    const name = file.name.toLowerCase()
    if (name.endsWith('.musicxml') || name.endsWith('.mxl') || name.endsWith('.xml')) return 'musicxml'
    if (file.type.startsWith('audio/')) return 'audio'
    if (name.endsWith('.pdf') || file.type.startsWith('image/')) return 'pdf-image'
    return 'audio'
  }
  if (/youtu\.be|youtube\.com/i.test(message)) return 'youtube'
  return null
}

function detectImportSourceFromFile(file: File): ImportSourceKind {
  return detectImportSource(file, '') ?? 'audio'
}

function deriveDraftName(file: File | null, message: string, source: ImportSourceKind) {
  if (file?.name) return file.name.replace(/\.[^.]+$/, '')
  if (source === 'youtube') return 'YouTube Import'
  const text = message.trim().slice(0, 40)
  return text || 'Imported Pack'
}

function buildImportDraft(file: File | null, message: string, source: ImportSourceKind): NewPackDraft {
  const baseName = deriveDraftName(file, message, source)

  switch (source) {
    case 'musicxml':
      return {
        name: baseName,
        bars: 32,
        tempo: 108,
        timeSignature: '4/4',
        key: 'G',
        layout: 'split',
        tuning: 'standard',
        capo: 0,
      }
    case 'pdf-image':
      return {
        name: baseName,
        bars: 16,
        tempo: 96,
        timeSignature: '4/4',
        key: 'C',
        layout: 'split',
        tuning: 'standard',
        capo: 0,
      }
    case 'youtube':
      return {
        name: baseName,
        bars: 32,
        tempo: 92,
        timeSignature: '4/4',
        key: 'Am',
        layout: 'split',
        tuning: 'standard',
        capo: 0,
      }
    case 'audio':
    default:
      return {
        name: baseName,
        bars: 32,
        tempo: 88,
        timeSignature: '4/4',
        key: 'D',
        layout: 'split',
        tuning: 'standard',
        capo: 0,
      }
  }
}

function sourceLabel(file: File | null, source: ImportSourceKind) {
  if (source === 'youtube') return 'YouTube link'
  if (file?.name) return file.name
  return 'Imported source'
}

function buildDetectedFields(draft: NewPackDraft) {
  return [
    { label: 'Key', value: draft.key },
    { label: 'Meter', value: draft.timeSignature },
    { label: 'Tempo', value: `${draft.tempo} BPM` },
  ]
}

function progressForIndex(index: number, total: number) {
  return Math.round(((index + 1) / Math.max(total, 1)) * 100)
}

function summarizeRequest(message: string) {
  const trimmed = message.trim()
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed
}

function shouldMockFail(file: File | null, message: string) {
  const sourceText = `${file?.name ?? ''} ${message}`.toLowerCase()
  return sourceText.includes('noisy') || sourceText.includes('fail')
}

function regenerateImportDraft(draft: NewPackDraft, previewVersion: number): NewPackDraft {
  const keyCycle = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Am', 'Em'] as const
  const meterCycle = ['4/4', '3/4', '6/8', '12/8'] as const
  const currentKeyIndex = Math.max(0, keyCycle.indexOf(draft.key as (typeof keyCycle)[number]))
  const currentMeterIndex = Math.max(0, meterCycle.indexOf(draft.timeSignature as (typeof meterCycle)[number]))
  const tempoOffsets = [0, -6, 4, 8, -10]
  const nextTempo = Math.max(40, Math.min(240, draft.tempo + tempoOffsets[previewVersion % tempoOffsets.length]))

  return {
    ...draft,
    key: keyCycle[(currentKeyIndex + 1) % keyCycle.length],
    timeSignature: meterCycle[(currentMeterIndex + (previewVersion % 2 === 0 ? 0 : 1)) % meterCycle.length],
    tempo: nextTempo,
  }
}

type SubmitPhase = 'idle' | 'analyzing' | 'arranging' | 'building'

declare global {
  interface Window {
    __lavaIntroShownForLoad?: boolean
  }
}

const PHASE_LABELS: Record<SubmitPhase, string> = {
  idle: '',
  analyzing: 'Analyzing your song...',
  arranging: 'Creating arrangement...',
  building: 'Building practice pack...',
}

export function HomePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const chatRef = useRef<ChatInputRef>(null)
  const projects = useProjectStore((s) => s.projects)
  const upsertProject = useProjectStore((s) => s.upsertProject)
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [newPackOpen, setNewPackOpen] = useState(false)
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null)
  const [setupState, setSetupState] = useState<SetupState | null>(null)
  const [waitingState, setWaitingState] = useState<WaitingState | null>(null)
  const [exportDialogState, setExportDialogState] = useState<ExportDialogState | null>(null)
  const [showIntroDialog, setShowIntroDialog] = useState(false)
  const [introSloganPosition, setIntroSloganPosition] = useState(0)
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([])

  useEffect(() => {
    chatRef.current?.focus()
  }, [])

  useEffect(() => {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navigationEntry?.type === 'reload' && !window.__lavaIntroShownForLoad) {
      window.__lavaIntroShownForLoad = true
      setShowIntroDialog(true)
    }
  }, [])

  useEffect(() => {
    const handleReset = () => {
      setPhase('idle')
      setAttachedFiles([])
      chatRef.current?.setValue('')
      chatRef.current?.focus()
    }
    window.addEventListener(HOME_NAV_RESET_EVENT, handleReset)
    return () => window.removeEventListener(HOME_NAV_RESET_EVENT, handleReset)
  }, [])

  const handleQuickActionClick = (prompt: string) => {
    chatRef.current?.setValue(prompt)
    chatRef.current?.focus()
  }

  const dismissIntroDialog = useCallback(() => {
    setShowIntroDialog(false)
  }, [])

  const advanceIntroSlogan = useCallback(() => {
    setIntroSloganPosition((current) => (current + 1) % 3)
  }, [])

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'audio/*,image/*,.pdf,.musicxml,.mxl,.xml'
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? [])
      if (files.length > 0) setAttachedFiles(files)
    }
    input.click()
  }

  const handleSend = useCallback(async (message: string) => {
    if (!message.trim() && attachedFiles.length === 0) return

    if (attachedFiles.length > 1) {
      const requestSummary = summarizeRequest(message || 'Multiple imports')
      const queueItems = attachedFiles.map((file) => {
        const source = detectImportSourceFromFile(file)
        return {
          id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          source,
          draft: buildImportDraft(file, message, source),
          requestSummary,
          stageIndex: 0,
          status: 'queued' as const,
        }
      })

      setImportQueue((current) => [...queueItems, ...current])
      setAttachedFiles([])
      toast(`${queueItems.length} files added.`)
      return
    }

    const attachedFile = attachedFiles[0] ?? null
    const importSource = detectImportSource(attachedFile, message)
    const requestSummary = summarizeRequest(message)
    if (importSource) {
      const draft = buildImportDraft(attachedFile, message, importSource)
      const resolvedSourceLabel = sourceLabel(attachedFile, importSource)

      if (importSource === 'musicxml') {
        setSetupState({
          draft,
          source: importSource,
          sourceLabel: resolvedSourceLabel,
          detectedFields: buildDetectedFields(draft),
          requestSummary,
          previewVersion: 1,
        })
        return
      }

      setProcessingState({
        source: importSource,
        title: importSource === 'youtube'
          ? 'Reading link'
          : importSource === 'pdf-image'
            ? 'Scanning score'
            : 'Reading file',
        stages: IMPORT_PROCESSING_STAGES[importSource],
        stageIndex: 0,
        draft,
        fileName: attachedFile?.name,
        sourceLabel: resolvedSourceLabel,
        requestSummary,
      })
      return
    }

    setPhase('analyzing')
    setTimeout(() => setPhase('arranging'), 900)
    setTimeout(() => setPhase('building'), 1800)

    const draftName = message.trim().slice(0, 48) || attachedFile?.name.replace(/\.[^.]+$/, '') || 'New Practice Pack'

    try {
      const project = await projectService.create(buildNewPackProjectPayload({
        name: draftName,
        bars: 32,
        tempo: 92,
        timeSignature: '4/4',
        key: 'C',
        layout: 'split',
        tuning: 'standard',
        capo: 0,
      }))
      upsertProject(project)
      setPhase('idle')
      navigate(`/pack/${project.id}`)
    } catch (error) {
      console.error('Failed to create AI pack shell', error)
      setPhase('idle')
    }
  }, [attachedFiles, navigate, upsertProject, toast])

  useEffect(() => {
    if (!processingState) return
    const stages = processingState.stages
    const timer = window.setTimeout(() => {
      if (processingState.stageIndex < stages.length - 1) {
        setProcessingState((current) => current ? { ...current, stageIndex: current.stageIndex + 1 } : null)
        return
      }

      const nextSetup: SetupState = {
        draft: processingState.draft,
        source: processingState.source,
        sourceLabel: processingState.sourceLabel,
        detectedFields: buildDetectedFields(processingState.draft),
        requestSummary: processingState.requestSummary,
        previewVersion: 1,
      }

      if (processingState.source === 'pdf-image') {
        setSetupState({
          draft: processingState.draft,
          source: processingState.source,
          sourceLabel: processingState.sourceLabel,
          detectedFields: buildDetectedFields(processingState.draft),
          requestSummary: processingState.requestSummary,
          previewVersion: 1,
        })
      } else {
        setSetupState(nextSetup)
      }
      setProcessingState(null)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [processingState])

  useEffect(() => {
    if (!waitingState || waitingState.status !== 'running') return

    const timer = window.setTimeout(async () => {
      if (waitingState.stageIndex < waitingState.stages.length - 1) {
        setWaitingState((current) => current ? { ...current, stageIndex: current.stageIndex + 1 } : null)
        return
      }

      if (waitingState.shouldFail) {
        setWaitingState((current) => current ? {
          ...current,
          status: 'error',
          visible: true,
          errorMessage: waitingState.source === 'audio'
            ? 'Audio is too noisy to read clearly.'
            : 'We could not read the score with confidence.',
        } : null)
        toast('Import failed. Try again or upload score files.', 'error')
        return
      }

      try {
        const payload = buildNewPackProjectPayload(waitingState.draft)
        const project = await projectService.create({
          ...payload,
          metadata: {
            ...payload.metadata,
            requestSummary: waitingState.requestSummary,
          },
        })
        upsertProject(project)
        setWaitingState((current) => current ? {
          ...current,
          status: 'success',
          visible: true,
          projectId: project.id,
        } : null)
        setAttachedFiles([])
        toast('Pack is ready.', 'success', {
          actionLabel: 'Open pack',
          onAction: () => navigate(`/pack/${project.id}`),
        })
      } catch (error) {
        console.error('Failed to create imported pack', error)
        setWaitingState((current) => current ? {
          ...current,
          status: 'error',
          visible: true,
          errorMessage: 'We could not finish the pack.',
        } : null)
        toast('Could not finish the pack.', 'error')
      }
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [navigate, toast, upsertProject, waitingState])

  const recentPacks = projects.slice(0, 6)

  useEffect(() => {
    const activeItem = importQueue.find((item) => item.status === 'processing')
    const queuedItem = importQueue.find((item) => item.status === 'queued')

    if (!activeItem && queuedItem) {
      setImportQueue((current) =>
        current.map((item) =>
          item.id === queuedItem.id ? { ...item, status: 'processing', stageIndex: 0 } : item
        )
      )
      return
    }

    if (!activeItem) return

    const stages = IMPORT_PROCESSING_STAGES[activeItem.source]
    const timer = window.setTimeout(async () => {
      if (activeItem.stageIndex < stages.length - 1) {
        setImportQueue((current) =>
          current.map((item) =>
            item.id === activeItem.id ? { ...item, stageIndex: item.stageIndex + 1 } : item
          )
        )
        return
      }

      try {
        const payload = buildNewPackProjectPayload(activeItem.draft)
        const project = await projectService.create({
          ...payload,
          metadata: {
            ...payload.metadata,
            requestSummary: activeItem.requestSummary,
          },
        })
        upsertProject(project)
        setImportQueue((current) =>
          current.map((item) =>
            item.id === activeItem.id ? { ...item, status: 'ready', projectId: project.id } : item
          )
        )
      } catch (error) {
        console.error('Failed to create imported pack', error)
        setImportQueue((current) =>
          current.map((item) =>
            item.id === activeItem.id
              ? { ...item, status: 'error', errorMessage: 'Could not finish.' }
              : item
          )
        )
      }
    }, 1100)

    return () => window.clearTimeout(timer)
  }, [importQueue, upsertProject])

  if (phase !== 'idle') {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <div className="size-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-lg text-text-secondary animate-pulse">
            {PHASE_LABELS[phase]}
          </p>
        </div>
        <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} />
      </>
    )
  }

  if (waitingState?.visible) {
    const progress = waitingState.status === 'success'
      ? 100
      : waitingState.status === 'error'
        ? progressForIndex(waitingState.stageIndex, waitingState.stages.length)
        : progressForIndex(waitingState.stageIndex, waitingState.stages.length)

    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/55">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-6 py-16">
            <div className="w-full rounded-[28px] border border-border bg-surface-0 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              {waitingState.status === 'success' ? (
                <CheckCircle2 className="size-6 text-success" />
              ) : waitingState.status === 'error' ? (
                <X className="size-6 text-error" />
              ) : (
                <Loader2 className="size-6 animate-spin text-text-primary" />
              )}
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {waitingState.status === 'success'
                    ? 'Project ready'
                    : waitingState.status === 'error'
                      ? 'Import failed'
                      : waitingState.stages[waitingState.stageIndex]}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {waitingState.status === 'success'
                    ? 'Your version is ready to edit, export, or publish.'
                    : waitingState.sourceLabel}
                </p>
              </div>
            </div>

            <div className="mt-6 h-2 rounded-full bg-surface-2">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  waitingState.status === 'error' ? 'bg-error' : 'bg-accent',
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 space-y-2">
              {waitingState.stages.map((stage, index) => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className={cn(index <= waitingState.stageIndex ? 'text-text-primary' : 'text-text-muted')}>
                    {stage}
                  </span>
                  <span className="text-text-muted">
                    {index < waitingState.stageIndex
                      ? 'Done'
                      : index === waitingState.stageIndex
                        ? waitingState.status === 'success'
                          ? 'Done'
                          : waitingState.status === 'error'
                            ? 'Stopped'
                            : 'Now'
                        : 'Next'}
                  </span>
                </div>
              ))}
            </div>

            {waitingState.status === 'error' ? (
              <div className="mt-6 rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-text-primary">
                <p className="font-medium text-error">Needs attention</p>
                <p className="mt-1 text-text-primary">{waitingState.errorMessage}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setWaitingState((current) => current ? {
                      ...current,
                      status: 'running',
                      stageIndex: 0,
                      errorMessage: undefined,
                    } : null)}
                    className="rounded-full bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingState(null)
                      setAttachedFiles([])
                    }}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
                  >
                    Try a different source
                  </button>
                </div>
              </div>
            ) : null}

            {waitingState.status === 'running' ? (
              <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <p className="text-sm font-medium text-text-primary">You can leave this page.</p>
                <p className="mt-1 text-sm text-text-secondary">We will notify you when processing is done.</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                {waitingState.status === 'success'
                  ? 'Choose the next step.'
                  : 'You can keep working while we finish processing.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {waitingState.status === 'success' && waitingState.projectId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/pack/${waitingState.projectId}?entry=play&ready=1`)}
                      className="rounded-full bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
                    >
                      Open version
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/pack/${waitingState.projectId}?entry=edit&ready=1`)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportDialogState({
                        open: true,
                        packName: waitingState.draft.name,
                        defaultLayout: waitingState.draft.layout,
                        keyValue: waitingState.draft.key,
                        tempo: waitingState.draft.tempo,
                        timeSignature: waitingState.draft.timeSignature,
                        tuningLabel: NEW_PACK_TUNINGS.find((entry) => entry.id === waitingState.draft.tuning)?.label,
                        capo: waitingState.draft.capo,
                        sections: createSectionsForBars(waitingState.draft.bars).map((section) => ({
                          label: section.label,
                          bars: section.measures.length,
                        })),
                      })}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
                    >
                      Export PDF
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingState((current) => current ? { ...current, visible: false } : null)
                      toast('We will notify you when it is ready.')
                    }}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
                  >
                    Keep browsing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} />
        {exportDialogState ? (
          <ExportPdfDialog
            open={exportDialogState.open}
            onClose={() => setExportDialogState(null)}
            packName={exportDialogState.packName}
            defaultLayout={exportDialogState.defaultLayout}
            keyValue={exportDialogState.keyValue}
            tempo={exportDialogState.tempo}
            timeSignature={exportDialogState.timeSignature}
            tuningLabel={exportDialogState.tuningLabel}
            capo={exportDialogState.capo}
            sections={exportDialogState.sections}
          />
        ) : null}
      </>
    )
  }

  return (
      <>
        <div className="figma-home-type mx-auto flex w-full max-w-5xl flex-col gap-24 px-6 pb-24 pt-24 md:pt-28 lg:pt-[20vh]">
          {/* Hero */}
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
            <h1 className="figma-home-type__hero text-[56px] font-bold leading-[0.92] tracking-[-0.045em] text-text-primary sm:text-[68px] lg:text-[80px]">
              Your guitar{' '}
              <span
                className="inline-block px-[0.18em] pb-[0.02em]"
                style={{ boxShadow: 'inset 0 -0.78em 0 rgba(255, 168, 212, 0.65)' }}
              >
                content engine
              </span>
            </h1>
            <p className="figma-home-type__body-large max-w-2xl text-[18px] leading-8 text-text-secondary sm:text-[20px]">
              Create versions for teaching, content, and release.
            </p>
          </div>

          {/* Input area */}
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            {/* File chip */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {attachedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex max-w-full items-center gap-2 rounded-full bg-surface-1 px-4 py-2 text-sm text-text-primary">
                    <Paperclip className="size-3.5 shrink-0 text-text-secondary" />
                    <span className="max-w-[220px] truncate">{file.name}</span>
                    <button
                      onClick={() => setAttachedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      className="text-text-muted transition-colors hover:text-text-primary"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {attachedFiles.length > 1 ? (
                  <span className="text-sm text-text-muted">Create separate projects</span>
                ) : null}
              </div>
            )}

            {/* Chat input with attachment */}
            <div className="relative">
              <ChatInput
                ref={chatRef}
                onSend={handleSend}
                placeholder="Drop audio, sheet music, PDF, or a link. Describe the version you want to create..."
                density="roomy"
                onAttachClick={handleFileSelect}
                canSend={attachedFiles.length > 0}
              />
            </div>

            {importQueue.length > 0 && (
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <p className="figma-home-type__label text-[15px] font-medium text-text-primary">Imports in progress</p>
                </div>
                <div className="flex flex-col gap-2">
                  {importQueue.map((item) => {
                    const stages = IMPORT_PROCESSING_STAGES[item.source]
                    const statusLabel =
                      item.status === 'queued'
                        ? 'Queued'
                        : item.status === 'processing'
                          ? stages[item.stageIndex]
                          : item.status === 'ready'
                            ? 'Ready'
                            : 'Error'

                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-surface-0 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="figma-home-type__item-title truncate text-[15px] font-medium text-text-primary">{item.fileName}</p>
                          <p className="figma-home-type__body mt-1 text-sm text-text-secondary">{statusLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === 'ready' && item.projectId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSetupState({
                                  draft: item.draft,
                                  source: item.source,
                                  sourceLabel: item.fileName,
                                  detectedFields: buildDetectedFields(item.draft),
                                  requestSummary: item.requestSummary,
                                  queueItemId: item.id,
                                  previewVersion: 1,
                                })
                              }}
                              className="rounded-full bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
                            >
                              Review
                            </button>
                          ) : null}
                          {item.status === 'error' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setImportQueue((current) =>
                                  current.map((entry) =>
                                    entry.id === item.id
                                      ? { ...entry, status: 'queued', stageIndex: 0, errorMessage: undefined }
                                      : entry
                                  )
                                )
                              }
                              className="rounded-full border border-border px-4 py-2 text-sm text-text-primary transition-colors hover:bg-surface-1"
                            >
                              Retry
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setImportQueue((current) => current.filter((entry) => entry.id !== item.id))
                            }
                            className="rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex items-center gap-3">
                <p className="figma-home-type__label text-[15px] font-medium text-text-primary">Start from a use case</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickActionClick(action.prompt)}
                    className={cn(
                      'shrink-0 rounded-full border border-border px-5 py-2.5 text-[15px] text-text-secondary transition-colors',
                      'hover:bg-surface-1 hover:text-text-primary',
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {recentPacks.length > 0 && (
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center gap-3">
                  <p className="figma-home-type__label text-[15px] font-medium text-text-primary">Recent projects</p>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {recentPacks.map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => navigate(`/pack/${pack.id}`)}
                      className={cn(
                        'shrink-0 rounded-full border border-border px-5 py-2.5 text-[15px] text-text-secondary transition-colors',
                        'hover:bg-surface-1 hover:text-text-primary',
                      )}
                    >
                      {pack.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          <section className="flex flex-col gap-7 pt-4" aria-labelledby="home-workflow-heading">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
              <p className="figma-home-type__mono text-[12px] font-medium uppercase tracking-[0.22em] text-text-muted">
                Workflow
              </p>
              <h2
                id="home-workflow-heading"
                className="figma-home-type__section-title flex flex-wrap items-end justify-center gap-x-1.5 gap-y-1 text-center leading-none tracking-[-0.04em] text-text-primary sm:gap-x-2.5"
              >
                <span className="block self-end pr-3 leading-none text-[28px] font-semibold sm:pr-5 sm:text-[34px]">Import</span>
                <span className="block self-end leading-none text-[40px] font-bold sm:text-[56px]">Reshape</span>
                <span className="block self-end pl-3 leading-none text-[28px] font-semibold sm:pl-5 sm:text-[34px]">Edit</span>
              </h2>
              <p className="figma-home-type__body max-w-none whitespace-nowrap text-sm leading-7 text-text-secondary sm:text-[15px]">
                Bring in music, then generate the score you need for any practice, teaching, or creator scenario.
              </p>
            </div>
          </section>

          <div className="flex flex-col gap-8 pt-2">
            <div className="flex justify-center">
              <h2 className="figma-home-type__section-title text-center text-[30px] font-semibold tracking-[-0.04em] text-text-primary sm:text-[36px]">
                How creators use Lava
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {EXPLORE_USE_CASES.map((item) => (
                <div
                  key={item.title}
                  className="flex min-h-[320px] flex-col overflow-hidden rounded-[32px] border border-border bg-surface-0 text-center"
                >
                  <div className="h-40 w-full bg-surface-1">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center px-7 py-7">
                    <div className="flex min-h-[5.5rem] items-center justify-center">
                      <p className="figma-home-type__card-title text-[22px] font-medium leading-[1.08] tracking-[-0.03em] text-text-primary">
                        {item.title}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {recentPacks.length === 0 && (
            <p className="pt-1 text-center text-sm text-text-muted">
              Your projects and generated versions will appear here.
            </p>
          )}
        </div>

      <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} />

      <Dialog
        open={showIntroDialog}
        onClose={dismissIntroDialog}
        className="max-w-4xl rounded-[32px] border border-border bg-surface-0 p-0"
        backdropClassName="bg-black/35"
      >
        <div className="grid overflow-hidden rounded-[32px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-t-[32px] bg-surface-1 md:min-h-[520px] md:rounded-l-[32px] md:rounded-tr-none">
            <img
              src={INTRO_MODAL_IMAGE}
              alt="Close-up of a person writing sheet music"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            <button
              type="button"
              onMouseEnter={advanceIntroSlogan}
              onFocus={advanceIntroSlogan}
              className="figma-home-type__modal-hero absolute z-10 h-[104px] w-[10ch] text-left text-[36px] font-semibold leading-[0.96] tracking-[-0.045em] text-white transition-[top] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:text-[46px]"
              style={INTRO_SLOGAN_POSITIONS[introSloganPosition]}
            >
              Create,
              <br />
              Your Way.
            </button>
          </div>

          <div className="flex flex-col rounded-b-[32px] px-6 py-8 md:min-h-[520px] md:rounded-r-[32px] md:rounded-bl-none md:px-9 md:py-9">
            <div className="flex flex-1 flex-col justify-center space-y-8">
              <div>
                <p className="figma-home-type__card-title text-[24px] font-semibold leading-[1.05] tracking-[-0.03em] text-text-primary">
                  Start with a prompt
                </p>
                <p className="figma-home-type__body mt-2 text-[14px] leading-[1.55] text-text-secondary">
                  Describe the version you want for your audience.
                </p>
              </div>

              <div className="pt-2">
                <p className="figma-home-type__card-title text-[24px] font-semibold leading-[1.05] tracking-[-0.03em] text-text-primary">
                  Drop audio
                </p>
                <p className="figma-home-type__body mt-2 text-[14px] leading-[1.55] text-text-secondary">
                  Turn a recording into an editable guitar version.
                </p>
              </div>

              <div className="pt-2">
                <p className="figma-home-type__card-title text-[24px] font-semibold leading-[1.05] tracking-[-0.03em] text-text-primary">
                  Scan a score
                </p>
                <p className="figma-home-type__body mt-2 text-[14px] leading-[1.55] text-text-secondary">
                  PDF, image, or MusicXML and make it reusable.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissIntroDialog}
              className="mt-8 inline-flex h-14 self-start items-center justify-center rounded-full bg-text-primary px-7 text-[18px] font-medium text-surface-0 transition-opacity hover:opacity-90 md:mt-10"
            >
              Start creating
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(processingState)}
        onClose={() => setProcessingState(null)}
        title={processingState?.title}
        className="max-w-[640px] rounded-[28px] border border-border bg-surface-0 p-6"
        backdropClassName="bg-black/40"
      >
        {processingState ? (
          <div className="space-y-6" aria-live="polite">
            <div className="space-y-2">
              <p className="text-[20px] font-semibold leading-[1.2] tracking-[-0.02em] text-text-primary">
                {processingState.sourceLabel}
              </p>
              <p className="text-[13px] text-text-muted">
                {progressForIndex(processingState.stageIndex, processingState.stages.length)}% complete
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-2 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-text-primary transition-all duration-500"
                  style={{ width: `${progressForIndex(processingState.stageIndex, processingState.stages.length)}%` }}
                />
              </div>
              <p className="text-[15px] font-medium text-text-primary">
                {processingState.stages[processingState.stageIndex]}
              </p>
            </div>

            <div className="space-y-2">
              {processingState.stages.map((stage, index) => (
                <div key={stage} className="flex items-center justify-between gap-4 rounded-[16px] bg-surface-1 px-4 py-3">
                  <span
                    className={cn(
                      'text-[15px] leading-[1.35]',
                      index <= processingState.stageIndex ? 'font-medium text-text-primary' : 'text-text-muted',
                    )}
                  >
                    {stage}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {index < processingState.stageIndex ? 'Done' : index === processingState.stageIndex ? 'In progress' : 'Next'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Dialog>

      <NewPackDialog
        open={Boolean(setupState)}
        onClose={() => setSetupState(null)}
        mode="import"
        initialDraft={setupState?.draft ?? null}
        initialRequestSummary={setupState?.requestSummary ?? ''}
        sourceLabel={setupState?.sourceLabel}
        detectedFields={setupState?.detectedFields}
        previewVersionLabel={setupState?.previewVersion ? `Preview ${setupState.previewVersion}` : undefined}
        submitLabel="Build score"
        onRegeneratePreview={async () => {
          if (!setupState) return
          await new Promise((resolve) => window.setTimeout(resolve, 900))
          setSetupState((current) => {
            if (!current) return current
            const previewVersion = current.previewVersion + 1
            const draft = regenerateImportDraft(current.draft, previewVersion)
            return {
              ...current,
              draft,
              detectedFields: buildDetectedFields(draft),
              previewVersion,
            }
          })
        }}
        onSubmitDraft={(draft, requestSummary) => {
          if (!setupState) return
          void (async () => {
              const primaryFile = attachedFiles[0] ?? null
              const shouldFail = shouldMockFail(primaryFile, setupState.sourceLabel)

            try {
              const payload = buildNewPackProjectPayload(draft)
              const project = await projectService.create({
                ...payload,
                metadata: {
                  ...payload.metadata,
                  requestSummary,
                  sourceLabel: setupState.sourceLabel,
                  importSource: setupState.source,
                },
              })

              upsertProject(project)
              setAttachedFiles([])
              if (setupState.queueItemId) {
                setImportQueue((current) => current.filter((entry) => entry.id !== setupState.queueItemId))
              }
              setSetupState(null)
              navigate(`/pack/${project.id}?rendering=1&ready=1&entry=play&source=${setupState.source}${shouldFail ? '&renderFail=1' : ''}`)
            } catch (error) {
              console.error('Failed to create imported pack shell', error)
              toast('Could not start the pack.', 'error')
            }
          })()
        }}
      />

      {exportDialogState ? (
        <ExportPdfDialog
          open={exportDialogState.open}
          onClose={() => setExportDialogState(null)}
          packName={exportDialogState.packName}
          defaultLayout={exportDialogState.defaultLayout}
          keyValue={exportDialogState.keyValue}
          tempo={exportDialogState.tempo}
          timeSignature={exportDialogState.timeSignature}
          tuningLabel={exportDialogState.tuningLabel}
          capo={exportDialogState.capo}
          sections={exportDialogState.sections}
        />
      ) : null}
      </>
  )
}
