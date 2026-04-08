/**
 * PropertyPanel — collapsible right-side panel showing properties of
 * the currently selected note/beat in the alphaTex tab editor.
 *
 * Reads selection from useTabEditorStore and dispatches mutations via
 * applyCommand.
 *
 * Commands use string IDs (trackId, barId, voiceId, beatId, noteId).
 * We resolve those IDs from the numeric cursor indices in the AST.
 */

import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Minus } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { Button } from '@/components/ui/Button'
import { useTabEditorStore } from '@/stores/tabEditorStore'
import {
  SetDuration,
  SetRest,
  SetHammerOn,
  SetSlide,
  SetBend,
  SetVibrato,
  SetHarmonic,
  SetTie,
  SetGhost,
  SetDeadNote,
  SetTap,
  SetPalmMute,
  SetLetRing,
  SetAccent,
  SetStroke,
  SetFret,
  SetString,
} from '@/editor/commands'
import type {
  Duration,
  DynamicsValue,
  SlideType,
  AccentType,
  StrokeType,
  BendPoint,
  NoteNode,
  BeatNode,
} from '@/editor/ast/types'

// ---------------------------------------------------------------------------
// ID-resolution helpers
// ---------------------------------------------------------------------------

interface ResolvedIds {
  trackId: string
  barId: string
  voiceId: string
  beatId: string
  noteId: string | null
  beat: BeatNode | null
  note: NoteNode | null
}

function resolveIds(
  ast: ReturnType<typeof useTabEditorStore.getState>['ast'],
  sel: ReturnType<typeof useTabEditorStore.getState>['selection'],
): ResolvedIds | null {
  if (!ast || !sel) return null
  const cursor = sel.kind === 'caret' ? sel.cursor : sel.anchor
  const track = ast.tracks[cursor.trackIndex]
  if (!track) return null
  const bar = track.staves[0]?.bars[cursor.barIndex]
  if (!bar) return null
  const voice = bar.voices[cursor.voiceIndex]
  if (!voice) return null
  const beat = voice.beats[cursor.beatIndex]
  if (!beat) return null
  // Find the note on the selected string (stringIndex is 1-indexed)
  const note = beat.notes.find((n) => n.string === cursor.stringIndex) ?? beat.notes[0] ?? null
  return {
    trackId: track.id,
    barId: bar.id,
    voiceId: voice.id,
    beatId: beat.id,
    noteId: note?.id ?? null,
    beat,
    note,
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children, defaultOpen = true }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted hover:text-text-secondary"
      >
        {title}
        {open
          ? <ChevronDown className="size-3.5" />
          : <ChevronRight className="size-3.5" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-20 shrink-0 text-[11px] text-text-muted">{label}</span>
      <div className="flex flex-1 flex-wrap gap-1">{children}</div>
    </div>
  )
}

