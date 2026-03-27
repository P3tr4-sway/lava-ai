import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { ToneChainSlotSnapshot } from '@lava/shared'
import { useAgentStore } from '@/stores/agentStore'
import { useProjectStore } from '@/stores/projectStore'
import { useToneStore, type ToneProjectMetadata } from '@/stores/toneStore'
import { cn } from '@/components/ui/utils'
import {
  ChevronDown,
  ChevronLeft,
  RotateCcw,
  Save,
  Share2,
  Power,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { projectService } from '@/services/projectService'
import {
  CATEGORIES,
  PEDAL_CATALOG,
  PRESETS,
  createDefaultToneState,
  findPedal,
  getPresetName,
  type Knob,
} from './toneModel'

interface ChainPedalProps {
  slot: ToneChainSlotSnapshot
  isSelected: boolean
  onClick: () => void
}

function buildPersistedMessages(messages: ReturnType<typeof useAgentStore.getState>['messages']) {
  return messages.filter((message) => !message.localOnly && !message.hidden)
}

function KnobControl({ knob, onChange, size = 'sm' }: {
  knob: Knob
  onChange: (value: number) => void
  size?: 'sm' | 'lg'
}) {
  const knobRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  const rotation = (knob.value / 100) * 270 - 135

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startValue: knob.value }
    const el = knobRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [knob.value])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = (dragRef.current.startY - e.clientY) * 0.5
    const newValue = Math.max(0, Math.min(100, dragRef.current.startValue + delta))
    onChange(Math.round(newValue))
  }, [onChange])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const isLarge = size === 'lg'

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          'rounded-full bg-surface-0 border-2 border-border-hover cursor-grab active:cursor-grabbing relative select-none',
          isLarge ? 'w-14 h-14' : 'w-8 h-8',
        )}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className={cn(
          'absolute left-1/2 bg-text-primary rounded-full -translate-x-1/2',
          isLarge ? 'w-1 h-3 top-1' : 'w-0.5 h-2 top-0.5',
        )} />
      </div>
      <span className={cn('text-text-secondary leading-none', isLarge ? 'text-xs' : 'text-2xs')}>{knob.label}</span>
      <span className={cn('text-text-muted leading-none tabular-nums', isLarge ? 'text-xs' : 'text-2xs')}>{knob.value}</span>
    </div>
  )
}

function ChainPedalThumbnail({ slot, isSelected, onClick }: ChainPedalProps) {
  const pedal = slot.pedalId ? findPedal(slot.pedalId) : null

  if (!pedal) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-20 h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-text-muted hover:border-border-hover hover:text-text-secondary transition-colors shrink-0',
          isSelected ? 'border-accent bg-surface-3' : 'border-border',
        )}
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-20 h-24 rounded-lg border-2 flex flex-col items-center justify-center gap-1 shrink-0 transition-all',
        isSelected ? 'border-accent ring-1 ring-accent/30 bg-surface-3' : 'border-border hover:border-border-hover',
      )}
    >
      <div className={cn('w-10 h-10 rounded-md flex items-center justify-center', pedal.color)}>
        <Power size={16} className="text-white/80" />
      </div>
      <span className="text-2xs text-text-primary font-medium leading-tight text-center px-1 truncate w-full">
        {pedal.name}
      </span>
    </button>
  )
}

