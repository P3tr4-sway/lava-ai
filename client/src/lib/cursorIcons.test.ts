import { describe, it, expect } from 'vitest'
import { noteCursorUrl, restCursorUrl } from './cursorIcons'
import type { NoteValue } from '@lava/shared'

describe('noteCursorUrl', () => {
  const durations: NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']

  for (const d of durations) {
    it(`returns a valid data URI for ${d} note`, () => {
      const url = noteCursorUrl(d)
      expect(url).toMatch(/^url\('data:image\/svg\+xml,/)
      expect(url).toContain('svg')
      expect(url).toContain('xmlns')
    })
  }

  it('returns different SVGs for different durations', () => {
    const quarter = noteCursorUrl('quarter')
    const half = noteCursorUrl('half')
    expect(quarter).not.toBe(half)
  })
})

describe('restCursorUrl', () => {
  it('returns a valid data URI', () => {
    const url = restCursorUrl()
    expect(url).toMatch(/^url\('data:image\/svg\+xml,/)
    expect(url).toContain('svg')
  })

  it('uses provided color when given', () => {
    const url = restCursorUrl('#ff0000')
    expect(url).toContain('ff0000')
  })
})
