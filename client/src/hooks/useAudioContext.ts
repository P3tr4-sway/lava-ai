import { useEffect, useRef } from 'react'

let sharedContext: AudioContext | null = null

export function useAudioContext() {
  const contextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!sharedContext) {
      sharedContext = new AudioContext({ sampleRate: 44100 })
    }
    contextRef.current = sharedContext

    return () => {
      // Don't close on unmount — context is shared
    }
  }, [])

  const resume = async () => {
    if (sharedContext?.state === 'suspended') {
      await sharedContext.resume()
    }
  }

  return { context: contextRef.current, resume }
}
