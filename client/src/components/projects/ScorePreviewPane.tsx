import { useEffect, useRef, useState } from 'react'
import { AlphaTabApi, LayoutMode, PlayerMode } from '@coderline/alphatab'
import type { Settings } from '@coderline/alphatab'
import { AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/components/ui/utils'
import { exportScoreDocumentToMusicXml } from '@/lib/scoreDocument'
import type { ScoreDocument } from '@lava/shared'

interface ScorePreviewPaneProps {
  gpBytes: Uint8Array | null
  scoreDocument: ScoreDocument | null
  fileType: 'gp' | 'musicxml' | null
  loading: boolean
}

export function ScorePreviewPane({
  gpBytes,
  scoreDocument,
  fileType,
  loading,
}: ScorePreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [renderState, setRenderState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Phase A: initialise AlphaTab once the container mounts (display-only, no sound)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const settings: Partial<Settings> = {
      core: {
        engine: 'svg',
        enableLazyLoading: false,
        fontDirectory: '/vendor/alphatab/font/',
        useWorkers: false,
      } as Settings['core'],
      display: {
        layoutMode: LayoutMode.Page,
        scale: 0.9,
      } as Settings['display'],
      player: {
        playerMode: PlayerMode.Disabled,
      } as Settings['player'],
    }

    const api = new AlphaTabApi(container, settings as unknown as Settings)
    apiRef.current = api
    setIsApiReady(true)

    return () => {
      api.destroy()
      apiRef.current = null
      setIsApiReady(false)
    }
  }, [])

  // Phase B: load score data whenever inputs or API readiness changes
  useEffect(() => {
    const api = apiRef.current
    if (!api || !isApiReady) return

    if (loading) {
      setRenderState('loading')
      return
    }

    const loadData = (data: Uint8Array) => {
      setRenderState('loading')
      setErrorMsg(null)

      // Use renderFinished (fired after SVG is drawn) to show the pane
      let resolved = false
      const off = api.renderFinished.on(() => {
        if (resolved) return
        resolved = true
        off()
        setRenderState('ready')
      })

      try {
        api.load(data)
      } catch (e) {
        off()
        setRenderState('error')
        setErrorMsg((e as Error).message)
      }
    }

    if (fileType === 'gp' && gpBytes) {
      loadData(gpBytes)
    } else if (fileType === 'musicxml' && scoreDocument) {
      try {
        const xml = exportScoreDocumentToMusicXml(scoreDocument)
        loadData(new TextEncoder().encode(xml))
      } catch (e) {
        setRenderState('error')
        setErrorMsg((e as Error).message)
      }
    } else {
      setRenderState('idle')
    }
  }, [gpBytes, scoreDocument, fileType, loading, isApiReady])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f5f4f1]">
      {/* AlphaTab SVG mount — kept in DOM so the API instance persists */}
      <div
        ref={containerRef}
        className={cn('h-full w-full overflow-y-auto', renderState !== 'ready' && 'invisible')}
      />

      {/* Loading */}
      {(renderState === 'loading' || (renderState === 'idle' && loading)) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[#8a8a8a]" />
        </div>
      )}

      {/* Error */}
      {renderState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-10 text-center">
          <AlertCircle size={18} className="text-[#b24d37]" />
          <p className="text-[12px] text-[#b24d37]">
            {errorMsg ?? 'Could not render score preview'}
          </p>
        </div>
      )}
    </div>
  )
}
