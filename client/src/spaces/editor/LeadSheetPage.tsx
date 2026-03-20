import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, ChevronDown, Trash2, Music2, Play, Pause, SkipBack,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useAgentStore } from '@/stores/agentStore'
import { useLeadSheetStore, type SectionType, type LeadSheetMeasure } from '@/stores/leadSheetStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'
import { useAudioStore } from '@/stores/audioStore'
import { DawPanel } from '@/components/daw/DawPanel'
import { KEYS } from '@lava/shared'

const TIME_SIGS = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8']
const SECTION_PRESETS: { type: SectionType; label: string }[] = [
  { type: 'intro', label: 'Intro' },
  { type: 'verse', label: 'Verse' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'bridge', label: 'Bridge' },
  { type: 'outro', label: 'Outro' },
  { type: 'custom', label: 'Custom' },
]

const SECTION_COLORS: Record<SectionType, string> = {
  intro: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  verse: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  chorus: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  bridge: 'bg-green-500/15 border-green-500/30 text-green-400',
  outro: 'bg-pink-500/15 border-pink-500/30 text-pink-400',
  custom: 'bg-surface-3 border-border text-text-secondary',
}

// ── MeasureCell ────────────────────────────────────────────────────────────

interface MeasureCellProps {
  measure: LeadSheetMeasure
  sectionId: string
  isActive: boolean
  onActivate: () => void
  onChordChange: (chords: string[]) => void
  onTab: (shift: boolean) => void
  onSeek: () => void
}

function MeasureCell({ measure, sectionId: _sectionId, isActive, onActivate, onChordChange, onTab, onSeek }: MeasureCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(measure.chords.join(' '))

  // Sync draft when measure changes externally
  useEffect(() => {
    if (!isActive) setDraft(measure.chords.join(' '))
  }, [measure.chords, isActive])

  // Focus when activated
  useEffect(() => {
    if (isActive) inputRef.current?.focus()
  }, [isActive])

  const commit = useCallback(() => {
    const chords = draft.trim() ? draft.trim().split(/\s+/) : []
    onChordChange(chords)
  }, [draft, onChordChange])

  return (
    <div
      className={cn(
        'relative border rounded-lg overflow-hidden transition-all cursor-text',
        'min-h-[64px] flex flex-col',
        isActive
          ? 'border-text-primary ring-1 ring-text-primary/30 bg-surface-0'
          : 'border-border bg-surface-1 hover:border-border-hover hover:bg-surface-2',
      )}
      onClick={() => { onSeek(); onActivate() }}
    >
      {/* Bar number */}
      <div className="absolute top-1 left-1.5 text-[9px] text-text-muted tabular-nums select-none">
        {/* shown by parent */}
      </div>

      {/* Chord display / edit */}
      <div className="flex-1 flex items-center justify-center p-1.5">
        {isActive ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { commit(); e.currentTarget.blur() }
              else if (e.key === 'Tab') { e.preventDefault(); commit(); onTab(e.shiftKey) }
              else if (e.key === 'Escape') { e.currentTarget.blur() }
            }}
            placeholder="Am7"
            className="w-full text-center text-sm font-medium bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        ) : (
          <span className={cn(
            'text-sm font-semibold text-center leading-tight',
            measure.chords.length > 0 ? 'text-text-primary' : 'text-text-muted/40',
          )}>
            {measure.chords.length > 0 ? measure.chords.join('  ') : '—'}
          </span>
        )}
      </div>

      {/* Bottom bar line indicator */}
      <div className="absolute right-0 top-2 bottom-2 w-px bg-border" />
    </div>
  )
}

// ── LeadSheetSection ──────────────────────────────────────────────────────

interface SectionBlockProps {
  section: ReturnType<typeof useLeadSheetStore.getState>['sections'][number]
  activeCellId: string | null
  onCellActivate: (sectionId: string, measureId: string) => void
  onCellTabTo: (sectionId: string, measureId: string, shift: boolean) => void
  startBarIndex: number
  onSeek: (globalBarIndex: number) => void
}

