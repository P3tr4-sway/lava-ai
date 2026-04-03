import { describe, it, expect } from 'vitest'
import {
  parseXml,
  serializeXml,
  getMeasures,
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
