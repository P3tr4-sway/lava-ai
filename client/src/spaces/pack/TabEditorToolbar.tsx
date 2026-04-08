/**
 * TabEditorToolbar — alphaTex tab editor toolbar.
 *
 * Replaces EditorToolbar for the USE_ALPHATEX_ENGINE path.
 * Implements: Duration, Technique, Dynamics, Bar-ops, Track-panel,
 * Import/Export, and Keyboard-shortcuts button groups.
 *
 * All button groups dispatch commands through useTabEditorStore.applyCommand().
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  ChevronDown,
  Download,
  FileJson,
  Keyboard,
  Music,
  Play,
  Printer,
  Settings,
  SkipBack,
  Square,
  UploadCloud,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import { useTabEditorStore } from '@/stores/tabEditorStore'
import {
  SetDuration,
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
  SetVibrato,
  SetHarmonic,
  SetDeadNote,
  SetGhost,
  SetTap,
  SetPalmMute,
  SetLetRing,
  SetAccent,
  SetStroke,
  makeBeatLoc,
} from '@/editor/commands'
import type {
  Duration,
  DynamicsValue,
  SlideType,
  StrokeType,
  AccentType,
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
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent text-surface-0'
          : 'border-border bg-surface-0 text-text-secondary hover:border-border-hover hover:bg-surface-1 hover:text-text-primary',
        className,
      )}
    >
      {children}
    </button>
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
        'absolute bottom-full mb-3 rounded-2xl border border-border bg-surface-0 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)]',
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
  const cursor = selection.kind === 'caret' ? selection.cursor : selection.anchor
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
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TabEditorToolbar({ className, bridgeRef, onOpenFile }: TabEditorToolbarProps) {
  const applyCommand = useTabEditorStore((s) => s.applyCommand)
  const currentDuration = useTabEditorStore((s) => s.currentDuration)
  const setDuration = useTabEditorStore((s) => s.setDuration)
  const undo = useTabEditorStore((s) => s.undo)
  const redo = useTabEditorStore((s) => s.redo)
  const ast = useTabEditorStore((s) => s.ast)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [panelAnchor, setPanelAnchor] = useState<{ left: number } | null>(null)
  const [trackDialogOpen, setTrackDialogOpen] = useState(false)
  const [tempoValue, setTempoValue] = useState(120)

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
    if (beatLoc && ids) {
      applyCommand(new SetDuration(beatLoc, { value, dots: currentDuration.dots }, ids.beat.duration))
    }
    setDuration({ value, dots: currentDuration.dots })
  }

  const toggleDot = () => {
    if (beatLoc && ids) {
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

  // Technique helpers
  const TECHNIQUE_BUTTONS: Array<{
    label: string
    title: string
    isActive: () => boolean
    onPress: () => void
  }> = [
    {
      label: 'H/P',
      title: 'Hammer-on / Pull-off',
      isActive: () => ids?.note?.hammerOrPull === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetHammerOn(noteLoc, !ids.note.hammerOrPull, ids.note.hammerOrPull))
      },
    },
    {
      label: 'p-o',
      title: 'Pull-off',
      isActive: () => ids?.note?.hammerOrPull === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetPullOff(noteLoc, !ids.note.hammerOrPull, ids.note.hammerOrPull))
      },
    },
    {
      label: '/sl',
      title: 'Slide up (legato)',
      isActive: () => ids?.note?.slide === 'legato',
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetSlide(noteLoc, ids.note.slide === 'legato' ? undefined : 'legato', ids.note.slide))
      },
    },
    {
      label: '\\sd',
      title: 'Slide down',
      isActive: () => ids?.note?.slide === 'shift',
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetSlide(noteLoc, ids.note.slide === 'shift' ? undefined : 'shift', ids.note.slide))
      },
    },
    {
      label: 'vib',
      title: 'Vibrato (slight)',
      isActive: () => ids?.note?.vibrato !== undefined,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetVibrato(noteLoc, ids.note.vibrato ? undefined : 'slight', ids.note.vibrato))
      },
    },
    {
      label: 'nh',
      title: 'Natural harmonic',
      isActive: () => ids?.note?.harmonic === 'natural',
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetHarmonic(noteLoc, ids.note.harmonic ? undefined : 'natural', ids.note.harmonic))
      },
    },
    {
      label: 'X',
      title: 'Dead note',
      isActive: () => ids?.note?.dead === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetDeadNote(noteLoc, !ids.note.dead, ids.note.dead))
      },
    },
    {
      label: 'g',
      title: 'Ghost note',
      isActive: () => ids?.note?.ghost === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetGhost(noteLoc, !ids.note.ghost, ids.note.ghost))
      },
    },
    {
      label: 'tap',
      title: 'Left-hand tap',
      isActive: () => ids?.note?.leftHandTap === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetTap(noteLoc, !ids.note.leftHandTap, ids.note.leftHandTap))
      },
    },
    {
      label: 'pm',
      title: 'Palm mute',
      isActive: () => ids?.note?.palmMute === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetPalmMute(noteLoc, !ids.note.palmMute, ids.note.palmMute))
      },
    },
    {
      label: 'lr',
      title: 'Let ring',
      isActive: () => ids?.note?.letRing === true,
      onPress: () => {
        if (!noteLoc || !ids?.note) return
        applyCommand(new SetLetRing(noteLoc, !ids.note.letRing, ids.note.letRing))
      },
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <KeyboardShortcutsPanel open={shortcuts.open} onClose={shortcuts.onClose} />

      {/* Track panel dialog */}
      {trackDialogOpen && ast && (
        <TrackDialog
          ast={ast}
          onClose={() => setTrackDialogOpen(false)}
          applyCommand={applyCommand}
        />
      )}

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
                  if (beatLoc && ids) {
                    applyCommand(new SetRest(beatLoc, !ids.beat.rest, ids.beat.rest ?? false))
                  }
                }}
                title="Toggle rest"
              >
                rest
              </ToolbarBtn>
            </PanelSection>
          </div>
        </FloatingPanel>

        {/* Technique panel */}
        <FloatingPanel open={openPanel === 'technique'} anchor={panelAnchor} onClose={() => setOpenPanel(null)} width="w-80">
          <PanelSection title="Techniques">
            <div className="flex flex-wrap gap-1.5">
              {TECHNIQUE_BUTTONS.map((btn) => (
                <ToolbarBtn
                  key={btn.label}
                  active={btn.isActive()}
                  onClick={btn.onPress}
                  title={btn.title}
                >
                  {btn.label}
                </ToolbarBtn>
              ))}
            </div>
          </PanelSection>
          <div className="mt-3 border-t border-border pt-3">
            <PanelSection title="Accent">
              {(['normal', 'heavy', 'tenuto'] as AccentType[]).map((type) => (
                <ToolbarBtn
                  key={type}
                  active={ids?.note?.accent === type}
                  onClick={() => {
                    if (!noteLoc || !ids?.note) return
                    applyCommand(new SetAccent(noteLoc, ids.note.accent === type ? undefined : type, ids.note.accent))
                  }}
                  title={`Accent: ${type}`}
                >
                  {type === 'normal' ? 'ac' : type === 'heavy' ? 'hac' : 'ten'}
                </ToolbarBtn>
              ))}
            </PanelSection>
          </div>
        </FloatingPanel>

        {/* Dynamics panel */}
        <FloatingPanel open={openPanel === 'dynamics'} anchor={panelAnchor} onClose={() => setOpenPanel(null)}>
          <PanelSection title="Dynamics">
            <div className="flex flex-wrap gap-1.5">
              {DYNAMICS_OPTIONS.map((d) => (
                <ToolbarBtn
                  key={d}
                  active={ids?.beat?.dynamics === d}
                  onClick={() => {
                    // TODO(phase10): add SetDynamics command
                    console.warn('[TabEditorToolbar] SetDynamics not yet implemented')
                  }}
                  title={d}
                >
                  {d}
                </ToolbarBtn>
              ))}
            </div>
          </PanelSection>
          <div className="mt-3 border-t border-border pt-3">
            <PanelSection title="Pick stroke">
              {(['up', 'down'] as StrokeType[]).map((dir) => (
                <ToolbarBtn
                  key={dir}
                  active={ids?.beat?.pickStroke === dir}
                  onClick={() => {
                    if (!beatLoc || !ids) return
                    applyCommand(new SetStroke(beatLoc, ids.beat.pickStroke === dir ? undefined : dir, ids.beat.pickStroke))
                  }}
                  title={`Pick stroke ${dir}`}
                >
                  {dir === 'up' ? '↑' : '↓'}
                </ToolbarBtn>
              ))}
            </PanelSection>
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
                    const { nanoid: nid } = { nanoid: () => nanoid() }
                    const newBar = {
                      id: nid(),
                      voices: [{ id: nid(), beats: [{ id: nid(), duration: { value: 4 as Duration, dots: 0 as const }, notes: [] }] }],
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
                    const newBar = {
                      id: nid(),
                      voices: [{ id: nid(), beats: [{ id: nid(), duration: { value: 4 as Duration, dots: 0 as const }, notes: [] }] }],
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
                defaultValue="4/4"
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
        <div className="pointer-events-auto rounded-[18px] border border-border bg-surface-0 p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center gap-0.5">
            {/* Playback */}
            <ToolbarBtn onClick={() => window.dispatchEvent(new CustomEvent('lava-tab-play-pause'))} title="Play / Pause">
              <Play className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => window.dispatchEvent(new CustomEvent('lava-tab-stop'))} title="Stop">
              <Square className="size-4" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => window.dispatchEvent(new CustomEvent('lava-tab-rewind'))} title="Back to beginning">
              <SkipBack className="size-4" />
            </ToolbarBtn>

            <GroupSep />

            {/* Duration group */}
            <div className="flex flex-col items-center gap-0.5">
              <GroupLabel>Duration</GroupLabel>
              <div className="flex gap-0.5">
                {DURATION_OPTIONS.map(({ value, label, shortcut }) => (
                  <ToolbarBtn
                    key={value}
                    active={currentDuration.value === value}
                    onClick={() => applyDuration(value)}
                    title={shortcut}
                  >
                    {label}
                  </ToolbarBtn>
                ))}
                <ToolbarBtn
                  active={currentDuration.dots > 0}
                  onClick={toggleDot}
                  title="Dot"
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
            </div>

            <GroupSep />

            {/* Technique button → opens panel */}
            <button
              type="button"
              onClick={(e) => openPanelAt('technique', e.currentTarget)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                openPanel === 'technique'
                  ? 'border-accent bg-surface-1 text-text-primary'
                  : 'border-border text-text-secondary hover:border-border-hover hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              Technique
              <ChevronDown className={cn('size-3 transition-transform', openPanel === 'technique' && 'rotate-180')} />
            </button>

            {/* Dynamics button → opens panel */}
            <button
              type="button"
              onClick={(e) => openPanelAt('dynamics', e.currentTarget)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                openPanel === 'dynamics'
                  ? 'border-accent bg-surface-1 text-text-primary'
                  : 'border-border text-text-secondary hover:border-border-hover hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              Dynamics
              <ChevronDown className={cn('size-3 transition-transform', openPanel === 'dynamics' && 'rotate-180')} />
            </button>

            <GroupSep />

            {/* Bar ops */}
            <button
              type="button"
              onClick={(e) => openPanelAt('bar', e.currentTarget)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                openPanel === 'bar'
                  ? 'border-accent bg-surface-1 text-text-primary'
                  : 'border-border text-text-secondary hover:border-border-hover hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              Bar
              <ChevronDown className={cn('size-3 transition-transform', openPanel === 'bar' && 'rotate-180')} />
            </button>

            {/* Track panel */}
            <ToolbarBtn onClick={() => setTrackDialogOpen(true)} title="Track settings">
              <Settings className="size-4" />
            </ToolbarBtn>

            <GroupSep />

            {/* Export */}
            <button
              type="button"
              onClick={(e) => openPanelAt('export', e.currentTarget)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                openPanel === 'export'
                  ? 'border-accent bg-surface-1 text-text-primary'
                  : 'border-border text-text-secondary hover:border-border-hover hover:bg-surface-1 hover:text-text-primary',
              )}
            >
              <Download className="size-3.5" />
              Save
              <ChevronDown className={cn('size-3 transition-transform', openPanel === 'export' && 'rotate-180')} />
            </button>

            {/* Keyboard shortcuts */}
            <ToolbarBtn onClick={shortcuts.onOpen} title="Keyboard shortcuts (?)">
              <HelpCircle className="size-4" />
            </ToolbarBtn>
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
  onClose: () => void
  applyCommand: ReturnType<typeof useTabEditorStore.getState>['applyCommand']
}

function TrackDialog({ ast, onClose, applyCommand }: TrackDialogProps) {
  if (!ast) return null

  const track = ast.tracks[0]
  if (!track) return null

  const [newName, setNewName] = useState(track.name)
  const [capo, setCapo] = useState(track.capo)
  const [instrument, setInstrument] = useState(track.instrument)

  const matchedTuning = STANDARD_TUNINGS.find(
    (t) => t.midi.length === track.tuning.length && t.midi.every((v, i) => v === track.tuning[i]),
  )
  const [selectedTuning, setSelectedTuning] = useState(matchedTuning?.label ?? 'Standard E')

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
