import { useMemo, useRef, useState, useLayoutEffect } from 'react'
import { cn } from '@/components/ui/utils'
import { useLeadSheetStore } from '@/stores/leadSheetStore'
import { useAudioStore } from '@/stores/audioStore'

// ── Types ──────────────────────────────────────────────────────────────
interface ChordEntry {
  chord: string
  sectionLabel: string
  sectionType: string
  barIndex: number
  totalBars: number
  globalIndex: number
  lyrics?: string
}

// ── Demo data — Figma: Dm → Em → Am → D → Dm ─────────────────────────
const DEMO_CHORDS: ChordEntry[] = [
  { chord: 'Dm', sectionLabel: 'Intro', sectionType: 'intro', barIndex: 0, totalBars: 4, globalIndex: 0 },
  { chord: 'Em', sectionLabel: 'Intro', sectionType: 'intro', barIndex: 1, totalBars: 4, globalIndex: 1 },
  { chord: 'Am', sectionLabel: 'Intro', sectionType: 'intro', barIndex: 2, totalBars: 4, globalIndex: 2, lyrics: "Gravity\u2019s holdin\u2019 me back" },
  { chord: 'D',  sectionLabel: 'Intro', sectionType: 'intro', barIndex: 3, totalBars: 4, globalIndex: 3 },
  { chord: 'Dm', sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 0, totalBars: 8, globalIndex: 4 },
  { chord: 'C',  sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 1, totalBars: 8, globalIndex: 5 },
  { chord: 'G',  sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 2, totalBars: 8, globalIndex: 6 },
  { chord: 'Em', sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 3, totalBars: 8, globalIndex: 7 },
  { chord: 'Am', sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 4, totalBars: 8, globalIndex: 8 },
  { chord: 'F',  sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 5, totalBars: 8, globalIndex: 9 },
  { chord: 'C',  sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 6, totalBars: 8, globalIndex: 10 },
  { chord: 'G',  sectionLabel: 'Verse 1', sectionType: 'verse', barIndex: 7, totalBars: 8, globalIndex: 11 },
]

function useChordSequence(): { chords: ChordEntry[]; isDemo: boolean } {
  const sections = useLeadSheetStore((s) => s.sections)
  return useMemo(() => {
    const entries: ChordEntry[] = []
    let globalIndex = 0
    let hasRealChords = false
    for (const section of sections) {
      for (let i = 0; i < section.measures.length; i++) {
        const m = section.measures[i]
        const chord = m.chords[0] || ''
        if (chord) hasRealChords = true
        entries.push({
          chord: chord || '—',
          sectionLabel: section.label,
          sectionType: section.type,
          barIndex: i,
          totalBars: section.measures.length,
          globalIndex,
        })
        globalIndex++
      }
    }
    if (!hasRealChords) return { chords: DEMO_CHORDS, isDemo: true }
    return { chords: entries, isDemo: false }
  }, [sections])
}

