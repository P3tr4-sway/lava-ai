import { Mic } from 'lucide-react'
import type { TrackLane } from '@/stores/dawPanelStore'
import { BAR_WIDTH_PX, TRACK_HEIGHT_PX } from '@/audio/constants'
import { ClipView } from './ClipView'
import { LiveWaveformCanvas } from './LiveWaveformCanvas'
import type { Recorder } from '@/audio/Recorder'

interface TrackLaneViewProps {
  track: TrackLane
  totalBars: number
  beatsPerBar: number
  currentBar: number
  selectedClipId: string | null
  snapEnabled: boolean
  onClipSelect: (clipId: string) => void
  onClipMove: (clipId: string, newStartBar: number) => void
  onClipResizeRight: (clipId: string, newLengthInBars: number) => void
  onClipResizeLeft: (clipId: string, newTrimStart: number, newStartBar: number) => void
  onDropAudioFile?: (file: File, atBar: number) => void
  /** Recorder instance — passed only for the track that is actively recording */
  recorder?: Recorder
}

export function TrackLaneView({
  track,
  totalBars,
  beatsPerBar,
  currentBar,
  selectedClipId,
  snapEnabled,
  onClipSelect,
  onClipMove,
  onClipResizeRight,
  onClipResizeLeft,
  onDropAudioFile,
  recorder,
}: TrackLaneViewProps) {
  const isRecording = track.recording
  const hasTempClip = track.clips.some((clip) => clip.status === 'temp')

  return (
    <div
      className="relative overflow-hidden border-b border-white/[0.05]"
      style={{ height: TRACK_HEIGHT_PX }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (!file || !onDropAudioFile) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const atBar = Math.floor(x / BAR_WIDTH_PX)
        onDropAudioFile(file, atBar)
      }}
    >
      {/* Grid lines for bars and beats */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: totalBars }, (_, i) => (
          <div
            key={i}
            className="flex-1 border-r border-white/[0.18] flex"
            style={{ minWidth: BAR_WIDTH_PX }}
          >
            {Array.from({ length: beatsPerBar - 1 }, (_, b) => (
              <div key={b} className="flex-1 border-r border-white/[0.09]" />
            ))}
            <div className="flex-1" />
          </div>
        ))}
      </div>
      <div className="absolute top-1/2 left-0 right-0 h-px bg-text-primary/[0.06]" />

      {/* Empty state */}
      {track.clips.length === 0 && !isRecording && !track.recordReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 text-text-muted/40">
            <Mic size={13} />
            <span className="text-[11px]">Empty track</span>
          </div>
        </div>
      )}

      {track.recordReady && !isRecording && hasTempClip && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-medium">
            Waiting for punch/record start
          </div>
        </div>
      )}

      {/* Live waveform oscilloscope — shows mic input during recording */}
      {isRecording && recorder && (
        <LiveWaveformCanvas
          recorder={recorder}
          color={track.color.accent}
          className="absolute inset-0 w-full h-full opacity-50 pointer-events-none z-10"
        />
      )}

      {/* Recording indicator badge */}
      {isRecording && (
        <div className="absolute top-1.5 right-2 flex items-center gap-1 z-20 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
          <span className="text-[9px] text-error font-medium">REC</span>
        </div>
      )}

      {/* Clips */}
      {track.clips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          barWidthPx={BAR_WIDTH_PX}
          trackHeight={TRACK_HEIGHT_PX}
          selected={selectedClipId === clip.id}
          snapEnabled={snapEnabled}
          onSelect={onClipSelect}
          onMove={onClipMove}
          onResizeRight={onClipResizeRight}
          onResizeLeft={onClipResizeLeft}
        />
      ))}

      {/* Playhead (bar-based position) */}
      {/* currentBar is updated each RAF frame via AudioController; position reflects last frame */}
      <div
        className="absolute top-0 bottom-0 w-[1px] bg-red-500 pointer-events-none z-10"
        style={{ left: currentBar * BAR_WIDTH_PX }}
      />
    </div>
  )
}
