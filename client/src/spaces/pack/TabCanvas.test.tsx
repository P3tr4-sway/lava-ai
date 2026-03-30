import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { createEmptyScoreDocument, exportScoreDocumentToMusicXml } from '@/lib/scoreDocument'
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
  getNoteAtPos: vi.fn(() => null),
  findMasterBarByIndex: vi.fn(() => ({
    visualBounds: { x: 24, y: 48, w: 220, h: 120 },
  })),
  staffSystems: [],
}

vi.mock('@coderline/alphatab', () => {
  class AlphaTabApi {
    settings = {
      display: {
        scale: 1,
      },
    }
    boundsLookup = mockBoundsLookup
    score = {}
    private renderFinishedHandlers: Array<() => void> = []
    renderFinished = {
      on: (handler: () => void) => {
        this.renderFinishedHandlers.push(handler)
        return () => {
          this.renderFinishedHandlers = this.renderFinishedHandlers.filter((entry) => entry !== handler)
        }
      },
    }
    constructor() {}
    load() {
      this.renderFinishedHandlers.forEach((handler) => handler())
    }
    render() {
      this.renderFinishedHandlers.forEach((handler) => handler())
    }
    destroy() {}
  }

  return {
    AlphaTabApi,
    LayoutMode: { Page: 'Page' },
    PlayerMode: { Disabled: 'Disabled' },
    StaveProfile: { ScoreTab: 1, Tab: 3 },
    TabRhythmMode: { Automatic: 'Automatic' },
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
      selectionScope: 'note',
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
    expect(useEditorStore.getState().caret).toMatchObject({
      measureIndex: 0,
      string: 6,
    })
    expect(useEditorStore.getState().caret?.beat).toBe(0.5)
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
})
