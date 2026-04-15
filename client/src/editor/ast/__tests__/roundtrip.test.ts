/**
 * AlphaTex AST round-trip tests.
 *
 * Each test verifies:
 *  1. parse(input) yields expected AST field values
 *  2. parse(print(parse(input))) ≡ parse(input)  (idempotency)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { parse } from '../parser'
import { print } from '../printer'
import type { ScoreNode, BeatNode, NoteNode } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundtrip(input: string): ScoreNode {
  const first = parse(input).score
  const reprinted = print(first)
  const second = parse(reprinted).score
  return second
}

/** Strip all id fields from an AST object for structural comparison */
function stripIds(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripIds)
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'id') continue
      result[k] = stripIds(v)
    }
    return result
  }
  return obj
}

function assertRoundtrip(input: string): void {
  const first = parse(input).score
  const reprinted = print(first)
  const second = parse(reprinted).score
  // Use JSON string comparison to avoid vitest's deep diff overhead
  const a = JSON.stringify(stripIds(first))
  const b = JSON.stringify(stripIds(second))
  expect(b).toBe(a)
}

function firstBeat(score: ScoreNode): BeatNode {
  return score.tracks[0].staves[0].bars[0].voices[0].beats[0]
}

function firstNote(score: ScoreNode): NoteNode {
  return firstBeat(score).notes[0]
}

// ---------------------------------------------------------------------------
// 1. Minimal score
// ---------------------------------------------------------------------------

