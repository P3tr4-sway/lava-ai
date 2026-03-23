import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, ChevronDown, Music2, AlignLeft, NotebookPen, FileUp, Upload, Loader2,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { SaveButton } from '@/components/ui/SaveButton'
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog'
import { useAgentStore } from '@/stores/agentStore'
import { useLeadSheetStore, type SectionType } from '@/stores/leadSheetStore'
import { useDawSetup } from '@/hooks/useDawSetup'
import { useAudioStore } from '@/stores/audioStore'
import { useProjectSave } from '@/hooks/useProjectSave'
import { useProjectStore } from '@/stores/projectStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'
import { projectService } from '@/services/projectService'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { DawPanel } from '@/components/daw/DawPanel'
import { ToneEngine } from '@/audio/ToneEngine'
import { pdfService } from '@/services/pdfService'
import { ChordGrid, PdfViewer, MetadataBar } from '@/components/score'

const SECTION_PRESETS: { type: SectionType; label: string }[] = [
  { type: 'intro', label: 'Intro' },
  { type: 'verse', label: 'Verse' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'bridge', label: 'Bridge' },
  { type: 'outro', label: 'Outro' },
  { type: 'custom', label: 'Custom' },
]

// ── LeadSheetPage ─────────────────────────────────────────────────────────

