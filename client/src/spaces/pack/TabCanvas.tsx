import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { PanelRightClose, SlidersHorizontal } from 'lucide-react'
import {
  AlphaTabApi,
  LayoutMode,
  PlayerMode,
  StaveProfile,
  TabRhythmMode,
} from '@coderline/alphatab'
import type { NoteValue, ScoreNoteEvent, ScoreTrack } from '@lava/shared'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/components/ui/utils'
import { durationToBeats, moveCaretByStep } from '@/spaces/pack/editor-core/commands'
import { pitchToMidi } from '@/lib/pitchUtils'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface TabCanvasProps {
  className?: string
  compact?: boolean
  getMeasureBoundsRef?: React.MutableRefObject<GetMeasureBounds>
  onScoreRerender?: () => void
}

interface OverlayRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface BoundsLike {
  x: number
  y: number
  w: number
  h: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

interface AlphaTabNoteLike {
  string: number
  fret: number
  realValue: number
  beat: {
    index: number
    voice: {
      bar: {
        index: number
      }
    }
  }
}

const DURATION_OPTIONS: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']
const TAB_CANVAS_RENDER_ERROR_MESSAGE = 'Unable to render the current score.'

function midiLabel(midi: number): string {
  const pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const pitchClass = pitchClasses[midi % 12] ?? 'C'
  const octave = Math.floor(midi / 12) - 1
  return `${pitchClass}${octave}`
}

function noteLabel(note: ScoreNoteEvent): string {
  if (note.isRest || !note.pitch) return 'Rest'
  const accidental = note.pitch.alter === 1 ? '#' : note.pitch.alter === -1 ? 'b' : ''
  return `${note.pitch.step}${accidental}${note.pitch.octave}`
}

function alphaTabStringToDocumentString(alphaString: number, stringCount: number): number {
  return Math.max(1, stringCount - alphaString + 1)
}

function getMeasureNotes(track: ScoreTrack, measureIndex: number) {
  return track.notes
    .filter((note) => note.measureIndex === measureIndex)
    .sort((a, b) => a.beat - b.beat)
}

function findDocumentNoteForAlphaNote(track: ScoreTrack, alphaNote: AlphaTabNoteLike): ScoreNoteEvent | null {
  const measureIndex = alphaNote.beat.voice.bar.index
  const measureNotes = getMeasureNotes(track, measureIndex)
  if (measureNotes.length === 0) return null

  const expectedString = alphaTabStringToDocumentString(alphaNote.string, track.tuning.length)
  const exactPlacement = measureNotes.find(
    (note) => note.placement?.string === expectedString && note.placement?.fret === alphaNote.fret,
  )
  if (exactPlacement) return exactPlacement

  const alphaMidi = alphaNote.realValue
  const pitchMatches = measureNotes.filter((note) => note.pitch && pitchToMidi(note.pitch) === alphaMidi)
  if (pitchMatches.length === 1) return pitchMatches[0]

  return pitchMatches[alphaNote.beat.index] ?? measureNotes[alphaNote.beat.index] ?? pitchMatches[0] ?? measureNotes[0] ?? null
}

function findDocumentNoteAtPlacement(track: ScoreTrack, measureIndex: number, beat: number, string: number): ScoreNoteEvent | null {
  return track.notes.find((note) =>
    note.measureIndex === measureIndex
    && Math.abs(note.beat - beat) < 0.02
    && note.placement?.string === string,
  ) ?? null
}

function getPointerPosition(reference: HTMLElement, event: ReactMouseEvent<HTMLDivElement>) {
  const rect = reference.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function getPreferredBounds(entry: { lineAlignedBounds?: BoundsLike; realBounds?: BoundsLike; visualBounds?: BoundsLike } | null | undefined) {
  return entry?.lineAlignedBounds ?? entry?.realBounds ?? entry?.visualBounds ?? null
}

function resolveTabStaffBounds(api: AlphaTabApi, measureIndex: number, pointerY?: number): BoundsLike | null {
  const masterBar = api.boundsLookup?.findMasterBarByIndex(measureIndex) as
    | ({ bars?: Array<{ lineAlignedBounds?: BoundsLike; realBounds?: BoundsLike; visualBounds?: BoundsLike }> } & {
        lineAlignedBounds?: BoundsLike
        realBounds?: BoundsLike
        visualBounds?: BoundsLike
      })
    | null
    | undefined

  if (Array.isArray(masterBar?.bars) && masterBar.bars.length > 0) {
    const preferredBounds = masterBar.bars
      .map((bar) => getPreferredBounds(bar))
      .filter((bounds): bounds is BoundsLike => Boolean(bounds))

    if (preferredBounds.length > 0) {
      if (pointerY !== undefined && preferredBounds.length > 1) {
        const containingBounds = preferredBounds.find(
          (bounds) => pointerY >= bounds.y && pointerY <= bounds.y + bounds.h,
        )
        if (containingBounds) return containingBounds

        // ScoreTab 同時有五線譜與 TAB，指針落在兩者之間時取最近的 stave。
        return preferredBounds.reduce((closest, bounds) => {
          const closestCenter = closest.y + closest.h / 2
          const nextCenter = bounds.y + bounds.h / 2
          return Math.abs(nextCenter - pointerY) < Math.abs(closestCenter - pointerY) ? bounds : closest
        })
      }

      return preferredBounds[preferredBounds.length - 1] ?? null
    }
  }

  return getPreferredBounds(masterBar)
}

function buildNoteOverlayRects(api: AlphaTabApi, track: ScoreTrack, selectedNoteIds: string[]): OverlayRect[] {
  const lookup = api.boundsLookup
  if (!lookup || selectedNoteIds.length === 0) return []

  const selected = new Set(selectedNoteIds)
  const rects: OverlayRect[] = []

  lookup.staffSystems.forEach((staffSystem) => {
    staffSystem.bars.forEach((masterBarBounds) => {
      masterBarBounds.bars.forEach((barBounds) => {
        barBounds.beats.forEach((beatBounds) => {
          beatBounds.notes?.forEach((noteBounds) => {
            const documentNote = findDocumentNoteForAlphaNote(track, noteBounds.note)
            if (!documentNote || !selected.has(documentNote.id)) return
            rects.push({
              id: documentNote.id,
              x: noteBounds.noteHeadBounds.x - 8,
              y: noteBounds.noteHeadBounds.y - 8,
              width: noteBounds.noteHeadBounds.w + 16,
              height: noteBounds.noteHeadBounds.h + 16,
            })
          })
        })
      })
    })
  })

  return rects
}

function findNoteOverlayRect(api: AlphaTabApi, track: ScoreTrack, noteId: string): OverlayRect | null {
  const lookup = api.boundsLookup
  if (!lookup) return null

  for (const staffSystem of lookup.staffSystems) {
    for (const masterBarBounds of staffSystem.bars) {
      for (const barBounds of masterBarBounds.bars) {
        for (const beatBounds of barBounds.beats) {
          for (const noteBounds of beatBounds.notes ?? []) {
            const documentNote = findDocumentNoteForAlphaNote(track, noteBounds.note)
            if (documentNote?.id !== noteId) continue
            return {
              id: noteId,
              x: noteBounds.noteHeadBounds.x - 8,
              y: noteBounds.noteHeadBounds.y - 8,
              width: noteBounds.noteHeadBounds.w + 16,
              height: noteBounds.noteHeadBounds.h + 16,
            }
          }
        }
      }
    }
  }

  return null
}

function beatToQuarterGrid(value: number, beatsPerBar: number) {
  return clamp(Math.round(value * 4) / 4, 0, Math.max(0, beatsPerBar - 0.25))
}

function resolveBeatFromPointer(api: AlphaTabApi, measureIndex: number, pointerX: number, beatsPerBar: number, pointerY?: number) {
  const bounds = resolveTabStaffBounds(api, measureIndex, pointerY)
  if (!bounds) return 0
  const ratio = clamp((pointerX - bounds.x) / Math.max(bounds.w, 1), 0, 1)
  return beatToQuarterGrid(ratio * beatsPerBar, beatsPerBar)
}

function buildCaretOverlayRect(
  api: AlphaTabApi,
  measureIndex: number,
  beat: number,
  string: number,
  beatsPerBar: number,
  stringCount: number,
): OverlayRect | null {
  const bounds = resolveTabStaffBounds(api, measureIndex)
  if (!bounds) return null

  const normalizedString = clamp(string, 1, Math.max(1, stringCount))
  const beatCenterRatio = beatsPerBar > 0 ? (beat + 0.125) / beatsPerBar : 0
  const x = bounds.x + clamp(beatCenterRatio, 0, 1) * bounds.w
  const yRatio = stringCount > 1 ? (normalizedString - 1) / (stringCount - 1) : 0.5
  const y = bounds.y + yRatio * bounds.h
  const beatWidth = bounds.w / Math.max(beatsPerBar * 2, 1)

  return {
    id: `caret-${measureIndex}-${beat}-${normalizedString}`,
    x: x - Math.max(12, beatWidth * 0.45),
    y: y - 14,
    width: Math.max(24, beatWidth * 0.9),
    height: 28,
  }
}

function resolveStringFromPointer(api: AlphaTabApi, measureIndex: number, pointerY: number, stringCount: number) {
  const bounds = resolveTabStaffBounds(api, measureIndex, pointerY)
  if (!bounds || stringCount <= 1) return 1

  const ratio = clamp((pointerY - bounds.y) / Math.max(bounds.h, 1), 0, 1)
  return clamp(Math.round(ratio * (stringCount - 1)) + 1, 1, stringCount)
}

function buildBeatHoverRect(
  api: AlphaTabApi,
  measureIndex: number,
  beat: number,
  string: number,
  beatsPerBar: number,
  stringCount: number,
  pointerY?: number,
): OverlayRect | null {
  const bounds = resolveTabStaffBounds(api, measureIndex, pointerY)
  if (!bounds) return null

  const normalizedString = clamp(string, 1, Math.max(1, stringCount))
  const beatCenterRatio = beatsPerBar > 0 ? (beat + 0.125) / beatsPerBar : 0
  const x = bounds.x + clamp(beatCenterRatio, 0, 1) * bounds.w
  const yRatio = stringCount > 1 ? (normalizedString - 1) / (stringCount - 1) : 0.5
  const y = bounds.y + yRatio * bounds.h
  const beatWidth = bounds.w / Math.max(beatsPerBar * 2, 1)

  return {
    id: `hover-beat-${measureIndex}-${beat}-${normalizedString}`,
    x: x - Math.max(12, beatWidth * 0.45),
    y: y - 14,
    width: Math.max(24, beatWidth * 0.9),
    height: 28,
  }
}

function entryPreviewLabel(entryMode: 'note' | 'rest') {
  return entryMode === 'rest' ? 'R' : '0'
}

export function TabCanvas({ className, compact = false, getMeasureBoundsRef, onScoreRerender }: TabCanvasProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const alphaTabRootRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const onScoreRerenderRef = useRef(onScoreRerender)

  const document = useScoreDocumentStore((state) => state.document)
  const exportCacheXml = useScoreDocumentStore((state) => state.exportCacheXml)
  const applyCommand = useScoreDocumentStore((state) => state.applyCommand)
  const lastWarnings = useScoreDocumentStore((state) => state.lastWarnings)
  const selectedBars = useEditorStore((state) => state.selectedBars)
  const selectedNoteIds = useEditorStore((state) => state.selectedNoteIds)
  const selectBar = useEditorStore((state) => state.selectBar)
  const selectNoteById = useEditorStore((state) => state.selectNoteById)
  const clearSelection = useEditorStore((state) => state.clearSelection)
  const caret = useEditorStore((state) => state.caret)
  const setCaret = useEditorStore((state) => state.setCaret)
  const hoverTarget = useEditorStore((state) => state.hoverTarget)
  const setHoverTarget = useEditorStore((state) => state.setHoverTarget)
  const editorMode = useEditorStore((state) => state.editorMode)
  const zoom = useEditorStore((state) => state.zoom)
  const activeToolGroup = useEditorStore((state) => state.activeToolGroup)
  const entryDuration = useEditorStore((state) => state.entryDuration)
  const entryMode = useEditorStore((state) => state.entryMode)
  const inspectorFocus = useEditorStore((state) => state.inspectorFocus)
  const clearInspectorFocus = useEditorStore((state) => state.clearInspectorFocus)
  const staveProfile = editorMode === 'fineEdit' ? StaveProfile.ScoreTab : StaveProfile.Tab

  const [renderError, setRenderError] = useState<string | null>(null)
  const [barRects, setBarRects] = useState<OverlayRect[]>([])
  const [noteRects, setNoteRects] = useState<OverlayRect[]>([])
  const [caretRect, setCaretRect] = useState<OverlayRect | null>(null)
  const [hoverRect, setHoverRect] = useState<OverlayRect | null>(null)
  const [addBarRect, setAddBarRect] = useState<OverlayRect | null>(null)
  const [chordDraft, setChordDraft] = useState('')
  const [annotationDraft, setAnnotationDraft] = useState('')
  const [capoDraft, setCapoDraft] = useState('0')
  const [noteStringDraft, setNoteStringDraft] = useState('1')
  const [noteFretDraft, setNoteFretDraft] = useState('0')
  const [noteDurationDraft, setNoteDurationDraft] = useState<NoteValue>('quarter')
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [editHintDismissed, setEditHintDismissed] = useState(false)
  const syncOverlaysRef = useRef<() => void>(() => {})
  const noteDurationSelectRef = useRef<HTMLSelectElement | null>(null)

  // Keep onScoreRerenderRef current when the prop changes
  useEffect(() => {
    onScoreRerenderRef.current = onScoreRerender
  }, [onScoreRerender])

  // Derive measure bounds from alphaTab boundsLookup using resolveTabStaffBounds
  const getMeasureBounds = useCallback<GetMeasureBounds>((barIndex: number) => {
    const api = apiRef.current
    if (!api) return null
    const bounds = resolveTabStaffBounds(api, barIndex)
    if (!bounds) return null
    return { x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h }
  }, [])

  // Keep getMeasureBoundsRef current whenever callback changes identity
  useEffect(() => {
    if (getMeasureBoundsRef) {
      getMeasureBoundsRef.current = getMeasureBounds
    }
  }, [getMeasureBoundsRef, getMeasureBounds])

  const track = document.tracks[0]
  const beatsPerBar = document.meter.numerator || 4
  const tuningLabels = useMemo(() => track?.tuning.map((midi) => midiLabel(midi)) ?? [], [track?.tuning])
  const selectedNote = useMemo(
    () => track?.notes.find((note) => note.id === selectedNoteIds[0]) ?? null,
    [selectedNoteIds, track?.notes],
  )
  const focusedMeasureIndex = selectedNote?.measureIndex ?? selectedBars[0] ?? caret?.measureIndex ?? null
  const focusedMeasure = focusedMeasureIndex !== null ? document.measures[focusedMeasureIndex] ?? null : null
  const canOpenInspector = !compact && editorMode === 'fineEdit' && (Boolean(selectedNote) || Boolean(focusedMeasure) || Boolean(caret))

  const syncOverlays = useCallback(() => {
    const api = apiRef.current
    if (!api) {
      setBarRects([])
      setNoteRects([])
      setCaretRect(null)
      setAddBarRect(null)
      return
    }

    const lookup = api.boundsLookup
    const score = api.score
    if (!lookup || !score) {
      setBarRects([])
      setNoteRects([])
      setCaretRect(null)
      setAddBarRect(null)
      return
    }

    setBarRects(
      selectedBars.flatMap((barIndex) => {
        const bounds = lookup.findMasterBarByIndex(barIndex)
        if (!bounds) return []
        return [{
          id: `bar-${barIndex}`,
          x: bounds.visualBounds.x,
          y: bounds.visualBounds.y,
          width: bounds.visualBounds.w,
          height: bounds.visualBounds.h,
        }]
      }),
    )

    if (!track) {
      setNoteRects([])
      setCaretRect(null)
      setAddBarRect(null)
      return
    }
    setNoteRects(buildNoteOverlayRects(api, track, selectedNoteIds))
    setCaretRect(caret ? buildCaretOverlayRect(api, caret.measureIndex, caret.beat, caret.string, beatsPerBar, track.tuning.length) : null)

    const addBarAnchorIndex = focusedMeasureIndex ?? document.measures.length - 1
    const addBarBounds = resolveTabStaffBounds(api, addBarAnchorIndex)
    setAddBarRect(addBarBounds
      ? {
          id: `add-bar-${addBarAnchorIndex}`,
          x: addBarBounds.x + addBarBounds.w + 18,
          y: addBarBounds.y + addBarBounds.h / 2 - 18,
          width: 36,
          height: 36,
        }
      : null)
  }, [beatsPerBar, caret, document.measures.length, focusedMeasureIndex, selectedBars, selectedNoteIds, track])

  useEffect(() => {
    syncOverlaysRef.current = syncOverlays
  }, [syncOverlays])

  useEffect(() => {
    if (!inspectorFocus || compact || !canOpenInspector) return

    setInspectorOpen(true)

    const timer = window.setTimeout(() => {
      if (inspectorFocus === 'duration') {
        noteDurationSelectRef.current?.focus()
      } else {
        const fretInput = window.document.getElementById('tab-canvas-note-fret') as HTMLInputElement | null
        fretInput?.focus()
        fretInput?.select()
      }
      clearInspectorFocus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [canOpenInspector, clearInspectorFocus, compact, inspectorFocus])

  useEffect(() => {
    if (!alphaTabRootRef.current) return

    const api = new AlphaTabApi(alphaTabRootRef.current, {
      core: {
        engine: 'svg',
        enableLazyLoading: false,
        fontDirectory: '/vendor/alphatab/font/',
        includeNoteBounds: true,
        useWorkers: false,
      },
      display: {
        barsPerRow: 4,
        layoutMode: LayoutMode.Page,
        scale: zoom / 100,
        staveProfile,
      },
      notation: {
        rhythmMode: TabRhythmMode.Automatic,
      },
      player: {
        playerMode: PlayerMode.Disabled,
      },
    })

    const offRenderFinished = api.renderFinished.on(() => {
      setRenderError(null)
      syncOverlaysRef.current()
      onScoreRerenderRef.current?.()
    })

    apiRef.current = api

    // Load the current XML into the freshly created API so switching
    // staveProfile (transform ↔ fineEdit) doesn't leave a blank canvas.
    const currentXml = useScoreDocumentStore.getState().exportCacheXml
    if (currentXml) {
      try {
        api.load(new TextEncoder().encode(currentXml))
      } catch (error) {
        console.error('[TabCanvas] alphaTab initial load failed', error)
        setRenderError(TAB_CANVAS_RENDER_ERROR_MESSAGE)
      }
    }

    return () => {
      offRenderFinished()
      api.destroy()
      apiRef.current = null
    }
  }, [staveProfile])

  useEffect(() => {
    const api = apiRef.current
    if (!api || !exportCacheXml) return

    try {
      api.load(new TextEncoder().encode(exportCacheXml))
      setRenderError(null)
    } catch (error) {
      console.error('[TabCanvas] alphaTab load failed', error)
      setRenderError(TAB_CANVAS_RENDER_ERROR_MESSAGE)
    }
  }, [exportCacheXml])

  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    api.settings.display.scale = zoom / 100
    api.render()
  }, [zoom])

  useEffect(() => {
    syncOverlays()
  }, [syncOverlays])

  useEffect(() => {
    setChordDraft(focusedMeasure?.harmony[0]?.symbol ?? '')
    setAnnotationDraft(focusedMeasure?.annotations[0] ?? '')
  }, [focusedMeasure?.id])

  useEffect(() => {
    setCapoDraft(String(track?.capo ?? 0))
  }, [track?.capo])

  useEffect(() => {
    if (!selectedNote) return
    setNoteStringDraft(String(selectedNote.placement?.string ?? 1))
    setNoteFretDraft(String(selectedNote.placement?.fret ?? 0))
    setNoteDurationDraft(selectedNote.durationType)
  }, [selectedNote?.id])

  useEffect(() => {
    if (!canOpenInspector) {
      setInspectorOpen(false)
    }
  }, [canOpenInspector])

  useEffect(() => {
    if (editorMode === 'fineEdit') {
      setEditHintDismissed(false)
      const timer = setTimeout(() => setEditHintDismissed(true), 5000)
      return () => clearTimeout(timer)
    }
    setEditHintDismissed(true)
  }, [editorMode])

  const resolveHoverState = useCallback((x: number, y: number) => {
    const api = apiRef.current
    if (!api?.boundsLookup || !track) {
      return { rect: null, target: null }
    }

    const beat = api.boundsLookup.getBeatAtPos(x, y)
    if (!beat) {
      return { rect: null, target: null }
    }

    const note = api.boundsLookup.getNoteAtPos(beat, x, y)
    if (note) {
      const documentNote = findDocumentNoteForAlphaNote(track, note)
      if (!documentNote) return { rect: null, target: null }
      const rect = findNoteOverlayRect(api, track, documentNote.id)
      return {
        rect: rect ? { ...rect, id: `hover-note-${documentNote.id}` } : null,
        target: {
          kind: 'note' as const,
          noteId: documentNote.id,
          measureIndex: documentNote.measureIndex,
          beat: documentNote.beat,
          string: documentNote.placement?.string,
        },
      }
    }

    if (editorMode === 'fineEdit') {
      const measureIndex = beat.voice.bar.index
      const targetBeat = resolveBeatFromPointer(api, measureIndex, x, beatsPerBar, y)
      const targetString = resolveStringFromPointer(api, measureIndex, y, track.tuning.length)
      return {
        rect: buildBeatHoverRect(api, measureIndex, targetBeat, targetString, beatsPerBar, track.tuning.length, y),
        target: {
          kind: 'beat' as const,
          measureIndex,
          beat: targetBeat,
          string: targetString,
        },
      }
    }

    const barBounds = api.boundsLookup.findMasterBarByIndex(beat.voice.bar.index)
    if (!barBounds) return { rect: null, target: null }
    return {
      rect: {
        id: `hover-bar-${beat.voice.bar.index}`,
        x: barBounds.visualBounds.x,
        y: barBounds.visualBounds.y,
        width: barBounds.visualBounds.w,
        height: barBounds.visualBounds.h,
      },
      target: {
        kind: 'bar' as const,
        measureIndex: beat.voice.bar.index,
      },
    }
  }, [beatsPerBar, editorMode, track])

  const handleSurfaceMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const alphaTabRoot = alphaTabRootRef.current
    if (!alphaTabRoot) return
    const { x, y } = getPointerPosition(alphaTabRoot, event)
    const { rect, target } = resolveHoverState(x, y)
    setHoverRect(rect)
    setHoverTarget(target)
  }, [resolveHoverState, setHoverTarget])

  const handleSurfaceClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const api = apiRef.current
    const alphaTabRoot = alphaTabRootRef.current
    if (!api?.boundsLookup || !alphaTabRoot || !track) return

    const { x, y } = getPointerPosition(alphaTabRoot, event)
    const beat = api.boundsLookup.getBeatAtPos(x, y)
    if (!beat) {
      clearSelection()
      setHoverTarget(null)
      return
    }

    const isNoteEntryToolActive = activeToolGroup === 'note' || activeToolGroup === 'rest'
    const isFineEditNoteEntry = editorMode === 'fineEdit' && isNoteEntryToolActive
    const pointerTarget = editorMode === 'fineEdit'
      ? {
          trackId: track.id,
          measureIndex: beat.voice.bar.index,
          beat: resolveBeatFromPointer(api, beat.voice.bar.index, x, beatsPerBar, y),
          string: resolveStringFromPointer(api, beat.voice.bar.index, y, track.tuning.length),
        }
      : null
    const isChordAddGesture = isFineEditNoteEntry && entryMode === 'note' && event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey

    const note = api.boundsLookup.getNoteAtPos(beat, x, y)
    if (note) {
      const documentNote = findDocumentNoteForAlphaNote(track, note)
      // Shift+click 落在同拍不同弦時，優先加到和弦，而不是被既有音符攔截成 selection。
      if (
        isChordAddGesture
        && pointerTarget
        && documentNote
        && (documentNote.measureIndex !== pointerTarget.measureIndex
          || Math.abs(documentNote.beat - pointerTarget.beat) >= 0.02
          || documentNote.placement?.string !== pointerTarget.string)
      ) {
        setCaret(pointerTarget)
        setHoverTarget({
          kind: 'beat',
          measureIndex: pointerTarget.measureIndex,
          beat: pointerTarget.beat,
          string: pointerTarget.string,
        })
      } else if (documentNote) {
        selectNoteById(documentNote.id, event.shiftKey)
        if (editorMode === 'fineEdit' && !compact) setInspectorOpen(true)
        return
      }
    }

    if (editorMode === 'fineEdit') {
      const nextCaret = pointerTarget ?? {
        trackId: track.id,
        measureIndex: beat.voice.bar.index,
        beat: resolveBeatFromPointer(api, beat.voice.bar.index, x, beatsPerBar, y),
        string: resolveStringFromPointer(api, beat.voice.bar.index, y, track.tuning.length),
      }
      setCaret(nextCaret)
      setHoverTarget({
        kind: 'beat',
        measureIndex: nextCaret.measureIndex,
        beat: nextCaret.beat,
        string: nextCaret.string,
      })
      if (event.altKey || event.metaKey || event.ctrlKey || !isNoteEntryToolActive) {
        return
      }

      applyCommand(
        entryMode === 'rest'
          ? {
              type: 'insertRestAtCaret',
              trackId: track.id,
              measureIndex: nextCaret.measureIndex,
              beat: nextCaret.beat,
              durationType: entryDuration,
            }
          : {
              type: 'insertNoteAtCaret',
              trackId: track.id,
              measureIndex: nextCaret.measureIndex,
              beat: nextCaret.beat,
              string: nextCaret.string,
              fret: 0,
              durationType: entryDuration,
            },
      )
      if (isChordAddGesture && entryMode === 'note') {
        setCaret(nextCaret)
        return
      }
      if (entryMode === 'note') {
        const insertedTrack = useScoreDocumentStore.getState().document.tracks[0]
        const insertedNote = insertedTrack
          ? findDocumentNoteAtPlacement(insertedTrack, nextCaret.measureIndex, nextCaret.beat, nextCaret.string)
          : null
        if (insertedNote) {
          selectNoteById(insertedNote.id)
          return
        }
      }
      setCaret({
        ...moveCaretByStep(
          nextCaret,
          'right',
          document.measures.length,
          document.meter.numerator,
          durationToBeats(entryDuration),
        ),
        trackId: track.id,
        string: nextCaret.string,
      })
      return
    }

    selectBar(beat.voice.bar.index, event.shiftKey)
  }, [activeToolGroup, applyCommand, beatsPerBar, clearSelection, compact, document.measures.length, document.meter.numerator, editorMode, entryDuration, entryMode, selectBar, selectNoteById, setCaret, setHoverTarget, track])

  const handleApplySelectedNote = useCallback(() => {
    if (!track || !selectedNote) return
    applyCommand({
      type: 'setStringFret',
      trackId: track.id,
      noteId: selectedNote.id,
      string: Number(noteStringDraft) || 1,
      fret: Number(noteFretDraft) || 0,
    })
    applyCommand({
      type: 'setDuration',
      trackId: track.id,
      noteId: selectedNote.id,
      durationType: noteDurationDraft,
      durationDivisions: 0,
    })
  }, [applyCommand, noteDurationDraft, noteFretDraft, noteStringDraft, selectedNote, track])

  const handleDeleteSelectedNotes = useCallback(() => {
    if (!track) return
    selectedNoteIds.forEach((noteId) => {
      applyCommand({ type: 'deleteNote', trackId: track.id, noteId })
    })
    clearSelection()
  }, [applyCommand, clearSelection, selectedNoteIds, track])

  const handleApplyMeasureMeta = useCallback(() => {
    if (focusedMeasureIndex === null) return
    if (chordDraft.trim()) {
      applyCommand({
        type: 'setChordSymbol',
        measureIndex: focusedMeasureIndex,
        beat: 0,
        symbol: chordDraft.trim(),
      })
    }
    applyCommand({
      type: 'setAnnotation',
      measureIndex: focusedMeasureIndex,
      text: annotationDraft,
    })
  }, [annotationDraft, applyCommand, chordDraft, focusedMeasureIndex])

  const handleTransposeMeasure = useCallback((semitones: number) => {
    if (!track || focusedMeasureIndex === null) return
    applyCommand({
      type: 'transposeSelection',
      trackId: track.id,
      measureRange: [focusedMeasureIndex, focusedMeasureIndex],
      semitones,
    })
  }, [applyCommand, focusedMeasureIndex, track])

  const handleSimplifyMeasure = useCallback(() => {
    if (!track || focusedMeasureIndex === null) return
    applyCommand({
      type: 'simplifyFingering',
      trackId: track.id,
      measureRange: [focusedMeasureIndex, focusedMeasureIndex],
    })
  }, [applyCommand, focusedMeasureIndex, track])

  const handleCapoApply = useCallback(() => {
    if (!track) return
    applyCommand({
      type: 'setCapo',
      trackId: track.id,
      capo: Math.max(0, Number(capoDraft) || 0),
    })
  }, [applyCommand, capoDraft, track])

  const handleAddBarAfterFocused = useCallback(() => {
    const afterIndex = focusedMeasureIndex ?? Math.max(document.measures.length - 1, 0)
    applyCommand({
      type: 'addMeasureAfter',
      afterIndex,
      count: 1,
    })
    selectBar(afterIndex + 1)
  }, [applyCommand, document.measures.length, focusedMeasureIndex, selectBar])

  if (!track) return null

  return (
    <div className={cn('relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface-1', className)}>
      <div
        ref={surfaceRef}
        data-testid="tab-canvas-surface"
        className={cn('relative h-full overflow-auto p-4', !compact && inspectorOpen && 'pr-[23rem]')}
        onMouseMove={handleSurfaceMouseMove}
        onMouseLeave={() => {
          setHoverRect(null)
          setHoverTarget(null)
        }}
        onClick={handleSurfaceClick}
      >
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
          <Badge className="bg-surface-0 text-text-primary">{track.name}</Badge>
          <Badge>{document.measures.length} bars</Badge>
          <Badge>{editorMode === 'fineEdit' ? 'Edit mode' : 'Practice mode'}</Badge>
          {!compact && <Badge>Tuning: {tuningLabels.join(' ')}</Badge>}
          {!compact && <Badge>Capo: {track.capo}</Badge>}
        </div>

        {!compact && (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            {editorMode === 'fineEdit' && (
              <Button size="sm" onClick={handleAddBarAfterFocused}>
                + Add Bar
              </Button>
            )}
            {canOpenInspector && !inspectorOpen && (
              <Button size="sm" variant="outline" onClick={() => setInspectorOpen(true)}>
                <SlidersHorizontal className="size-4" />
                Edit Selection
              </Button>
            )}
          </div>
        )}

        <div className="pt-10">
          <div className="relative min-h-full min-w-[720px]">
            <div ref={alphaTabRootRef} className="score-paper-bg relative min-h-full min-w-[720px]" />

            <div className="pointer-events-none absolute inset-0">
              {hoverRect && (
                <div
                  className={cn(
                    'absolute bg-accent/8',
                    hoverTarget?.kind === 'note'
                      ? 'rounded-full border border-border-hover'
                      : hoverTarget?.kind === 'beat'
                        ? 'rounded-full border border-dashed border-border-hover'
                        : 'rounded-xl border border-border-hover',
                  )}
                  style={{
                    left: hoverRect.x,
                    top: hoverRect.y,
                    width: hoverRect.width,
                    height: hoverRect.height,
                  }}
                />
              )}

              {hoverRect && hoverTarget?.kind === 'beat' && editorMode === 'fineEdit' && (
                <div
                  className="absolute flex items-center justify-center rounded-full border border-dashed border-border-hover bg-surface-0/95 text-xs font-semibold text-text-primary shadow-sm"
                  style={{
                    left: hoverRect.x,
                    top: hoverRect.y,
                    width: hoverRect.width,
                    height: hoverRect.height,
                  }}
                >
                  {entryPreviewLabel(entryMode)}
                </div>
              )}

              {barRects.map((rect) => (
                <div
                  key={rect.id}
                  className="absolute rounded-xl border border-accent/70 bg-accent/10"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }}
                />
              ))}

              {noteRects.map((rect) => (
                <div
                  key={rect.id}
                  className="absolute rounded-full border-2 border-accent bg-accent/10 shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }}
                />
              ))}

              {caretRect && editorMode === 'fineEdit' && (
                <div
                  className="absolute flex items-center justify-center rounded-full border-2 border-accent bg-surface-0/98 text-xs font-semibold text-accent shadow-[0_0_0_4px_rgba(255,255,255,0.18)]"
                  style={{
                    left: caretRect.x,
                    top: caretRect.y,
                    width: caretRect.width,
                    height: caretRect.height,
                  }}
                >
                  {entryPreviewLabel(entryMode)}
                </div>
              )}

              {addBarRect && editorMode === 'fineEdit' && (
                <button
                  type="button"
                  className="pointer-events-auto absolute flex items-center justify-center rounded-full border border-border bg-surface-0 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-border-hover hover:bg-surface-1"
                  style={{
                    left: addBarRect.x,
                    top: addBarRect.y,
                    width: addBarRect.width,
                    height: addBarRect.height,
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleAddBarAfterFocused()
                  }}
                  aria-label="Add bar after current bar"
                  title="Add bar after current bar"
                >
                  +
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {(renderError || lastWarnings.length > 0) && (
        <div className="border-t border-border px-4 py-3 text-xs">
          {renderError && <p className="text-warning">{renderError}</p>}
          {lastWarnings.length > 0 && <p className="text-text-secondary">{lastWarnings.join(' ')}</p>}
        </div>
      )}

      {!compact && inspectorOpen && (
        <aside className="absolute inset-y-4 right-4 z-30 flex w-[22rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface-0 shadow-lg animate-slide-in-right">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Selection</p>
              <h3 className="text-sm font-semibold text-text-primary">
                {selectedNote
                  ? `Note · Bar ${selectedNote.measureIndex + 1}`
                  : focusedMeasure
                    ? `Bar ${focusedMeasure.index + 1}`
                    : 'Nothing selected'}
              </h3>
              <p className="text-xs text-text-secondary">
                Edit mode tools for the current note or bar. This panel stays hidden until you ask for it.
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => setInspectorOpen(false)} aria-label="Close selection panel">
              <PanelRightClose className="size-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            <Card className="bg-surface-1">
              <p className="mb-2 text-xs font-medium text-text-secondary">Global</p>
              <Input
                id="tab-canvas-capo"
                label="Capo"
                value={capoDraft}
                onChange={(event) => setCapoDraft(event.target.value)}
                inputMode="numeric"
              />
              <Button className="mt-2 w-full" variant="outline" onClick={handleCapoApply}>
                Apply Capo
              </Button>
            </Card>

            {selectedNote && (
              <Card className="bg-surface-1">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-text-secondary">Selected Note</p>
                  <Badge>{noteLabel(selectedNote)}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="tab-canvas-note-string"
                    label="String"
                    value={noteStringDraft}
                    onChange={(event) => setNoteStringDraft(event.target.value)}
                    inputMode="numeric"
                  />
                  <Input
                    id="tab-canvas-note-fret"
                    label="Fret"
                    value={noteFretDraft}
                    onChange={(event) => setNoteFretDraft(event.target.value)}
                    inputMode="numeric"
                  />
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
                  Duration
                  <select
                    ref={noteDurationSelectRef}
                    className="h-8 rounded border border-border bg-surface-3 px-3 text-sm text-text-primary"
                    value={noteDurationDraft}
                    onChange={(event) => setNoteDurationDraft(event.target.value as NoteValue)}
                  >
                    {DURATION_OPTIONS.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 grid gap-2">
                  <Button className="w-full" onClick={handleApplySelectedNote}>
                    Apply Note Changes
                  </Button>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={selectedNote.techniques.slide === 'up' ? 'default' : 'outline'}
                      onClick={() => applyCommand({
                        type: selectedNote.techniques.slide === 'up' ? 'removeTechnique' : 'addTechnique',
                        trackId: track.id,
                        noteId: selectedNote.id,
                        technique: 'slide',
                        ...(selectedNote.techniques.slide === 'up' ? {} : { value: 'up' }),
                      })}
                    >
                      Slide Up
                    </Button>
                    <Button
                      variant={selectedNote.techniques.slide === 'down' ? 'default' : 'outline'}
                      onClick={() => applyCommand({
                        type: selectedNote.techniques.slide === 'down' ? 'removeTechnique' : 'addTechnique',
                        trackId: track.id,
                        noteId: selectedNote.id,
                        technique: 'slide',
                        ...(selectedNote.techniques.slide === 'down' ? {} : { value: 'down' }),
                      })}
                    >
                      Slide Down
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => applyCommand({
                        type: 'removeTechnique',
                        trackId: track.id,
                        noteId: selectedNote.id,
                        technique: 'slide',
                      })}
                    >
                      Clear Slide
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => applyCommand({ type: 'toggleRest', trackId: track.id, noteId: selectedNote.id })}
                    >
                      Toggle Rest
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => applyCommand({ type: 'toggleTie', trackId: track.id, noteId: selectedNote.id })}
                    >
                      Toggle Tie
                    </Button>
                  </div>
                  <Button variant="destructive" onClick={handleDeleteSelectedNotes}>
                    Delete Selected Notes
                  </Button>
                </div>
              </Card>
            )}

            {focusedMeasure && (
              <Card className="bg-surface-1">
                <p className="mb-3 text-xs font-medium text-text-secondary">Bar Actions</p>

                <div className="grid gap-3">
                  <Input label="Chord" value={chordDraft} onChange={(event) => setChordDraft(event.target.value)} />
                  <Input
                    label="Annotation"
                    value={annotationDraft}
                    onChange={(event) => setAnnotationDraft(event.target.value)}
                    placeholder="e.g. palm mute"
                  />
                  <Button variant="outline" onClick={handleApplyMeasureMeta}>
                    Apply Chord / Annotation
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => handleTransposeMeasure(-1)}>
                      Transpose -1
                    </Button>
                    <Button variant="outline" onClick={() => handleTransposeMeasure(1)}>
                      Transpose +1
                    </Button>
                  </div>

                  <Button variant="outline" onClick={handleSimplifyMeasure}>
                    Simplify Fingering
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        applyCommand({
                          type: 'addMeasureBefore',
                          beforeIndex: focusedMeasure.index,
                          count: 1,
                        })
                      }
                    >
                      Add Bar Before
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        applyCommand({
                          type: 'addMeasureAfter',
                          afterIndex: focusedMeasure.index,
                          count: 1,
                        })
                      }
                    >
                      Add Bar After
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        applyCommand({
                          type: 'deleteMeasureRange',
                          start: focusedMeasure.index,
                          end: focusedMeasure.index,
                        })
                      }
                    >
                      Delete Bar
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </aside>
      )}

      {!compact && !inspectorOpen && editorMode === 'fineEdit' && !editHintDismissed && (
        <div className="pointer-events-none absolute bottom-6 right-6 z-20 animate-fade-in">
          <button
            type="button"
            onClick={() => setEditHintDismissed(true)}
            className="pointer-events-auto rounded-full border border-border bg-surface-0 px-3 py-2 text-xs text-text-secondary shadow-sm transition-opacity hover:opacity-70"
          >
            {caret
              ? 'The ring marks the next input spot. Choose a value in Note tools, hover a string, and click to write. Use Alt/Cmd/Ctrl-click to move only.'
              : canOpenInspector
                ? 'Select Edit Selection to adjust the chosen note or bar.'
                : 'Choose a note value in the toolbar, hover the target string, and click directly on the score to write.'}
          </button>
        </div>
      )}
    </div>
  )
}
