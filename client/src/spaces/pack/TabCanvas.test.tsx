import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createEmptyScoreDocument, exportScoreDocumentToMusicXml } from '@/lib/scoreDocument'
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'
import { TabCanvas } from './TabCanvas'

const mockBoundsLookup = {
  getBeatAtPos: vi.fn(() => ({
    index: 0,
    voice: {
      bar: {
        index: 0,
      },
    },
  })),
  getNoteAtPos: vi.fn<(...args: Array<unknown>) => unknown | null>(() => null),
  findMasterBarByIndex: vi.fn(() => ({
    visualBounds: { x: 24, y: 48, w: 220, h: 120 },
  })),
  staffSystems: [],
}

function mockElementRect(element: Element, rect: { left: number; top: number; width?: number; height?: number }) {
  const width = rect.width ?? 0
  const height = rect.height ?? 0
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + width,
      bottom: rect.top + height,
      width,
      height,
      toJSON: () => ({}),
    }),
  })
}

function KeyboardHarness() {
  useEditorKeyboard()
  return null
}

const makeNoOpEvent = () => ({ on: vi.fn(() => vi.fn()) })

vi.mock('@coderline/alphatab', () => {
  class AlphaTabApi {
    settings = { display: { scale: 1 } }
    boundsLookup = mockBoundsLookup
    score = { masterBars: [] }
    playbackSpeed = 1
    tickPosition = 0
    private renderFinishedHandlers: Array<() => void> = []
    renderFinished = {
      on: (handler: () => void) => {
        this.renderFinishedHandlers.push(handler)
        return () => {
          this.renderFinishedHandlers = this.renderFinishedHandlers.filter((entry) => entry !== handler)
        }
      },
    }
    playerStateChanged = makeNoOpEvent()
    playerPositionChanged = makeNoOpEvent()
    constructor() {}
    load() { this.renderFinishedHandlers.forEach((handler) => handler()) }
    render() { this.renderFinishedHandlers.forEach((handler) => handler()) }
    play() {}
    pause() {}
    stop() {}
    playBeat() {}
    destroy() {}
  }

  return {
    AlphaTabApi,
    LayoutMode: { Page: 'Page' },
    PlayerMode: { EnabledAutomatic: 'EnabledAutomatic', Disabled: 'Disabled' },
    StaveProfile: { ScoreTab: 1, Tab: 3, Score: 2 },
    TabRhythmMode: { Automatic: 'Automatic' },
    synth: {
      PlayerState: { Playing: 1, Paused: 2 },
    },
  }
})

