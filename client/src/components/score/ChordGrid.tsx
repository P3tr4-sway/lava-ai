import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, ChevronDown, Trash2, Music2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useLeadSheetStore, type SectionType, type LeadSheetMeasure } from '@/stores/leadSheetStore'

export const SECTION_COLORS: Record<SectionType, string> = {
  intro: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  verse: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  chorus: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  bridge: 'bg-green-500/15 border-green-500/30 text-green-400',
  outro: 'bg-pink-500/15 border-pink-500/30 text-pink-400',
  custom: 'bg-surface-3 border-border text-text-secondary',
}

// ── MeasureCell ─────────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (!isActive) setDraft(measure.chords.join(' '))
  }, [measure.chords, isActive])

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
      <div className="absolute top-1 left-1.5 text-[9px] text-text-muted tabular-nums select-none" />
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
      <div className="absolute right-0 top-2 bottom-2 w-px bg-border" />
    </div>
  )
}

// ── SectionBlock ─────────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-2">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1 group">
          <ChevronDown size={13} className={cn('text-text-muted transition-transform', collapsed && '-rotate-90')} />
        </button>
        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium', colorClass)}>
          {editingLabel ? (
            <input
              ref={labelRef}
              defaultValue={section.label}
              onBlur={(e) => { updateSectionLabel(section.id, e.target.value || section.label); setEditingLabel(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
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
            className="p-1 rounded text-text-muted hover:text-error hover:bg-surface-2 transition-colors"
            title="Remove section"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="grid grid-cols-4 gap-1.5">
          {section.measures.map((measure, idx) => (
            <div key={measure.id} className="relative">
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

// ── ChordGrid ────────────────────────────────────────────────────────────────

interface ChordGridProps {
  onSeek?: (globalBarIndex: number) => void
  className?: string
}

export function ChordGrid({ onSeek, className }: ChordGridProps) {
  const sections = useLeadSheetStore((s) => s.sections)
  const activeCell = useLeadSheetStore((s) => s.activeCell)
  const setActiveCell = useLeadSheetStore((s) => s.setActiveCell)
  const clearActiveCell = useLeadSheetStore((s) => s.clearActiveCell)
  const addSection = useLeadSheetStore((s) => s.addSection)
  const key = useLeadSheetStore((s) => s.key)
  const timeSignature = useLeadSheetStore((s) => s.timeSignature)
  const tempo = useLeadSheetStore((s) => s.tempo)

  const allCells = sections.flatMap((s) => s.measures.map((m) => ({ sectionId: s.id, measureId: m.id })))
  const sectionStartBars = sections.map((_, i) =>
    sections.slice(0, i).reduce((sum, s) => sum + s.measures.length, 0)
  )

  const handleCellTabTo = useCallback((sectionId: string, measureId: string, shift: boolean) => {
    const idx = allCells.findIndex((c) => c.sectionId === sectionId && c.measureId === measureId)
    if (idx === -1) return
    const next = shift ? idx - 1 : idx + 1
    if (next >= 0 && next < allCells.length) {
      const { sectionId: ns, measureId: nm } = allCells[next]
      setActiveCell(ns, nm)
    }
  }, [allCells, setActiveCell])

  const handleSeek = onSeek ?? (() => {})

  return (
    <div
      className={cn('flex-1 overflow-y-auto px-6 py-5', className)}
      onClick={(e) => { if (e.target === e.currentTarget) clearActiveCell() }}
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
          <div className="text-center pt-2 pb-1">
            <p className="text-xs text-text-muted font-mono">
              {key} major · {timeSignature} · ♩= {tempo}
            </p>
          </div>
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
          <div className="h-4" />
        </div>
      )}
    </div>
  )
}
