/**
 * TabEditorToolbar — alphaTex tab editor toolbar.
 *
 *
 * Implements: Duration, Technique, Dynamics, Bar-ops, Track-panel,
 * Import/Export, and Keyboard-shortcuts button groups.
 *
 * All button groups dispatch commands through useTabEditorStore.applyCommand().
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  FileJson,
  Music,
  Printer,
  UploadCloud,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import { useTabEditorStore } from '@/stores/tabEditorStore'
import {
  SetDuration,
  InsertBeat,
  ToggleDot,
  SetTuplet,
  SetRest,
  InsertBar,
  DeleteBar,
  SetTimeSignature,
  SetBarTempo,
  InsertTrack,
  DeleteTrack,
  SetTuning,
  SetCapo,
  RenameTrack,
  SetHammerOn,
  SetPullOff,
  SetSlide,
  SetBend,
  SetTie,
  SetVibrato,
  SetHarmonic,
  SetDeadNote,
  SetGhost,
  SetTap,
  SetPalmMute,
  SetLetRing,
  SetAccent,
  SetStroke,
  SetDynamics,
  SetStaccato,
  SetSlur,
  SetTrill,
  SetOrnament,
  SetCrescendo,
  SetDecrescendo,
  SetArpeggio,
  SetBrush,
  SetFade,
  SetTremoloPicking,
  SetFermata,
  makeBeatLoc,
  CompositeCommand,
} from '@/editor/commands'
import { barCapacityUnits, durationToUnits, getEffectiveTimeSig, makeBarBeats, splitIntoRests } from '@/editor/ast/barFill'
import type {
  Duration,
  DynamicsValue,
  SlideType,
  StrokeType,
} from '@/editor/ast/types'
import { downloadAst } from '@/io/json'
import type { AlphaTabBridge } from '@/render/alphaTabBridge'
import { KeyboardShortcutsPanel, useKeyboardShortcutsPanel } from '@/components/editor/KeyboardShortcutsPanel'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION_OPTIONS: Array<{ value: Duration; label: string; shortcut: string }> = [
  { value: 1, label: 'W', shortcut: 'Whole' },
  { value: 2, label: 'H', shortcut: 'Half' },
  { value: 4, label: 'Q', shortcut: 'Quarter' },
  { value: 8, label: 'E', shortcut: 'Eighth' },
  { value: 16, label: 'S', shortcut: '16th' },
  { value: 32, label: 'T', shortcut: '32nd' },
]

const DYNAMICS_OPTIONS: DynamicsValue[] = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']

const STANDARD_TUNINGS = [
  { label: 'Standard E', midi: [40, 45, 50, 55, 59, 64] },
  { label: 'Drop D', midi: [38, 45, 50, 55, 59, 64] },
  { label: 'Open G', midi: [38, 43, 50, 55, 58, 62] },
  { label: 'Open D', midi: [38, 45, 50, 54, 57, 62] },
  { label: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  { label: 'Half step down', midi: [39, 44, 49, 54, 58, 63] },
  { label: 'Full step down', midi: [38, 43, 48, 53, 57, 62] },
]

// Broad MIDI instrument groups
const MIDI_INSTRUMENTS = [
  { group: 'Guitar', items: [
    { label: 'Nylon Guitar', value: 24 },
    { label: 'Steel Guitar', value: 25 },
    { label: 'Jazz Guitar', value: 26 },
    { label: 'Clean Guitar', value: 27 },
    { label: 'Muted Guitar', value: 28 },
    { label: 'Overdriven', value: 29 },
    { label: 'Distortion', value: 30 },
  ]},
  { group: 'Bass', items: [
    { label: 'Acoustic Bass', value: 32 },
    { label: 'Electric Bass (finger)', value: 33 },
    { label: 'Electric Bass (pick)', value: 34 },
    { label: 'Slap Bass 1', value: 36 },
    { label: 'Synth Bass 1', value: 38 },
  ]},
  { group: 'Keys', items: [
    { label: 'Acoustic Grand Piano', value: 0 },
    { label: 'Electric Piano', value: 4 },
    { label: 'Organ', value: 16 },
  ]},
  { group: 'Strings', items: [
    { label: 'Violin', value: 40 },
    { label: 'Viola', value: 41 },
    { label: 'Cello', value: 42 },
    { label: 'Acoustic Bass', value: 43 },
  ]},
]

// ---------------------------------------------------------------------------
// Small reusable sub-components
// ---------------------------------------------------------------------------

function ToolbarBtn({
  active,
  disabled,
  onClick,
  title,
  children,
  className,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative group/btn', className)}>
      <button
        type="button"
        aria-label={title}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'inline-flex h-8 min-w-[32px] items-center justify-center rounded-full px-2.5 text-xs font-semibold',
          'transition-all duration-100 ease-out active:scale-[0.88] active:duration-[50ms]',
          active
            ? 'bg-accent text-surface-0 shadow-[0_2px_10px_rgba(0,0,0,0.22)]'
            : 'bg-surface-2 text-text-secondary shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:scale-[1.06] hover:bg-surface-3 hover:text-text-primary hover:shadow-[0_3px_10px_rgba(0,0,0,0.10)]',
          disabled && 'cursor-not-allowed opacity-40',
        )}
      >
        {children}
      </button>
      {title && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface-4 px-2 py-1 text-[11px] text-text-primary opacity-0 transition-opacity group-hover/btn:opacity-100 group-hover/btn:delay-150">
          {title}
        </span>
      )}
    </div>
  )
}

function GroupSep() {
  return <div className="mx-1.5 h-6 w-px bg-border" aria-hidden="true" />
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </span>
  )
}

function GlassCircleBtn({
  active,
  onClick,
  title,
  children,
  className,
}: {
  active?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative group/btn', className)}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        className={cn(
          'relative flex size-12 items-center justify-center rounded-full text-[19px] font-semibold',
          'transition-all duration-100 ease-out active:scale-[0.88] active:duration-[50ms]',
          active
            ? 'bg-accent text-surface-0 shadow-[0_2px_10px_rgba(0,0,0,0.22)]'
            : 'bg-surface-2 text-text-secondary shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:scale-[1.08] hover:bg-surface-3 hover:text-text-primary hover:shadow-[0_4px_14px_rgba(0,0,0,0.11)]',
        )}
      >
        {children}
      </button>
      {title && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-4 px-2 py-1 text-[11px] text-text-primary opacity-0 transition-opacity delay-300 group-hover/btn:opacity-100">
          {title}
        </span>
      )}
    </div>
  )
}

function GlassPillBtn({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-12 items-center justify-center rounded-full px-5',
        'text-base font-medium',
        'transition-all duration-100 ease-out active:scale-[0.95] active:duration-[50ms]',
        active
          ? 'bg-accent text-surface-0 shadow-[0_2px_10px_rgba(0,0,0,0.22)]'
          : 'bg-surface-2 text-text-secondary shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:bg-surface-3 hover:text-text-primary hover:shadow-[0_4px_14px_rgba(0,0,0,0.11)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Floating panel wrapper
// ---------------------------------------------------------------------------

function FloatingPanel({
  open,
  anchor,
  onClose,
  children,
  width = 'w-72',
}: {
  open: boolean
  anchor: { left: number } | null
  onClose: () => void
  children: React.ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const handle = (e: PointerEvent) => {
      const el = document.getElementById('tab-toolbar-panels')
      if (!el?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', handle)
    return () => window.removeEventListener('pointerdown', handle)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        // pointer-events-auto: parent toolbar wrapper sets pointer-events-none
        // so the empty space around the pill stays click-through to the score.
        // Floating panels must opt back in or clicks pass through to the score
        // and trigger spurious selections (and the panel buttons stop working).
        'pointer-events-auto absolute bottom-full mb-3 rounded-2xl border border-border bg-surface-0 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)]',
        width,
      )}
      style={anchor ? { left: anchor.left, transform: 'translateX(-50%)' } : { left: '50%', transform: 'translateX(-50%)' }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel section header
// ---------------------------------------------------------------------------

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: resolve selection IDs from AST (same logic as PropertyPanel)
// ---------------------------------------------------------------------------

function useBeatIds() {
  const ast = useTabEditorStore((s) => s.ast)
  const selection = useTabEditorStore((s) => s.selection)

  if (!ast || !selection) return null
  const cursor = selection.kind === 'caret' ? selection.cursor : selection.kind === 'range' ? selection.anchor : null
  if (!cursor) return null
  const track = ast.tracks[cursor.trackIndex]
  if (!track) return null
  const bar = track.staves[0]?.bars[cursor.barIndex]
  if (!bar) return null
  const voice = bar.voices[cursor.voiceIndex]
  if (!voice) return null
  const beat = voice.beats[cursor.beatIndex]
  if (!beat) return null
  const note = beat.notes.find((n) => n.string === cursor.stringIndex) ?? beat.notes[0] ?? null
  return {
    trackId: track.id,
    barId: bar.id,
    voiceId: voice.id,
    beatId: beat.id,
    noteId: note?.id ?? null,
    barIndex: cursor.barIndex,
    track,
    bar,
    beat,
    note,
    cursor,
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TabEditorToolbarProps {
  className?: string
  bridgeRef?: React.RefObject<AlphaTabBridge | null>
  onOpenFile?: () => void
  isInsertMode?: boolean
  applyRestBeat?: () => void
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TabEditorToolbar({ className, bridgeRef, onOpenFile, isInsertMode, applyRestBeat }: TabEditorToolbarProps) {
  const applyCommand = useTabEditorStore((s) => s.applyCommand)
  const currentDuration = useTabEditorStore((s) => s.currentDuration)
  const setDuration = useTabEditorStore((s) => s.setDuration)
  const undo = useTabEditorStore((s) => s.undo)
  const redo = useTabEditorStore((s) => s.redo)
  const ast = useTabEditorStore((s) => s.ast)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [panelAnchor, setPanelAnchor] = useState<{ left: number } | null>(null)
  const [tempoValue, setTempoValue] = useState(120)
  const [trillFret, setTrillFret] = useState(0)
  const slurCounter = useRef(1)

  const shortcuts = useKeyboardShortcutsPanel()
  const ids = useBeatIds()

  // Close open panel on outside click
  useEffect(() => {
    const handle = (e: PointerEvent) => {
      if (!toolbarRef.current?.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPanel(null)
    }
    window.addEventListener('pointerdown', handle)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('pointerdown', handle)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Undo/Redo keyboard
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
      if (isMod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [undo, redo])

  const openPanelAt = useCallback(
    (panelName: string, buttonEl: HTMLButtonElement | null) => {
      const toolbarEl = toolbarRef.current
      if (toolbarEl && buttonEl) {
        const tr = toolbarEl.getBoundingClientRect()
        const br = buttonEl.getBoundingClientRect()
        setPanelAnchor({ left: br.left - tr.left + br.width / 2 })
      }
      setOpenPanel((cur) => (cur === panelName ? null : panelName))
    },
    [],
  )

  const beatLoc = ids ? makeBeatLoc(ids.trackId, ids.barId, ids.voiceId, ids.beatId) : null
  const noteLoc = ids?.noteId
    ? { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: ids.beatId, noteId: ids.noteId }
    : null

  // Duration picker
  const applyDuration = (value: Duration) => {
    // Update the store's currentDuration first — applyRestBeat reads it from the store.
    setDuration({ value, dots: currentDuration.dots })
    if (!beatLoc || !ids) return

    // Rest beat: delegate to applyRestBeat — it handles auto-fill atomically.
    if (ids.beat.rest && applyRestBeat) {
      applyRestBeat()
      return
    }

    const voice = ids.bar.voices[ids.cursor.voiceIndex]
    if (!voice || !ast) return

    const timeSig = getEffectiveTimeSig(ast, ids.cursor.trackIndex, ids.barIndex)
    const capacity = barCapacityUnits(timeSig)
    const oldBeatUnits = durationToUnits(ids.beat.duration)
    const newBeatDur = { value, dots: currentDuration.dots }
    const newBeatUnits = durationToUnits(newBeatDur)
    const totalUsed = voice.beats.reduce((sum, b) => sum + durationToUnits(b.duration), 0)
    const room = capacity - (totalUsed - oldBeatUnits)

    if (newBeatUnits > room) return  // Would overflow — reject

    const freed = oldBeatUnits - newBeatUnits

    if (freed > 0) {
      // Shorten: fill freed space with canonical rests (same binary-fill as commitFret)
      const restFill = splitIntoRests(newBeatUnits, freed)
      const cmds: Array<SetDuration | InsertBeat> = [
        new SetDuration(beatLoc, newBeatDur, ids.beat.duration),
      ]
      restFill.forEach((durValue, offset) => {
        cmds.push(new InsertBeat(
          { trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId },
          { id: nanoid(), duration: { value: durValue, dots: 0 }, notes: [], rest: true },
          ids.cursor.beatIndex + 1 + offset,
        ))
      })
      applyCommand(cmds.length === 1 ? cmds[0] : new CompositeCommand(cmds, 'Set duration'))
    } else {
      applyCommand(new SetDuration(beatLoc, newBeatDur, ids.beat.duration))
    }
  }

  const toggleDot = () => {
    if (beatLoc && ids) {
      const beatNextDots: 0 | 1 | 2 =
        ids.beat.duration.dots === 0 ? 1 : ids.beat.duration.dots === 1 ? 2 : 0
      if (beatNextDots > 0) {  // only check when adding dots, not cycling back to 0
        const voice = ids.bar.voices[ids.cursor.voiceIndex]
        if (voice && ast) {
          const timeSig = getEffectiveTimeSig(ast, ids.cursor.trackIndex, ids.barIndex)
          const capacity = barCapacityUnits(timeSig)
          const oldBeatUnits = durationToUnits(ids.beat.duration)
          const totalUsed = voice.beats.reduce((sum, b) => sum + durationToUnits(b.duration), 0)
          const room = capacity - (totalUsed - oldBeatUnits)
          if (durationToUnits({ value: ids.beat.duration.value, dots: beatNextDots }) > room) return
        }
      }
      applyCommand(new ToggleDot(beatLoc))
    }
    const nextDots: 0 | 1 | 2 =
      currentDuration.dots === 0 ? 1 : currentDuration.dots === 1 ? 2 : 0
    setDuration({ value: currentDuration.value, dots: nextDots })
  }

  const toggleTriplet = () => {
    if (!beatLoc || !ids) return
    const hasTriplet = ids.beat.duration.tuplet?.numerator === 3
    applyCommand(new SetTuplet(
      beatLoc,
      hasTriplet ? undefined : { numerator: 3, denominator: 2 },
      ids.beat.duration.tuplet,
    ))
  }

  // Export
  const handleDownloadJson = () => {
    if (ast) downloadAst(ast)
  }

  const handleExportMidi = async () => {
    const bridge = bridgeRef?.current
    if (!bridge) return
    const { exportMidi } = await import('@/io/midi-export')
    await exportMidi(bridge, ast?.meta.title)
  }

  // Slur: create pair with next note, or extend if on end, or clear if on start
  const handleSlur = () => {
    if (!noteLoc || !ids?.note || !ast) return
    const currentSlurId = ids.note.slur
    const voice = ids.bar.voices[ids.cursor.voiceIndex]
    if (!voice) return

    if (currentSlurId === undefined) {
      // No slur → create new pair: current note + next note
      const nextBeat = voice.beats[ids.cursor.beatIndex + 1]
      const nextNote = nextBeat?.notes[0]
      if (!nextBeat || !nextNote) return
      const newId = slurCounter.current++
      applyCommand(new CompositeCommand([
        new SetSlur(noteLoc, newId, undefined),
        new SetSlur({ trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: nextBeat.id, noteId: nextNote.id }, newId, nextNote.slur),
      ], 'Add slur'))
      return
    }

    // Find partner note (same slur ID, different note)
    let partnerBeatId = ''
    let partnerNoteId = ''
    let partnerBeatIdx = -1
    for (let bi = 0; bi < voice.beats.length; bi++) {
      const beat = voice.beats[bi]
      for (const note of beat.notes) {
        if (note.id !== ids.note.id && note.slur === currentSlurId) {
          partnerBeatId = beat.id
          partnerNoteId = note.id
          partnerBeatIdx = bi
          break
        }
      }
      if (partnerBeatId) break
    }

    const isStart = partnerBeatIdx === -1 || partnerBeatIdx > ids.cursor.beatIndex

    const clearBoth = () => {
      const cmds: SetSlur[] = [new SetSlur(noteLoc, undefined, currentSlurId)]
      if (partnerBeatId && partnerNoteId) {
        cmds.push(new SetSlur({ trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: partnerBeatId, noteId: partnerNoteId }, undefined, currentSlurId))
      }
      applyCommand(cmds.length > 1 ? new CompositeCommand(cmds, 'Remove slur') : cmds[0])
    }

    if (isStart) {
      clearBoth()
    } else {
      // Current note is the END → extend to next note
      const nextBeat = voice.beats[ids.cursor.beatIndex + 1]
      const nextNote = nextBeat?.notes[0]
      if (!nextBeat || !nextNote) { clearBoth(); return }
      applyCommand(new CompositeCommand([
        new SetSlur(noteLoc, undefined, currentSlurId),
        new SetSlur({ trackId: ids.trackId, barId: ids.barId, voiceId: ids.voiceId, beatId: nextBeat.id, noteId: nextNote.id }, currentSlurId, nextNote.slur),
      ], 'Extend slur'))
    }
  }

  // Bend presets
  const BEND_PRESETS = [
    {
      label: '½b',
      title: 'Half-step bend',
      points: [{ position: 0, value: 0 }, { position: 6, value: 50 }, { position: 12, value: 50 }],
    },
    {
      label: '1b',
      title: 'Whole-step bend',
      points: [{ position: 0, value: 0 }, { position: 6, value: 100 }, { position: 12, value: 100 }],
    },
    {
      label: 'b/r',
      title: 'Bend & release',
      points: [{ position: 0, value: 0 }, { position: 6, value: 100 }, { position: 12, value: 0 }],
    },
    {
      label: 'pb',
      title: 'Pre-bend',
      points: [{ position: 0, value: 100 }, { position: 12, value: 100 }],
    },
  ] as const

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <KeyboardShortcutsPanel open={shortcuts.open} onClose={shortcuts.onClose} />

      <div
        ref={toolbarRef}
        id="tab-toolbar-panels"
        className={cn(
          'pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2',
          className,
        )}
      >
        {/* Floating panels */}

        {/* Duration panel */}
        <FloatingPanel open={openPanel === 'duration'} anchor={panelAnchor} onClose={() => setOpenPanel(null)} width="w-80">
          <div className="space-y-3">
            <PanelSection title="Duration">
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map(({ value, label, shortcut }) => (
                  <ToolbarBtn
                    key={value}
                    active={currentDuration.value === value}
                    onClick={() => { applyDuration(value); setOpenPanel(null) }}
                    title={shortcut}
                  >
                    {label}
                  </ToolbarBtn>
                ))}
                <ToolbarBtn
                  active={currentDuration.dots > 0}
                  onClick={toggleDot}
                  title={`Dotted (${currentDuration.dots} dot${currentDuration.dots !== 1 ? 's' : ''})`}
                >
                  .
                </ToolbarBtn>
                <ToolbarBtn
                  active={ids?.beat?.duration?.tuplet?.numerator === 3}
                  onClick={toggleTriplet}
                  title="Triplet"
                >
                  3
                </ToolbarBtn>
              </div>
            </PanelSection>
            <PanelSection title="Rest">
              <ToolbarBtn
                active={ids?.beat?.rest === true}
                onClick={() => {
                  if (ids) {
                    applyRestBeat?.()
                  }
                }}
                title="Toggle rest"
              >
                rest
              </ToolbarBtn>
            </PanelSection>
          </div>
        </FloatingPanel>

        {/* Technique panel — guitar-specific note-level techniques */}
        <FloatingPanel open={openPanel === 'technique'} anchor={panelAnchor} onClose={() => setOpenPanel(null)} width="w-96">
          <div className="space-y-3">
            <PanelSection title="Connectivity">
              <div className="flex flex-wrap gap-1.5">
                <ToolbarBtn active={ids?.note?.hammerOrPull === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetHammerOn(noteLoc, !ids.note.hammerOrPull, ids.note.hammerOrPull)) }} title="Hammer-on / Pull-off (h)">H/P</ToolbarBtn>
                <ToolbarBtn active={ids?.note?.slur !== undefined} onClick={handleSlur} title="Slur — select start note, click to draw arc to next; click end note to extend">slur</ToolbarBtn>
                <ToolbarBtn active={ids?.note?.tie === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetTie(noteLoc, !ids.note.tie, ids.note.tie)) }} title="Tie — same pitch, extends duration (i)">tie</ToolbarBtn>
                <ToolbarBtn active={ids?.note?.slide === 'legato'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetSlide(noteLoc, ids.note.slide === 'legato' ? undefined : 'legato', ids.note.slide)) }} title="Legato slide">/sl</ToolbarBtn>
                <ToolbarBtn active={ids?.note?.slide === 'shift'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetSlide(noteLoc, ids.note.slide === 'shift' ? undefined : 'shift', ids.note.slide)) }} title="Shift slide">\sd</ToolbarBtn>
                <ToolbarBtn active={ids?.note?.slide === 'intoFromBelow'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetSlide(noteLoc, ids.note.slide === 'intoFromBelow' ? undefined : 'intoFromBelow', ids.note.slide)) }} title="Slide in from below">↗sl</ToolbarBtn>
                <ToolbarBtn active={ids?.note?.slide === 'outDown'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetSlide(noteLoc, ids.note.slide === 'outDown' ? undefined : 'outDown', ids.note.slide)) }} title="Slide out down">sl↘</ToolbarBtn>
              </div>
            </PanelSection>

            <div className="border-t border-border pt-3">
              <PanelSection title="Bend">
                <div className="flex flex-wrap gap-1.5">
                  {BEND_PRESETS.map((preset) => {
                    const isActive = JSON.stringify(ids?.note?.bend) === JSON.stringify(preset.points)
                    return (
                      <ToolbarBtn
                        key={preset.label}
                        active={isActive}
                        onClick={() => {
                          if (!noteLoc || !ids?.note) return
                          applyCommand(new SetBend(noteLoc, isActive ? undefined : [...preset.points], ids.note.bend))
                        }}
                        title={preset.title}
                      >
                        {preset.label}
                      </ToolbarBtn>
                    )
                  })}
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Vibrato">
                <div className="flex flex-wrap gap-1.5">
                  <ToolbarBtn active={ids?.note?.vibrato === 'slight'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetVibrato(noteLoc, ids.note.vibrato === 'slight' ? undefined : 'slight', ids.note.vibrato)) }} title="Vibrato (slight)">~</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.vibrato === 'wide'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetVibrato(noteLoc, ids.note.vibrato === 'wide' ? undefined : 'wide', ids.note.vibrato)) }} title="Wide vibrato">~~</ToolbarBtn>
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Harmonics">
                <div className="flex flex-wrap gap-1.5">
                  {(['natural', 'artificial', 'pinch', 'tap'] as const).map((type) => (
                    <ToolbarBtn
                      key={type}
                      active={ids?.note?.harmonic === type}
                      onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetHarmonic(noteLoc, ids.note.harmonic === type ? undefined : type, ids.note.harmonic)) }}
                      title={`${type} harmonic`}
                    >
                      {type === 'natural' ? 'nh' : type === 'artificial' ? 'ah' : type === 'pinch' ? 'ph' : 'th'}
                    </ToolbarBtn>
                  ))}
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Touch">
                <div className="flex flex-wrap gap-1.5">
                  <ToolbarBtn active={ids?.note?.dead === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetDeadNote(noteLoc, !ids.note.dead, ids.note.dead)) }} title="Dead note">x</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.ghost === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetGhost(noteLoc, !ids.note.ghost, ids.note.ghost)) }} title="Ghost note">g</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.palmMute === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetPalmMute(noteLoc, !ids.note.palmMute, ids.note.palmMute)) }} title="Palm mute">pm</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.letRing === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetLetRing(noteLoc, !ids.note.letRing, ids.note.letRing)) }} title="Let ring">lr</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.leftHandTap === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetTap(noteLoc, !ids.note.leftHandTap, ids.note.leftHandTap)) }} title="Left-hand tap">tap</ToolbarBtn>
                </div>
              </PanelSection>
            </div>

          </div>
        </FloatingPanel>

        {/* Articulation panel — notation marks about how notes/beats are shaped */}
        <FloatingPanel open={openPanel === 'articulation'} anchor={panelAnchor} onClose={() => setOpenPanel(null)} width="w-80">
          <div className="space-y-3">
            <PanelSection title="Accent & Staccato">
              <div className="flex flex-wrap gap-1.5">
                <ToolbarBtn active={ids?.note?.staccato === true} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetStaccato(noteLoc, !ids.note.staccato, ids.note.staccato)) }} title="Staccato">st</ToolbarBtn>
                {(['normal', 'heavy', 'tenuto'] as const).map((type) => (
                  <ToolbarBtn
                    key={type}
                    active={ids?.note?.accent === type}
                    onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetAccent(noteLoc, ids.note.accent === type ? undefined : type, ids.note.accent)) }}
                    title={type === 'normal' ? 'Accent' : type === 'heavy' ? 'Heavy accent' : 'Tenuto'}
                  >
                    {type === 'normal' ? 'ac' : type === 'heavy' ? 'hac' : 'ten'}
                  </ToolbarBtn>
                ))}
              </div>
            </PanelSection>

            <div className="border-t border-border pt-3">
              <PanelSection title="Ornaments">
                <div className="flex flex-wrap gap-1.5">
                  <ToolbarBtn active={ids?.note?.ornament === 'turn'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetOrnament(noteLoc, ids.note.ornament === 'turn' ? undefined : 'turn', ids.note.ornament)) }} title="Turn">𝄒</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.ornament === 'umordent'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetOrnament(noteLoc, ids.note.ornament === 'umordent' ? undefined : 'umordent', ids.note.ornament)) }} title="Upper mordent">m↑</ToolbarBtn>
                  <ToolbarBtn active={ids?.note?.ornament === 'lmordent'} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetOrnament(noteLoc, ids.note.ornament === 'lmordent' ? undefined : 'lmordent', ids.note.ornament)) }} title="Lower mordent">m↓</ToolbarBtn>
                  {ids?.note?.trill ? (
                    <ToolbarBtn active onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetTrill(noteLoc, undefined, ids.note.trill)) }} title="Clear trill">tr✕</ToolbarBtn>
                  ) : (
                    <div className="flex items-center gap-1">
                      <ToolbarBtn active={false} onClick={() => { if (!noteLoc || !ids?.note) return; applyCommand(new SetTrill(noteLoc, { fret: trillFret || ids.note.fret + 2, duration: 16 }, ids.note.trill)) }} title="Add trill (tr fret ↑)">tr</ToolbarBtn>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={trillFret || ''}
                        placeholder="fret"
                        onChange={(e) => setTrillFret(Number(e.target.value))}
                        className="h-8 w-14 rounded-lg border border-border bg-surface-0 px-2 text-xs text-text-primary outline-none"
                      />
                    </div>
                  )}
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Pick stroke">
                <div className="flex flex-wrap gap-1.5">
                  {(['up', 'down'] as StrokeType[]).map((dir) => (
                    <ToolbarBtn
                      key={dir}
                      disabled={!beatLoc}
                      active={ids?.beat?.pickStroke === dir}
                      onClick={() => { if (!beatLoc || !ids) return; applyCommand(new SetStroke(beatLoc, ids.beat.pickStroke === dir ? undefined : dir, ids.beat.pickStroke)) }}
                      title={`Pick stroke ${dir}`}
                    >
                      {dir === 'up' ? '↑' : '↓'}
                    </ToolbarBtn>
                  ))}
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Arpeggio / Brush">
                <div className="flex flex-wrap gap-1.5">
                  <ToolbarBtn disabled={!beatLoc} active={ids?.beat?.arpeggioUp === true} onClick={() => { if (!beatLoc || !ids) return; const cur = ids.beat.arpeggioUp ? 'up' : ids.beat.arpeggioDown ? 'down' : undefined; applyCommand(new SetArpeggio(beatLoc, cur === 'up' ? undefined : 'up', cur)) }} title="Arpeggio up">↑arp</ToolbarBtn>
                  <ToolbarBtn disabled={!beatLoc} active={ids?.beat?.arpeggioDown === true} onClick={() => { if (!beatLoc || !ids) return; const cur = ids.beat.arpeggioUp ? 'up' : ids.beat.arpeggioDown ? 'down' : undefined; applyCommand(new SetArpeggio(beatLoc, cur === 'down' ? undefined : 'down', cur)) }} title="Arpeggio down">↓arp</ToolbarBtn>
                  <ToolbarBtn disabled={!beatLoc} active={ids?.beat?.brushUp === true} onClick={() => { if (!beatLoc || !ids) return; const cur = ids.beat.brushUp ? 'up' : ids.beat.brushDown ? 'down' : undefined; applyCommand(new SetBrush(beatLoc, cur === 'up' ? undefined : 'up', cur)) }} title="Brush up">↑br</ToolbarBtn>
                  <ToolbarBtn disabled={!beatLoc} active={ids?.beat?.brushDown === true} onClick={() => { if (!beatLoc || !ids) return; const cur = ids.beat.brushUp ? 'up' : ids.beat.brushDown ? 'down' : undefined; applyCommand(new SetBrush(beatLoc, cur === 'down' ? undefined : 'down', cur)) }} title="Brush down">↓br</ToolbarBtn>
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Tremolo picking">
                <div className="flex flex-wrap gap-1.5">
                  <ToolbarBtn disabled={!beatLoc} active={ids?.beat?.tremoloPickingDuration === 8} onClick={() => { if (!beatLoc || !ids) return; applyCommand(new SetTremoloPicking(beatLoc, ids.beat.tremoloPickingDuration === 8 ? undefined : 8, ids.beat.tremoloPickingDuration)) }} title="Tremolo picking (8th)">tp8</ToolbarBtn>
                  <ToolbarBtn disabled={!beatLoc} active={ids?.beat?.tremoloPickingDuration === 16} onClick={() => { if (!beatLoc || !ids) return; applyCommand(new SetTremoloPicking(beatLoc, ids.beat.tremoloPickingDuration === 16 ? undefined : 16, ids.beat.tremoloPickingDuration)) }} title="Tremolo picking (16th)">tp16</ToolbarBtn>
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Fermata">
                <div className="flex flex-wrap gap-1.5">
                  {([['medium', '𝄐', 'Fermata (normal)'], ['short', '𝄐s', 'Fermata (short)'], ['long', '𝄐l', 'Fermata (long)']] as const).map(([type, label, title]) => (
                    <ToolbarBtn
                      key={type}
                      disabled={!beatLoc}
                      active={ids?.beat?.fermata?.type === type}
                      onClick={() => {
                        if (!beatLoc || !ids) return
                        const cur = ids.beat.fermata
                        applyCommand(new SetFermata(beatLoc, cur?.type === type ? undefined : { type, length: 1 }, cur))
                      }}
                      title={title}
                    >
                      {label}
                    </ToolbarBtn>
                  ))}
                </div>
              </PanelSection>
            </div>
          </div>
        </FloatingPanel>

        {/* Dynamics panel — volume & expression only */}
        <FloatingPanel open={openPanel === 'dynamics'} anchor={panelAnchor} onClose={() => setOpenPanel(null)} width="w-72">
          <div className="space-y-3">
            <PanelSection title="Dynamics">
              <div className="flex flex-wrap gap-1.5">
                {DYNAMICS_OPTIONS.map((d) => (
                  <ToolbarBtn
                    key={d}
                    disabled={!beatLoc}
                    active={ids?.beat?.dynamics === d}
                    onClick={() => {
                      if (!beatLoc || !ids) return
                      const newValue = ids.beat.dynamics === d ? undefined : d
                      applyCommand(new SetDynamics(beatLoc, newValue, ids.beat.dynamics))
                      setOpenPanel(null)
                    }}
                    title={beatLoc ? d : 'Select a beat first'}
                  >
                    <span className="italic text-xs font-medium">{d}</span>
                  </ToolbarBtn>
                ))}
              </div>
            </PanelSection>

            <div className="border-t border-border pt-3">
              <PanelSection title="Hairpin">
                <div className="flex flex-wrap gap-1.5">
                  <ToolbarBtn
                    disabled={!beatLoc}
                    active={ids?.beat?.crescendo === true}
                    onClick={() => { if (!beatLoc || !ids) return; applyCommand(new SetCrescendo(beatLoc, !ids.beat.crescendo, ids.beat.crescendo)) }}
                    title="Crescendo (hairpin open)"
                  >
                    cresc
                  </ToolbarBtn>
                  <ToolbarBtn
                    disabled={!beatLoc}
                    active={ids?.beat?.decrescendo === true}
                    onClick={() => { if (!beatLoc || !ids) return; applyCommand(new SetDecrescendo(beatLoc, !ids.beat.decrescendo, ids.beat.decrescendo)) }}
                    title="Decrescendo / diminuendo"
                  >
                    dim
                  </ToolbarBtn>
                </div>
              </PanelSection>
            </div>

            <div className="border-t border-border pt-3">
              <PanelSection title="Fade">
                <div className="flex flex-wrap gap-1.5">
                  {([['in', 'fi', 'Fade in'], ['out', 'fo', 'Fade out'], ['swell', 'vs', 'Volume swell']] as const).map(([val, label, title]) => {
                    const cur = ids?.beat?.fadeIn ? 'in' : ids?.beat?.fadeOut ? 'out' : ids?.beat?.volumeSwell ? 'swell' : undefined
                    return (
                      <ToolbarBtn key={val} disabled={!beatLoc} active={cur === val} onClick={() => { if (!beatLoc || !ids) return; applyCommand(new SetFade(beatLoc, cur === val ? undefined : val, cur)) }} title={title}>{label}</ToolbarBtn>
                    )
                  })}
                </div>
              </PanelSection>
            </div>
          </div>
        </FloatingPanel>

        {/* Bar ops panel */}
        <FloatingPanel open={openPanel === 'bar'} anchor={panelAnchor} onClose={() => setOpenPanel(null)} width="w-72">
          <div className="space-y-3">
            <PanelSection title="Insert bar">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!ids || !ast) return
                    const nid = () => nanoid()
                    // Inherit the time signature from the bar being displaced
                    const timeSig = getEffectiveTimeSig(ast, ids.cursor.trackIndex, ids.barIndex)
                    const newBar = {
                      id: nid(),
                      voices: [{ id: nid(), beats: makeBarBeats(timeSig, nid) }],
                    }
                    applyCommand(new InsertBar(ids.trackId, 0, newBar, ids.barIndex))
                    setOpenPanel(null)
                  }}
                >
                  Before
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!ids || !ast) return
                    const nid = () => nanoid()
                    // Inherit the time signature from the bar before the new one
                    const timeSig = getEffectiveTimeSig(ast, ids.cursor.trackIndex, ids.barIndex)
                    const newBar = {
                      id: nid(),
                      voices: [{ id: nid(), beats: makeBarBeats(timeSig, nid) }],
                    }
                    applyCommand(new InsertBar(ids.trackId, 0, newBar, ids.barIndex + 1))
                    setOpenPanel(null)
                  }}
                >
                  After
                </Button>
              </div>
            </PanelSection>

            <PanelSection title="Delete bar">
              <Button
                variant="outline"
                size="sm"
                disabled={!ids}
                onClick={() => {
                  if (!ids) return
                  applyCommand(new DeleteBar(ids.trackId, 0, ids.barId))
                  setOpenPanel(null)
                }}
              >
                Delete selected bar
              </Button>
            </PanelSection>

            <PanelSection title="Time signature">
              <select
                value={(() => {
                  if (!ast || !ids) return '4/4'
                  const ts = getEffectiveTimeSig(ast, ids.cursor.trackIndex, ids.barIndex)
                  return `${ts.numerator}/${ts.denominator}`
                })()}
                onChange={(e) => {
                  if (!ids) return
                  const [num, den] = e.target.value.split('/').map(Number)
                  applyCommand(new SetTimeSignature(ids.trackId, ids.barId, { numerator: num, denominator: den }, ids.bar.timeSignature))
                }}
                className="h-8 rounded-lg border border-border bg-surface-0 px-2 text-xs text-text-primary outline-none"
              >
                {['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '5/4', '7/8'].map((ts) => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </PanelSection>

            <PanelSection title="Tempo">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={20}
                  max={320}
                  value={tempoValue}
                  onChange={(e) => setTempoValue(Number(e.target.value))}
                  className="h-8 w-20 rounded-lg border border-border bg-surface-0 px-2 text-xs text-text-primary outline-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!ids) return
                    applyCommand(new SetBarTempo(ids.trackId, ids.barId, tempoValue, ids.bar.tempo))
                  }}
                >
                  Set
                </Button>
              </div>
            </PanelSection>
          </div>
        </FloatingPanel>

        {/* Export panel */}
        <FloatingPanel open={openPanel === 'export'} anchor={panelAnchor} onClose={() => setOpenPanel(null)}>
          <div className="space-y-2">
            <PanelSection title="Export / Save">
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => { handleDownloadJson(); setOpenPanel(null) }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                >
                  <FileJson className="size-4 shrink-0" />
                  Save as .json
                </button>
                <button
                  type="button"
                  onClick={() => { void handleExportMidi(); setOpenPanel(null) }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                >
                  <Music className="size-4 shrink-0" />
                  Export MIDI (.mid)
                </button>
                <button
                  type="button"
                  onClick={() => { setOpenPanel(null) }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                  title="Export as PDF (browser print dialog)"
                >
                  <Printer className="size-4 shrink-0" />
                  Export PDF (print)
                </button>
              </div>
            </PanelSection>
            <div className="border-t border-border pt-2">
              <button
                type="button"
                onClick={() => { onOpenFile?.(); setOpenPanel(null) }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-text-secondary hover:bg-surface-1 hover:text-text-primary"
              >
                <UploadCloud className="size-4 shrink-0" />
                Import GP file (.gpx/.gp7…)
              </button>
            </div>
          </div>
        </FloatingPanel>

        {/* Main pill */}
        <div className="pointer-events-auto rounded-full bg-surface-0 p-2 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-3">
            {/* Input mode indicator */}
            {isInsertMode && (
              <div className="flex h-8 items-center gap-1.5 rounded-full bg-[rgba(255,138,0,0.15)] px-2.5">
                <span className="size-1.5 animate-pulse rounded-full bg-[rgba(255,138,0,0.9)]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(255,138,0,0.9)]">Input</span>
              </div>
            )}

            {/* Duration circles */}
            {DURATION_OPTIONS.map(({ value, label, shortcut }) => (
              <GlassCircleBtn
                key={value}
                active={currentDuration.value === value}
                onClick={() => applyDuration(value)}
                title={shortcut}
              >
                {label}
              </GlassCircleBtn>
            ))}
            <GlassCircleBtn
              active={currentDuration.dots > 0}
              onClick={toggleDot}
              title="Dot"
            >
              .
            </GlassCircleBtn>
            <GlassCircleBtn
              active={ids?.beat?.duration?.tuplet?.numerator === 3}
              onClick={toggleTriplet}
              title="Triplet"
            >
              3
            </GlassCircleBtn>
            <GlassCircleBtn
              active={ids?.beat?.rest === true}
              onClick={() => { if (ids) applyRestBeat?.() }}
              title="Rest (R)"
            >
              R
            </GlassCircleBtn>

            {/* Technique / Articulation / Dynamic */}
            <GlassPillBtn
              active={openPanel === 'technique'}
              onClick={(e) => openPanelAt('technique', e.currentTarget)}
            >
              Technique
            </GlassPillBtn>
            <GlassPillBtn
              active={openPanel === 'articulation'}
              onClick={(e) => openPanelAt('articulation', e.currentTarget)}
            >
              Articulation
            </GlassPillBtn>
            <GlassPillBtn
              active={openPanel === 'dynamics'}
              onClick={(e) => openPanelAt('dynamics', e.currentTarget)}
            >
              Dynamic
            </GlassPillBtn>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// TrackDialog — track settings panel (modal)
// ---------------------------------------------------------------------------

interface TrackDialogProps {
  ast: ReturnType<typeof useTabEditorStore.getState>['ast']
  activeTrackIndex: number
  onClose: () => void
  applyCommand: ReturnType<typeof useTabEditorStore.getState>['applyCommand']
}

function TrackDialog({ ast, activeTrackIndex, onClose, applyCommand }: TrackDialogProps) {
  const track = ast?.tracks[activeTrackIndex] ?? ast?.tracks[0]

  const [newName, setNewName] = useState(track?.name ?? '')
  const [capo, setCapo] = useState(track?.capo ?? 0)
  const [instrument, setInstrument] = useState(track?.instrument ?? 0)

  const matchedTuning = track
    ? STANDARD_TUNINGS.find(
        (t) => t.midi.length === track.tuning.length && t.midi.every((v, i) => v === track.tuning[i]),
      )
    : undefined
  const [selectedTuning, setSelectedTuning] = useState(matchedTuning?.label ?? 'Standard E')

  if (!ast || !track) return null

  const applyAll = () => {
    if (newName !== track.name) {
      applyCommand(new RenameTrack(track.id, newName, track.name))
    }
    if (capo !== track.capo) {
      applyCommand(new SetCapo(track.id, capo, track.capo))
    }
    const tuning = STANDARD_TUNINGS.find((t) => t.label === selectedTuning)
    if (tuning && JSON.stringify(tuning.midi) !== JSON.stringify(track.tuning)) {
      applyCommand(new SetTuning(track.id, tuning.midi, track.tuning))
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface-0 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Track settings</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Track name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 rounded-lg border border-border bg-surface-1 px-3 text-sm text-text-primary outline-none focus:border-border-hover"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Tuning</span>
            <select
              value={selectedTuning}
              onChange={(e) => setSelectedTuning(e.target.value)}
              className="h-8 rounded-lg border border-border bg-surface-1 px-2 text-sm text-text-primary outline-none"
            >
              {STANDARD_TUNINGS.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Capo (fret)</span>
            <input
              type="number"
              min={0}
              max={12}
              value={capo}
              onChange={(e) => setCapo(Math.max(0, Math.min(12, Number(e.target.value))))}
              className="h-8 rounded-lg border border-border bg-surface-1 px-3 text-sm text-text-primary outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">MIDI instrument</span>
            <select
              value={instrument}
              onChange={(e) => setInstrument(Number(e.target.value))}
              className="h-8 rounded-lg border border-border bg-surface-1 px-2 text-sm text-text-primary outline-none"
            >
              {MIDI_INSTRUMENTS.map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={applyAll} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
