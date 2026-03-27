import {
  buildPlayableArrangements,
  type ArrangementId,
  type LeadSheetSection,
  type LeadSheetSectionType,
  type PlayableArrangement,
} from '@lava/shared'

export interface ChordChart {
  id: string
  title: string
  artist?: string
  style: string
  key: string
  tempo?: number
  timeSignature?: string
  tuning?: string
  pdfUrl?: string
  sections?: LeadSheetSection[]
  arrangements?: PlayableArrangement[]
  defaultArrangementId?: ArrangementId
}

let measureId = 0
function m(...chords: string[]) {
  return { id: `sm-${++measureId}`, chords }
}

let sectionId = 0
function sec(
  type: LeadSheetSectionType,
  label: string,
  measures: ReturnType<typeof m>[],
): LeadSheetSection {
  return { id: `ss-${++sectionId}`, label, type, measures }
}

function chartWithArrangements(chart: ChordChart & { sections: LeadSheetSection[]; tempo: number; timeSignature: string }): ChordChart {
  const { arrangements, defaultArrangementId } = buildPlayableArrangements({
    key: chart.key,
    tempo: chart.tempo,
    timeSignature: chart.timeSignature,
    sections: chart.sections,
  })

  return {
    ...chart,
    arrangements,
    defaultArrangementId,
  }
}

