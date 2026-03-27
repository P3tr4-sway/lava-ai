import { create } from 'zustand'
import type { AgentMessage } from '@lava/shared'
import { Recorder } from '@/audio/Recorder'
import {
  type PracticeAssistMode,
  type PracticeAssistStatus,
  type PracticeAssistSummary,
} from '@/utils/practiceAssist'
import { useAgentStore } from './agentStore'

const recorder = new Recorder()
let armingTimer: ReturnType<typeof setTimeout> | null = null

function clearArmingTimer() {
  if (!armingTimer) return
  clearTimeout(armingTimer)
  armingTimer = null
}

function addLocalAssistantMessage(
  content: string,
  subtype: AgentMessage['subtype'],
) {
  useAgentStore.getState().addMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    createdAt: Date.now(),
    subtype,
    localOnly: true,
  })
}

interface PracticeAssistState {
  mode: PracticeAssistMode | null
  status: PracticeAssistStatus
  songId: string | null
  summary: PracticeAssistSummary | null

  startReview: (songId: string) => Promise<void>
  retryPermission: () => Promise<void>
  endReview: (summary: PracticeAssistSummary) => void
  clearReview: () => void
  reset: (songId?: string | null) => void
}

async function requestModeStart(mode: PracticeAssistMode, songId: string) {
  const permission = await recorder.requestPermission()
  if (permission !== 'granted') {
    usePracticeAssistStore.setState({
      mode,
      status: 'permission',
      songId,
      summary: null,
    })
    addLocalAssistantMessage('Mic access needed', 'practiceStatus')
    return
  }

  usePracticeAssistStore.setState({
    mode,
    status: 'arming',
    songId,
    summary: null,
  })
  addLocalAssistantMessage('Getting ready...', 'practiceStatus')

  clearArmingTimer()
  armingTimer = setTimeout(() => {
    usePracticeAssistStore.setState({ status: 'listening' })
    addLocalAssistantMessage('Review in progress', 'practiceStatus')
  }, 700)
}

export const usePracticeAssistStore = create<PracticeAssistState>((set, get) => ({
  mode: null,
  status: 'idle',
  songId: null,
  summary: null,

  startReview: async (songId) => {
    await requestModeStart('review', songId)
  },

  retryPermission: async () => {
    const { mode, songId } = get()
    if (!mode || !songId) return
    await requestModeStart(mode, songId)
  },

  endReview: (summary) => {
    clearArmingTimer()
    recorder.stopStream()
    set({
      status: 'summary',
      summary,
    })
    addLocalAssistantMessage(
      `Session summary\n\nTiming: ${summary.timing}\n\nChords: ${summary.chords}\n\nNext: ${summary.next}`,
      'practiceSummary',
    )
  },

  clearReview: () => {
    clearArmingTimer()
    recorder.stopStream()
    set({
      mode: null,
      status: 'idle',
      summary: null,
    })
  },

  reset: (songId) => {
    const currentSongId = get().songId
    if (songId && currentSongId && currentSongId === songId) return
    clearArmingTimer()
    recorder.stopStream()
    set({
      mode: null,
      status: 'idle',
      songId: songId ?? null,
      summary: null,
    })
  },
}))
