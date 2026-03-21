import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import { useAgentStore } from '@/stores/agentStore'
import { useAudioStore } from '@/stores/audioStore'
import { useDawPanelStore, makeTrack } from '@/stores/dawPanelStore'
import { useProjectStore } from '@/stores/projectStore'
import { projectService } from '@/services/projectService'
import {
  Music, FileMusic, ArrowLeft, Sparkles, Save, Check, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { CHORD_CHARTS } from '@/data/chordCharts'
import { DawPanel } from '@/components/daw/DawPanel'
import type { DawSectionLabel } from '@/components/daw/DawPanel'

const PARTS = [
  { id: 'lead', label: 'Lead Guitar' },
  { id: 'rhythm', label: 'Rhythm Guitar' },
  { id: 'bass', label: 'Bass Line' },
]

const PROGRESS_SECTIONS = [
  { id: 1, label: 'Intro',   type: 'intro',  barCount: 2, status: 'done'    as const, accuracy: 96 },
  { id: 2, label: 'Verse 1', type: 'verse',  barCount: 4, status: 'done'    as const, accuracy: 88 },
  { id: 3, label: 'Chorus',  type: 'chorus', barCount: 3, status: 'current' as const, accuracy: 71 },
  { id: 4, label: 'Verse 2', type: 'verse',  barCount: 4, status: 'locked'  as const, accuracy: 0  },
  { id: 5, label: 'Bridge',  type: 'bridge', barCount: 2, status: 'locked'  as const, accuracy: 0  },
  { id: 6, label: 'Outro',   type: 'outro',  barCount: 1, status: 'locked'  as const, accuracy: 0  },
]

export function SongsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isGenerateMode = searchParams.get('generate') === '1'
  const setSpaceContext = useAgentStore((s) => s.setSpaceContext)

  const [selectedPart, setSelectedPart] = useState('lead')
  const [generating, setGenerating] = useState(isGenerateMode)

  // Audio store
  const playbackState = useAudioStore((s) => s.playbackState)
  const setPlaybackState = useAudioStore((s) => s.setPlaybackState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const duration = useAudioStore((s) => s.duration)
  const setDuration = useAudioStore((s) => s.setDuration)
  const bpm = useAudioStore((s) => s.bpm)

  // DAW panel tracks
  const tracks = useDawPanelStore((s) => s.tracks)
  const setTracks = useDawPanelStore((s) => s.setTracks)
  const addTrack = useDawPanelStore((s) => s.addTrack)
  const updateTrack = useDawPanelStore((s) => s.updateTrack)

  // Save state
  const upsertProject = useProjectStore((s) => s.upsertProject)
  const [saving, setSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [showSavedBadge, setShowSavedBadge] = useState(false)
  const lastSavedClipIdsRef = useRef('')

  const chart = CHORD_CHARTS.find((c) => c.id === id)

  // Derive committed clip fingerprint to detect new recordings after a save
  const committedClipIds = tracks
    .flatMap((t) => t.clips.filter((c) => c.status === 'committed').map((c) => c.id))
    .join(',')

  const hasCommittedClips = committedClipIds.length > 0

  // Reset saved state when new clips appear after saving
  useEffect(() => {
    if (isSaved && committedClipIds !== lastSavedClipIdsRef.current) {
      setIsSaved(false)
    }
  }, [committedClipIds, isSaved])

  // Block navigation when there are unsaved recordings
  const blocker = useBlocker(hasCommittedClips && !isSaved)

  const handleSaveProject = async (): Promise<boolean> => {
    if (!chart || saving) return false
    setSaving(true)
    try {
      const serializedTracks = tracks.map((t) => ({
        name: t.name,
        color: t.color,
        clips: t.clips
          .filter((c) => c.status === 'committed' && c.audioFileId)
          .map((c) => ({
            audioFileId: c.audioFileId,
            startBar: c.startBar,
            lengthInBars: c.lengthInBars,
            name: c.name,
          })),
      }))
      const project = await projectService.create({
        name: `${chart.title} — Recording`,
        description: `${chart.artist ? chart.artist + ' · ' : ''}${bpm} BPM`,
        space: 'learn',
        metadata: {
          type: 'recording-session',
          songId: chart.id,
          songTitle: chart.title,
          bpm,
          tracks: serializedTracks,
        },
      })
      upsertProject(project)
      lastSavedClipIdsRef.current = committedClipIds
      setIsSaved(true)
      setShowSavedBadge(true)
      setTimeout(() => setShowSavedBadge(false), 3000)
      return true
    } catch (err) {
      console.error('Save project failed:', err)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleDialogSave = async () => {
    const ok = await handleSaveProject()
    if (ok) blocker.proceed?.()
  }

  const isPlaying = playbackState === 'playing'
  const animRef = useRef<number>()
  const playStartRef = useRef({ time: 0, position: 0 })

  // Seed initial tracks for this song
  useEffect(() => {
    if (chart) {
      setTracks([makeTrack(chart.title, 0)])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart?.id])

  // Set song duration based on tempo
  useEffect(() => {
    if (chart?.tempo) {
      const songDuration = (16 * 4 * 60) / chart.tempo
      setDuration(songDuration)
    } else {
      setDuration(240)
    }
  }, [chart?.tempo, setDuration])

  // Playback animation
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }
    playStartRef.current = { time: performance.now(), position: currentTime }
    const animate = () => {
      const elapsed = (performance.now() - playStartRef.current.time) / 1000
      const newTime = playStartRef.current.position + elapsed
      if (newTime >= duration) {
        setCurrentTime(0)
        setPlaybackState('stopped')
        return
      }
      setCurrentTime(newTime)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, setCurrentTime, setPlaybackState])

  useEffect(() => {
    setSpaceContext({ currentSpace: 'learn', projectId: id })
  }, [id, setSpaceContext])

  // Simulate AI generation
  useEffect(() => {
    if (!generating) return
    const t = setTimeout(() => setGenerating(false), 2500)
    return () => clearTimeout(t)
  }, [generating])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const dawSections = useMemo<DawSectionLabel[]>(() => {
    let barStart = 0
    return PROGRESS_SECTIONS.map((s) => {
      const section = { label: s.label, type: s.type, barStart, barCount: s.barCount }
      barStart += s.barCount
      return section
    })
  }, [])

  if (!chart) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <FileMusic size={40} className="text-text-muted" />
          <p className="text-sm font-medium text-text-primary">Song not found</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── Header toolbar ──────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border bg-surface-0/90 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-7 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5">
          <Music size={15} className="text-text-muted shrink-0" />
          <span className="text-sm font-semibold text-text-primary">{chart.title}</span>
          {chart.artist && <span className="text-xs text-text-muted">— {chart.artist}</span>}
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Key */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Key</span>
          <span className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary tabular-nums">
            {chart.key}
          </span>
        </div>

        {/* Time signature */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Time</span>
          <span className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary tabular-nums">
            {chart.timeSignature ?? '4/4'}
          </span>
        </div>

        {/* Tempo */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">♩=</span>
          <span className="text-xs bg-surface-2 border border-border rounded px-1.5 py-1 text-text-primary tabular-nums">
            {chart.tempo ?? '—'}
          </span>
        </div>

        <div className="flex-1" />

        {/* Save button — always visible */}
        <button
          onClick={() => void handleSaveProject()}
          disabled={saving || !hasCommittedClips || isSaved}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            showSavedBadge
              ? 'bg-success/10 text-success border border-success/20'
              : hasCommittedClips && !isSaved
                ? 'bg-surface-2 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover'
                : 'bg-surface-2 border border-border text-text-muted opacity-40 cursor-not-allowed',
          )}
        >
          {showSavedBadge ? (
            <><Check size={13} /> Saved</>
          ) : saving ? (
            'Saving...'
          ) : (
            <><Save size={13} /> Save</>
          )}
        </button>

        {/* Part picker */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-border">
          {PARTS.map((part) => (
            <button
              key={part.id}
              onClick={() => setSelectedPart(part.id)}
              className={cn(
                'flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                selectedPart === part.id
                  ? 'bg-surface-0 text-text-primary shadow-sm border border-border'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {part.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Score area ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {generating ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-text-primary/10 flex items-center justify-center">
                <Sparkles size={28} className="text-text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Generating score & backing track...</p>
                <p className="text-xs text-text-muted mt-1">Analyzing audio, extracting chords and melody</p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-text-primary/40 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : chart.pdfUrl ? (
          <div className="h-full overflow-y-auto">
            <object
              data={`${chart.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              type="application/pdf"
              className="w-full h-[1400px]"
            >
              <iframe
                src={`${chart.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="w-full h-[1400px] border-0"
                title="Score"
              />
            </object>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="w-full max-w-3xl">
                <div className="bg-surface-0 border border-border rounded-xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Music size={18} className="text-text-muted" />
                    <span className="text-sm font-semibold text-text-primary">{chart.title}</span>
                    <span className="text-xs text-text-muted">{chart.style}</span>
                  </div>

                  <div className="flex flex-col gap-8">
                    {PROGRESS_SECTIONS.map((section) => (
                      <div key={section.id} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded',
                            section.status === 'current'
                              ? 'bg-text-primary/10 text-text-primary'
                              : section.status === 'done'
                                ? 'text-text-secondary'
                                : 'text-text-muted',
                          )}>
                            {section.label}
                          </span>
                          {section.status !== 'locked' && (
                            <span className={cn(
                              'text-2xs font-mono',
                              section.accuracy >= 90 ? 'text-success' : section.accuracy >= 80 ? 'text-warning' : 'text-text-muted',
                            )}>
                              {section.accuracy}%
                            </span>
                          )}
                        </div>
                        <div className="relative h-16 border border-border rounded-lg overflow-hidden">
                          {[0, 1, 2, 3, 4].map((line) => (
                            <div
                              key={line}
                              className="absolute left-0 right-0 h-px bg-border"
                              style={{ top: `${20 + line * 12}%` }}
                            />
                          ))}
                          {section.status === 'current' && isPlaying && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-text-primary/60 transition-all"
                              style={{ left: `${progressPercent}%` }}
                            />
                          )}
                          {section.status === 'locked' && (
                            <div className="absolute inset-0 bg-surface-1/60 flex items-center justify-center">
                              <span className="text-2xs text-text-muted">Complete previous sections first</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DAW Panel ───────────────────────────────────────────── */}
      <DawPanel
        tracks={tracks}
        onUpdateTrack={updateTrack}
        onAddTrack={() => addTrack()}
        showRecordButton={true}
        sections={dawSections}
      />

      {/* ── Unsaved-changes dialog ───────────────────────────────── */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => blocker.reset?.()}
          />
          {/* Dialog */}
          <div className="relative z-10 w-full max-w-sm mx-4 bg-surface-1 border border-border rounded-lg shadow-xl animate-fade-in">
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center mt-0.5">
                  <AlertTriangle size={16} className="text-warning" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Unsaved recording</p>
                  <p className="text-xs text-text-secondary mt-1">
                    You have a recording that hasn't been saved to Projects. Save it before leaving?
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => blocker.reset?.()}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => blocker.proceed?.()}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-border transition-colors"
                >
                  Don't Save
                </button>
                <button
                  onClick={() => void handleDialogSave()}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-text-primary text-surface-0 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
