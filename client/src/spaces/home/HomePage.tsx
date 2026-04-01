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
  type NewPackDraft,
} from '@/spaces/pack/newPack'
import { cn } from '@/components/ui/utils'

const QUICK_ACTIONS = [
  {
    label: 'Try another style',
    prompt: 'I just learned a song and want to hear how it would feel in a softer singer-songwriter style on guitar.',
  },
  {
    label: 'Rap to electric guitar',
    prompt: 'Turn this rap melody line into an electric guitar version.',
  },
  {
    label: 'Film score to guitar',
    prompt: 'I love this section of a film score. Make it into a playable guitar arrangement.',
  },
  {
    label: 'Family gathering version',
    prompt: 'I need a version for a family gathering. Make this song easier than the tabs online.',
  },
  {
    label: 'Beginner-friendly',
    prompt: 'This song is too hard for my current level. Turn it into a simpler guitar version.',
  },
  {
    label: 'No tabs online',
    prompt: 'I want to play someone a favorite song, but it is obscure and there is no guitar tab. Make one for me.',
  },
  {
    label: 'Shift positions',
    prompt: 'Rewrite this passage so I can practice position shifts more clearly.',
  },
  {
    label: 'Fingerpicking remake',
    prompt: 'Turn this song into a fingerpicking arrangement.',
  },
  {
    label: 'Unique cover version',
    prompt: 'Make a version for a cover video that feels different from what everyone else is playing.',
  },
  {
    label: 'Creator refresh',
    prompt: 'I need fresh arrangements regularly for content. Give me a new playable version of this song.',
  },
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
}

type ReviewState = {
  draft: NewPackDraft
  source: ImportSourceKind
  sourceLabel: string
  recognitionSummary: string[]
}

type SetupState = {
  draft: NewPackDraft
  source: ImportSourceKind
  sourceLabel: string
  detectedFields: Array<{ label: string; value: string }>
}