export const CHORD_CHARTS: ChordChart[] = [
  chartWithArrangements({
    id: '1',
    title: 'Autumn Leaves',
    style: 'Jazz Standard',
    key: 'Gm',
    tempo: 120,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'A Section', [m('Cm7'), m('F7'), m('Bbmaj7'), m('Ebmaj7'), m('Am7b5'), m('D7'), m('Gm'), m('Gm')]),
      sec('verse', 'A Section (repeat)', [m('Cm7'), m('F7'), m('Bbmaj7'), m('Ebmaj7'), m('Am7b5'), m('D7'), m('Gm'), m('Gm')]),
      sec('bridge', 'B Section', [m('Am7b5'), m('D7'), m('Gm'), m('Gm'), m('Cm7'), m('F7'), m('Bbmaj7'), m('Ebmaj7')]),
      sec('outro', 'Ending', [m('Am7b5'), m('D7'), m('Gm', 'C7'), m('Fm', 'Bb7'), m('Ebmaj7'), m('Am7b5', 'D7'), m('Gm'), m('Gm')]),
    ],
  }),
  chartWithArrangements({
    id: '2',
    title: '12 Bar Blues',
    style: 'Blues',
    key: 'A',
    tempo: 100,
    timeSignature: '4/4',
    sections: [
      sec('verse', '12 Bar Blues', [m('A7'), m('A7'), m('A7'), m('A7'), m('D7'), m('D7'), m('A7'), m('A7'), m('E7'), m('D7'), m('A7'), m('E7')]),
    ],
  }),
  chartWithArrangements({
    id: '3',
    title: 'ii-V-I Progressions',
    style: 'Jazz',
    key: 'C',
    tempo: 110,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'Major ii-V-I', [m('Dm7'), m('G7'), m('Cmaj7'), m('Cmaj7')]),
      sec('verse', 'Minor ii-V-i', [m('Dm7b5'), m('G7b9'), m('Cm'), m('Cm')]),
      sec('verse', 'All Keys', [m('Dm7'), m('G7'), m('Cmaj7'), m('Cmaj7'), m('Cm7'), m('F7'), m('Bbmaj7'), m('Bbmaj7')]),
    ],
  }),
  chartWithArrangements({
    id: '4',
    title: 'Canon in D',
    style: 'Classical',
    key: 'D',
    tempo: 72,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'Progression', [m('D'), m('A'), m('Bm'), m('F#m'), m('G'), m('D'), m('G'), m('A')]),
    ],
  }),
  chartWithArrangements({
    id: '5',
    title: 'Rhythm Changes',
    style: 'Jazz',
    key: 'Bb',
    tempo: 140,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'A Section', [m('Bbmaj7', 'G7'), m('Cm7', 'F7'), m('Dm7', 'G7'), m('Cm7', 'F7'), m('Fm7', 'Bb7'), m('Ebmaj7', 'Ab7'), m('Dm7', 'G7'), m('Cm7', 'F7')]),
      sec('bridge', 'B Section (Bridge)', [m('D7'), m('D7'), m('G7'), m('G7'), m('C7'), m('C7'), m('F7'), m('F7')]),
    ],
  }),
  chartWithArrangements({
    id: '6',
    title: 'Minor Swing',
    style: 'Gypsy Jazz',
    key: 'Am',
    tempo: 190,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'A Section', [m('Am6'), m('Am6'), m('Dm6'), m('Dm6'), m('E7'), m('E7'), m('Am6'), m('Am6')]),
      sec('bridge', 'B Section', [m('Dm6'), m('Dm6'), m('Am6'), m('Am6'), m('E7'), m('E7'), m('Am6'), m('Am6')]),
    ],
  }),
  chartWithArrangements({
    id: '7',
    title: 'Bossa Nova Basics',
    style: 'Bossa Nova',
    key: 'Dm',
    tempo: 130,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'Verse', [m('Dm7'), m('Dm7'), m('G7'), m('G7'), m('Cmaj7'), m('Cmaj7'), m('A7'), m('A7')]),
    ],
  }),
  chartWithArrangements({
    id: '8',
    title: 'Pop Punk Essentials',
    style: 'Pop Punk',
    key: 'G',
    tempo: 170,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'Verse', [m('G'), m('D'), m('Em'), m('C'), m('G'), m('D'), m('Em'), m('C')]),
      sec('chorus', 'Chorus', [m('C'), m('G'), m('D'), m('Em'), m('C'), m('G'), m('D'), m('D')]),
    ],
  }),
  chartWithArrangements({
    id: '9',
    title: 'Soul Progressions',
    style: 'Soul',
    key: 'F',
    tempo: 85,
    timeSignature: '4/4',
    sections: [
      sec('verse', 'Verse', [m('Fmaj7'), m('Em7', 'A7'), m('Dm7'), m('Gm7', 'C7'), m('Fmaj7'), m('Em7', 'A7'), m('Dm7'), m('Gm7', 'C7')]),
    ],
  }),
  {
    id: 'anjo-de-mim',
    title: 'Anjo De Mim',
    artist: 'O Rappa',
    style: 'Brazilian Rock',
    key: 'Em',
    tempo: 92,
    timeSignature: '4/4',
    tuning: 'Standard',
    pdfUrl: '/scores/anjo-de-mim.pdf',
  },
  chartWithArrangements({
    id: 'wonderwall',
    title: 'Wonderwall',
    artist: 'Oasis',
    style: 'Pop',
    key: 'G',
    tempo: 87,
    timeSignature: '4/4',
    sections: [
      sec('intro', 'Intro', [m('Em7'), m('G'), m('Dsus4'), m('A7sus4')]),
      sec('verse', 'Verse', [m('Em7'), m('G'), m('Dsus4'), m('A7sus4'), m('Em7'), m('G'), m('Dsus4'), m('A7sus4')]),
      sec('chorus', 'Chorus', [m('C'), m('D'), m('Em'), m('Em'), m('C'), m('D'), m('G'), m('G')]),
    ],
  }),
  chartWithArrangements({
    id: 'wish-you-were-here',
    title: 'Wish You Were Here',
    artist: 'Pink Floyd',
    style: 'Rock',
    key: 'G',
    tempo: 60,
    timeSignature: '4/4',
    sections: [
      sec('intro', 'Intro', [m('Em7'), m('G'), m('Em7'), m('G'), m('Em7'), m('A7sus4'), m('Em7'), m('A7sus4'), m('G'), m('G')]),
      sec('verse', 'Verse', [m('C'), m('D'), m('Am', 'G'), m('D', 'C'), m('Am'), m('G'), m('D'), m('D')]),
      sec('chorus', 'Chorus', [m('C'), m('D'), m('Am', 'G'), m('D', 'C'), m('Am'), m('G'), m('D'), m('D')]),
    ],
  }),
  chartWithArrangements({
    id: 'let-her-go',
    title: 'Let Her Go',
    artist: 'Passenger',
    style: 'Pop',
    key: 'C',
    tempo: 75,
    timeSignature: '4/4',
    sections: [
      sec('intro', 'Intro', [m('C'), m('D'), m('Em'), m('Em')]),
      sec('verse', 'Verse', [m('Em'), m('C'), m('D'), m('Bm'), m('Em'), m('C'), m('D'), m('D')]),
      sec('chorus', 'Chorus', [m('C'), m('D'), m('Em'), m('Em'), m('C'), m('D'), m('G'), m('G'), m('C'), m('D'), m('Em'), m('D'), m('C'), m('D'), m('Em'), m('Em')]),
    ],
  }),
  chartWithArrangements({
    id: 'hotel-california',
    title: 'Hotel California',
    artist: 'Eagles',
    style: 'Rock',
    key: 'Bm',
    tempo: 74,
    timeSignature: '4/4',
    sections: [
      sec('intro', 'Intro', [m('Bm'), m('F#7'), m('A'), m('E'), m('G'), m('D'), m('Em'), m('F#7')]),
      sec('verse', 'Verse', [m('Bm'), m('F#7'), m('A'), m('E'), m('G'), m('D'), m('Em'), m('F#7')]),
      sec('chorus', 'Chorus', [m('G'), m('D'), m('F#7'), m('Bm'), m('G'), m('D'), m('Em'), m('F#7')]),
    ],
  }),
]