function PillButton({
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
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex min-h-[28px] items-center justify-center rounded-md border px-2 text-xs transition-colors',
        active
          ? 'border-accent bg-accent text-surface-0'
          : 'border-border bg-surface-1 text-text-secondary hover:border-border-hover hover:text-text-primary',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATIONS: Array<{ value: Duration; label: string }> = [
  { value: 1, label: 'W' },
  { value: 2, label: 'H' },
  { value: 4, label: 'Q' },
  { value: 8, label: 'E' },
  { value: 16, label: 'S' },
  { value: 32, label: 'T' },
]

const DYNAMICS: DynamicsValue[] = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff']

const SLIDES: Array<{ value: SlideType; label: string }> = [
  { value: 'legato', label: 'sl' },
  { value: 'shift', label: 'ss' },
  { value: 'intoFromBelow', label: 'sib' },
  { value: 'intoFromAbove', label: 'sia' },
  { value: 'outUp', label: 'sou' },
  { value: 'outDown', label: 'sod' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PropertyPanelProps {
  className?: string
}

export function PropertyPanel({ className }: PropertyPanelProps) {
  const ast = useTabEditorStore((s) => s.ast)
  const selection = useTabEditorStore((s) => s.selection)
  const currentDuration = useTabEditorStore((s) => s.currentDuration)
  const applyCommand = useTabEditorStore((s) => s.applyCommand)

  const [bendPoints, setBendPoints] = useState<BendPoint[]>([])

  const resolved = resolveIds(ast, selection)
  const { beat, note, trackId, barId, voiceId, beatId, noteId } = resolved ?? {}

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (!resolved || !beat) {
    return (
      <aside className={cn('flex w-64 flex-col border-l border-border bg-surface-0 text-xs', className)}>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-text-muted">
          Select a beat or note to see its properties.
        </div>
      </aside>
    )
  }

  // ---------------------------------------------------------------------------
  // Beat-level commands
  // ---------------------------------------------------------------------------
  const beatLoc = { trackId: trackId!, barId: barId!, voiceId: voiceId!, beatId: beatId! }

  const applyDuration = (value: Duration) => {
    applyCommand(new SetDuration(beatLoc, { value, dots: currentDuration.dots }, beat.duration))
  }

  const toggleDot = () => {
    const nextDots: 0 | 1 | 2 =
      currentDuration.dots === 0 ? 1 : currentDuration.dots === 1 ? 2 : 0
    applyCommand(new SetDuration(beatLoc, { value: currentDuration.value, dots: nextDots }, beat.duration))
  }

  const toggleRest = () => {
    applyCommand(new SetRest(beatLoc, !beat.rest, beat.rest ?? false))
  }

  const applyStroke = (dir: StrokeType) => {
    applyCommand(new SetStroke(beatLoc, beat.pickStroke === dir ? undefined : dir, beat.pickStroke))
  }

  // ---------------------------------------------------------------------------
  // Note-level commands (require a resolved noteId)
  // ---------------------------------------------------------------------------
  const noteLoc = noteId
    ? { trackId: trackId!, barId: barId!, voiceId: voiceId!, beatId: beatId!, noteId }
    : null

  const applyBend = () => {
    if (!noteLoc) return
    applyCommand(new SetBend(noteLoc, bendPoints, note?.bend ?? []))
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <aside className={cn('flex w-64 flex-col border-l border-border bg-surface-0 text-xs', className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[11px] font-semibold text-text-primary">Properties</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Beat ── */}
        <Section title="Beat">
          <Row label="Duration">
            {DURATIONS.map(({ value, label }) => (
              <PillButton
                key={value}
                active={currentDuration.value === value}
                onClick={() => applyDuration(value)}
              >
                {label}
              </PillButton>
            ))}
          </Row>
          <Row label="Dot">
            <PillButton
              active={currentDuration.dots > 0}
              onClick={toggleDot}
              title={`Augmentation dot (currently ${currentDuration.dots})`}
            >
              .
            </PillButton>
          </Row>
          <Row label="Rest">
            <PillButton active={beat.rest === true} onClick={toggleRest}>
              rest
            </PillButton>
          </Row>
          <Row label="Dynamics">
            {DYNAMICS.map((d) => (
              <PillButton
                key={d}
                active={beat.dynamics === d}
                onClick={() => {
                  // TODO(phase10): add SetDynamics command
                  console.warn('[PropertyPanel] SetDynamics command not yet implemented — needs phase 10')
                }}
              >
                {d}
              </PillButton>
            ))}
          </Row>
          <Row label="Pick stroke">
            {(['up', 'down'] as StrokeType[]).map((dir) => (
              <PillButton
                key={dir}
                active={beat.pickStroke === dir}
                onClick={() => applyStroke(dir)}
              >
                {dir === 'up' ? '↑' : '↓'}
              </PillButton>
            ))}
          </Row>
        </Section>

        {/* ── Note (only when a note is selected) ── */}
        {note && noteLoc && (
          <Section title="Note">
            <Row label="Fret">
              <input
                type="number"
                min={0}
                max={24}
                value={note.fret}
                onChange={(e) => {
                  applyCommand(new SetFret(noteLoc, Math.max(0, Math.min(24, Number(e.target.value))), note.fret))
                }}
                className="h-7 w-16 rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
              />
            </Row>
            <Row label="String">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <PillButton
                  key={s}
                  active={note.string === s}
                  onClick={() => applyCommand(new SetString(noteLoc, s, note.string))}
                >
                  {s}
                </PillButton>
              ))}
            </Row>
            <Row label="Technique">
              <PillButton
                active={note.hammerOrPull === true}
                onClick={() =>
                  applyCommand(new SetHammerOn(noteLoc, !note.hammerOrPull, note.hammerOrPull))
                }
                title="Hammer-on / Pull-off"
              >
                H/P
              </PillButton>
              {SLIDES.map(({ value, label }) => (
                <PillButton
                  key={value}
                  active={note.slide === value}
                  onClick={() =>
                    applyCommand(new SetSlide(noteLoc, note.slide === value ? undefined : value, note.slide))
                  }
                >
                  {label}
                </PillButton>
              ))}
              <PillButton
                active={note.vibrato !== undefined}
                onClick={() =>
                  applyCommand(new SetVibrato(noteLoc, note.vibrato ? undefined : 'slight', note.vibrato))
                }
              >
                vib
              </PillButton>
              <PillButton
                active={note.ghost === true}
                onClick={() => applyCommand(new SetGhost(noteLoc, !note.ghost, note.ghost))}
              >
                ghost
              </PillButton>
              <PillButton
                active={note.dead === true}
                onClick={() => applyCommand(new SetDeadNote(noteLoc, !note.dead, note.dead))}
              >
                X
              </PillButton>
              <PillButton
                active={note.palmMute === true}
                onClick={() => applyCommand(new SetPalmMute(noteLoc, !note.palmMute, note.palmMute))}
              >
                pm
              </PillButton>
              <PillButton
                active={note.letRing === true}
                onClick={() => applyCommand(new SetLetRing(noteLoc, !note.letRing, note.letRing))}
              >
                lr
              </PillButton>
              <PillButton
                active={note.tie === true}
                onClick={() => applyCommand(new SetTie(noteLoc, !note.tie, note.tie))}
              >
                tie
              </PillButton>
              {(['normal', 'heavy', 'tenuto'] as AccentType[]).map((type) => (
                <PillButton
                  key={type}
                  active={note.accent === type}
                  onClick={() =>
                    applyCommand(
                      new SetAccent(noteLoc, note.accent === type ? undefined : type, note.accent),
                    )
                  }
                >
                  {type === 'normal' ? 'ac' : type === 'heavy' ? 'hac' : 'ten'}
                </PillButton>
              ))}
              <PillButton
                active={note.harmonic !== undefined}
                onClick={() =>
                  applyCommand(
                    new SetHarmonic(noteLoc, note.harmonic ? undefined : 'natural', note.harmonic),
                  )
                }
              >
                nh
              </PillButton>
              <PillButton
                active={note.leftHandTap === true}
                onClick={() => applyCommand(new SetTap(noteLoc, !note.leftHandTap, note.leftHandTap))}
              >
                tap
              </PillButton>
            </Row>

            {/* Bend editor */}
            <Section title="Bend" defaultOpen={false}>
              <div className="space-y-1">
                {bendPoints.map((pt, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-6 shrink-0 text-[10px] text-text-muted">p</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={pt.position}
                      onChange={(e) => {
                        const next = [...bendPoints]
                        next[i] = { ...pt, position: Number(e.target.value) }
                        setBendPoints(next)
                      }}
                      className="h-6 w-12 rounded border border-border bg-surface-1 px-1 text-[10px] outline-none"
                    />
                    <span className="w-6 shrink-0 text-[10px] text-text-muted">v</span>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={pt.value}
                      onChange={(e) => {
                        const next = [...bendPoints]
                        next[i] = { ...pt, value: Number(e.target.value) }
                        setBendPoints(next)
                      }}
                      className="h-6 w-12 rounded border border-border bg-surface-1 px-1 text-[10px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setBendPoints(bendPoints.filter((_, j) => j !== i))}
                      className="text-text-muted hover:text-error"
                    >
                      <Minus className="size-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBendPoints([...bendPoints, { position: 30, value: 4 }])}
                    className="h-6 gap-1 text-[10px]"
                  >
                    <Plus className="size-3" />
                    Add point
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={bendPoints.length === 0}
                    onClick={applyBend}
                    className="h-6 text-[10px]"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </Section>
          </Section>
        )}
      </div>
    </aside>
  )
}
