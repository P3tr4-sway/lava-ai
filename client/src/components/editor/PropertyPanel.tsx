/**
 * PropertyPanel — collapsible right-side panel showing properties of the
 * currently selected note / beat / bar in the alphaTex tab editor.
 *
 * Reads selection from useTabEditorStore and dispatches mutations via
 * applyCommand. Resolves numeric cursor indices into string IDs that the
 * Command layer expects.
 */

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/components/ui/utils'
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
  SetDynamics,
  SetFret,
  SetString,
  SetTrill,
  SetSlur,
  SetFermata,
  SetWhammy,
  SetChord,
  SetRepeat,
  SetJump,
  SetAlternateEnding,
  SetSection,
} from '@/editor/commands'
import type { FermataValue } from '@/editor/commands'
import { BendCurveEditor, getPresetsForKind } from './BendCurveEditor'
import type {
  Duration,
  DynamicsValue,
  SlideType,
  AccentType,
  StrokeType,
  BendPoint,
  NoteNode,
  BeatNode,
  BarNode,
  JumpType,
} from '@/editor/ast/types'

// ---------------------------------------------------------------------------
// ID-resolution helpers
// ---------------------------------------------------------------------------

interface ResolvedBeatContext {
  kind: 'beat'
  trackId: string
  barId: string
  voiceId: string
  beatId: string
  noteId: string | null
  beat: BeatNode
  note: NoteNode | null
}

interface ResolvedBarContext {
  kind: 'bar'
  trackId: string
  barId: string
  bar: BarNode
}

type ResolvedContext = ResolvedBeatContext | ResolvedBarContext

