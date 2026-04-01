import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EditSurface } from './EditSurface'
import { createEmptyScoreDocument } from '@/lib/scoreDocument'
import { useEditorStore } from '@/stores/editorStore'
import { useScoreDocumentStore } from '@/stores/scoreDocumentStore'

describe('EditSurface note entry', () => {
  beforeEach(() => {
    const document = createEmptyScoreDocument()
    useScoreDocumentStore.setState({
      document,
      exportCacheXml: document.lastExportedXml ?? '',
      undoStack: [],
      redoStack: [],
      lastWarnings: [],
    })
    useEditorStore.setState({
      selectedBars: [],
      selectedNotes: [],
      selectedNoteIds: [],
      cursorNoteId: null,
      activeToolGroup: 'note',
      entryMode: 'note',
      entryDuration: 'quarter',
      caret: {
        trackId: document.tracks[0]!.id,
        measureIndex: 0,
        beat: 0,
        string: 2,
      },
    })
  })

  it('inserts a note from the visible caret entry controls', () => {
    render(<EditSurface />)

    expect(screen.getByText('Note entry')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('String'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Fret'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Insert note at caret' }))

    const notes = useScoreDocumentStore.getState().document.tracks[0]?.notes ?? []
    expect(notes).toHaveLength(1)
    expect(notes[0]?.placement).toMatchObject({ string: 3, fret: 5 })
    expect(useEditorStore.getState().caret?.beat).toBe(1)
  })

  it('writes a note directly when clicking an empty beat on the staff', () => {
    const { container } = render(<EditSurface />)

    const svg = container.querySelector('svg')
    if (!svg) throw new Error('missing svg surface')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: Number(svg.getAttribute('width') ?? 0),
        height: Number(svg.getAttribute('height') ?? 0),
      }),
      configurable: true,
    })

    fireEvent.mouseDown(svg, { clientX: 48, clientY: 82 })

    const notes = useScoreDocumentStore.getState().document.tracks[0]?.notes ?? []
    expect(notes).toHaveLength(1)
    expect(notes[0]?.beat).toBe(0)
    expect(notes[0]?.placement).toMatchObject({ string: 2, fret: 0 })
    expect(useEditorStore.getState().caret?.beat).toBe(1)
  })
})