describe('TabCanvas fine edit', () => {
  beforeEach(() => {
    const document = createEmptyScoreDocument()
    useScoreDocumentStore.setState({
      document,
      exportCacheXml: exportScoreDocumentToMusicXml(document),
      undoStack: [],
      redoStack: [],
      lastWarnings: [],
    })
    useEditorStore.setState({
      editorMode: 'fineEdit',
      activeToolGroup: 'note',
      selectedBars: [],
      selectedNotes: [],
      selectedNoteIds: [],
      cursorNoteId: null,
      caret: null,
      hoverTarget: null,
      entryDuration: 'quarter',
      entryMode: 'note',
    })
    mockBoundsLookup.getBeatAtPos.mockClear()
    mockBoundsLookup.getNoteAtPos.mockClear()
    mockBoundsLookup.findMasterBarByIndex.mockReset()
    mockBoundsLookup.findMasterBarByIndex.mockImplementation(() => ({
      visualBounds: { x: 24, y: 48, w: 220, h: 120 },
    }))
  })

  it('writes a note directly into the score when clicking an empty beat in fine edit', () => {
    useEditorStore.setState({ entryDuration: 'eighth' })

    render(<TabCanvas />)

    fireEvent.click(screen.getByTestId('tab-canvas-surface'), { clientX: 28, clientY: 168 })

    const notes = useScoreDocumentStore.getState().document.tracks[0]?.notes ?? []
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      measureIndex: 0,
      beat: 0,
      durationType: 'eighth',
      placement: {
        string: 6,
        fret: 0,
      },
    })
    expect(useEditorStore.getState().selectedNoteIds).toEqual([notes[0]?.id])
    expect(useEditorStore.getState().caret).toBeNull()
  })

  it('uses modifier-click to move the caret without writing a note', () => {
    render(<TabCanvas />)

    fireEvent.click(screen.getByTestId('tab-canvas-surface'), { clientX: 28, clientY: 48, altKey: true })

    const notes = useScoreDocumentStore.getState().document.tracks[0]?.notes ?? []
    expect(notes).toHaveLength(0)
    expect(useEditorStore.getState().caret).toMatchObject({
      measureIndex: 0,
      beat: 0,
      string: 1,
    })
  })

  it('uses alphaTab root coordinates for hit testing after offsets and scroll', () => {
    render(<TabCanvas />)

    const surface = screen.getByTestId('tab-canvas-surface')
    const alphaTabRoot = surface.querySelector('.score-paper-bg')
    expect(alphaTabRoot).not.toBeNull()

    mockElementRect(surface, { left: 21, top: 65, width: 900, height: 600 })
    mockElementRect(alphaTabRoot as Element, { left: 37, top: -144, width: 720, height: 480 })

    fireEvent.click(surface, { clientX: 61, clientY: 56, altKey: true })

    expect(mockBoundsLookup.getBeatAtPos).toHaveBeenCalledWith(24, 200)
  })

  it('selects the stave nearest the pointer in ScoreTab mode instead of always using the last stave', () => {
    mockBoundsLookup.findMasterBarByIndex.mockImplementation(() => ({
      visualBounds: { x: 24, y: 24, w: 220, h: 140 },
      bars: [
        { visualBounds: { x: 24, y: 24, w: 220, h: 40 } },
        { visualBounds: { x: 24, y: 96, w: 220, h: 60 } },
      ],
    }))

    render(<TabCanvas />)

    fireEvent.click(screen.getByTestId('tab-canvas-surface'), { clientX: 28, clientY: 40, altKey: true })

    expect(useEditorStore.getState().caret).toMatchObject({
      measureIndex: 0,
      string: 3,
    })
  })

  it('shift-clicks on the same beat to add another string to the chord instead of selecting the existing note', () => {
    render(<TabCanvas />)

    fireEvent.click(screen.getByTestId('tab-canvas-surface'), { clientX: 28, clientY: 48 })

    mockBoundsLookup.getNoteAtPos.mockImplementation(() => ({
      string: 6,
      fret: 0,
      realValue: 64,
      beat: {
        index: 0,
        voice: {
          bar: {
            index: 0,
          },
        },
      },
    }))

    fireEvent.click(screen.getByTestId('tab-canvas-surface'), { clientX: 28, clientY: 96, shiftKey: true })

    const notes = useScoreDocumentStore.getState().document.tracks[0]?.notes ?? []
    expect(notes).toHaveLength(2)
    expect(notes.map((note) => note.placement?.string)).toEqual([1, 3])
    expect(notes.every((note) => note.beat === 0)).toBe(true)
    expect(useEditorStore.getState().caret).toMatchObject({
      measureIndex: 0,
      beat: 0,
      string: 3,
    })
  })

  it('lets the next digit key change the clicked note fret instead of inserting a new note', () => {
    render(
      <>
        <KeyboardHarness />
        <TabCanvas />
      </>,
    )

    fireEvent.click(screen.getByTestId('tab-canvas-surface'), { clientX: 28, clientY: 48 })
    fireEvent.keyDown(window, { key: '3' })

    const notes = useScoreDocumentStore.getState().document.tracks[0]?.notes ?? []
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      measureIndex: 0,
      beat: 0,
      placement: {
        string: 1,
        fret: 3,
      },
    })
    expect(useEditorStore.getState().selectedNoteIds).toEqual([notes[0]?.id])
    expect(useEditorStore.getState().caret).toBeNull()
  })
})
