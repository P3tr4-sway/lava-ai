import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Sparkles, Music, FileMusic } from 'lucide-react'
import { SIDEBAR_NAV_ITEMS, HOME_NAV_RESET_EVENT } from './navItems'
import { LavaLogo } from './LavaLogo'
import { cn } from '@/components/ui/utils'
import { NewPackDialog } from '@/components/projects/NewPackDialog'
import { Dialog } from '@/components/ui/Dialog'
import { PipelineSteps, type PipelineStep } from '@/components/ui/PipelineSteps'
import { buildNewPackProjectPayload, type NewPackDraft } from '@/spaces/pack/newPack'
import { projectService } from '@/services/projectService'
import { useProjectStore } from '@/stores/projectStore'

const AI_STYLE_PIPELINE_STEPS: PipelineStep[] = [
  { label: 'Stylize', icon: Sparkles },
  { label: 'Transcribe', icon: Music },
  { label: 'Build score', icon: FileMusic },
]

type AiStyleSetupState = {
  draft: NewPackDraft
  aiPrompt: string
}

function buildDetectedFields(draft: NewPackDraft) {
  return [
    { label: 'Key', value: draft.key },
    { label: 'Meter', value: draft.timeSignature },
    { label: 'Tempo', value: `${draft.tempo} BPM` },
  ]
}

export function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const upsertProject = useProjectStore((s) => s.upsertProject)
  const [newPackOpen, setNewPackOpen] = useState(false)

  // AI style multi-dialog flow
  const [showProcessing, setShowProcessing] = useState(false)
  const [processingStageIndex, setProcessingStageIndex] = useState(0)
  const [setupState, setSetupState] = useState<AiStyleSetupState | null>(null)

  const handleNavClick = (to: string) => {
    if (to === '/' && pathname === '/') {
      window.dispatchEvent(new CustomEvent(HOME_NAV_RESET_EVENT))
    }
  }

  const handleAiStyleSubmit = useCallback((draft: NewPackDraft, aiPrompt: string) => {
    setSetupState({ draft, aiPrompt })
    setProcessingStageIndex(0)
    setShowProcessing(true)
  }, [])

  const cancelAiStyleFlow = useCallback(() => {
    setShowProcessing(false)
    setSetupState(null)
  }, [])

  // Advance through processing pipeline stages
  useEffect(() => {
    if (!showProcessing) return
    const timer = window.setTimeout(() => {
      if (processingStageIndex < AI_STYLE_PIPELINE_STEPS.length - 1) {
        setProcessingStageIndex((i) => i + 1)
      } else {
        setShowProcessing(false)
        // setupState already set — the setup dialog opens automatically
      }
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [showProcessing, processingStageIndex])

  const progress = Math.round(((processingStageIndex + 1) / AI_STYLE_PIPELINE_STEPS.length) * 100)

  return (
    <>
      <nav
        className="fixed left-4 top-1/2 z-40 flex w-16 -translate-y-1/2 flex-col items-center overflow-hidden rounded-[28px] border border-border/70 bg-surface-0/92 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur"
      >
      <div className="mb-4 flex items-center justify-center px-0">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-surface-1">
            <LavaLogo />
          </div>
        </Link>
      </div>

      <div className="mb-3 flex justify-center px-0">
        <button
          onClick={() => setNewPackOpen(true)}
          title="New Pack"
          className="flex size-11 items-center justify-center gap-2 rounded-2xl bg-accent text-surface-0 transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <Plus className="size-5 shrink-0" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1.5 px-0">
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              onClick={() => handleNavClick(to)}
              title={label}
              className={cn(
                'flex size-11 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/10',
                isActive
                  ? 'bg-surface-2 text-text-primary shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]'
                  : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'
              )}
            >
              <Icon className="size-5 shrink-0" />
            </Link>
          )
        })}
      </div>
      </nav>

      {/* Step 1: Create a guitar project dialog */}
      <NewPackDialog
        open={newPackOpen}
        onClose={() => setNewPackOpen(false)}
        onAiStyleSubmit={handleAiStyleSubmit}
      />

      {/* Step 2: Processing dialog (Stylize → Transcribe → Build score) */}
      <Dialog
        open={showProcessing}
        onClose={cancelAiStyleFlow}
        title="Applying style"
        className="max-w-[640px] rounded-[28px] border border-border bg-surface-0 p-6"
        backdropClassName="bg-black/40"
      >
        {showProcessing ? (
          <div className="space-y-6" aria-live="polite">
            <div className="space-y-2">
              <p className="text-[20px] font-semibold leading-[1.2] tracking-[-0.02em] text-text-primary">
                {setupState?.draft.name ?? 'New Project'}
              </p>
              <p className="text-[13px] text-text-muted">{progress}% complete</p>
            </div>

            <PipelineSteps
              steps={AI_STYLE_PIPELINE_STEPS}
              activeIndex={processingStageIndex}
              status="running"
            />

            <div className="space-y-3">
              <div className="h-2 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-text-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[15px] font-medium text-text-primary">
                {AI_STYLE_PIPELINE_STEPS[processingStageIndex].label}
              </p>
            </div>

            <div className="space-y-2">
              {AI_STYLE_PIPELINE_STEPS.map((step, index) => (
                <div key={step.label} className="flex items-center justify-between gap-4 rounded-[16px] bg-surface-1 px-4 py-3">
                  <span
                    className={cn(
                      'text-[15px] leading-[1.35]',
                      index <= processingStageIndex ? 'font-medium text-text-primary' : 'text-text-muted',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-[13px] text-text-muted">
                    {index < processingStageIndex ? 'Done' : index === processingStageIndex ? 'In progress' : 'Next'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* Step 3: Generate guitar score (import-mode setup dialog) */}
      <NewPackDialog
        open={Boolean(setupState) && !showProcessing}
        onClose={() => setSetupState(null)}
        mode="import"
        importSource={null}
        initialDraft={setupState?.draft ?? null}
        initialRequestSummary={setupState?.aiPrompt ?? ''}
        sourceLabel={setupState?.draft.name}
        detectedFields={setupState ? buildDetectedFields(setupState.draft) : undefined}
        previewVersionLabel="Preview 1"
        previewAudioUrl={null}
        submitLabel="Generate score"
        onRegeneratePreview={async () => {
          // no audio to regenerate for AI style flow
        }}
        onSubmitDraft={async (draft, requestSummary) => {
          if (!setupState) return
          try {
            const payload = buildNewPackProjectPayload(draft)
            const project = await projectService.create({
              ...payload,
              metadata: { ...payload.metadata, requestSummary },
            })
            upsertProject(project)
            setSetupState(null)
            navigate(`/pack/${project.id}`)
          } catch (err) {
            console.error('Failed to create AI style project', err)
          }
        }}
      />
    </>
  )
}
