import { describe, it, expect } from 'vitest'
import {
  parseXml,
  serializeXml,
  getMeasures,
  addBars,
  deleteBars,
  clearBars,
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
