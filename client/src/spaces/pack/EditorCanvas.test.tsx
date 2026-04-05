import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEditorStore } from '@/stores/editorStore'
import { EditorCanvas } from './EditorCanvas'

vi.mock('./PracticeSurface', () => ({
  PracticeSurface: ({ viewMode }: { viewMode?: string }) => (
    <div data-testid="practice-surface" data-view-mode={viewMode} />
  ),
}))

describe('EditorCanvas', () => {
  beforeEach(() => {
    useEditorStore.setState({
      viewMode: 'tab',
      editorMode: 'fineEdit',
    })
  })

  it('renders PracticeSurface in tab view', () => {
    render(<EditorCanvas />)

    expect(screen.getByTestId('practice-surface')).toBeInTheDocument()
    expect(screen.getByTestId('practice-surface')).toHaveAttribute('data-view-mode', 'tab')
  })

  it('passes split viewMode to PracticeSurface', () => {
    useEditorStore.setState({ viewMode: 'split', editorMode: 'fineEdit' })

    render(<EditorCanvas />)

    expect(screen.getByTestId('practice-surface')).toHaveAttribute('data-view-mode', 'split')
  })
})
