export type PracticeAssistMode = 'review'
export type PracticeAssistStatus = 'idle' | 'permission' | 'arming' | 'listening' | 'summary'

export interface PracticeAssistSummary {
  timing: string
  chords: string
  next: string
}

export interface PracticeAssistMeasureInput {
  chords: string[]
}

export interface PracticeAssistSectionInput {
  label: string
  type: string
  measures: PracticeAssistMeasureInput[]
}

export function buildPracticeSummary(
  sections: PracticeAssistSectionInput[],
): PracticeAssistSummary {
  const uniqueChords = new Set(
    sections.flatMap((section) =>
      section.measures.flatMap((measure) => measure.chords.filter(Boolean)),
    ),
  )

  const hasBridge = sections.some((section) => section.type === 'bridge')
  const hasChorus = sections.some((section) => section.type === 'chorus')
  const sectionCount = sections.length
  const chordCount = uniqueChords.size

  let timing = 'Mostly steady. Keep the groove even.'
  let chords = 'Changes were clear. Keep them relaxed.'
  let next = 'Run one more pass at the same tempo.'

  if (hasChorus) {
    timing = 'Mostly steady. Chorus rushed a bit.'
    next = 'Run the chorus once more at a slower tempo.'
  } else if (sectionCount >= 5) {
    timing = 'Timing held up well. Watch the section moves.'
    next = 'Play the full form once and keep the transitions clean.'
  }

  if (hasBridge) {
    chords = 'Changes were clear. Watch the bridge move.'
  } else if (chordCount >= 7) {
    chords = 'Chord changes were solid. Keep the tighter turns ready.'
  }

  return { timing, chords, next }
}

export function getPracticeStatusText(
  mode: PracticeAssistMode | null,
  status: PracticeAssistStatus,
): string | null {
  if (status === 'permission') return 'Mic access needed'
  if (status === 'arming') return 'Getting ready...'
  if (status === 'summary') return 'Session summary ready'
  if (status !== 'listening' || !mode) return null
  return 'Review in progress'
}
