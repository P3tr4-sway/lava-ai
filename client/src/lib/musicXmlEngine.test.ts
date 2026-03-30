import { describe, it, expect } from 'vitest'
import {
  parseXml,
  serializeXml,
  getMeasures,
  addBars,
  deleteBars,
  clearBars,
  setChord,
  setKeySig,
  setTimeSig,
  setNotePitch,
  setNoteDuration,
  addAccidental,
  toggleTie,
  toggleRest,
  transposeBars,
  copyBars,
  pasteBars,
  duplicateBars,
  setLyric,
  setAnnotation,
  buildNoteOnsetMap,
  buildScoreSummary,
} from './musicXmlEngine'

const SIMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

describe('parseXml / serializeXml', () => {
  it('round-trips without data loss', () => {
    const doc = parseXml(SIMPLE_XML)
    const result = serializeXml(doc)
    const doc2 = parseXml(result)
    expect(getMeasures(doc2).length).toBe(3)
  })
})

describe('getMeasures', () => {
  it('returns all measures', () => {
    const doc = parseXml(SIMPLE_XML)
    expect(getMeasures(doc).length).toBe(3)
  })
})

describe('addBars', () => {
  it('adds 2 empty bars after bar 1', () => {
    const result = addBars(SIMPLE_XML, 0, 2)
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(5)
  })

  it('new bars contain whole rests', () => {
    const result = addBars(SIMPLE_XML, 0, 1)
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    const newMeasure = measures[1] // inserted after index 0
    const rest = newMeasure.querySelector('rest')
    expect(rest).not.toBeNull()
  })

  it('renumbers measures sequentially', () => {
    const result = addBars(SIMPLE_XML, 0, 1)
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    measures.forEach((m, i) => {
      expect(m.getAttribute('number')).toBe(String(i + 1))
    })
  })

  it('adds 2 bars in forward order (first bar is immediately after reference)', () => {
    const result = addBars(SIMPLE_XML, 0, 2)
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    // bar 0 stays, then 2 new rest bars, then original bars 1 and 2
    expect(measures.length).toBe(5)
    // measures[1] and [2] should both be whole rests
    expect(measures[1].querySelector('rest')).not.toBeNull()
    expect(measures[2].querySelector('rest')).not.toBeNull()
    // measures[3] should be the original bar 2 (G whole note)
    expect(measures[3].querySelector('pitch > step')?.textContent).toBe('G')
  })

  it('throws RangeError for out-of-range afterIndex', () => {
    expect(() => addBars(SIMPLE_XML, 10, 1)).toThrow(RangeError)
    expect(() => addBars(SIMPLE_XML, -1, 1)).toThrow(RangeError)
  })
})

describe('deleteBars', () => {
  it('deletes bar at index 1', () => {
    const result = deleteBars(SIMPLE_XML, [1])
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(2)
  })

  it('renumbers remaining measures', () => {
    const result = deleteBars(SIMPLE_XML, [1])
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    measures.forEach((m, i) => {
      expect(m.getAttribute('number')).toBe(String(i + 1))
    })
  })

  it('deletes multiple non-contiguous bars', () => {
    const result = deleteBars(SIMPLE_XML, [0, 2])
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(1)
  })
})

describe('clearBars', () => {
  it('replaces content with whole rest but keeps the bar', () => {
    const result = clearBars(SIMPLE_XML, [0])
    const doc = parseXml(result)
    const measures = getMeasures(doc)
    expect(measures.length).toBe(3) // same count
    const notes = measures[0].querySelectorAll('note')
    expect(notes.length).toBe(1)
    expect(notes[0].querySelector('rest')).not.toBeNull()
  })
})

