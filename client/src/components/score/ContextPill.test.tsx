import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextPill } from './ContextPill'

const defaultBounds = { x: 50, y: 100, width: 200, height: 60 }

describe('ContextPill', () => {
  it('renders nothing when selectionType is none', () => {
    const { container } = render(
      <ContextPill
        selectionType="none"
        bounds={null}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders when selectionType is bar', () => {
    render(
      <ContextPill
        selectionType="bar"
        bounds={defaultBounds}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('renders Transpose button for note selection', () => {
    render(
      <ContextPill
        selectionType="note"
        bounds={defaultBounds}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={vi.fn()}
        onTranspose={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /transpose/i })).toBeInTheDocument()
  })

  it('does NOT render Transpose button for bar selection', () => {
    render(
      <ContextPill
        selectionType="bar"
        bounds={defaultBounds}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /transpose/i })).toBeNull()
  })

  it('calls onDelete when Delete button clicked', async () => {
    const onDelete = vi.fn()
    render(
      <ContextPill
        selectionType="bar"
        bounds={defaultBounds}
        onDelete={onDelete}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('calls onCopy when Copy button clicked', async () => {
    const onCopy = vi.fn()
    render(
      <ContextPill
        selectionType="bar"
        bounds={defaultBounds}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={onCopy}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('renders nothing when bounds is null', () => {
    const { container } = render(
      <ContextPill
        selectionType="bar"
        bounds={null}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('is positioned above the selection bounds', () => {
    const { container } = render(
      <ContextPill
        selectionType="bar"
        bounds={{ x: 100, y: 80, width: 200, height: 50 }}
        onDelete={vi.fn()}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    )
    const pill = container.firstChild as HTMLElement
    // Should be positioned at left: bounds.x, and top: something < bounds.y
    expect(pill.style.left).toBe('100px')
    // top should be bounds.y - some offset (e.g. 40px)
    expect(parseInt(pill.style.top)).toBeLessThan(80)
  })
})
