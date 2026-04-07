import { describe, expect, it } from 'vitest'
import { exportScoreDocumentToMusicXml, parseMusicXmlToScoreDocument } from './scoreDocument'
import { applyCommandToDocument } from '@/spaces/pack/editor-core/commandRouter'

const SIMPLE_GUITAR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Test Piece</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Guitar</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
        <staff-details>
          <staff-lines>6</staff-lines>
          <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
          <staff-tuning line="2"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="3"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="4"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
          <staff-tuning line="5"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
          <capo>2</capo>
        </staff-details>
      </attributes>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <voice>1</voice>
        <type>quarter</type>
      </note>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
    </measure>
  </part>
</score-partwise>`

describe('scoreDocument', () => {
  it('assigns guitar placement when xml note lacks explicit string/fret', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)

    expect(document.tracks[0]?.notes[0]?.placement).toBeTruthy()
    expect(document.tracks[0]?.capo).toBe(2)
    expect(document.measures[0]?.harmony[0]?.symbol).toBe('C')
  })

  it('round-trips tuning and capo through export/import', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)
    const exported = exportScoreDocumentToMusicXml(document)
    const reparsed = parseMusicXmlToScoreDocument(exported)

    expect(reparsed.tracks[0]?.capo).toBe(2)
    expect(reparsed.tracks[0]?.tuning).toEqual(document.tracks[0]?.tuning)
    expect(reparsed.measures).toHaveLength(document.measures.length)
  })

  it('updates pitch when string/fret changes', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)
    const noteId = document.tracks[0]?.notes[0]?.id
    if (!noteId) throw new Error('missing note id')

    const result = applyCommandToDocument(document, {
      type: 'setStringFret',
      trackId: document.tracks[0]!.id,
      noteId,
      string: 2,
      fret: 3,
    })

    expect(result.document.tracks[0]?.notes[0]?.placement).toMatchObject({ string: 2, fret: 3 })
    expect(result.document.tracks[0]?.notes[0]?.pitch).toMatchObject({ step: 'E', octave: 4 })
  })

  it('updates measure annotations through the score command model', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)

    const result = applyCommandToDocument(document, {
      type: 'setAnnotation',
      measureIndex: 0,
      text: 'palm mute',
    })

    expect(result.document.measures[0]?.annotations).toEqual(['palm mute'])
  })

  it('inserts notes and rests at the caret for direct tab entry', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)
    const trackId = document.tracks[0]!.id

    const withNote = applyCommandToDocument(document, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 1,
      string: 2,
      fret: 3,
      durationType: 'eighth',
    })

    const insertedNote = withNote.document.tracks[0]?.notes.find((note) => note.measureIndex === 0 && note.beat === 1)
    expect(insertedNote?.placement).toMatchObject({ string: 2, fret: 3 })
    expect(insertedNote?.durationType).toBe('eighth')

    const withRest = applyCommandToDocument(withNote.document, {
      type: 'insertRestAtCaret',
      trackId,
      measureIndex: 0,
      beat: 2,
      durationType: 'quarter',
    })

    const insertedRest = withRest.document.tracks[0]?.notes.find((note) => note.measureIndex === 0 && note.beat === 2)
    expect(insertedRest?.isRest).toBe(true)
    expect(insertedRest?.placement).toBeNull()
    expect(insertedRest?.pitch).toBeNull()
  })

  it('keeps multiple notes on the same beat when they are on different strings', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)
    const trackId = document.tracks[0]!.id

    const withFirstNote = applyCommandToDocument(document, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 1,
      string: 1,
      fret: 0,
      durationType: 'quarter',
    })

    const withChord = applyCommandToDocument(withFirstNote.document, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 0,
      beat: 1,
      string: 3,
      fret: 2,
      durationType: 'quarter',
    })

    const notesAtBeat = withChord.document.tracks[0]?.notes.filter(
      (note) => note.measureIndex === 0 && note.beat === 1,
    ) ?? []
    expect(notesAtBeat).toHaveLength(2)
    expect(notesAtBeat.map((note) => note.placement?.string)).toEqual([1, 3])
  })

  it('supports section labels and chord diagram placement on measures', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)
    const withBar = applyCommandToDocument(document, {
      type: 'addMeasureAfter',
      afterIndex: 0,
      count: 1,
    })

    const labeled = applyCommandToDocument(withBar.document, {
      type: 'setSectionLabel',
      startMeasureIndex: 0,
      endMeasureIndex: 1,
      label: 'Verse',
    })

    expect(labeled.document.measures[0]?.sectionLabel).toBe('Verse')
    expect(labeled.document.measures[1]?.sectionLabel).toBeUndefined()

    const placed = applyCommandToDocument(labeled.document, {
      type: 'setChordDiagramPlacement',
      measureIndex: 0,
      placement: 'top',
    })

    expect(placed.document.measures[0]?.chordDiagramPlacement).toBe('top')
  })

  it('adds measures before the selected bar and shifts downstream notes', () => {
    const document = parseMusicXmlToScoreDocument(SIMPLE_GUITAR_XML)
    const trackId = document.tracks[0]!.id
    const expanded = applyCommandToDocument(document, {
      type: 'addMeasureAfter',
      afterIndex: 0,
      count: 1,
    })
    const withNote = applyCommandToDocument(expanded.document, {
      type: 'insertNoteAtCaret',
      trackId,
      measureIndex: 1,
      beat: 0,
      string: 3,
      fret: 2,
      durationType: 'quarter',
    })

    const result = applyCommandToDocument(withNote.document, {
      type: 'addMeasureBefore',
      beforeIndex: 1,
      count: 1,
    })

    expect(result.document.measures).toHaveLength(3)
    const shiftedNote = result.document.tracks[0]?.notes.find((note) => note.measureIndex === 2 && note.beat === 0)
    expect(shiftedNote).toBeTruthy()
  })
})