describe('setChord', () => {
  it('adds a harmony element to bar 0 beat 0', () => {
    const result = setChord(SIMPLE_XML, 0, 0, 'Am7')
    const doc = parseXml(result)
    const harmony = getMeasures(doc)[0].querySelector('harmony')
    expect(harmony).not.toBeNull()
    const root = harmony!.querySelector('root > root-step')
    expect(root!.textContent).toBe('A')
    const kind = harmony!.querySelector('kind')
    expect(kind!.textContent).toBe('minor-seventh')
  })

  it('replaces existing chord at same position', () => {
    const withChord = setChord(SIMPLE_XML, 0, 0, 'Am7')
    const result = setChord(withChord, 0, 0, 'G')
    const doc = parseXml(result)
    const harmonies = getMeasures(doc)[0].querySelectorAll('harmony')
    expect(harmonies.length).toBe(1)
    expect(harmonies[0].querySelector('root > root-step')!.textContent).toBe('G')
  })

  it('correctly parses B-flat chord (Bb)', () => {
    const result = setChord(SIMPLE_XML, 0, 0, 'Bb')
    const doc = parseXml(result)
    const harmony = getMeasures(doc)[0].querySelector('harmony')
    expect(harmony).not.toBeNull()
    expect(harmony!.querySelector('root > root-step')!.textContent).toBe('B')
    expect(harmony!.querySelector('root > root-alter')!.textContent).toBe('-1')
    expect(harmony!.querySelector('kind')!.textContent).toBe('major')
  })
})

describe('setKeySig', () => {
  it('changes key signature from bar onward', () => {
    const result = setKeySig(SIMPLE_XML, 0, 'G')
    const doc = parseXml(result)
    const fifths = getMeasures(doc)[0].querySelector('key > fifths')
    expect(fifths!.textContent).toBe('1') // G major = 1 sharp
  })
})

describe('setTimeSig', () => {
  it('changes time signature at specified bar', () => {
    const result = setTimeSig(SIMPLE_XML, 1, 3, 4)
    const doc = parseXml(result)
    const m = getMeasures(doc)[1]
    const beats = m.querySelector('time > beats')
    expect(beats!.textContent).toBe('3')
  })
})

describe('setNotePitch', () => {
  it('changes pitch of first note in bar 0', () => {
    const result = setNotePitch(SIMPLE_XML, 0, 0, { step: 'A', octave: 4, alter: 0 })
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('pitch > step')!.textContent).toBe('A')
    expect(note.querySelector('pitch > octave')!.textContent).toBe('4')
  })
})

describe('setNoteDuration', () => {
  it('changes duration type of a note', () => {
    const result = setNoteDuration(SIMPLE_XML, 0, 0, 'half', 2)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('type')!.textContent).toBe('half')
    expect(note.querySelector('duration')!.textContent).toBe('2')
  })
})

describe('addAccidental', () => {
  it('adds sharp accidental to a note', () => {
    const result = addAccidental(SIMPLE_XML, 0, 0, 'sharp')
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('accidental')!.textContent).toBe('sharp')
    expect(note.querySelector('pitch > alter')!.textContent).toBe('1')
  })
})

describe('toggleTie', () => {
  it('adds tie to a note that has none', () => {
    const result = toggleTie(SIMPLE_XML, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('tie')).not.toBeNull()
  })

  it('removes tie from a note that has one', () => {
    const withTie = toggleTie(SIMPLE_XML, 0, 0)
    const result = toggleTie(withTie, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('tie')).toBeNull()
  })
})

describe('toggleRest', () => {
  it('converts a note to rest of same duration', () => {
    const result = toggleRest(SIMPLE_XML, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('rest')).not.toBeNull()
    expect(note.querySelector('pitch')).toBeNull()
    expect(note.querySelector('type')!.textContent).toBe('quarter')
  })

  it('converts a rest back to a note (default C4)', () => {
    const withRest = toggleRest(SIMPLE_XML, 0, 0)
    const result = toggleRest(withRest, 0, 0)
    const doc = parseXml(result)
    const note = getMeasures(doc)[0].querySelectorAll('note')[0]
    expect(note.querySelector('pitch')).not.toBeNull()
    expect(note.querySelector('rest')).toBeNull()
  })
})

describe('transposeBars', () => {
  it('transposes all notes in bar up by 2 semitones', () => {
    const result = transposeBars(SIMPLE_XML, [0], 2)
    const doc = parseXml(result)
    const firstNote = getMeasures(doc)[0].querySelectorAll('note')[0]
    // C4 + 2 semitones = D4
    expect(firstNote.querySelector('pitch > step')!.textContent).toBe('D')
  })
})

