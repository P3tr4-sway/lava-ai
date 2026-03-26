import { useEffect, useRef } from 'react'
import { useAudioStore } from '@/stores'
import { useCoachStore } from '@/stores/coachStore'
import { useLeadSheetStore } from '@/stores/leadSheetStore'

interface SectionRange {
  label: string
  type: string
  barStart: number
  barEnd: number
  chords: string[]
}

export function useCoachSectionTracker(
  sendHiddenMessage: ((content: string) => Promise<void>) | null,
) {
  const currentBar = useAudioStore((s) => s.currentBar)
  const playbackState = useAudioStore((s) => s.playbackState)
  const sections = useLeadSheetStore((s) => s.sections)
  const coachingStyle = useCoachStore((s) => s.coachingStyle)
  const lastSectionRef = useRef<string | null>(null)

  const isPlaying = playbackState === 'playing'

  useEffect(() => {
    if (coachingStyle !== 'active' || !isPlaying || !sendHiddenMessage) return

    // Build section bar ranges
    const ranges: SectionRange[] = []
    let barOffset = 0
    for (const section of sections) {
      const chords = section.measures.flatMap((m) => m.chords)
      const uniqueChords = [...new Set(chords)].filter(Boolean)
      ranges.push({
        label: section.label,
        type: section.type,
        barStart: barOffset,
        barEnd: barOffset + section.measures.length - 1,
        chords: uniqueChords,
      })
      barOffset += section.measures.length
    }

    // Find current section
    const currentSection = ranges.find(
      (r) => currentBar >= r.barStart && currentBar <= r.barEnd,
    )
    if (!currentSection) return

    // Only fire on section change
    if (currentSection.label === lastSectionRef.current) return
    const previousLabel = lastSectionRef.current
    lastSectionRef.current = currentSection.label

    // Don't fire for the very first section on play start
    if (!previousLabel) return

    sendHiddenMessage(
      `[Section change: now entering "${currentSection.label}", chords: ${currentSection.chords.join(', ')}. Previous section: "${previousLabel}"]`,
    )
  }, [currentBar, isPlaying, sections, coachingStyle, sendHiddenMessage])

  // Reset tracking when playback stops
  useEffect(() => {
    if (!isPlaying) {
      lastSectionRef.current = null
    }
  }, [isPlaying])
}
