# Stylization Confirmation Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mechanical confirmation flow with a vivid, pipeline-aware dialog that distinguishes audio vs score stylization, adds style selection pills, and shows progress with visual feedback.

**Architecture:** Three layers of changes: (1) a reusable `PipelineSteps` horizontal stepper component, (2) enhanced `NewPackDialog` import mode with style pills and two-phase flow, (3) enhanced `PreviewBar` with change summary. All reuse existing design tokens — no new CSS custom properties or color values.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (existing tokens), lucide-react icons, Zustand stores.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/components/ui/PipelineSteps.tsx` | **Create** | Horizontal pipeline stepper with icons per step |
| `client/src/components/projects/NewPackDialog.tsx` | **Modify** | Add style pills, two-phase flow, source-aware UI |
| `client/src/spaces/home/HomePage.tsx` | **Modify** | Replace flat stage list with `PipelineSteps`, update stage labels |
| `client/src/spaces/pack/PreviewBar.tsx` | **Modify** | Add change summary pills and comparison info |

---

### Task 1: Create `PipelineSteps` component

**Files:**
- Create: `client/src/components/ui/PipelineSteps.tsx`

- [ ] **Step 1: Create the PipelineSteps component**

```tsx
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'

export interface PipelineStep {
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface PipelineStepsProps {
  steps: PipelineStep[]
  activeIndex: number
  status: 'running' | 'success' | 'error'
  className?: string
}

export function PipelineSteps({ steps, activeIndex, status, className }: PipelineStepsProps) {
  const resolvedActive = status === 'success' ? steps.length - 1 : status === 'error' ? activeIndex : activeIndex

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((step, index) => {
        const isDone = index < resolvedActive || status === 'success'
        const isActive = index === resolvedActive && status !== 'success'
        const isPending = index > resolvedActive && status !== 'success'
        const isError = index === resolvedActive && status === 'error'

        return (
          <div key={step.label} className="flex items-center gap-1">
            {/* Step node */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isDone && 'border-text-primary bg-text-primary text-surface-0',
                  isActive && !isError && 'border-text-primary text-text-primary',
                  isError && 'border-error bg-error/10 text-error',
                  isPending && 'border-border text-text-muted',
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : isActive && !isError ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <step.icon className="size-3.5" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-[13px] leading-none sm:block',
                  isDone && 'font-medium text-text-primary',
                  isActive && 'font-medium text-text-primary',
                  isError && 'font-medium text-error',
                  isPending && 'text-text-muted',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-px flex-1 min-w-[12px] transition-colors',
                  index < resolvedActive ? 'bg-text-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ui/PipelineSteps.tsx
git commit -m "feat: add PipelineSteps horizontal stepper component"
```

---

### Task 2: Update pipeline stage definitions with icons

**Files:**
- Modify: `client/src/spaces/home/HomePage.tsx:175-187` (stage constants)

- [ ] **Step 1: Add lucide icon imports**

Add to the existing import from `lucide-react` on line 4: `FileAudio, FileMusic, FileText, Sparkles, Music, Wand2`

- [ ] **Step 2: Replace IMPORT_PROCESSING_STAGES and WAITING_STAGES with richer pipeline definitions**

Replace lines 175-187 with:

```tsx
import type { PipelineStep } from '@/components/ui/PipelineSteps'

const IMPORT_PIPELINE_STEPS: Record<ImportSourceKind, PipelineStep[]> = {
  audio: [
    { label: 'Upload', icon: FileAudio },
    { label: 'Detect', icon: Music },
    { label: 'Build score', icon: FileMusic },
  ],
  youtube: [
    { label: 'Fetch', icon: FileAudio },
    { label: 'Detect', icon: Music },
    { label: 'Build score', icon: FileMusic },
  ],
  musicxml: [
    { label: 'Import', icon: FileText },
  ],
  'pdf-image': [
    { label: 'Scan', icon: FileText },
    { label: 'Read', icon: Music },
    { label: 'Build score', icon: FileMusic },
  ],
}

const WAITING_PIPELINE_STEPS: Record<ImportSourceKind, PipelineStep[]> = {
  audio: [
    { label: 'Read audio', icon: FileAudio },
    { label: 'AI stylize', icon: Sparkles },
    { label: 'Transcribe', icon: Music },
    { label: 'AI arrange', icon: Wand2 },
  ],
  youtube: [
    { label: 'Read audio', icon: FileAudio },
    { label: 'AI stylize', icon: Sparkles },
    { label: 'Transcribe', icon: Music },
    { label: 'AI arrange', icon: Wand2 },
  ],
  musicxml: [
    { label: 'Import score', icon: FileText },
    { label: 'Render MIDI', icon: Music },
    { label: 'AI stylize', icon: Sparkles },
    { label: 'Transcribe', icon: FileMusic },
    { label: 'AI arrange', icon: Wand2 },
  ],
  'pdf-image': [
    { label: 'Scan score', icon: FileText },
    { label: 'AI stylize', icon: Sparkles },
    { label: 'Transcribe', icon: Music },
    { label: 'AI arrange', icon: Wand2 },
  ],
}
```

- [ ] **Step 3: Update stage-label references**

The old `IMPORT_PROCESSING_STAGES[source]` was a `string[]`. Now the pipeline steps are `PipelineStep[]`. All code that used `.stages` (an array of strings) for `.map(stage => stage)` and `.stages[stageIndex]` needs to use the `.label` property from `PipelineStep` instead.

In the `processingState` effect (line 475-508): change `processingState.stages` references that render text to use `.map(s => s.label)` and `.stages[stageIndex].label`.

Similarly in `waitingState` effect (lines 510-566) and the `importQueue` effect (lines 570-624).

**Specifically:**

- `ProcessingState` type (line 114-123): change `stages: string[]` to `stages: PipelineStep[]`
- `WaitingState` type (line 135-149): change `stages: string[]` to `stages: PipelineStep[]`
- `ImportQueueItem` type (line 163-173): `stages` doesn't exist here — it uses `stageIndex` directly, so it accesses `IMPORT_PIPELINE_STEPS[source]` at render time.

Everywhere stages are rendered as text (the old `.map(stage => ...)` patterns), change to `.map(step => step.label)`. Every `.stages[stageIndex]` becomes `.stages[stageIndex].label`. The `stages.length` stays the same.

- [ ] **Step 4: Update ProcessingState dialog to use PipelineSteps**

Replace the stage list in the `processingState` dialog (lines 1134-1183) with `PipelineSteps`:

```tsx
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

      <PipelineSteps
        steps={processingState.stages}
        activeIndex={processingState.stageIndex}
        status="running"
      />

      <div className="space-y-2">
        {processingState.stages.map((step, index) => (
          <div key={step.label} className="flex items-center justify-between gap-4 rounded-[16px] bg-surface-1 px-4 py-3">
            <span
              className={cn(
                'text-[15px] leading-[1.35]',
                index <= processingState.stageIndex ? 'font-medium text-text-primary' : 'text-text-muted',
              )}
            >
              {step.label}
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
```

- [ ] **Step 5: Update WaitingState rendering to use PipelineSteps**

Replace the flat stage list in the `waitingState` rendering (lines 686-705) with `PipelineSteps`:

```tsx
<PipelineSteps
  steps={waitingState.stages}
  activeIndex={waitingState.stageIndex}
  status={waitingState.status === 'error' ? 'error' : waitingState.status === 'success' ? 'success' : 'running'}
  className="mt-4"
/>

<div className="mt-4 space-y-2">
  {waitingState.stages.map((step, index) => (
    <div key={step.label} className="flex items-center justify-between text-sm">
      <span className={cn(index <= waitingState.stageIndex ? 'text-text-primary' : 'text-text-muted')}>
        {step.label}
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
```

- [ ] **Step 6: Commit**

```bash
git add client/src/spaces/home/HomePage.tsx
git commit -m "feat: replace flat stage lists with PipelineSteps in import/waiting dialogs"
```

---

### Task 3: Add style pills selector to NewPackDialog import mode

**Files:**
- Modify: `client/src/components/projects/NewPackDialog.tsx:4-5, 520-646` (import mode review section)

- [ ] **Step 1: Add icon imports**

Add to the existing `lucide-react` import: `Sparkles, Guitar, Music2, Hand, Scissors, Zap, RefreshCw, Sliders`

- [ ] **Step 2: Add style options constant**

After the `LAYOUT_OPTIONS` array (line ~47), add:

```tsx
const STYLE_OPTIONS = [
  { id: 'fingerstyle', icon: Guitar, label: 'Fingerstyle', prompt: 'Create a fingerstyle version' },
  { id: 'blues', icon: Music2, label: 'Blues', prompt: 'Create a blues arrangement' },
  { id: 'fresh-cover', icon: RefreshCw, label: 'Fresh cover', prompt: 'Create a fresh cover arrangement' },
  { id: 'simplify', icon: Sliders, label: 'Simplify', prompt: 'Simplify this song' },
  { id: 'open-chords', icon: Hand, label: 'Open chords', prompt: 'Use only open chords' },
  { id: 'solo', icon: Zap, label: 'Solo', prompt: 'Turn into a guitar solo' },
] as const
```

- [ ] **Step 3: Add activeStyleId state**

In the component state declarations (around line 297-304), add:

```tsx
const [activeStyleId, setActiveStyleId] = useState<string | null>(null)
```

Reset it in the `useEffect` that resets state on `open` change (line 311-321):

```tsx
setActiveStyleId(null)
```

- [ ] **Step 4: Wire style pill selection to requestSummary**

When a style pill is selected, set the `requestSummary` to that pill's prompt. When deselected, clear it. Add a handler:

```tsx
const handleStyleSelect = (styleId: string, prompt: string) => {
  if (activeStyleId === styleId) {
    setActiveStyleId(null)
    setRequestSummary('')
  } else {
    setActiveStyleId(styleId)
    setRequestSummary(prompt)
  }
}
```

- [ ] **Step 5: Add style pills UI in import mode**

In the import mode section (after the "Audio preview" `ImportStageCard`, before the "Score info" `ImportStageCard`), add a new `ImportStageCard` for style selection:

```tsx
<ImportStageCard title="Style direction">
  <div className="flex flex-wrap gap-2">
    {STYLE_OPTIONS.map((option) => {
      const active = activeStyleId === option.id
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => handleStyleSelect(option.id, option.prompt)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all',
            active
              ? 'border-text-primary bg-text-primary text-surface-0'
              : 'border-border bg-surface-0 text-text-secondary hover:border-border-hover hover:bg-surface-2 hover:text-text-primary',
          )}
        >
          <option.icon className="size-3.5" />
          {option.label}
        </button>
      )
    })}
  </div>
  <DetailCard
    label="Or describe your own"
    helper="Optional"
    className="mt-3 min-h-[100px] gap-2 px-4 py-3"
  >
    <textarea
      aria-label="Style prompt"
      value={requestSummary}
      onChange={(event) => {
        setRequestSummary(event.target.value)
        if (event.target.value.trim()) setActiveStyleId(null)
      }}
      placeholder="Describe the style you want..."
      rows={2}
      className={cn(
        VALUE_INPUT_CLASS_NAME,
        'min-h-[56px] resize-none leading-[1.5] placeholder:text-[#a3a3a3]',
      )}
    />
  </DetailCard>
</ImportStageCard>
```

- [ ] **Step 6: Remove old style prompt from Score info card**

In the existing "Score info" `ImportStageCard`, remove the "Style prompt" `DetailCard` (lines 629-645) since it's now in the style direction section above.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/projects/NewPackDialog.tsx
git commit -m "feat: add style pills selector to NewPackDialog import mode"
```

---

### Task 4: Source-aware UI differentiation in NewPackDialog

**Files:**
- Modify: `client/src/components/projects/NewPackDialog.tsx:16-30, 446-468` (props and header)

- [ ] **Step 1: Add importSource prop**

Add to `NewPackDialogProps`:

```tsx
importSource?: ImportSourceKind | null
```

Where `ImportSourceKind` needs to be either imported from `HomePage.tsx` or defined locally. To avoid cross-file coupling, define locally:

```tsx
type ImportSourceKind = 'audio' | 'youtube' | 'musicxml' | 'pdf-image'
```

- [ ] **Step 2: Destructure the new prop**

Add `importSource` to the component destructuring.

- [ ] **Step 3: Derive source-specific display values**

After destructuring, add:

```tsx
const sourceIcon = importSource === 'audio' || importSource === 'youtube'
  ? FileAudio
  : importSource === 'musicxml'
    ? FileMusic
    : importSource === 'pdf-image'
      ? FileText
      : FileAudio

const sourceTitle = isImportMode
  ? importSource === 'audio' || importSource === 'youtube'
    ? 'Style this audio'
    : 'Style this score'
  : 'Create a guitar project'
```

Add icon imports: `FileAudio, FileMusic, FileText` from `lucide-react`.

- [ ] **Step 4: Update dialog header**

Replace the header title (line 449):

```tsx
<h2 id="new-pack-dialog-title" className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-[#111111]">
  {sourceTitle}
</h2>
```

- [ ] **Step 5: Update source section with source icon**

In the import mode source section (line 473-497), add the source icon before the source label:

```tsx
<div className="flex items-center gap-2">
  {(() => { const Icon = sourceIcon; return <Icon className="size-4 text-[#737373]" /> })()}
  <p className="truncate text-[15px] font-medium leading-[1.35] text-[#111111]">
    {sourceLabel || draft.name}
  </p>
</div>
```

- [ ] **Step 6: Pass importSource from HomePage.tsx**

In `HomePage.tsx`, update the `NewPackDialog` usage (line 1185) to pass the source:

```tsx
importSource={setupState?.source ?? null}
```

- [ ] **Step 7: Commit**

```bash
git add client/src/components/projects/NewPackDialog.tsx client/src/spaces/home/HomePage.tsx
git commit -m "feat: add source-aware UI differentiation to import dialog"
```

---

### Task 5: Two-phase dialog (source confirm → style pick)

**Files:**
- Modify: `client/src/components/projects/NewPackDialog.tsx`

- [ ] **Step 1: Add import phase state**

```tsx
type ImportPhase = 'confirm-source' | 'pick-style'
// ...
const [importPhase, setImportPhase] = useState<ImportPhase>('confirm-source')
```

Reset in the open-change effect:
```tsx
setImportPhase('confirm-source')
```

- [ ] **Step 2: Split import mode rendering into two phases**

**Phase 1 ("confirm-source")** — shows only:
- Source info (file name, detected key/meter/tempo)
- Audio preview section
- "Continue" button (replaces "Build score")

**Phase 2 ("pick-style")** — shows:
- Style pills selector (from Task 3)
- Score info fields (Key/Meter/Tempo)
- Layout selector
- Project name
- More settings
- "Build score" submit button

In the import mode rendering section, wrap the existing content in a conditional:

```tsx
{isImportMode && importPhase === 'confirm-source' ? (
  // Phase 1: source confirmation only
  <>
    {/* Source section (same as before) */}
    {/* Audio preview ImportStageCard */}
    {/* Continue button */}
    <button
      type="button"
      onClick={() => setImportPhase('pick-style')}
      className="..."
    >
      Choose a style
    </button>
  </>
) : isImportMode ? (
  // Phase 2: style + settings
  <>
    {/* Style direction ImportStageCard (from Task 3) */}
    {/* Score info ImportStageCard */}
    {/* Layout, Project name, More settings */}
  </>
) : (
  // Default mode (unchanged)
)}
```

- [ ] **Step 3: Add back button in phase 2**

In the phase 2 header area, add a back button to return to phase 1:

```tsx
<button
  type="button"
  onClick={() => setImportPhase('confirm-source')}
  className="..."
>
  ← Back
</button>
```

- [ ] **Step 4: Update footer actions per phase**

Phase 1 footer: `Cancel` + `Choose a style` (primary)
Phase 2 footer: `Cancel` + `Build score` (primary)
Default mode footer: unchanged

- [ ] **Step 5: Commit**

```bash
git add client/src/components/projects/NewPackDialog.tsx
git commit -m "feat: split import dialog into two phases (confirm-source → pick-style)"
```

---

### Task 6: Enhanced PreviewBar with change summary

**Files:**
- Modify: `client/src/spaces/pack/PreviewBar.tsx`

- [ ] **Step 1: Add change summary pills to PreviewBar**

Replace the entire PreviewBar content with an enhanced version that includes:
- A "Changes:" label followed by pill tags
- Pills derived from the version name (since version names encode the transformation, e.g. "Fingerstyle Version", "Blues Version")
- Larger action buttons with clearer labels

```tsx
import { Check, X, Columns2, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useVersionStore } from '@/stores/versionStore'

interface PreviewBarProps {
  onApply?: () => void
  onDiscard?: () => void
  onCompare?: () => void
  className?: string
}

function deriveChangeTags(name: string): string[] {
  const tags: string[] = []
  const lower = name.toLowerCase()
  if (lower.includes('fingerstyle')) tags.push('Fingerstyle')
  if (lower.includes('blues')) tags.push('Blues')
  if (lower.includes('simplif')) tags.push('Simplified')
  if (lower.includes('fresh') || lower.includes('cover')) tags.push('Fresh cover')
  if (lower.includes('solo')) tags.push('Solo')
  if (lower.includes('open chord')) tags.push('Open chords')
  if (tags.length === 0) tags.push('AI stylized')
  return tags
}

export function PreviewBar({ onApply, onDiscard, onCompare, className }: PreviewBarProps) {
  const previewVersionId = useVersionStore((s) => s.previewVersionId)
  const versions = useVersionStore((s) => s.versions)
  const previewVersion = previewVersionId
    ? versions.find((v) => v.id === previewVersionId)
    : undefined

  if (!previewVersion) return null

  const changeTags = deriveChangeTags(previewVersion.name)

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 z-30 flex flex-col gap-2',
        'border-b border-border bg-surface-1 px-4 py-2.5',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Sparkles className="size-4 shrink-0 text-accent-dim" />
          <span className="text-sm font-medium text-text-primary truncate">
            Previewing: <span className="text-accent">{previewVersion.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCompare}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            <Columns2 className="size-3.5" />
            Compare
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            <X className="size-3.5" />
            Discard
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-80"
          >
            <Check className="size-3.5" />
            Apply
          </button>
        </div>
      </div>

      {changeTags.length > 0 && (
        <div className="flex items-center gap-1.5 pl-7">
          <span className="text-[11px] text-text-muted">Changes:</span>
          {changeTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/spaces/pack/PreviewBar.tsx
git commit -m "feat: add change summary pills and sparkles icon to PreviewBar"
```

---

### Task 7: Export PipelineSteps from ui barrel

**Files:**
- Modify: `client/src/components/ui/index.ts`

- [ ] **Step 1: Add export**

```tsx
export { PipelineSteps } from './PipelineSteps'
export type { PipelineStep, PipelineStepsProps } from './PipelineSteps'
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ui/index.ts
git commit -m "feat: export PipelineSteps from ui barrel"
```

---

### Task 8: Verify build and fix any type errors

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Fix any type errors that arise from the stage type changes (`string[]` → `PipelineStep[]`).

- [ ] **Step 2: Run dev server and visually verify**

```bash
pnpm dev
```

Manually check:
1. Upload an audio file → processing dialog shows PipelineSteps with icons
2. Processing completes → waiting dialog shows PipelineSteps
3. Review imported song → NewPackDialog shows two-phase flow
4. Style pills are selectable and update the style prompt
5. Editor transform → PreviewBar shows change summary pills

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: typecheck fixes for pipeline steps integration"
```