describe('copyBars / pasteBars', () => {
  it('copies bar 0 and pastes after bar 2', () => {
    const fragment = copyBars(SIMPLE_XML, [0])
    const result = pasteBars(SIMPLE_XML, fragment, 2)
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(4)
  })
})

describe('duplicateBars', () => {
  it('duplicates bar 0 after itself', () => {
    const result = duplicateBars(SIMPLE_XML, [0], 0)
    const doc = parseXml(result)
    expect(getMeasures(doc).length).toBe(4)
    // Duplicated bar should have same notes
    const orig = getMeasures(parseXml(SIMPLE_XML))[0].querySelectorAll('note')
    const dup = getMeasures(doc)[1].querySelectorAll('note')
    expect(dup.length).toBe(orig.length)
  })
})

describe('setLyric', () => {
  it('adds lyric to a note', () => {
    const result = setLyric(SIMPLE_XML, 0, 0, 'hel-')
    const doc = parseXml(result)
    const lyric = getMeasures(doc)[0].querySelectorAll('note')[0].querySelector('lyric')
    expect(lyric).not.toBeNull()
    expect(lyric!.querySelector('text')!.textContent).toBe('hel')
  })
})

describe('setAnnotation', () => {
  it('adds direction text above bar', () => {
    const result = setAnnotation(SIMPLE_XML, 0, 'palm mute')
    const doc = parseXml(result)
    const direction = getMeasures(doc)[0].querySelector('direction')
    expect(direction).not.toBeNull()
    const words = direction!.querySelector('direction-type > words')
    expect(words!.textContent).toBe('palm mute')
  })
})

describe('buildNoteOnsetMap', () => {
  it('builds onset map for simple XML', () => {
    const map = buildNoteOnsetMap(SIMPLE_XML, 120)
    expect(map.length).toBeGreaterThan(0)
    expect(map[0]).toMatchObject({ barIndex: 0, noteIndex: 0 })
    expect(typeof map[0].onsetTime).toBe('number')
    expect(typeof map[0].duration).toBe('number')
    // At 120 BPM, quarter note = 0.5s. First note onset should be 0
    expect(map[0].onsetTime).toBe(0)
  })
})

describe('buildScoreSummary', () => {
  // Need to import it at the top of the file too
  const SUMMARY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>1</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction placement="above"><direction-type><rehearsal>Intro</rehearsal></direction-type></direction>
      <harmony><root><root-step>G</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <harmony><root><root-step>E</root-step></root><kind>minor</kind></harmony>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="3">
      <direction placement="above"><direction-type><rehearsal>Verse</rehearsal></direction-type></direction>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="4">
      <sound tempo="120"/>
      <harmony><root><root-step>D</root-step></root><kind>dominant</kind></harmony>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`

  it('extracts key, time sig, bar count, and chords', () => {
    const summary = buildScoreSummary(SUMMARY_XML)
    expect(summary).toContain('Key: G major')
    expect(summary).toContain('Time: 4/4')
    expect(summary).toContain('4 bars')
    expect(summary).toContain('Bar 1: G')
    expect(summary).toContain('Bar 2: Em')
    expect(summary).toContain('Bar 3: C')
    expect(summary).toContain('Bar 4: D7')
  })

  it('extracts tempo from <sound> element', () => {
    const summary = buildScoreSummary(SUMMARY_XML)
    expect(summary).toContain('Tempo: 120 BPM')
  })

  it('extracts section labels from rehearsal marks', () => {
    const summary = buildScoreSummary(SUMMARY_XML)
    expect(summary).toContain('Intro (1)')
    expect(summary).toContain('Verse (3)')
  })

  it('handles XML with no harmony elements', () => {
    const summary = buildScoreSummary(SIMPLE_XML)
    expect(summary).toContain('3 bars')
    expect(summary).not.toContain('Chords:')
  })

  it('handles XML with no key signature', () => {
    const noKeyXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><rest/><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`
    const summary = buildScoreSummary(noKeyXml)
    expect(summary).toContain('1 bars')
    expect(summary).not.toContain('Key:')
  })
})