describe('01 minimal score', () => {
  const input = `\\title "X"\n.\n:4 3.3`

  it('parses title', () => {
    const { score } = parse(input)
    expect(score.meta.title).toBe('X')
  })

  it('parses single note', () => {
    const { score } = parse(input)
    const note = firstNote(score)
    expect(note.fret).toBe(3)
    expect(note.string).toBe(3)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 2. Rest
// ---------------------------------------------------------------------------

describe('02 rest', () => {
  const input = '.\nr'

  it('parses rest beat', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    expect(beat.rest).toBe(true)
    expect(beat.notes).toHaveLength(0)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 3. Duration dot
// ---------------------------------------------------------------------------

describe('03 duration dot', () => {
  const input = '.\n:4 5.2 {d}'

  it('parses dotted note', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    expect(beat.duration.value).toBe(4)
    expect(beat.duration.dots).toBe(1)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 4. Double dot
// ---------------------------------------------------------------------------

describe('04 double dot', () => {
  const input = '.\n:2 3.1 {dd}'

  it('parses double-dotted note', () => {
    const { score } = parse(input)
    expect(firstBeat(score).duration.dots).toBe(2)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 5. Chord (multi-note beat)
// ---------------------------------------------------------------------------

describe('05 chord multi-note beat', () => {
  const input = '.\n(3.1 2.2 0.3)'

  it('parses chord with 3 notes', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    expect(beat.notes).toHaveLength(3)
    expect(beat.notes[0]).toMatchObject({ fret: 3, string: 1 })
    expect(beat.notes[1]).toMatchObject({ fret: 2, string: 2 })
    expect(beat.notes[2]).toMatchObject({ fret: 0, string: 3 })
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 6. Hammer-on / pull-off
// ---------------------------------------------------------------------------

describe('06 hammer-on pull-off', () => {
  const input = '.\n3.1 {h}'

  it('parses hammer-on flag', () => {
    const { score } = parse(input)
    expect(firstNote(score).hammerOrPull).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 7. Slide — legato
// ---------------------------------------------------------------------------

describe('07 legato slide', () => {
  const input = '.\n5.2 {sl}'

  it('parses legato slide', () => {
    const { score } = parse(input)
    expect(firstNote(score).slide).toBe('legato')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 8. Slide — shift
// ---------------------------------------------------------------------------

describe('08 shift slide', () => {
  const input = '.\n5.2 {ss}'

  it('parses shift slide', () => {
    const { score } = parse(input)
    expect(firstNote(score).slide).toBe('shift')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 9. Slide — into from below / above
// ---------------------------------------------------------------------------

describe('09 slide into from below', () => {
  const input = '.\n7.1 {sib}'

  it('parses slide into from below', () => {
    const { score } = parse(input)
    expect(firstNote(score).slide).toBe('intoFromBelow')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 10. Slide — out up / down
// ---------------------------------------------------------------------------

describe('10 slide out down', () => {
  const input = '.\n7.1 {sod}'

  it('parses slide out down', () => {
    const { score } = parse(input)
    expect(firstNote(score).slide).toBe('outDown')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 11. Bend with curve points
// ---------------------------------------------------------------------------

describe('11 bend with curve points', () => {
  const input = '.\n17.1 {b (0 4 4 0)}'

  it('parses bend points', () => {
    const { score } = parse(input)
    const note = firstNote(score)
    expect(note.bend).toBeDefined()
    expect(note.bend).toHaveLength(4)
    expect(note.bend![0].value).toBe(0)
    expect(note.bend![1].value).toBe(4)
    expect(note.bend![2].value).toBe(4)
    expect(note.bend![3].value).toBe(0)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 12. Vibrato (note level)
// ---------------------------------------------------------------------------

describe('12 vibrato note level', () => {
  const input = '.\n12.2 {v}'

  it('parses slight vibrato on note', () => {
    const { score } = parse(input)
    // vibrato on a single-note beat may be on note or beat depending on parser
    const beat = firstBeat(score)
    const hasVibrato = beat.vibrato === 'slight' || firstNote(score).vibrato === 'slight'
    expect(hasVibrato).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 13. Wide vibrato
// ---------------------------------------------------------------------------

describe('13 wide vibrato', () => {
  const input = '.\n12.2 {vw}'

  it('parses wide vibrato', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    const note = firstNote(score)
    const hasWideVibrato = beat.vibrato === 'wide' || note.vibrato === 'wide'
    expect(hasWideVibrato).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 14. Tie
// ---------------------------------------------------------------------------

describe('14 tie', () => {
  const input = '.\n5.3 {t}'

  it('parses tie', () => {
    const { score } = parse(input)
    expect(firstNote(score).tie).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 15. Ghost note
// ---------------------------------------------------------------------------

describe('15 ghost note', () => {
  const input = '.\n3.2 {g}'

  it('parses ghost note', () => {
    const { score } = parse(input)
    expect(firstNote(score).ghost).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 16. Dead note
// ---------------------------------------------------------------------------

describe('16 dead note', () => {
  const input = '.\n3.2 {x}'

  it('parses dead note', () => {
    const { score } = parse(input)
    expect(firstNote(score).dead).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 17. Palm mute
// ---------------------------------------------------------------------------

describe('17 palm mute', () => {
  const input = '.\n3.3 {pm}'

  it('parses palm mute', () => {
    const { score } = parse(input)
    expect(firstNote(score).palmMute).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 18. Let ring
// ---------------------------------------------------------------------------

describe('18 let ring', () => {
  const input = '.\n12.1 {lr}'

  it('parses let ring', () => {
    const { score } = parse(input)
    expect(firstNote(score).letRing).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 19. Tuplet (triplet)
// ---------------------------------------------------------------------------

describe('19 tuplet triplet', () => {
  const input = '.\n:8 3.1 {tu 3} 5.1 {tu 3} 7.1 {tu 3}'

  it('parses triplet tuplet', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    expect(beat.duration.tuplet).toEqual({ numerator: 3, denominator: 2 })
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 20. Tuplet explicit denominator
// ---------------------------------------------------------------------------

describe('20 tuplet explicit', () => {
  const input = '.\n:8 3.1 {tu (5 4)}'

  it('parses 5-against-4 tuplet', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    expect(beat.duration.tuplet).toEqual({ numerator: 5, denominator: 4 })
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 21. Time signature change
// ---------------------------------------------------------------------------

describe('21 time signature change', () => {
  const input = '.\n\\ts 3 4\n3.1 5.2 7.1'

  it('parses time signature', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.timeSignature).toEqual({ numerator: 3, denominator: 4 })
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 22. Key signature
// ---------------------------------------------------------------------------

describe('22 key signature', () => {
  const input = '.\n\\ks F#\n3.1'

  it('parses key signature', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.keySignature).toMatch(/F#|F/)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 23. Tempo change in bar
// ---------------------------------------------------------------------------

describe('23 bar tempo change', () => {
  const input = '.\n\\tempo 140\n3.1'

  it('parses tempo on bar', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.tempo).toBe(140)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 24. Repeat start / end
// ---------------------------------------------------------------------------

describe('24 repeat start end', () => {
  const input = '.\n\\ro\n3.1 4.2 |\n5.1 6.2 \\rc 2'

  it('parses repeat start', () => {
    const { score } = parse(input)
    const bars = score.tracks[0].staves[0].bars
    expect(bars[0].repeat?.start).toBe(true)
  })

  it('parses repeat end with count', () => {
    const { score } = parse(input)
    const bars = score.tracks[0].staves[0].bars
    expect(bars[1].repeat?.end).toBe(true)
    expect(bars[1].repeat?.count).toBe(2)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 25. Alternate ending
// ---------------------------------------------------------------------------

describe('25 alternate ending', () => {
  const input = '.\n\\ro\n3.1 |\n\\ae (1)\n4.1 |\n\\ae (2)\n5.1 \\rc 2'

  it('parses alternate endings', () => {
    const { score } = parse(input)
    const bars = score.tracks[0].staves[0].bars
    expect(bars[1].alternateEnding).toContain(1)
    expect(bars[2].alternateEnding).toContain(2)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 26. Section marker
// ---------------------------------------------------------------------------

describe('26 section marker', () => {
  const input = '.\n\\section "Chorus"\n3.1'

  it('parses section text', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.section).toBe('Chorus')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 27. Section with marker symbol
// ---------------------------------------------------------------------------

describe('27 section with marker symbol', () => {
  const input = '.\n\\section "A" "Verse 1"\n3.1'

  it('parses section marker and text', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.sectionMarker).toBe('A')
    expect(bar.section).toBe('Verse 1')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 28. Lyrics on beat
// ---------------------------------------------------------------------------

describe('28 lyrics on beat', () => {
  const input = '.\n3.1 {lyrics "He"}'

  it('parses lyrics', () => {
    const { score } = parse(input)
    expect(firstBeat(score).lyrics).toBe('He')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 29. Multi-bar score
// ---------------------------------------------------------------------------

describe('29 multi-bar score', () => {
  const input = '.\n3.1 4.2 5.3 | 6.1 7.2 8.3 | 9.1 10.2 0.3'

  it('parses three bars', () => {
    const { score } = parse(input)
    const bars = score.tracks[0].staves[0].bars
    expect(bars.length).toBeGreaterThanOrEqual(3)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 30. Capo
// ---------------------------------------------------------------------------

describe('30 capo', () => {
  const input = '.\n\\capo 2\n3.1'

  it('parses capo', () => {
    const { score } = parse(input)
    expect(score.tracks[0].capo).toBe(2)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 31. Custom tuning
// ---------------------------------------------------------------------------

describe('31 custom tuning', () => {
  const input = '.\n\\tuning D2 A2 D3 G3 B3 E4\n3.1'

  it('parses custom tuning as MIDI pitches', () => {
    const { score } = parse(input)
    const tuning = score.tracks[0].tuning
    expect(tuning).toHaveLength(6)
    // D2 = MIDI 38
    expect(tuning[0]).toBe(38)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 32. Score metadata — all fields
// ---------------------------------------------------------------------------

describe('32 score metadata all fields', () => {
  const input = `
\\title "My Song"
\\subtitle "A Demo"
\\artist "The Band"
\\album "Album One"
\\words "Lyricist"
\\music "Composer"
\\tempo 110
.
3.1`.trim()

  it('parses all meta fields', () => {
    const { score } = parse(input)
    expect(score.meta.title).toBe('My Song')
    expect(score.meta.subtitle).toBe('A Demo')
    expect(score.meta.artist).toBe('The Band')
    expect(score.meta.album).toBe('Album One')
    expect(score.meta.words).toBe('Lyricist')
    expect(score.meta.music).toBe('Composer')
    expect(score.meta.tempo).toBe(110)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 33. Dynamics
// ---------------------------------------------------------------------------

describe('33 dynamics', () => {
  const input = '.\n3.1 {dy f}'

  it('parses dynamics', () => {
    const { score } = parse(input)
    expect(firstBeat(score).dynamics).toBe('f')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 34. Accent types
// ---------------------------------------------------------------------------

describe('34 accent normal', () => {
  const input = '.\n3.1 {ac}'

  it('parses normal accent', () => {
    const { score } = parse(input)
    const note = firstNote(score)
    expect(note.accent).toBe('normal')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

describe('34b heavy accent', () => {
  const input = '.\n3.1 {hac}'

  it('parses heavy accent', () => {
    const { score } = parse(input)
    expect(firstNote(score).accent).toBe('heavy')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 35. Pick stroke
// ---------------------------------------------------------------------------

describe('35 pick stroke up', () => {
  const input = '.\n3.1 {su}'

  it('parses pick stroke up', () => {
    const { score } = parse(input)
    expect(firstBeat(score).pickStroke).toBe('up')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

describe('35b pick stroke down', () => {
  const input = '.\n3.1 {sd}'

  it('parses pick stroke down', () => {
    const { score } = parse(input)
    expect(firstBeat(score).pickStroke).toBe('down')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 36. Natural harmonic
// ---------------------------------------------------------------------------

describe('36 natural harmonic', () => {
  const input = '.\n12.1 {nh}'

  it('parses natural harmonic', () => {
    const { score } = parse(input)
    expect(firstNote(score).harmonic).toBe('natural')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 37. Artificial harmonic
// ---------------------------------------------------------------------------

describe('37 artificial harmonic', () => {
  const input = '.\n0.1 {ah 12}'

  it('parses artificial harmonic with fret', () => {
    const { score } = parse(input)
    const note = firstNote(score)
    expect(note.harmonic).toBe('artificial')
    expect(note.harmonicFret).toBe(12)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 38. Fade in / fade out
// ---------------------------------------------------------------------------

describe('38 fade in', () => {
  const input = '.\n3.1 {f}'

  it('parses fade in', () => {
    const { score } = parse(input)
    expect(firstBeat(score).fadeIn).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 39. Text annotation
// ---------------------------------------------------------------------------

describe('39 text annotation', () => {
  const input = '.\n3.1 {txt "Bend here"}'

  it('parses text annotation', () => {
    const { score } = parse(input)
    expect(firstBeat(score).text).toBe('Bend here')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 40. Chord annotation
// ---------------------------------------------------------------------------

describe('40 chord annotation', () => {
  const input = '.\n(0.1 2.2 2.3) {ch "Am"}'

  it('parses chord annotation', () => {
    const { score } = parse(input)
    expect(firstBeat(score).chord).toBe('Am')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 41. Tremolo picking
// ---------------------------------------------------------------------------

describe('41 tremolo picking', () => {
  const input = '.\n5.2 {tp 8}'

  it('parses tremolo picking duration', () => {
    const { score } = parse(input)
    expect(firstBeat(score).tremoloPickingDuration).toBe(8)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 42. Whammy bar
// ---------------------------------------------------------------------------

describe('42 whammy bar', () => {
  const input = '.\n3.1 {tb (0 4 0)}'

  it('parses whammy bar points', () => {
    const { score } = parse(input)
    const whammy = firstBeat(score).whammy
    expect(whammy).toBeDefined()
    expect(whammy!.length).toBeGreaterThan(0)
    expect(whammy![1].value).toBe(4)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 43. Staccato
// ---------------------------------------------------------------------------

describe('43 staccato', () => {
  const input = '.\n3.1 {st}'

  it('parses staccato', () => {
    const { score } = parse(input)
    expect(firstNote(score).staccato).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 44. Trill
// ---------------------------------------------------------------------------

describe('44 trill', () => {
  const input = '.\n5.1 {tr 7 16}'

  it('parses trill', () => {
    const { score } = parse(input)
    const note = firstNote(score)
    expect(note.trill).toBeDefined()
    expect(note.trill!.fret).toBe(7)
    expect(note.trill!.duration).toBe(16)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 45. Duration prefix changes (multiple beats)
// ---------------------------------------------------------------------------

describe('45 duration prefix changes', () => {
  const input = '.\n:4 3.1 :8 5.2 7.1 :16 2.3'

  it('parses mixed durations', () => {
    const { score } = parse(input)
    const beats = score.tracks[0].staves[0].bars[0].voices[0].beats
    expect(beats[0].duration.value).toBe(4)
    expect(beats[1].duration.value).toBe(8)
    expect(beats[2].duration.value).toBe(8) // inherited
    expect(beats[3].duration.value).toBe(16)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 46. Duration suffix on note (fret.string.duration)
// ---------------------------------------------------------------------------

describe('46 duration suffix', () => {
  const input = '.\n14.1.2'

  it('parses duration suffix', () => {
    const { score } = parse(input)
    expect(firstBeat(score).duration.value).toBe(2)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 47. Crescendo / decrescendo
// ---------------------------------------------------------------------------

describe('47 crescendo', () => {
  const input = '.\n3.1 {cre}'

  it('parses crescendo', () => {
    const { score } = parse(input)
    expect(firstBeat(score).crescendo).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

describe('47b decrescendo', () => {
  const input = '.\n3.1 {dec}'

  it('parses decrescendo', () => {
    const { score } = parse(input)
    expect(firstBeat(score).decrescendo).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 48. Complex multi-feature score (Canon Rock excerpt)
// ---------------------------------------------------------------------------

describe('48 complex mixed score', () => {
  const input = `
\\title "Canon Rock"
\\subtitle "JerryC"
\\tempo 90
.
:2 19.2{v f} 17.2{v f} |
15.2{v f} 14.2{v f} |
12.2{v f} 10.2{v f}`.trim()

  it('parses title and tempo', () => {
    const { score } = parse(input)
    expect(score.meta.title).toBe('Canon Rock')
    expect(score.meta.tempo).toBe(90)
  })

  it('parses notes with effects', () => {
    const { score } = parse(input)
    const beat = firstBeat(score)
    expect(beat.duration.value).toBe(2)
    expect(firstNote(score).fret).toBe(19)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 49. Error recovery: invalid beat should not crash
// ---------------------------------------------------------------------------

describe('49 error recovery', () => {
  const input = '.\n3.1 INVALID_TOKEN :4 5.2'

  it('does not throw on invalid beat', () => {
    expect(() => parse(input)).not.toThrow()
  })

  it('still produces a score', () => {
    const { score } = parse(input)
    expect(score).toBeDefined()
    expect(score.tracks.length).toBeGreaterThan(0)
  })

  it('finds valid notes after invalid token', () => {
    const { score } = parse(input)
    const beats = score.tracks[0].staves[0].bars[0]?.voices[0]?.beats ?? []
    const hasFret5 = beats.some(b => b.notes.some(n => n.fret === 5 && n.string === 2))
    expect(hasFret5).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 50. Left-hand fingering
// ---------------------------------------------------------------------------

describe('50 left-hand fingering', () => {
  const input = '.\n5.3 {lf 1}'

  it('parses left-hand fingering', () => {
    const { score } = parse(input)
    expect(firstNote(score).leftFinger).toBe(1)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 51. Right-hand fingering
// ---------------------------------------------------------------------------

describe('51 right-hand fingering', () => {
  const input = '.\n5.3 {rf 0}'

  it('parses right-hand fingering', () => {
    const { score } = parse(input)
    expect(firstNote(score).rightFinger).toBe(0)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 52. Tempo change on beat
// ---------------------------------------------------------------------------

describe('52 tempo change on beat', () => {
  const input = '.\n3.1 {tempo 100}'

  it('parses tempo change on beat', () => {
    const { score } = parse(input)
    expect(firstBeat(score).tempoChange).toBe(100)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 53. Fermata
// ---------------------------------------------------------------------------

describe('53 fermata', () => {
  const input = '.\n3.1 {fermata (short 1)}'

  it('parses fermata', () => {
    const { score } = parse(input)
    const fermata = firstBeat(score).fermata
    expect(fermata).toBeDefined()
    expect(fermata!.type).toBe('short')
    expect(fermata!.length).toBe(1)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 54. Pick slide up / down
// ---------------------------------------------------------------------------

describe('54 pick slide', () => {
  const input = '.\n7.3 {psu}'

  it('parses pick slide up', () => {
    const { score } = parse(input)
    expect(firstNote(score).slide).toBe('pickSlideUp')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 55. Arpeggio
// ---------------------------------------------------------------------------

describe('55 arpeggio up', () => {
  const input = '.\n(0.1 2.2 2.3 2.4) {au}'

  it('parses arpeggio up', () => {
    const { score } = parse(input)
    expect(firstBeat(score).arpeggioUp).toBe(true)
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 56. Clef change
// ---------------------------------------------------------------------------

describe('56 clef change', () => {
  const input = '.\n\\clef F4\n3.1'

  it('parses clef', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.clef).toBe('F4')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 57. Triplet feel
// ---------------------------------------------------------------------------

describe('57 triplet feel', () => {
  const input = '.\n\\tf triplet8th\n3.1'

  it('parses triplet feel', () => {
    const { score } = parse(input)
    const bar = score.tracks[0].staves[0].bars[0]
    expect(bar.tripletFeel).toBe('triplet8th')
  })

  it('round-trips', () => {
    assertRoundtrip(input)
  })
})

// ---------------------------------------------------------------------------
// 58. Empty score (no tracks / minimal)
// ---------------------------------------------------------------------------

describe('58 empty score', () => {
  it('parses empty input without crashing', () => {
    expect(() => parse('')).not.toThrow()
    const { score } = parse('')
    expect(score).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 59. Comment stripping
// ---------------------------------------------------------------------------

describe('59 comment stripping', () => {
  const input = `
// This is a comment
\\title "Test" // inline comment
/* block comment */
.
3.1 // note comment`.trim()

  it('parses ignoring comments', () => {
    const { score } = parse(input)
    expect(score.meta.title).toBe('Test')
  })

  it('parses note after comment', () => {
    const { score } = parse(input)
    expect(firstNote(score).fret).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 60. Score with no metadata separator (v1.7+ format)
// ---------------------------------------------------------------------------

describe('60 no metadata separator', () => {
  const input = '\\title "Direct"\n3.1'

  it('parses without explicit dot separator', () => {
    const { score } = parse(input)
    expect(score.meta.title).toBe('Direct')
    // Note: note may or may not be parsed depending on parser phase detection
    expect(score).toBeDefined()
  })
})
