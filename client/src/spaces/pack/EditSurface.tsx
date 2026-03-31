import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NoteValue } from '@lava/shared'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/components/ui/utils'
import { durationToBeats, moveCaretByStep, togglePlacementMode } from './editor-core/commands'
import {
  buildTabLayout,
  getMeasuresInRect,
  hitTestBeat,
  hitTestMeasure,
  hitTestNote,
  inferStringFromPointer,
  type LayoutPointer,
} from './editor-core/layout'
import { useAudioStore } from '@/stores/audioStore'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

interface EditSurfaceProps {
  className?: string
  compact?: boolean
}

function pointerFromEvent(
  element: SVGSVGElement,
  event: React.MouseEvent<SVGSVGElement>,
  layoutWidth: number,
  layoutHeight: number,
): LayoutPointer {
  const rect = element.getBoundingClientRect()
  const scaleX = layoutWidth / Math.max(rect.width, 1)
  const scaleY = layoutHeight / Math.max(rect.height, 1)
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function notePreviewLabel(entryMode: 'note' | 'rest', fretDraft: string) {
  return entryMode === 'rest' ? 'R' : String(Math.max(0, Number(fretDraft) || 0))
}

function noteFlagCount(duration: NoteValue) {
  if (duration === 'eighth') return 1
  if (duration === 'sixteenth') return 2
  return 0
}

function shouldDrawStem(duration: NoteValue) {
  return duration !== 'whole'
}

interface EntryTarget {
  measureIndex: number
  beat: number
  string: number
}

export function EditSurface({ className, compact = false }: EditSurfaceProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragStartRef = useRef<LayoutPointer | null>(null)

  const document = useScoreDocumentStore((state) => state.document)
  const applyCommand = useScoreDocumentStore((state) => state.applyCommand)
  const selectedBars = useEditorStore((state) => state.selectedBars)
  const selectedNoteIds = useEditorStore((state) => state.selectedNoteIds)
  const selectBar = useEditorStore((state) => state.selectBar)
  const selectRange = useEditorStore((state) => state.selectRange)
  const selectNoteById = useEditorStore((state) => state.selectNoteById)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const zoom = useEditorStore((state) => state.zoom)
  const showChordDiagrams = useEditorStore((state) => state.showChordDiagrams)
  const caret = useEditorStore((state) => state.caret)
  const setCaret = useEditorStore((state) => state.setCaret)
  const setEntryDuration = useEditorStore((state) => state.setEntryDuration)
  const setEntryMode = useEditorStore((state) => state.setEntryMode)
  const hoverTarget = useEditorStore((state) => state.hoverTarget)
  const setHoverTarget = useEditorStore((state) => state.setHoverTarget)
  const dragState = useEditorStore((state) => state.dragState)
  const setDragState = useEditorStore((state) => state.setDragState)
  const activeToolGroup = useEditorStore((state) => state.activeToolGroup)
  const entryDuration = useEditorStore((state) => state.entryDuration)
  const entryMode = useEditorStore((state) => state.entryMode)
  const track = document.tracks[0]
  const currentBar = useAudioStore((state) => state.currentBar)

  const layout = useMemo(() => buildTabLayout(document, zoom), [document, zoom])
  const [marquee, setMarquee] = useState<{ start: LayoutPointer; end: LayoutPointer } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; measureIndex: number } | null>(null)
  const [entryStringDraft, setEntryStringDraft] = useState('1')
  const [entryFretDraft, setEntryFretDraft] = useState('0')

  const durationOptions = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] as const
  const quickFretOptions = Array.from({ length: 13 }, (_, index) => index)

  useEffect(() => {
    if (!caret) return
    setEntryStringDraft(String(caret.string))
  }, [caret?.measureIndex, caret?.beat, caret?.string])

  const selectedNoteMap = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds])
  const selectedBarStart = selectedBars.length > 0 ? Math.min(...selectedBars) : null
  const selectedBarEnd = selectedBars.length > 0 ? Math.max(...selectedBars) : null
  const primarySelectedNote = useMemo(
    () => track?.notes.find((note) => note.id === selectedNoteIds[0]) ?? null,
    [selectedNoteIds, track?.notes],
  )
  const selectionSummary = selectedNoteIds.length > 0
    ? `${selectedNoteIds.length} note${selectedNoteIds.length === 1 ? '' : 's'} selected`
    : selectedBars.length > 0
      ? selectedBarStart === selectedBarEnd
        ? `Bar ${selectedBarStart! + 1}`
        : `Bars ${selectedBarStart! + 1}-${selectedBarEnd! + 1}`
      : caret
        ? `Caret at bar ${caret.measureIndex + 1}, beat ${caret.beat}`
        : 'No active selection'
  const caretPreviewLabel = notePreviewLabel(entryMode, entryFretDraft)

  const handleMeasureContextAction = useCallback((action: 'before' | 'after' | 'delete') => {
    if (!contextMenu) return
    if (action === 'before') {
      applyCommand({ type: 'addMeasureBefore', beforeIndex: contextMenu.measureIndex, count: 1 })
      selectBar(contextMenu.measureIndex)
    } else if (action === 'after') {
      applyCommand({ type: 'addMeasureAfter', afterIndex: contextMenu.measureIndex, count: 1 })
      selectBar(contextMenu.measureIndex + 1)
    } else {
      applyCommand({ type: 'deleteMeasureRange', start: contextMenu.measureIndex, end: contextMenu.measureIndex })
      clearSelection()
    }
    setContextMenu(null)
  }, [applyCommand, clearSelection, contextMenu, selectBar])

  const handleChordPlacementToggle = useCallback((anchor: 'top' | 'bottom') => {
    if (selectedBars.length === 0) return
    selectedBars.forEach((measureIndex) => {
      const measure = document.measures[measureIndex]
      if (!measure) return
      applyCommand({
        type: 'setChordDiagramPlacement',
        measureIndex,
        placement: togglePlacementMode(measure.chordDiagramPlacement ?? 'hidden', anchor),
      })
    })
  }, [applyCommand, document.measures, selectedBars])

  const isNoteEntryToolActive = activeToolGroup === 'note' || activeToolGroup === 'rest'

  // 这里统一处理真正的落音逻辑，避免界面上看到的是 caret 预览，但实际并没有把 note 写进文档。
  const commitEntryAtTarget = useCallback((target: EntryTarget, overrideFret?: number) => {
    if (!track || !isNoteEntryToolActive) return

    const nextString = Math.max(1, Math.min(track.tuning.length, Number(entryStringDraft) || target.string || 1))
    const nextFret = Math.max(0, overrideFret ?? (Number(entryFretDraft) || 0))

    if (entryMode === 'rest') {
      applyCommand({
        type: 'insertRestAtCaret',
        trackId: track.id,
        measureIndex: target.measureIndex,
        beat: target.beat,
        durationType: entryDuration,
      })
    } else {
      applyCommand({
        type: 'insertNoteAtCaret',
        trackId: track.id,
        measureIndex: target.measureIndex,
        beat: target.beat,
        string: nextString,
        fret: nextFret,
        durationType: entryDuration,
      })
      setEntryFretDraft(String(nextFret))
    }

    setCaret({
      ...moveCaretByStep(
        {
          trackId: track.id,
          measureIndex: target.measureIndex,
          beat: target.beat,
          string: nextString,
        },
        'right',
        document.measures.length,
        document.meter.numerator,
        durationToBeats(entryDuration),
      ),
      trackId: track.id,
      string: nextString,
    })
  }, [applyCommand, document.measures.length, document.meter.numerator, entryDuration, entryFretDraft, entryMode, entryStringDraft, isNoteEntryToolActive, setCaret, track])

  const handleInsertAtCaret = useCallback((overrideFret?: number) => {
    if (!caret) return
    commitEntryAtTarget(caret, overrideFret)
  }, [caret, commitEntryAtTarget])

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const pointer = pointerFromEvent(svg, event, layout.width, layout.height)

    if (dragState.active && dragStartRef.current) {
      setMarquee({ start: dragStartRef.current, end: pointer })
      const covered = getMeasuresInRect(layout, dragStartRef.current, pointer)
      if (covered.length > 0) {
        selectRange(Math.min(...covered), Math.max(...covered))
        setDragState({ currentMeasureIndex: covered[covered.length - 1] })
      }
      return
    }

    const note = hitTestNote(layout, pointer)
    if (note) {
      setHoverTarget({ kind: 'note', noteId: note.noteId, measureIndex: note.measureIndex, beat: note.beat, string: note.string })
      return
    }
    const beat = hitTestBeat(layout, pointer)
    if (beat) {
      setHoverTarget({
        kind: 'beat',
        measureIndex: beat.measureIndex,
        beat: beat.beat,
        string: inferStringFromPointer(beat, pointer.y),
      })
      return
    }
    setHoverTarget(null)
  }, [dragState.active, layout, selectRange, setDragState, setHoverTarget])

  const handleMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    setContextMenu(null)
    const pointer = pointerFromEvent(svg, event, layout.width, layout.height)
    const note = hitTestNote(layout, pointer)
    const beat = hitTestBeat(layout, pointer)

    if (note) {
      selectNoteById(note.noteId, event.shiftKey)
      return
    }

    if (beat && track && activeToolGroup === 'note') {
      const target = {
        trackId: track.id,
        measureIndex: beat.measureIndex,
        beat: beat.beat,
        string: inferStringFromPointer(beat, pointer.y),
      }
      setCaret(target)
      if (event.altKey || event.metaKey || event.ctrlKey) {
        return
      }
      commitEntryAtTarget(target)
      return
    }

    const measure = hitTestMeasure(layout, pointer)
    if (!measure) {
      clearSelection()
      setCaret(null)
      return
    }

    dragStartRef.current = pointer
    setMarquee({ start: pointer, end: pointer })
    setDragState({
      active: true,
      mode: 'bar',
      startMeasureIndex: measure.index,
      currentMeasureIndex: measure.index,
    })
    selectBar(measure.index, event.shiftKey)
  }, [activeToolGroup, clearSelection, commitEntryAtTarget, layout, selectBar, selectNoteById, setCaret, setDragState, track])

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null
    setMarquee(null)
    setDragState({
      active: false,
      mode: null,
      startMeasureIndex: null,
      currentMeasureIndex: null,
    })
  }, [setDragState])

  const handleContextMenu = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const pointer = pointerFromEvent(svg, event, layout.width, layout.height)
    const measure = hitTestMeasure(layout, pointer)
    if (!measure) return
    event.preventDefault()
    selectBar(measure.index)
    setContextMenu({ x: event.clientX, y: event.clientY, measureIndex: measure.index })
  }, [layout, selectBar])

  if (!track) return null

  return (
    <div className={cn('relative min-h-0 flex-1 overflow-hidden rounded-[28px] border border-border bg-surface-1', className)}>
      <div className="absolute left-6 top-5 z-20 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-text-primary">{track.name}</span>
        <span className="text-text-muted/60">•</span>
        <span className="text-text-secondary">{document.measures.length} bars</span>
        <span className="text-text-muted/60">•</span>
        <span className="text-text-secondary">{selectionSummary}</span>
      </div>

      {!compact && (selectedBars.length > 0 || selectedNoteIds.length > 0 || Boolean(caret)) && (
        <div className="absolute right-6 top-6 z-20 w-[280px] space-y-3">
          <Card className="rounded-[24px] border-border bg-surface-0/96 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.10)] backdrop-blur">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Selection</p>
              <p className="text-sm font-medium text-text-primary">{selectionSummary}</p>
              {primarySelectedNote && (
                <p className="text-sm text-text-secondary">
                  String {primarySelectedNote.placement?.string ?? 'R'} · Fret {primarySelectedNote.placement?.fret ?? 'R'} · {primarySelectedNote.durationType} · {durationToBeats(primarySelectedNote.durationType)} beat
                </p>
              )}
              {!primarySelectedNote && caret && (
                <p className="text-sm text-text-secondary">
                  Bar {caret.measureIndex + 1} · Beat {caret.beat} · String {caret.string}
                </p>
              )}
            </div>
          </Card>


          {caret && (
            <Card className="rounded-[24px] border-border bg-surface-0/96 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.10)] backdrop-blur">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Note entry</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Click a beat to place the caret, then insert a note or rest directly here.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={entryMode === 'note' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setEntryMode('note')}
                  >
                    Note
                  </Button>
                  <Button
                    size="sm"
                    variant={entryMode === 'rest' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setEntryMode('rest')}
                  >
                    Rest
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Duration</p>
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((duration) => (
                      <Button
                        key={duration}
                        size="sm"
                        variant={entryDuration === duration ? 'default' : 'outline'}
                        className="rounded-xl"
                        onClick={() => setEntryDuration(duration)}
                      >
                        {duration}
                      </Button>
                    ))}
                  </div>
                </div>

                {entryMode === 'note' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        id="caret-entry-string"
                        label="String"
                        value={entryStringDraft}
                        onChange={(event) => setEntryStringDraft(event.target.value)}
                        inputMode="numeric"
                      />
                      <Input
                        id="caret-entry-fret"
                        label="Fret"
                        value={entryFretDraft}
                        onChange={(event) => setEntryFretDraft(event.target.value)}
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Quick frets</p>
                      <div className="grid grid-cols-5 gap-2">
                        {quickFretOptions.map((fret) => (
                          <Button
                            key={fret}
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => handleInsertAtCaret(fret)}
                          >
                            {fret}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Button className="w-full rounded-xl" onClick={() => handleInsertAtCaret()}>
                  {entryMode === 'rest' ? 'Insert rest at caret' : 'Insert note at caret'}
                </Button>
              </div>
            </Card>
          )}

          {showChordDiagrams && selectedBars.length > 0 && (
            <Card className="rounded-[24px] border-border bg-surface-0/96 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.10)] backdrop-blur">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Chord diagrams</p>
                  <p className="mt-1 text-sm text-text-secondary">Pin diagrams above or below the selected measures.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => handleChordPlacementToggle('top')}>Top</Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => handleChordPlacementToggle('bottom')}>Bottom</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="h-full overflow-auto px-8 pb-32 pt-16">
        <div className="min-w-[720px]">
          <svg
            ref={svgRef}
            width={layout.width}
            height={layout.height}
            className="block"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
          >
          {layout.measures.map((measure) => {
            const isSelectedBar = selectedBars.includes(measure.index)
            const isPlaying = currentBar === measure.index
            const hoveredBar = hoverTarget?.measureIndex === measure.index && hoverTarget.kind !== 'note'
            const chordSymbol = measure.measure.harmony[0]?.symbol
            const chordPlacement = measure.measure.chordDiagramPlacement ?? 'hidden'
            const showTopChord = showChordDiagrams && (chordPlacement === 'top' || chordPlacement === 'both')
            const showBottomChord = showChordDiagrams && (chordPlacement === 'bottom' || chordPlacement === 'both')

            return (
              <g key={measure.measure.id}>
                <rect
                  x={measure.x}
                  y={measure.y}
                  width={measure.width}
                  height={measure.height}
                  rx={18}
                  fill={isSelectedBar ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : hoveredBar ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--surface-0)'}
                  stroke={isSelectedBar ? 'var(--accent)' : hoveredBar ? 'var(--border-hover)' : 'var(--border)'}
                />
                <text x={measure.x + 14} y={measure.y + 18} fill="var(--text-secondary)" fontSize="11">
                  Bar {measure.index + 1}
                </text>
                {measure.measure.sectionLabel && (
                  <text x={measure.x + measure.width - 14} y={measure.y + 18} fill="var(--text-primary)" fontSize="11" textAnchor="end">
                    {measure.measure.sectionLabel}
                  </text>
                )}
                {chordSymbol && (
                  <text x={measure.contentX} y={measure.y + 34} fill="var(--text-primary)" fontSize="14" fontWeight="600">
                    {chordSymbol}
                  </text>
                )}

                {measure.stringCenters.map((center) => (
                  <line
                    key={`${measure.measure.id}-${center}`}
                    x1={measure.contentX}
                    y1={center}
                    x2={measure.contentX + measure.topAnchorRect.width}
                    y2={center}
                    stroke={isPlaying ? 'var(--accent-dim)' : 'var(--border-hover)'}
                    strokeWidth={1}
                  />
                ))}

                {measure.beatAnchors.filter((entry) => Number.isInteger(entry.beat)).map((entry) => (
                  <line
                    key={`${measure.measure.id}-tick-${entry.beat}`}
                    x1={entry.x}
                    y1={measure.contentY - 6}
                    x2={entry.x}
                    y2={measure.contentY + 66}
                    stroke="var(--border)"
                    strokeDasharray="2 3"
                    strokeWidth={0.8}
                  />
                ))}

                {showTopChord && (
                  <g>
                    <rect
                      x={measure.topAnchorRect.x}
                      y={measure.topAnchorRect.y}
                      width={measure.topAnchorRect.width}
                      height={measure.topAnchorRect.height}
                      rx={10}
                      fill="color-mix(in srgb, var(--accent) 7%, transparent)"
                      stroke="var(--border)"
                    />
                    <text
                      x={measure.topAnchorRect.x + measure.topAnchorRect.width / 2}
                      y={measure.topAnchorRect.y + 15}
                      fill="var(--text-primary)"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      {chordSymbol ?? 'Chord'}
                    </text>
                  </g>
                )}

                {showBottomChord && (
                  <g>
                    <rect
                      x={measure.bottomAnchorRect.x}
                      y={measure.bottomAnchorRect.y}
                      width={measure.bottomAnchorRect.width}
                      height={measure.bottomAnchorRect.height}
                      rx={10}
                      fill="color-mix(in srgb, var(--accent) 7%, transparent)"
                      stroke="var(--border)"
                    />
                    <text
                      x={measure.bottomAnchorRect.x + measure.bottomAnchorRect.width / 2}
                      y={measure.bottomAnchorRect.y + 15}
                      fill="var(--text-primary)"
                      fontSize="11"
                      textAnchor="middle"
                    >
                      {chordSymbol ?? 'Chord'}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {layout.measures.flatMap((measure) => measure.noteCells).map((note) => {
            const isSelected = selectedNoteMap.has(note.noteId)
            const isHovered = hoverTarget?.kind === 'note' && hoverTarget.noteId === note.noteId
            const headCx = note.x + note.width / 2
            const headCy = note.y + note.height / 2
            const headRx = Math.max(12, note.width * 0.42)
            const headRy = 14
            const stemX = headCx + headRx - 1
            const stemTop = headCy - 30
            const flagCount = noteFlagCount(note.durationType)
            return (
              <g key={note.noteId}>
                <ellipse
                  cx={headCx}
                  cy={headCy}
                  rx={headRx}
                  ry={headRy}
                  fill={isSelected ? 'var(--accent)' : isHovered ? 'color-mix(in srgb, var(--accent) 14%, var(--surface-0))' : 'var(--surface-0)'}
                  stroke={isSelected ? 'var(--accent)' : 'var(--text-primary)'}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                {shouldDrawStem(note.durationType) && !note.isRest && (
                  <>
                    <line
                      x1={stemX}
                      y1={headCy}
                      x2={stemX}
                      y2={stemTop}
                      stroke={isSelected ? 'var(--accent)' : 'var(--text-primary)'}
                      strokeWidth={1.5}
                    />
                    {Array.from({ length: flagCount }, (_, index) => {
                      const y = stemTop + index * 7
                      return (
                        <path
                          key={`${note.noteId}-flag-${index}`}
                          d={`M ${stemX} ${y} C ${stemX + 12} ${y + 2}, ${stemX + 12} ${y + 10}, ${stemX + 2} ${y + 12}`}
                          fill="none"
                          stroke={isSelected ? 'var(--accent)' : 'var(--text-primary)'}
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        />
                      )
                    })}
                  </>
                )}
                <text
                  x={headCx}
                  y={headCy + 4}
                  fill={isSelected ? 'var(--surface-0)' : 'var(--text-primary)'}
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {note.isRest ? 'R' : note.fret ?? 0}
                </text>
              </g>
            )
          })}

          {hoverTarget?.kind === 'beat' && (() => {
            const measure = layout.measures[hoverTarget.measureIndex]
            if (!measure || measure.beatAnchors.length === 0 || hoverTarget.beat == null || hoverTarget.string == null) return null
            const hoverBeat = hoverTarget.beat
            let anchor = measure.beatAnchors.find((entry) => Math.abs(entry.beat - hoverBeat) < 0.02)
            if (!anchor) {
              anchor = measure.beatAnchors.reduce((best, entry) =>
                Math.abs(entry.beat - hoverBeat) < Math.abs(best.beat - hoverBeat) ? entry : best,
              )
            }
            if (!anchor) return null
            const stringCenter = measure.stringCenters[Math.max(0, Math.min(5, hoverTarget.string - 1))]
            const cx = anchor.x + anchor.width / 2
            return (
              <ellipse
                cx={cx}
                cy={stringCenter}
                rx={Math.max(12, anchor.width * 0.35)}
                ry={14}
                fill="color-mix(in srgb, var(--accent) 10%, transparent)"
                stroke="var(--border-hover)"
                strokeDasharray="4 3"
              />
            )
          })()}

          {caret && (() => {
            const measure = layout.measures[caret.measureIndex]
            if (!measure || measure.beatAnchors.length === 0) return null
            let anchor = measure.beatAnchors.find((entry) => Math.abs(entry.beat - caret.beat) < 0.02)
            if (!anchor) {
              anchor = measure.beatAnchors.reduce((best, entry) =>
                Math.abs(entry.beat - caret.beat) < Math.abs(best.beat - caret.beat) ? entry : best,
              )
            }
            if (!anchor) return null
            const stringCenter = measure.stringCenters[Math.max(0, Math.min(5, caret.string - 1))]
            const cx = anchor.x + anchor.width / 2
            const rx = Math.max(13, anchor.width * 0.36)
            const stemX = cx + rx - 1
            const stemTop = stringCenter - 34
            const flagCount = noteFlagCount(entryDuration)
            return (
              <g>
                <ellipse
                  cx={cx}
                  cy={stringCenter}
                  rx={rx}
                  ry={15}
                  fill="color-mix(in srgb, var(--accent) 10%, transparent)"
                  stroke="var(--accent)"
                  strokeWidth={2}
                />
                {shouldDrawStem(entryDuration) && entryMode !== 'rest' && (
                  <>
                    <line
                      x1={stemX}
                      y1={stringCenter}
                      x2={stemX}
                      y2={stemTop}
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                    />
                    {Array.from({ length: flagCount }, (_, index) => {
                      const y = stemTop + index * 7
                      return (
                        <path
                          key={`caret-flag-${index}`}
                          d={`M ${stemX} ${y} C ${stemX + 12} ${y + 2}, ${stemX + 12} ${y + 10}, ${stemX + 2} ${y + 12}`}
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        />
                      )
                    })}
                  </>
                )}
                <text
                  x={cx}
                  y={stringCenter + 4}
                  fill="var(--text-primary)"
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {caretPreviewLabel}
                </text>
              </g>
            )
          })()}

          {marquee && (
            <rect
              x={Math.min(marquee.start.x, marquee.end.x)}
              y={Math.min(marquee.start.y, marquee.end.y)}
              width={Math.abs(marquee.end.x - marquee.start.x)}
              height={Math.abs(marquee.end.y - marquee.start.y)}
              fill="color-mix(in srgb, var(--accent) 8%, transparent)"
              stroke="var(--accent)"
              strokeDasharray="4 4"
            />
          )}
          </svg>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-40 min-w-[220px] rounded-[20px] border border-border bg-surface-0/98 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <Button className="h-10 w-full justify-start rounded-xl" variant="ghost" onClick={() => handleMeasureContextAction('before')}>
            Add Bar Before
          </Button>
          <div className="mx-2 my-1 h-px bg-border" />
          <Button className="h-10 w-full justify-start rounded-xl" variant="ghost" onClick={() => handleMeasureContextAction('after')}>
            Add Bar After
          </Button>
          <div className="mx-2 my-1 h-px bg-border" />
          <Button className="h-10 w-full justify-start rounded-xl" variant="ghost" onClick={() => handleMeasureContextAction('delete')}>
            Delete Bar
          </Button>
        </div>
      )}
    </div>
  )
}
