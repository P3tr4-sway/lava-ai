export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = '#' | 'b' | 'n' | ''
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'
export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'

export interface TimeSignature {
  numerator: number
  denominator: number
}

export interface KeySignature {
  key: string
  mode: 'major' | 'minor'
}

export interface Note {
  id: string
  pitch: NoteName
  octave: number
  accidental: Accidental
  duration: NoteValue
  dots: number
  startBeat: number
  tied?: boolean
}

export interface Measure {
  id: string
  index: number
  timeSignature?: TimeSignature
  keySignature?: KeySignature
  notes: Note[]
  tempo?: number
}

export interface Part {
  id: string
  name: string
  instrument: string
  clef: Clef
  measures: Measure[]
}

export interface Score {
  id: string
  title: string
  composer?: string
  tempo: number
  timeSignature: TimeSignature
  keySignature: KeySignature
  parts: Part[]
  createdAt: number
}

export type LeadSheetSectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom'

export interface LeadSheetMeasure {
  id: string
  chords: string[]
  barline?: 'single' | 'double' | 'repeat-start' | 'repeat-end'
}

export interface LeadSheetSection {
  id: string
  label: string
  type: LeadSheetSectionType
  measures: LeadSheetMeasure[]
}

export type ArrangementId =
  | 'original'
  | 'simplified'
  | 'sing_play'
  | 'solo_focus'
  | 'low_position'
  | 'capo'

export type ArrangementDifficulty = 'Easy' | 'Medium' | 'Hard'

export interface PlayableArrangement {
  id: ArrangementId
  label: string
  subtitle: string
  difficulty: ArrangementDifficulty
  bestFor: string
  concertKey: string
  displayKey: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  capoFret?: number
  fretRange?: string
  changeSummary: string[]
  focusBars?: string[]
  recommended?: boolean
  recommendedReason?: string
  format: 'lead_sheet'
}

export interface AnalysisScore {
  key: string
  tempo: number
  timeSignature: string
  sections: LeadSheetSection[]
  duration: number
  title?: string
  videoId?: string
  arrangements?: PlayableArrangement[]
  defaultArrangementId?: ArrangementId
}

export const ARRANGEMENT_ORDER: ArrangementId[] = [
  'original',
  'simplified',
  'sing_play',
  'solo_focus',
  'low_position',
  'capo',
]

export const ARRANGEMENT_COPY: Record<
ArrangementId,
{
  label: string
  subtitle: string
  difficulty: ArrangementDifficulty
  bestFor: string
}
> = {
  original: {
    label: 'Original',
    subtitle: 'Closest to the song.',
    difficulty: 'Hard',
    bestFor: 'Full song',
  },
  simplified: {
    label: 'Simplified',
    subtitle: 'Fewer hard changes.',
    difficulty: 'Easy',
    bestFor: 'Easy start',
  },
  sing_play: {
    label: 'Sing & Play',
    subtitle: 'Built for vocals and rhythm.',
    difficulty: 'Easy',
    bestFor: 'Vocals',
  },
  solo_focus: {
    label: 'Solo Focus',
    subtitle: 'Main hooks first.',
    difficulty: 'Medium',
    bestFor: 'Hooks',
  },
  low_position: {
    label: 'Low Position',
    subtitle: 'Lower frets only.',
    difficulty: 'Medium',
    bestFor: 'Lower frets',
  },
  capo: {
    label: 'Capo',
    subtitle: 'Easier shapes, same feel.',
    difficulty: 'Easy',
    bestFor: 'Easy shapes',
  },
}