type WaitingState = {
  visible: boolean
  status: 'running' | 'success' | 'error'
  draft: NewPackDraft
  source: ImportSourceKind
  stageIndex: number
  stages: string[]
  sourceLabel: string
  projectId?: string
  errorMessage?: string
  shouldFail: boolean
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
  'pdf-image': ['Confirm scan', 'Generate score', 'Prepare pack'],
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

function shouldMockFail(file: File | null, message: string) {
  const sourceText = `${file?.name ?? ''} ${message}`.toLowerCase()
  return sourceText.includes('noisy') || sourceText.includes('fail')
}

type SubmitPhase = 'idle' | 'analyzing' | 'arranging' | 'building'

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
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [newPackOpen, setNewPackOpen] = useState(false)
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null)
  const [reviewState, setReviewState] = useState<ReviewState | null>(null)
  const [setupState, setSetupState] = useState<SetupState | null>(null)
  const [waitingState, setWaitingState] = useState<WaitingState | null>(null)

  useEffect(() => {
    chatRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleReset = () => {
      setPhase('idle')
      setAttachedFile(null)
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

  const handleFileSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*,image/*,.pdf,.musicxml,.mxl,.xml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) setAttachedFile(file)
    }
    input.click()
  }

  const handleSend = useCallback(async (message: string) => {
    if (!message.trim() && !attachedFile) return

    const importSource = detectImportSource(attachedFile, message)
    if (importSource) {
      const draft = buildImportDraft(attachedFile, message, importSource)
      const resolvedSourceLabel = sourceLabel(attachedFile, importSource)

      if (importSource === 'musicxml') {
        setSetupState({
          draft,
          source: importSource,
          sourceLabel: resolvedSourceLabel,
          detectedFields: buildDetectedFields(draft),
        })
        return
      }

      setProcessingState({
        source: importSource,
        title: importSource === 'youtube' ? 'Reading link' : 'Reading file',
        stages: IMPORT_PROCESSING_STAGES[importSource],
        stageIndex: 0,
        draft,
        fileName: attachedFile?.name,
        sourceLabel: resolvedSourceLabel,
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
  }, [attachedFile, navigate, upsertProject])

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
      }

      if (processingState.source === 'pdf-image') {
        setReviewState({
          draft: processingState.draft,
          source: processingState.source,
          sourceLabel: processingState.sourceLabel,
          recognitionSummary: [
            'Staff and bars detected',
            `Suggested key: ${processingState.draft.key}`,
            `Suggested tempo: ${processingState.draft.tempo} BPM`,
          ],
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
        const project = await projectService.create(buildNewPackProjectPayload(waitingState.draft))
        upsertProject(project)
        setWaitingState((current) => current ? {
          ...current,
          status: 'success',
          visible: true,
          projectId: project.id,
        } : null)
        setAttachedFile(null)
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
                    ? 'Pack ready'
                    : waitingState.status === 'error'
                      ? 'Import failed'
                      : waitingState.stages[waitingState.stageIndex]}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {waitingState.sourceLabel}
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
                      setAttachedFile(null)
                    }}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
                  >
                    Upload score instead
                  </button>
                </div>
              </div>
            ) : null}

            {waitingState.status === 'running' ? (
              <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <p className="text-sm font-medium text-text-primary">You can leave this page.</p>
                <p className="mt-1 text-sm text-text-secondary">We will notify you when the pack is ready.</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                {waitingState.status === 'success'
                  ? 'Open the pack or go back home.'
                  : 'You can keep browsing while we finish this.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {waitingState.status === 'success' && waitingState.projectId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/pack/${waitingState.projectId}`)}
                    className="rounded-full bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
                  >
                    Open Pack
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setWaitingState((current) => current ? { ...current, visible: false } : null)
                    toast('We will notify you when the pack is ready.')
                  }}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
                >
                  {waitingState.status === 'success' ? 'Back home' : 'Keep browsing'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} />
      </>
    )
  }

  return (
      <>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-14 px-6 pb-14 pt-16 md:pt-20 lg:pt-[16vh]">
          {/* Hero */}
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center gap-4">
            <h1 className="text-[44px] font-bold leading-[0.96] tracking-tight text-text-primary sm:text-[52px]">
              Practice any song your way
            </h1>
            <p className="max-w-xl text-base leading-7 text-text-secondary sm:text-[17px]">
              Upload a song, get a practice pack in seconds
            </p>
          </div>

          {/* Input area */}
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {/* File chip */}
            {attachedFile && (
              <div className="flex w-fit max-w-full items-center gap-2 rounded-full bg-surface-1 px-3 py-1.5 text-sm text-text-primary">
                <Paperclip className="size-3.5 text-text-secondary" />
                <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="text-text-muted transition-colors hover:text-text-primary">
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Chat input with attachment */}
            <div className="relative">
              <ChatInput
                ref={chatRef}
                onSend={handleSend}
                placeholder="Add or drag sheet music and audio here..."
                density="roomy"
                onAttachClick={handleFileSelect}
                canSend={Boolean(attachedFile)}
              />
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-text-primary">Quick actions</p>
                <span className="text-xs text-text-muted">Tap to fill</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickActionClick(action.prompt)}
                    className={cn(
                      'shrink-0 rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors',
                      'hover:bg-surface-1 hover:text-text-primary',
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent packs */}
          {recentPacks.length > 0 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-text-primary">Recent</h2>
                <span className="hidden text-sm text-text-muted sm:block">Continue where you left off</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentPacks.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => navigate(`/pack/${pack.id}`)}
                    className="flex min-w-[196px] flex-col gap-2 rounded-2xl border border-border bg-surface-0 p-4 text-left transition-colors hover:bg-surface-1"
                  >
                    <span className="text-sm font-medium text-text-primary truncate">
                      {pack.name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {new Date(pack.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentPacks.length === 0 && (
            <p className="pt-1 text-center text-sm text-text-muted">
              Your practice packs will appear here.
            </p>
          )}
        </div>

      <NewPackDialog open={newPackOpen} onClose={() => setNewPackOpen(false)} />

      <Dialog
        open={Boolean(processingState)}
        onClose={() => setProcessingState(null)}
        title={processingState?.title}
        className="max-w-lg rounded-[24px] border border-border bg-surface-0 p-6"
        backdropClassName="bg-black/40"
      >
        {processingState ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-surface-1 px-3 py-1 text-xs font-medium text-text-secondary">
                Step 1 of 3
              </span>
              <span className="text-xs font-medium text-text-muted">
                {progressForIndex(processingState.stageIndex, processingState.stages.length)}%
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              {processingState.sourceLabel}
            </p>
            <div className="h-2 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progressForIndex(processingState.stageIndex, processingState.stages.length)}%` }}
              />
            </div>
            <div className="space-y-2">
              {processingState.stages.map((stage, index) => (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <span className={cn(index <= processingState.stageIndex ? 'text-text-primary' : 'text-text-muted')}>
                    {stage}
                  </span>
                  <span className="text-text-muted">
                    {index < processingState.stageIndex ? 'Done' : index === processingState.stageIndex ? 'Now' : 'Next'}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
              <p className="text-sm font-medium text-text-primary">Please wait</p>
              <p className="mt-1 text-sm text-text-secondary">We are reading the source before setup.</p>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(reviewState)}
        onClose={() => setReviewState(null)}
        title="Review OCR result"
        className="max-w-xl rounded-[24px] border border-border bg-surface-0 p-6"
        backdropClassName="bg-black/40"
      >
        {reviewState ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-surface-1 px-3 py-1 text-xs font-medium text-text-secondary">
                Step 2 of 3
              </span>
              <span className="text-xs font-medium text-text-muted">Check scan</span>
            </div>
            <p className="text-sm text-text-secondary">
              Check the scan before creating the pack.
            </p>
            <div className="rounded-2xl border border-border bg-surface-1 p-4">
              <p className="text-sm font-medium text-text-primary">Detected from {reviewState.sourceLabel}</p>
              <ul className="space-y-2 text-sm text-text-primary">
                {reviewState.recognitionSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Check this carefully</p>
              <p className="mt-1 text-sm text-amber-800">If the scan looks wrong, retry before moving on.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewState(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
              >
                Retry scan
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetupState({
                    draft: reviewState.draft,
                    source: reviewState.source,
                    sourceLabel: reviewState.sourceLabel,
                    detectedFields: buildDetectedFields(reviewState.draft),
                  })
                  setReviewState(null)
                }}
                className="rounded-full bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <NewPackDialog
        open={Boolean(setupState)}
        onClose={() => setSetupState(null)}
        mode="import"
        initialDraft={setupState?.draft ?? null}
        sourceLabel={setupState?.sourceLabel}
        detectedFields={setupState?.detectedFields}
        submitLabel="Create Pack"
        onSubmitDraft={(draft) => {
          if (!setupState) return
          const shouldFail = shouldMockFail(attachedFile, setupState.sourceLabel)
          setWaitingState({
            visible: true,
            status: 'running',
            draft,
            source: setupState.source,
            stageIndex: 0,
            stages: WAITING_STAGES[setupState.source],
            sourceLabel: setupState.sourceLabel,
            shouldFail,
          })
        }}
      />
      </>
  )
}
