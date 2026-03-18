import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { Music, Play, Square, Circle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'
import { KEYS, SCALES } from '@lava/shared'

export function JamPage() {
  const { id } = useParams()
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)
  const bpm = useAudioStore((s) => s.bpm)
  const setBpm = useAudioStore((s) => s.setBpm)
  const key = useAudioStore((s) => s.key)
  const setKey = useAudioStore((s) => s.setKey)
  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)

  useEffect(() => {
    setSpaceContext({ currentSpace: 'jam', projectId: id })
  }, [id, setSpaceContext])

  const isPlaying = playbackState === 'playing'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Music size={20} className="text-text-secondary" />
          <h1 className="text-xl font-semibold">Jam</h1>
        </div>
        <p className="text-text-secondary text-sm">
          Free-form play with AI-generated backing tracks. Set your key, tempo, and vibe.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Controls */}
        <Card className="lg:col-span-1 flex flex-col gap-4">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Session
          </p>

          <div>
            <label className="text-xs text-text-secondary mb-1 block">Key</label>
            <div className="flex flex-wrap gap-1">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKey(k)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    key === k
                      ? 'bg-white text-black'
                      : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label={`Tempo: ${bpm} BPM`}
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => setPlaybackState(isPlaying ? 'stopped' : 'playing')}
            >
              {isPlaying ? (
                <>
                  <Square size={14} /> Stop
                </>
              ) : (
                <>
                  <Play size={14} /> Start
                </>
              )}
            </Button>
            <Button variant="outline" size="icon">
              <Circle size={14} className="text-red-500" />
            </Button>
          </div>
        </Card>

        {/* Canvas */}
        <Card className="lg:col-span-2 min-h-[300px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-surface-3 flex items-center justify-center mx-auto mb-4">
              <Music size={24} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary">Jam session canvas</p>
            <p className="text-xs text-text-muted mt-1">
              Start a session or ask LAVA AI to pick a backing track
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