function SectionBlock({ section, activeCellId, onCellActivate, onCellTabTo, startBarIndex, onSeek }: SectionBlockProps) {
  const setChord = useLeadSheetStore((s) => s.setChord)
  const addMeasure = useLeadSheetStore((s) => s.addMeasure)
  const removeSection = useLeadSheetStore((s) => s.removeSection)
  const updateSectionLabel = useLeadSheetStore((s) => s.updateSectionLabel)
  const [collapsed, setCollapsed] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingLabel) labelRef.current?.focus()
  }, [editingLabel])

  const colorClass = SECTION_COLORS[section.type]

  return (
    <div className="flex flex-col gap-1.5">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 group"
        >
          <ChevronDown
            size={13}
            className={cn('text-text-muted transition-transform', collapsed && '-rotate-90')}
          />
        </button>

        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium', colorClass)}>
          {editingLabel ? (
            <input
              ref={labelRef}
              defaultValue={section.label}
              onBlur={(e) => { updateSectionLabel(section.id, e.target.value || section.label); setEditingLabel(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
              }}
              className="bg-transparent focus:outline-none w-24"
            />
          ) : (
            <span onDoubleClick={() => setEditingLabel(true)} className="cursor-text">{section.label}</span>
          )}
          <span className="text-current/50">{section.measures.length} bars</span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => addMeasure(section.id)}
            className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
            title="Add measure"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => removeSection(section.id)}
            className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-surface-2 transition-colors"
            title="Remove section"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Measures grid — 4 columns */}
      {!collapsed && (
        <div className="grid grid-cols-4 gap-1.5">
          {section.measures.map((measure, idx) => (
            <div key={measure.id} className="relative">
              {/* Bar number */}
              <div className="absolute top-1 left-1.5 text-[9px] text-text-muted tabular-nums select-none z-10">
                {idx + 1}
              </div>
              <MeasureCell
                measure={measure}
                sectionId={section.id}
                isActive={activeCellId === measure.id}
                onActivate={() => onCellActivate(section.id, measure.id)}
                onChordChange={(chords) => setChord(section.id, measure.id, chords)}
                onTab={(shift) => onCellTabTo(section.id, measure.id, shift)}
                onSeek={() => onSeek(startBarIndex + idx)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── LeadSheetPage ─────────────────────────────────────────────────────────

export function LeadSheetPage() {
  const navigate = useNavigate()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

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
  const activeCell = useLeadSheetStore((s) => s.activeCell)
  const setActiveCell = useLeadSheetStore((s) => s.setActiveCell)
  const clearActiveCell = useLeadSheetStore((s) => s.clearActiveCell)
  const reset = useLeadSheetStore((s) => s.reset)

  const tracks = useDawPanelStore((s) => s.tracks)
  const setTracks = useDawPanelStore((s) => s.setTracks)
  const addTrack = useDawPanelStore((s) => s.addTrack)
  const updateTrack = useDawPanelStore((s) => s.updateTrack)

  const setAudioTempo = useAudioStore((s) => s.setBpm)
  const setAudioKey = useAudioStore((s) => s.setKey)
  const setDuration = useAudioStore((s) => s.setDuration)
  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const setCurrentBar = useAudioStore((s) => s.setCurrentBar)
  const isPlaying = playbackState === 'playing'

  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Init tracks and audio state on mount
  useEffect(() => {
    reset()
    setTracks([makeTrack('Lead Sheet', 0)])
    setDuration(240)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn' })
  }, [setSpaceContext])

  // Sync tempo/key with audio store
  useEffect(() => { setAudioTempo(tempo) }, [tempo, setAudioTempo])
  useEffect(() => { setAudioKey(key) }, [key, setAudioKey])

  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  // Build flat list of all measure cells for Tab navigation
  const allCells = sections.flatMap((s) => s.measures.map((m) => ({ sectionId: s.id, measureId: m.id })))

  // Compute start bar index for each section (cumulative)
  const sectionStartBars = sections.map((_, i) =>
    sections.slice(0, i).reduce((sum, s) => sum + s.measures.length, 0)
  )

  // Duration of one bar in seconds
  const beatsPerBar = parseInt(timeSignature.split('/')[0])
  const barDuration = beatsPerBar * (60 / tempo)

  const handleSeek = useCallback((globalBarIndex: number) => {
    setCurrentTime(globalBarIndex * barDuration)
    setCurrentBar(globalBarIndex)
  }, [barDuration, setCurrentTime, setCurrentBar])

  // Compute section layout for the DAW panel marker/ruler
  const dawSections = useMemo(() => {
    let barStart = 0
    return sections.map((section) => {
      const barCount = section.measures.length
      const result = {
        label: section.label,
        type: section.type,
        barStart,
        barCount,
      }
      barStart += barCount
      return result
    })
  }, [sections])

  // DAW bar click → highlight the corresponding lead sheet measure
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

  const handleCellTabTo = useCallback((sectionId: string, measureId: string, shift: boolean) => {
    const idx = allCells.findIndex((c) => c.sectionId === sectionId && c.measureId === measureId)
    if (idx === -1) return
    const next = shift ? idx - 1 : idx + 1
    if (next >= 0 && next < allCells.length) {
      const { sectionId: ns, measureId: nm } = allCells[next]
      setActiveCell(ns, nm)
    }
  }, [allCells, setActiveCell])

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

        {/* Key selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Key</span>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary focus:outline-none focus:border-text-primary/40 cursor-pointer"
          >
            {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Time signature */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Time</span>
          <select
            value={timeSignature}
            onChange={(e) => setTimeSignature(e.target.value)}
            className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary focus:outline-none focus:border-text-primary/40 cursor-pointer"
          >
            {TIME_SIGS.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
          </select>
        </div>

        {/* Tempo */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">♩=</span>
          <input
            type="number"
            min={40}
            max={300}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            className="w-14 text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary focus:outline-none focus:border-text-primary/40 tabular-nums text-center"
          />
        </div>

        <div className="flex-1" />

        {/* Add section */}
        <div className="relative">
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

      {/* ── Lead sheet content area ──────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-6 py-5"
        onClick={(e) => {
          // Clear active cell when clicking outside a measure
          if (e.target === e.currentTarget) clearActiveCell()
        }}
      >
        {sections.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <Music2 size={40} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">No sections yet</p>
              <p className="text-xs text-text-muted">Click "Add Section" to start building your lead sheet</p>
              <button
                onClick={() => addSection('verse', 'Verse 1')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-text-primary text-surface-0 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                Add first section
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            {/* Title block */}
            <div className="text-center pt-2 pb-1">
              <p className="text-xs text-text-muted font-mono">
                {key} major · {timeSignature} · ♩= {tempo}
              </p>
            </div>

            {/* Sections */}
            {sections.map((section, sIdx) => (
              <SectionBlock
                key={section.id}
                section={section}
                activeCellId={activeCell?.sectionId === section.id ? activeCell.measureId : null}
                onCellActivate={(sId, mId) => setActiveCell(sId, mId)}
                onCellTabTo={handleCellTabTo}
                startBarIndex={sectionStartBars[sIdx]}
                onSeek={handleSeek}
              />
            ))}

            {/* Bottom padding */}
            <div className="h-4" />
          </div>
        )}
      </div>

      {/* ── DAW Panel (no transport bar — workstation mode) ──────── */}
      <DawPanel
        tracks={tracks}
        onUpdateTrack={updateTrack}
        onAddTrack={() => addTrack()}
        showRecordButton={true}
        showTransportBar={false}
        sections={dawSections}
        onBarClick={handleBarClick}
      />

      {/* ── Minimal bottom transport ─────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-center gap-3 h-12 border-t border-border bg-surface-0">
        <button
          onClick={() => { setCurrentTime(0); setPlaybackState('stopped') }}
          className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          title="Back to start"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={() => setPlaybackState(isPlaying ? 'paused' : 'playing')}
          className="w-10 h-10 rounded-full bg-text-primary text-surface-0 flex items-center justify-center hover:opacity-80 transition-opacity"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
      </div>
    </div>
  )
}
