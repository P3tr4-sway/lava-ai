import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Check,
  ChevronRight,
  Clock3,
  Columns2,
  Hash,
  KeyRound,
  LayoutGrid,
  Music2,
  Pilcrow,
  Repeat2,
  SlidersVertical,
  Sparkles,
  Type,
  WholeWord,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { useEditorStore } from '@/stores/editorStore'

interface SidebarTool {
  id: string
  label: string
  icon: LucideIcon
  options: string[]
  onSelect?: () => void
}

const SIDEBAR_TOOLS: SidebarTool[] = [
  { id: 'clefs', label: 'Clefs', icon: Music2, options: ['Treble', 'Bass', 'Alto', 'Tenor'] },
  { id: 'key-signatures', label: 'Key signatures', icon: KeyRound, options: ['C major', 'G major', 'D major', 'A minor'], onSelect: () => useEditorStore.getState().setToolMode('keySig') },
  { id: 'time-signatures', label: 'Time signatures', icon: Clock3, options: ['4/4', '3/4', '6/8', '12/8'] },
  { id: 'tempo', label: 'Tempo', icon: SlidersVertical, options: ['Largo', 'Andante', 'Moderato', 'Allegro'] },
  { id: 'pitch', label: 'Pitch', icon: AudioLines, options: ['Concert pitch', 'Octave up', 'Octave down', 'Chromatic'] },
  { id: 'accidentals', label: 'Accidentals', icon: Hash, options: ['Sharp', 'Flat', 'Natural', 'Courtesy accidental'] },
  { id: 'dynamics', label: 'Dynamics', icon: WholeWord, options: ['pp', 'p', 'mf', 'ff'] },
  { id: 'articulations', label: 'Articulations', icon: Sparkles, options: ['Accent', 'Staccato', 'Tenuto', 'Marcato'] },
  { id: 'text', label: 'Text', icon: Type, options: ['Title', 'Lyrics', 'Fingering', 'Comment'], onSelect: () => useEditorStore.getState().setToolMode('text') },
  { id: 'keyboard', label: 'Keyboard', icon: Pilcrow, options: ['Show keyboard', 'Hide keyboard', 'Piano roll', 'Transpose keys'] },
  { id: 'repeats-jumps', label: 'Repeats & jumps', icon: Repeat2, options: ['Repeat start', 'Repeat end', 'D.C. al Fine', 'Segno'] },
  { id: 'barlines', label: 'Barlines', icon: Columns2, options: ['Single', 'Double', 'Final', 'Dashed'] },
  { id: 'layout', label: 'Layout', icon: LayoutGrid, options: ['System break', 'Page break', 'Staff spacing', 'Measure width'] },
]

export function ScoreSidebarToolbar() {
  const editorMode = useEditorStore((state) => state.editorMode)
  const toolMode = useEditorStore((state) => state.toolMode)
  const setActiveToolGroup = useEditorStore((state) => state.setActiveToolGroup)

  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    Object.fromEntries(SIDEBAR_TOOLS.map((tool) => [tool.id, tool.options[0] ?? '']))
  )
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setHoveredToolId(null)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (editorMode !== 'fineEdit') {
      setHoveredToolId(null)
      setActiveToolId(null)
    }
  }, [editorMode])

  useEffect(() => {
    if (toolMode === 'keySig') setActiveToolId('key-signatures')
    if (toolMode === 'text') setActiveToolId('text')
  }, [toolMode])

  if (editorMode !== 'fineEdit') return null

  return (
    <div ref={containerRef} className="pointer-events-none absolute left-5 top-6 z-20">
      <div className="pointer-events-auto flex flex-col gap-1 overflow-visible rounded-[12px] border border-[#f1f1f1] bg-white/96 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.12)] backdrop-blur">
        {SIDEBAR_TOOLS.map((tool) => {
          const selected = activeToolId === tool.id
          const panelOpen = hoveredToolId === tool.id
          const selectedOption = selectedOptions[tool.id]
          const Icon = tool.icon

          return (
            <div
              key={tool.id}
              className="group relative flex items-center"
              onMouseEnter={() => setHoveredToolId(tool.id)}
              onMouseLeave={() => setHoveredToolId((current) => current === tool.id ? null : current)}
            >
              <button
                type="button"
                aria-label={tool.label}
                title={tool.label}
                onClick={() => {
                  setActiveToolId((current) => current === tool.id ? null : tool.id)
                  setHoveredToolId(tool.id)
                  if (tool.id === 'articulations') setActiveToolGroup('notation')
                  tool.onSelect?.()
                }}
                className={cn(
                  'flex size-10 items-center justify-center rounded-[10px] text-[#0d0d0d] transition-colors',
                  selected ? 'bg-[#8df790]' : 'hover:bg-[#f6f6f6]',
                )}
              >
                <Icon className="size-[18px] stroke-[2]" />
              </button>

              <div
                className={cn(
                  'pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-[10px] border border-[#f1f1f1] bg-white px-3 py-1.5 text-sm font-medium text-[#102050] shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition-all duration-150',
                  panelOpen ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                {tool.label}
              </div>

              {panelOpen && (
                <div className="absolute left-[calc(100%+10px)] top-1/2 z-20 min-w-[220px] -translate-y-1/2 rounded-[12px] border border-[#f1f1f1] bg-white p-2 shadow-[0_18px_48px_rgba(0,0,0,0.12)]">
                  <div className="mb-1 flex items-center justify-between px-2 py-1">
                    <span className="text-sm font-semibold text-[#102050]">{tool.label}</span>
                    <ChevronRight className="size-4 text-[#7a7a7a]" />
                  </div>
                  <div className="flex flex-col gap-1">
                    {tool.options.map((option) => {
                      const optionSelected = selectedOption === option
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setActiveToolId(tool.id)
                            setSelectedOptions((current) => ({ ...current, [tool.id]: option }))
                            if (tool.id === 'articulations') setActiveToolGroup('notation')
                            tool.onSelect?.()
                          }}
                          className={cn(
                            'flex items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition-colors',
                            optionSelected
                              ? 'bg-[#8df790] text-[#0d0d0d]'
                              : 'text-[#102050] hover:bg-[#f6f6f6]',
                          )}
                        >
                          <span>{option}</span>
                          {optionSelected && <Check className="size-4" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