export function LeadSheetPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const loadFromProject = useLeadSheetStore((s) => s.loadFromProject)
  const setTracks = useDawPanelStore((s) => s.setTracks)
  const updateClip = useDawPanelStore((s) => s.updateClip)

  const projectName = useLeadSheetStore((s) => s.projectName)
  const setProjectName = useLeadSheetStore((s) => s.setProjectName)
  const key = useLeadSheetStore((s) => s.key)
  const setKey = useLeadSheetStore((s) => s.setKey)
  const tempo = useLeadSheetStore((s) => s.tempo)
  const setTempo = useLeadSheetStore((s) => s.setTempo)
  const timeSignature = useLeadSheetStore((s) => s.timeSignature)
  const setTimeSignature = useLeadSheetStore((s) => s.setTimeSignature)
  const sections = useLeadSheetStore((s) => s.sections)
  const addSection = useLeadSheetStore((s) => s.addSection)
  const reset = useLeadSheetStore((s) => s.reset)
  const pdfUrl = useLeadSheetStore((s) => s.pdfUrl)
  const setPdfUrl = useLeadSheetStore((s) => s.setPdfUrl)

  const { tracks, addTrack, updateTrack, committedClipIds } = useDawSetup({
    initTrackName: 'Lead Sheet',
    initDuration: 240,
  })

  const bpm = useAudioStore((s) => s.bpm)
  const setAudioTempo = useAudioStore((s) => s.setBpm)
  const setAudioKey = useAudioStore((s) => s.setKey)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)

  const { requireAuth } = useRequireAuth()

  const [mode, setMode] = useState<'leadsheet' | 'score'>('leadsheet')
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [importing, setImporting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Content tracking for save
  const hasAnySections = sections.length > 0
  const hasAnyChords = sections.some((s) => s.measures.some((m) => m.chords.length > 0))
  const hasContent = hasAnySections || committedClipIds.length > 0
  const contentFingerprint = `${projectName}|${key}|${tempo}|${timeSignature}|${sections.length}|${hasAnyChords}|${committedClipIds}`

  const buildProjectData = useCallback(() => {
    const serializedSections = sections.map((s) => ({
      id: s.id,
      type: s.type,
      label: s.label,
      measures: s.measures.map((m) => ({ id: m.id, chords: m.chords })),
    }))
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
      name: projectName,
      description: `${key} · ${timeSignature} · ${bpm} BPM`,
      space: 'learn' as const,
      metadata: {
        type: 'lead-sheet',
        key,
        tempo: bpm,
        timeSignature,
        pdfUrl,
        sections: serializedSections,
        tracks: serializedTracks,
      },
    }
  }, [projectName, key, bpm, timeSignature, pdfUrl, sections, tracks])

  const {
    saving, isSaved, showSavedBadge, blocker, handleSave, handleDialogSave,
  } = useProjectSave({ hasContent, contentFingerprint, buildProjectData, projectId: id })

  const [loadingProject, setLoadingProject] = useState(!!id)

  // Load existing project or reset for new
  useEffect(() => {
    if (id) {
      setLoadingProject(true)
      projectService.get(id).then((project) => {
        loadFromProject(project)
        setActiveProject(project)

        // Restore DAW tracks from metadata (useDawSetup resets on mount, so we overwrite after fetch)
        const savedTracks = Array.isArray(project.metadata.tracks) ? project.metadata.tracks as Array<{
          name: string
          color: { bg: string; accent: string }
          clips: Array<{ audioFileId?: string; startBar: number; lengthInBars: number; name: string }>
        }> : []

        if (savedTracks.length > 0) {
          const restoredTracks = savedTracks.map((t, idx) => {
            const base = makeTrack(t.name, idx)
            const trackColor = t.color ?? base.color
            const clips = (t.clips ?? []).map((c, ci) => ({
              id: `clip-restored-${Date.now()}-${ci}`,
              trackId: base.id,
              startBar: c.startBar ?? 0,
              lengthInBars: c.lengthInBars ?? 4,
              trimStart: 0,
              trimEnd: 0,
              audioFileId: c.audioFileId,
              committedAudioFileId: c.audioFileId,
              name: c.name ?? 'Recording',
              color: trackColor.accent,
              status: 'committed' as const,
            }))
            return { ...base, color: trackColor, clips, hasRecording: clips.length > 0 }
          })
          setTracks(restoredTracks)

          // Re-fetch audio buffers for each clip (non-blocking)
          const engine = ToneEngine.getInstance()
          for (const track of restoredTracks) {
            for (const clip of track.clips) {
              if (clip.audioFileId) {
                engine.loadBuffer(clip.audioFileId).then((audioBuffer) => {
                  updateClip(track.id, clip.id, { audioBuffer })
                }).catch((err) => {
                  console.warn(`Failed to load audio for clip "${clip.name}":`, err)
                })
              }
            }
          }
        }
      }).catch(() => {
        navigate('/projects', { replace: true })
      }).finally(() => {
        setLoadingProject(false)
      })
    } else {
      reset()
      setActiveProject(null)
    }
    return () => { setActiveProject(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn' })
  }, [setSpaceContext])

  useEffect(() => { setAudioTempo(tempo) }, [tempo, setAudioTempo])
  useEffect(() => { setAudioKey(key) }, [key, setAudioKey])

  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  const beatsPerBar = parseInt(timeSignature.split('/')[0])
  const barDuration = beatsPerBar * (60 / tempo)

  const handleSeek = useCallback((globalBarIndex: number) => {
    setCurrentTime(globalBarIndex * barDuration)
    setCurrentBar(globalBarIndex)
  }, [barDuration, setCurrentTime, setCurrentBar])

  const dawSections = useMemo(() => {
    let barStart = 0
    return sections.map((section) => {
      const barCount = section.measures.length
      const result = { label: section.label, type: section.type, barStart, barCount }
      barStart += barCount
      return result
    })
  }, [sections])

  const setActiveCell = useLeadSheetStore((s) => s.setActiveCell)

  const handleBarClick = useCallback((bar: number) => {
    let remaining = bar
    for (const section of sections) {
      if (remaining < section.measures.length) {
        const measure = section.measures[remaining]
        if (measure) setActiveCell(section.id, measure.id)
        break
      }
      remaining -= section.measures.length
    }
  }, [sections, setActiveCell])

  if (loadingProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-muted" />
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

        {/* Project name */}
        <div className="flex items-center gap-1.5">
          <Music2 size={15} className="text-text-muted shrink-0" />
          {editingName ? (
            <input
              ref={nameRef}
              defaultValue={projectName}
              onBlur={(e) => { setProjectName(e.target.value || projectName); setEditingName(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
              className="text-sm font-semibold bg-transparent text-text-primary focus:outline-none border-b border-text-primary/40 pb-0.5 min-w-[120px]"
            />
          ) : (
            <span
              className="text-sm font-semibold text-text-primary cursor-text hover:opacity-70 transition-opacity"
              onDoubleClick={() => setEditingName(true)}
              title="Double-click to rename"
            >
              {projectName}
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Key / Time / Tempo */}
        <MetadataBar
          keyValue={key}
          timeSignature={timeSignature}
          tempo={tempo}
          editable
          onKeyChange={setKey}
          onTimeSignatureChange={setTimeSignature}
          onTempoChange={setTempo}
        />

        <div className="flex-1" />

        {/* Save button */}
        <SaveButton
          saving={saving}
          hasContent={hasContent}
          isSaved={isSaved}
          showSavedBadge={showSavedBadge}
          onSave={() => { if (!requireAuth('Save Lead Sheet')) return; void handleSave() }}
        />

        {/* Mode picker */}
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
            onClick={() => setMode('score')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              mode === 'score'
                ? 'bg-surface-0 text-text-primary shadow-sm border border-border'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            <NotebookPen size={11} />
            Score
          </button>
        </div>

        {/* Add section */}
        <div className={cn('relative', mode === 'score' && 'invisible')}>
          <button
            onClick={() => setAddSectionOpen(!addSectionOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <Plus size={12} />
            Add Section
            <ChevronDown size={11} className={cn('transition-transform', addSectionOpen && 'rotate-180')} />
          </button>
          {addSectionOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface-0 border border-border rounded-xl shadow-xl py-1 z-30 w-40">
              {SECTION_PRESETS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => { addSection(type, label); setAddSectionOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────── */}
      {mode === 'leadsheet' ? (
        <ChordGrid onSeek={handleSeek} />
      ) : (
        pdfUrl ? (
          <PdfViewer pdfUrl={pdfUrl} />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4 max-w-sm">
              <div className="size-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
                <FileUp size={24} className="text-text-muted" />
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-text-primary">Import PDF Score</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Upload a PDF lead sheet to display it alongside your chord chart.
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setImporting(true)
                    try {
                      const result = await pdfService.upload(file)
                      setPdfUrl(result.url)
                    } catch (err) {
                      console.error('PDF upload failed:', err)
                    } finally {
                      setImporting(false)
                    }
                  }}
                />
                <span className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg bg-text-primary text-surface-0 text-sm font-medium hover:opacity-90 transition-opacity',
                  importing && 'opacity-50 pointer-events-none',
                )}>
                  <Upload size={14} />
                  {importing ? 'Uploading...' : 'Import PDF'}
                </span>
              </label>
            </div>
          </div>
        )
      )}

      {/* ── DAW Panel ───────────────────────────────────────────── */}
      <DawPanel
        tracks={tracks}
        onUpdateTrack={updateTrack}
        onAddTrack={() => addTrack()}
        showRecordButton={true}
        sections={dawSections}
        onBarClick={handleBarClick}
      />

      {/* ── Unsaved-changes dialog ───────────────────────────────── */}
      <UnsavedChangesDialog
        blocker={blocker}
        onSave={() => void handleDialogSave()}
        saving={saving}
        message="Your lead sheet has unsaved changes. Save it before leaving?"
      />
    </div>
  )
}