// ── Section pill colors ────────────────────────────────────────────────
const SECTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  intro:  { bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    text: 'text-blue-400' },
  verse:  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  chorus: { bg: 'bg-purple-500/15',  border: 'border-purple-500/30',  text: 'text-purple-400' },
  bridge: { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400' },
  outro:  { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-400' },
  custom: { bg: 'bg-surface-3/50',   border: 'border-border',         text: 'text-text-secondary' },
}

/*
 * ─── Figma pixel-perfect layout (node 8:2) ────────────────────────────
 *
 * The inner container renders at the EXACT Figma frame dimensions
 * (1230 × 340 px), with all elements at their Figma pixel positions.
 * CSS `transform: scale()` shrinks the whole thing to fit the
 * available container width — every proportion matches 1:1.
 *
 * Figma positions (y offset by -85 so Am starts at y=0):
 *   Panel:   left=65   top=37   w=1100  h=235  rounded-24
 *   Am:      left=415  top=0    256px bold
 *   Em:      left=263  top=159  64px  #7d7d7d
 *   D:       left=896  top=159  64px  #7d7d7d
 *   Dm(L):   left=101  top=183  36px  #b4b4b4
 *   Dm(R):   left=1067 top=183  36px  #b4b4b4
 *   Lyrics:  left=480  top=307  24px
 */

// Figma inner canvas dimensions
const FIGMA_W = 1230
const FIGMA_H = 340 // from Am top (y=85) to lyrics bottom (y=417) ≈ 340px

// ── FollowView ─────────────────────────────────────────────────────────
interface FollowViewProps {
  className?: string
}

export function FollowView({ className }: FollowViewProps) {
  const currentBar = useAudioStore((s) => s.currentBar)
  const { chords, isDemo } = useChordSequence()

  const effectiveBar = isDemo ? 2 : currentBar
  const currentIndex = Math.max(0, Math.min(effectiveBar, chords.length - 1))
  const current = chords[currentIndex]

  const prev2 = chords[currentIndex - 2]
  const prev1 = chords[currentIndex - 1]
  const next1 = chords[currentIndex + 1]
  const next2 = chords[currentIndex + 2]

  // Measure container width to compute scale
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.512)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      setScale(w / FIGMA_W)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!current) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <p className="text-sm text-text-muted">No chords to follow. Add chords in Lead Sheet mode.</p>
      </div>
    )
  }

  const sectionColor = SECTION_COLORS[current.sectionType] ?? SECTION_COLORS.custom

  return (
    <div className={cn('flex-1 overflow-hidden relative flex flex-col items-center', className)}>
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      {/* Section pill */}
      <div className="relative z-10 mt-5 mb-2">
        <div
          className={cn(
            'flex items-center gap-1.5 px-[9px] py-px rounded-full border text-[12px] font-medium',
            sectionColor.bg,
            sectionColor.border,
            sectionColor.text,
          )}
        >
          <span>{current.sectionLabel}</span>
          <span>{current.totalBars} bars</span>
        </div>
      </div>

      {/*
       * Scaled Figma canvas — renders at 1230×340 with exact Figma
       * pixel values, then `transform: scale()` fits it to the
       * container width. All proportions are 1:1 with Figma.
       */}
      <div
        ref={containerRef}
        className="relative z-10 flex-1 w-full overflow-hidden flex items-center justify-center"
      >
        <div
          className="relative shrink-0"
          style={{
            width: FIGMA_W,
            height: FIGMA_H,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Panel — Figma: x=65, y=122→37, w=1100, h=235, rounded-24 */}
          <div
            className="absolute bg-surface-3 rounded-[24px]"
            style={{ left: 65, top: 37, width: 1100, height: 235 }}
          />

          {/*
           * Chord text — Figma vector node 5:1180
           * Position: x=104, y=147 in frame → y=62 in canvas (offset -85)
           * Size: 1018 × 186 px
           *
           * Demo mode: use exact Figma vector asset for pixel-perfect rendering.
           * Live mode: render chord text dynamically.
           */}
          {isDemo ? (
            <img
              className="absolute z-10 select-none"
              style={{ left: 104, top: 62, width: 1018, height: 186 }}
              src="https://www.figma.com/api/mcp/asset/12b2473c-da1f-4c79-b759-4892161707b4"
              alt="Dm Em Am D Dm"
              draggable={false}
            />
          ) : (
            <>
              {/* Am — 256px bold */}
              <p
                className="absolute z-10 font-bold text-text-primary select-none whitespace-nowrap"
                style={{ left: 415, top: 0, fontSize: 256, lineHeight: 0.82 }}
              >
                {current.chord}
              </p>

              {/* prev1 — 64px #7d7d7d */}
              {prev1 && prev1.chord !== '—' && (
                <p
                  className="absolute z-10 font-normal select-none whitespace-nowrap"
                  style={{ left: 263, top: 159, fontSize: 64, lineHeight: 0.82, color: '#7d7d7d' }}
                >
                  {prev1.chord}
                </p>
              )}

              {/* next1 — 64px #7d7d7d */}
              {next1 && next1.chord !== '—' && (
                <p
                  className="absolute z-10 font-normal select-none whitespace-nowrap"
                  style={{ left: 896, top: 159, fontSize: 64, lineHeight: 0.82, color: '#7d7d7d' }}
                >
                  {next1.chord}
                </p>
              )}

              {/* prev2 — 36px #b4b4b4 */}
              {prev2 && prev2.chord !== '—' && (
                <p
                  className="absolute z-10 font-normal select-none whitespace-nowrap"
                  style={{ left: 101, top: 183, fontSize: 36, lineHeight: 0.82, color: '#b4b4b4' }}
                >
                  {prev2.chord}
                </p>
              )}

              {/* next2 — 36px #b4b4b4 */}
              {next2 && next2.chord !== '—' && (
                <p
                  className="absolute z-10 font-normal select-none whitespace-nowrap"
                  style={{ left: 1067, top: 183, fontSize: 36, lineHeight: 0.82, color: '#b4b4b4' }}
                >
                  {next2.chord}
                </p>
              )}
            </>
          )}

          {/* Lyrics — Figma: x=480, y=392→307, 24px */}
          {current.lyrics && (
            <p
              className="absolute z-10 font-normal text-text-primary whitespace-nowrap"
              style={{ left: 480, top: 307, fontSize: 24 }}
            >
              {current.lyrics}
            </p>
          )}
        </div>
      </div>

      {/* Bar progress */}
      <div className="relative z-10 mb-3 flex items-center gap-1.5">
        {Array.from({ length: current.totalBars }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              i === current.barIndex
                ? 'w-6 bg-text-primary'
                : i < current.barIndex
                  ? 'w-3 bg-text-muted'
                  : 'w-3 bg-surface-3',
            )}
          />
        ))}
      </div>
    </div>
  )
}
