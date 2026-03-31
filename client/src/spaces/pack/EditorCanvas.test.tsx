import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEditorStore } from '@/stores/editorStore'
import { EditorCanvas } from './EditorCanvas'

vi.mock('./PracticeSurface', () => ({
  PracticeSurface: ({ compact = false }: { compact?: boolean }) => (
    <div data-testid={compact ? 'practice-surface-compact' : 'practice-surface'} />
  ),
}))

vi.mock('./StaffPreview', () => ({
  StaffPreview: () => <div data-testid="staff-preview" />,
}))

vi.mock('@/hooks/useCursorEngine', () => ({
  useCursorEngine: () => ({
    cursorMode: 'hidden' as const,
    displayX: -100,
    displayY: { top: 0, bottom: 0 },
    isSnapped: false,
    onMouseMove: vi.fn(),
    onMouseLeave: vi.fn(),
  }),
}))

describe('EditorCanvas', () => {
  beforeEach(() => {
    useEditorStore.setState({
      viewMode: 'tab',
      editorMode: 'fineEdit',
    })
  })

  it('uses the professional tab surface in fine edit tab view', () => {
    render(<EditorCanvas />)

    expect(screen.getByTestId('practice-surface')).toBeInTheDocument()
    expect(screen.queryByTestId('staff-preview')).not.toBeInTheDocument()
  })

  it('uses the professional tab surface in split view too', () => {
    useEditorStore.setState({ viewMode: 'split', editorMode: 'fineEdit' })

    render(<EditorCanvas />)

    expect(screen.getByTestId('staff-preview')).toBeInTheDocument()
    expect(screen.getByTestId('practice-surface-compact')).toBeInTheDocument()
  })
})