function resolveIds(
  ast: ReturnType<typeof useTabEditorStore.getState>['ast'],
  sel: ReturnType<typeof useTabEditorStore.getState>['selection'],
): ResolvedContext | null {
  if (!ast || !sel) return null

  // Bar selection — resolve from sel.from
  if (sel.kind === 'bar') {
    const track = ast.tracks[sel.from.trackIndex]
    if (!track) return null
    const bar = track.staves[0]?.bars[sel.from.barIndex]
    if (!bar) return null
    return { kind: 'bar', trackId: track.id, barId: bar.id, bar }
  }

  // Note / caret / range — resolve to the active beat
  const cursor =
    sel.kind === 'caret' || sel.kind === 'note'
      ? sel.cursor
      : sel.kind === 'range'
        ? sel.anchor
        : null
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
    kind: 'beat',
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
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
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

const FERMATA_OPTIONS: Array<{ value: FermataValue['type']; label: string; length: number }> = [
  { value: 'short', label: 'Short', length: 100 },
  { value: 'medium', label: 'Med', length: 200 },
  { value: 'long', label: 'Long', length: 400 },
]

const TRILL_DURATIONS: Array<{ value: Duration; label: string }> = [
  { value: 4, label: 'Q' },
  { value: 8, label: 'E' },
  { value: 16, label: 'S' },
  { value: 32, label: 'T' },
]

const JUMP_OPTIONS: Array<{ value: JumpType; label: string }> = [
  { value: 'Fine', label: 'Fine' },
  { value: 'Segno', label: 'Segno' },
  { value: 'Coda', label: 'Coda' },
  { value: 'DaCapo', label: 'D.C.' },
  { value: 'DaCapoAlFine', label: 'D.C. al Fine' },
  { value: 'DaCapoAlCoda', label: 'D.C. al Coda' },
  { value: 'DalSegno', label: 'D.S.' },
  { value: 'DalSegnoAlFine', label: 'D.S. al Fine' },
  { value: 'DalSegnoAlCoda', label: 'D.S. al Coda' },
  { value: 'DoubleCoda', label: 'Double Coda' },
  { value: 'DoubleSegno', label: 'Double Segno' },
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

  const resolved = resolveIds(ast, selection)

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (!resolved) {
    return (
      <aside className={cn('flex w-64 flex-col border-l border-border bg-surface-0 text-xs', className)}>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-text-muted">
          Select a beat, note, or bar to see its properties.
        </div>
      </aside>
    )
  }

  // ---------------------------------------------------------------------------
  // Render — Bar selection
  // ---------------------------------------------------------------------------
  if (resolved.kind === 'bar') {
    return (
      <aside className={cn('flex w-64 flex-col border-l border-border bg-surface-0 text-xs', className)}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-[11px] font-semibold text-text-primary">Bar properties</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <BarProperties resolved={resolved} applyCommand={applyCommand} />
        </div>
      </aside>
    )
  }

  // ---------------------------------------------------------------------------
  // Beat / Note selection
  // ---------------------------------------------------------------------------
  const { beat, note, trackId, barId, voiceId, beatId, noteId } = resolved
  const beatLoc = { trackId, barId, voiceId, beatId }

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

  const noteLoc = noteId ? { ...beatLoc, noteId } : null

  const handleBendChange = (next: BendPoint[]) => {
    if (!noteLoc) return
    applyCommand(new SetBend(noteLoc, next.length > 0 ? next : undefined, note?.bend))
  }

  const handleWhammyChange = (next: BendPoint[]) => {
    applyCommand(new SetWhammy(beatLoc, next.length > 0 ? next : undefined, beat.whammy))
  }

  const applyChord = (value: string) => {
    const trimmed = value.trim()
    applyCommand(new SetChord(beatLoc, trimmed === '' ? undefined : trimmed, beat.chord))
  }

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
                  const newValue = beat.dynamics === d ? undefined : d
                  applyCommand(new SetDynamics(beatLoc, newValue, beat.dynamics))
                }}
              >
                <span className="italic text-xs font-medium">{d}</span>
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
          <Row label="Fermata">
            <PillButton
              active={beat.fermata === undefined}
              onClick={() => {
                if (beat.fermata !== undefined)
                  applyCommand(new SetFermata(beatLoc, undefined, beat.fermata))
              }}
            >
              off
            </PillButton>
            {FERMATA_OPTIONS.map(({ value, label, length }) => (
              <PillButton
                key={value}
                active={beat.fermata?.type === value}
                onClick={() =>
                  applyCommand(
                    new SetFermata(
                      beatLoc,
                      beat.fermata?.type === value ? undefined : { type: value, length },
                      beat.fermata,
                    ),
                  )
                }
              >
                {label}
              </PillButton>
            ))}
          </Row>
          <Row label="Chord">
            <input
              type="text"
              defaultValue={beat.chord ?? ''}
              onBlur={(e) => {
                if ((e.target.value.trim() || undefined) !== beat.chord) {
                  applyChord(e.target.value)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              placeholder="e.g. Cm7"
              className="h-7 w-full rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
            />
          </Row>
        </Section>

        {/* ── Whammy (beat-level, even without a note) ── */}
        <Section title="Whammy bar" defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {getPresetsForKind('whammy').map(({ key, label, points }) => (
                <PillButton
                  key={key}
                  onClick={() => handleWhammyChange(points)}
                  title={`Apply ${label} whammy preset`}
                >
                  {label}
                </PillButton>
              ))}
              <PillButton
                disabled={!beat.whammy || beat.whammy.length === 0}
                onClick={() => handleWhammyChange([])}
              >
                Clear
              </PillButton>
            </div>
            <BendCurveEditor
              kind="whammy"
              points={beat.whammy ?? []}
              onChange={handleWhammyChange}
            />
          </div>
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
                  applyCommand(
                    new SetFret(
                      noteLoc,
                      Math.max(0, Math.min(24, Number(e.target.value))),
                      note.fret,
                    ),
                  )
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
                <span className="glyph-text-fallback">H/P</span>
              </PillButton>
              {SLIDES.map(({ value, label }) => (
                <PillButton
                  key={value}
                  active={note.slide === value}
                  onClick={() =>
                    applyCommand(new SetSlide(noteLoc, note.slide === value ? undefined : value, note.slide))
                  }
                >
                  <span className="glyph-text-fallback">{label}</span>
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
                <span className="glyph-text-fallback">pm</span>
              </PillButton>
              <PillButton
                active={note.letRing === true}
                onClick={() => applyCommand(new SetLetRing(noteLoc, !note.letRing, note.letRing))}
              >
                <span className="glyph-text-fallback">lr</span>
              </PillButton>
              <PillButton
                active={note.tie === true}
                onClick={() => applyCommand(new SetTie(noteLoc, !note.tie, note.tie))}
              >
                <span className="glyph-text-fallback">tie</span>
              </PillButton>
              <PillButton
                active={note.slur !== undefined}
                onClick={() => {
                  const nextId = note.slur === undefined ? hashStringToNumber(nanoid(8)) : undefined
                  applyCommand(new SetSlur(noteLoc, nextId, note.slur))
                }}
                title="Slur (legato phrase)"
              >
                <span className="glyph-text-fallback">slur</span>
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
                <span className="glyph-text-fallback">tap</span>
              </PillButton>
            </Row>

            {/* Trill */}
            <Row label="Trill">
              <PillButton
                active={note.trill === undefined}
                onClick={() => {
                  if (note.trill !== undefined)
                    applyCommand(new SetTrill(noteLoc, undefined, note.trill))
                }}
              >
                off
              </PillButton>
              {note.trill !== undefined && (
                <>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={note.trill.fret}
                    onChange={(e) =>
                      applyCommand(
                        new SetTrill(
                          noteLoc,
                          {
                            fret: Math.max(0, Math.min(24, Number(e.target.value))),
                            duration: note.trill!.duration,
                          },
                          note.trill,
                        ),
                      )
                    }
                    className="h-7 w-14 rounded-md border border-border bg-surface-1 px-2 text-xs outline-none focus:border-border-hover"
                    title="Trill target fret"
                  />
                  {TRILL_DURATIONS.map(({ value, label }) => (
                    <PillButton
                      key={value}
                      active={note.trill?.duration === value}
                      onClick={() =>
                        applyCommand(
                          new SetTrill(
                            noteLoc,
                            { fret: note.trill!.fret, duration: value },
                            note.trill,
                          ),
                        )
                      }
                    >
                      {label}
                    </PillButton>
                  ))}
                </>
              )}
              {note.trill === undefined && (
                <PillButton
                  onClick={() =>
                    applyCommand(
                      new SetTrill(noteLoc, { fret: note.fret + 2, duration: 16 }, undefined),
                    )
                  }
                >
                  enable
                </PillButton>
              )}
            </Row>

            {/* Bend editor */}
            <Section title="Bend" defaultOpen={false}>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {getPresetsForKind('bend').map(({ key, label, points }) => (
                    <PillButton
                      key={key}
                      onClick={() => handleBendChange(points)}
                      title={`Apply ${label} bend preset`}
                    >
                      {label}
                    </PillButton>
                  ))}
                  <PillButton
                    disabled={!note.bend || note.bend.length === 0}
                    onClick={() => handleBendChange([])}
                  >
                    Clear
                  </PillButton>
                </div>
                <BendCurveEditor
                  kind="bend"
                  points={note.bend ?? []}
                  onChange={handleBendChange}
                />
              </div>
            </Section>
          </Section>
        )}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Bar properties subcomponent
// ---------------------------------------------------------------------------

function BarProperties({
  resolved,
  applyCommand,
}: {
  resolved: ResolvedBarContext
  applyCommand: ReturnType<typeof useTabEditorStore.getState>['applyCommand']
}) {
  const { bar, trackId, barId } = resolved

  const patchRepeat = (patch: Partial<NonNullable<BarNode['repeat']>>) => {
    const current = bar.repeat ?? {}
    const next = { ...current, ...patch }
    const cleaned =
      !next.start && !next.end && !next.count ? undefined : next
    applyCommand(new SetRepeat(trackId, barId, cleaned, bar.repeat))
  }

  return (
    <>
      {/* Repeat */}
      <Section title="Repeat">
        <Row label="Start">
          <PillButton
            active={bar.repeat?.start === true}
            onClick={() => patchRepeat({ start: !bar.repeat?.start })}
            title="Repeat start barline |:"
          >
            |:
          </PillButton>
        </Row>
        <Row label="End">
          <PillButton
            active={bar.repeat?.end === true}
            onClick={() => patchRepeat({ end: !bar.repeat?.end })}
            title="Repeat end barline :|"
          >
            :|
          </PillButton>
        </Row>
        {bar.repeat?.end && (
          <Row label="Count">
            <input
              type="number"
              min={2}
              max={16}
              value={bar.repeat?.count ?? 2}
              onChange={(e) =>
                patchRepeat({ count: Math.max(2, Math.min(16, Number(e.target.value))) })
              }
              className="h-7 w-16 rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
            />
          </Row>
        )}
      </Section>

      {/* Jump (D.C. / D.S. / Coda / etc.) */}
      <Section title="Jump" defaultOpen={false}>
        <Row label="Marker">
          <select
            value={bar.jump ?? ''}
            onChange={(e) => {
              const v = e.target.value as JumpType | ''
              applyCommand(new SetJump(trackId, barId, v === '' ? undefined : v, bar.jump))
            }}
            className="h-7 w-full rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
          >
            <option value="">— none —</option>
            {JUMP_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      {/* Alternate ending */}
      <Section title="Alternate ending" defaultOpen={false}>
        <Row label="Numbers">
          <input
            type="text"
            defaultValue={(bar.alternateEnding ?? []).join(', ')}
            placeholder="e.g. 1, 2"
            onBlur={(e) => {
              const parsed = e.target.value
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => Number(s))
                .filter((n) => Number.isFinite(n) && n >= 1 && n <= 8)
              const next = parsed.length > 0 ? parsed : undefined
              if (JSON.stringify(next) !== JSON.stringify(bar.alternateEnding)) {
                applyCommand(new SetAlternateEnding(trackId, barId, next, bar.alternateEnding))
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className="h-7 w-full rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
          />
        </Row>
      </Section>

      {/* Section */}
      <Section title="Section marker" defaultOpen={false}>
        <Row label="Label">
          <input
            type="text"
            defaultValue={bar.section ?? ''}
            placeholder="e.g. Chorus"
            onBlur={(e) => {
              const next = e.target.value.trim() || undefined
              if (next !== bar.section) {
                applyCommand(
                  new SetSection(trackId, barId, next, bar.sectionMarker, bar.section, bar.sectionMarker),
                )
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className="h-7 w-full rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
          />
        </Row>
        <Row label="Marker">
          <input
            type="text"
            defaultValue={bar.sectionMarker ?? ''}
            placeholder="e.g. A"
            onBlur={(e) => {
              const next = e.target.value.trim() || undefined
              if (next !== bar.sectionMarker) {
                applyCommand(
                  new SetSection(trackId, barId, bar.section, next, bar.section, bar.sectionMarker),
                )
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className="h-7 w-full rounded-md border border-border bg-surface-1 px-2 text-xs text-text-primary outline-none focus:border-border-hover"
          />
        </Row>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Hash a short string (e.g. nanoid) into a small positive integer id that the
 * SetSlur command accepts. AlphaTex slur ids are numeric — we just need
 * uniqueness within the score, not a wide keyspace.
 */
function hashStringToNumber(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return (h % 900000) + 100000 // 6-digit positive int
}