export function TonePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const setActiveThread = useAgentStore((s) => s.setActiveThread)
  const replaceMessages = useAgentStore((s) => s.replaceMessages)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const upsertProject = useProjectStore((s) => s.upsertProject)

  const projectId = useToneStore((s) => s.projectId)
  const projectName = useToneStore((s) => s.projectName)
  const loadedProjectId = useToneStore((s) => s.loadedProjectId)
  const chain = useToneStore((s) => s.chain)
  const selectedSlotId = useToneStore((s) => s.selectedSlotId)
  const activeCategory = useToneStore((s) => s.activeCategory)
  const selectedPreset = useToneStore((s) => s.selectedPreset)
  const pedalKnobs = useToneStore((s) => s.pedalKnobs)
  const resetDraft = useToneStore((s) => s.resetDraft)
  const loadSnapshot = useToneStore((s) => s.loadSnapshot)
  const setSelectedSlotId = useToneStore((s) => s.setSelectedSlotId)
  const setActiveCategory = useToneStore((s) => s.setActiveCategory)
  const setSelectedPreset = useToneStore((s) => s.setSelectedPreset)
  const pickPedal = useToneStore((s) => s.pickPedal)
  const setKnobValue = useToneStore((s) => s.setKnobValue)
  const addSlot = useToneStore((s) => s.addSlot)
  const removeSlot = useToneStore((s) => s.removeSlot)
  const getCurrentKnobs = useToneStore((s) => s.getCurrentKnobs)
  const getSelectedPedal = useToneStore((s) => s.getSelectedPedal)
  const getToneContextSummary = useToneStore((s) => s.getToneContextSummary)

  const [presetOpen, setPresetOpen] = useState(false)
  const [loadingProject, setLoadingProject] = useState(false)

  const queryProjectId = searchParams.get('projectId') ?? undefined
  const requestedPresetId = typeof location.state?.presetId === 'string' ? location.state.presetId : null
  const selectedPedal = getSelectedPedal()
  const currentKnobs = getCurrentKnobs()
  const from = typeof location.state?.from === 'string' ? location.state.from : null
  const threadId = projectId ? `tone:${projectId}` : 'tone:draft'

  useEffect(() => {
    let ignore = false

    const loadProject = async () => {
      if (!queryProjectId) {
        resetDraft()
        setActiveProject(null)
        setActiveThread('tone:draft')
        replaceMessages([])
        return
      }

      if (loadedProjectId === queryProjectId) {
        setActiveThread(`tone:${queryProjectId}`)
        return
      }

      setLoadingProject(true)

      try {
        const project = await projectService.get(queryProjectId)
        if (ignore) return

        const metadata = project.metadata as Partial<ToneProjectMetadata>
        if (metadata.type !== 'tone-patch') {
          navigate('/?tab=tools', { replace: true })
          return
        }

        loadSnapshot(metadata.toneState, project.id, project.name)
        setActiveProject(project)
        setActiveThread(`tone:${project.id}`)
        replaceMessages(Array.isArray(metadata.agentThread?.messages) ? metadata.agentThread?.messages as ReturnType<typeof useAgentStore.getState>['messages'] : [])
      } catch {
        if (!ignore) navigate('/?tab=tools', { replace: true })
      } finally {
        if (!ignore) setLoadingProject(false)
      }
    }

    void loadProject()

    return () => {
      ignore = true
    }
  }, [loadedProjectId, loadSnapshot, navigate, queryProjectId, replaceMessages, resetDraft, setActiveProject, setActiveThread])

  useEffect(() => {
    if (!projectId) return
    if (searchParams.get('projectId') === projectId) return

    const next = new URLSearchParams(searchParams)
    next.set('projectId', projectId)
    setSearchParams(next, { replace: true })
  }, [projectId, searchParams, setSearchParams])

  useEffect(() => {
    if (selectedPedal) {
      setActiveCategory(selectedPedal.category)
    }
  }, [selectedPedal, setActiveCategory])

  useEffect(() => {
    if (!requestedPresetId) return
    if (!PRESETS.some((preset) => preset.id === requestedPresetId)) return
    if (requestedPresetId === selectedPreset) return

    // 允许从 Files 资产页直接打开目标 preset，保证管理页和 Tone 编辑页共享同一套预设源。
    setSelectedPreset(requestedPresetId)
  }, [requestedPresetId, selectedPreset, setSelectedPreset])

  useEffect(() => {
    const { selectedPresetName, chainSummary, knobSummary, selectedPedalName } = getToneContextSummary()

    setSpaceContext({
      currentSpace: 'tone',
      projectId,
      projectName,
      toneContext: {
        selectedPreset,
        selectedPresetName,
        selectedSlotId,
        selectedPedalId: chain.find((slot) => slot.id === selectedSlotId)?.pedalId ?? null,
        selectedPedalName,
        activeCategory,
        chainSummary,
        knobSummary,
      },
    })
  }, [activeCategory, chain, getToneContextSummary, projectId, projectName, selectedPreset, selectedSlotId, setSpaceContext])

  useEffect(() => {
    if (!projectId || loadingProject || isStreaming) return

    const timeout = window.setTimeout(() => {
      const state = useToneStore.getState()
      const metadata: ToneProjectMetadata = {
        type: 'tone-patch',
        toneState: {
          selectedPreset: state.selectedPreset,
          selectedSlotId: state.selectedSlotId,
          activeCategory: state.activeCategory,
          chain: state.chain,
          pedalKnobs: state.pedalKnobs,
        },
        agentThread: {
          id: threadId,
          title: projectName ?? `${getPresetName(state.selectedPreset)} Tone`,
          messages: buildPersistedMessages(messages),
          updatedAt: Date.now(),
        },
      }

      void projectService.update(projectId, {
        name: projectName ?? `${getPresetName(state.selectedPreset)} Tone`,
        description: 'AI tone patch',
        space: 'tools',
        metadata: metadata as unknown as Record<string, unknown>,
      }).then((project) => {
        upsertProject(project)
        setActiveProject(project)
      }).catch(() => {})
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [activeCategory, chain, isStreaming, loadingProject, messages, pedalKnobs, projectId, projectName, selectedPreset, selectedSlotId, setActiveProject, threadId, upsertProject])

  const handleGoBack = () => {
    if (from && from !== `${location.pathname}${location.search}`) {
      navigate(from)
      return
    }

    navigate('/?tab=tools')
  }

  const handleResetTone = () => {
    if (!projectId) {
      resetDraft()
      return
    }

    const draft = createDefaultToneState()
    loadSnapshot(draft, projectId, projectName)
  }

  const filteredPedals = useMemo(
    () => PEDAL_CATALOG.filter((pedal) => pedal.category === activeCategory),
    [activeCategory],
  )
  const currentPreset = PRESETS.find((preset) => preset.id === selectedPreset)

  if (loadingProject) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-secondary">
        Loading tone project...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col md:flex-row">
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon-sm" onClick={handleGoBack}>
                  <ChevronLeft size={16} />
                </Button>
                <div className="relative">
                  <button
                    onClick={() => setPresetOpen((open) => !open)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-lg hover:border-border-hover transition-colors"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {currentPreset?.name ?? 'Custom'}
                    </span>
                    <ChevronDown size={14} className="text-text-muted" />
                  </button>
                  {presetOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-surface-2 border border-border rounded-lg shadow-lg z-20 py-1">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setSelectedPreset(preset.id)
                            setPresetOpen(false)
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm hover:bg-surface-3 transition-colors',
                            selectedPreset === preset.id ? 'text-text-primary font-medium' : 'text-text-secondary',
                          )}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" title="Reset" onClick={handleResetTone}>
                  <RotateCcw size={14} />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Save">
                  <Save size={14} />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Share">
                  <Share2 size={14} />
                </Button>
              </div>
            </div>

            <div className="border-b border-border bg-surface-1 px-4 py-5">
              <p className="text-xs text-text-muted mb-3 uppercase tracking-widest">Signal Chain</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-2xs font-mono text-green-500 uppercase">IN</span>
                  <div className="w-6 h-px bg-green-500/50" />
                </div>

                {chain.map((slot, index) => (
                  <div key={slot.id} className="flex items-center gap-2 shrink-0">
                    <ChainPedalThumbnail
                      slot={slot}
                      isSelected={slot.id === selectedSlotId}
                      onClick={() => setSelectedSlotId(slot.id)}
                    />
                    {index < chain.length - 1 && <div className="w-4 h-px bg-border" />}
                  </div>
                ))}

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-4 h-px bg-border" />
                  <button
                    onClick={addSlot}
                    className="w-8 h-8 rounded-full border border-dashed border-border hover:border-border-hover flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <span className="text-sm leading-none">+</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-6 h-px bg-red-500/50" />
                  <span className="text-2xs font-mono text-red-500 uppercase">OUT</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <div className="border-b border-border px-4 py-2 flex gap-1 overflow-x-auto">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.key}
                    onClick={() => setActiveCategory(category.key)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors shrink-0',
                      activeCategory === category.key
                        ? 'bg-accent text-surface-0'
                        : 'bg-surface-2 text-text-secondary hover:bg-surface-3',
                    )}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredPedals.map((pedal) => {
                    const isInChain = chain.some((slot) => slot.pedalId === pedal.id)
                    return (
                      <button
                        key={pedal.id}
                        onClick={() => pickPedal(pedal)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:-translate-y-0.5',
                          isInChain
                            ? 'border-accent bg-surface-2'
                            : 'border-border hover:border-border-hover bg-surface-1 hover:bg-surface-2',
                        )}
                      >
                        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', pedal.color)}>
                          <Power size={20} className="text-white/80" />
                        </div>
                        <span className="text-xs font-medium text-text-primary text-center leading-tight">{pedal.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-[340px] lg:w-[400px] border-l border-border bg-surface-1 flex flex-col shrink-0">
            {selectedPedal ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
                <div className={cn(
                  'w-48 h-64 rounded-2xl border-4 border-surface-4 flex flex-col items-center justify-between py-6 px-4 shadow-lg relative',
                  selectedPedal.color,
                )}>
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />

                  <div className="flex flex-wrap justify-center gap-4">
                    {currentKnobs.map((knob) => (
                      <KnobControl
                        key={knob.id}
                        knob={knob}
                        onChange={(value) => setKnobValue(selectedSlotId, knob.id, value)}
                        size="lg"
                      />
                    ))}
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-md px-3 py-1.5">
                    <p className="text-sm font-bold text-white tracking-wide text-center uppercase">
                      {selectedPedal.name}
                    </p>
                  </div>

                  <div className="w-10 h-5 rounded bg-surface-4/80 border border-white/10" />
                </div>

                <div className="text-center">
                  <p className="text-base font-semibold text-text-primary">{selectedPedal.name}</p>
                  <p className="text-xs text-text-muted capitalize mt-0.5">{selectedPedal.category}</p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSlot(selectedSlotId)}
                  className="text-text-muted hover:text-error"
                >
                  Remove from chain
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
                  <Power size={32} className="text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary">Select a slot in the chain</p>
                <p className="text-xs text-text-muted mt-1">Then pick a pedal from the left</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
