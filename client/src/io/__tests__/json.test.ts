/**
 * Tests for io/json.ts — AST ↔ JSON serialization + localStorage auto-save.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nanoid } from 'nanoid'
import type { ScoreNode } from '../../editor/ast/types'
import {
  serializeAst,
  deserializeAst,
  autoSave,
  loadAutoSave,
  downloadAst,
  loadAstFromFile,
  AUTOSAVE_KEY,
} from '../json'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeScore(overrides: Partial<ScoreNode> = {}): ScoreNode {
  return {
    id: nanoid(),
    meta: {
      title: 'Test Score',
      artist: 'Test Artist',
      tempo: 120,
    },
    tracks: [
      {
        id: nanoid(),
        name: 'Guitar',
        instrument: 25,
        tuning: [40, 45, 50, 55, 59, 64],
        capo: 0,
        chordDefs: [],
        staves: [
          {
            id: nanoid(),
            showTabs: true,
            bars: [
              {
                id: nanoid(),
                voices: [
                  {
                    id: nanoid(),
                    beats: [
                      {
                        id: nanoid(),
                        duration: { value: 4, dots: 0 },
                        notes: [
                          {
                            id: nanoid(),
                            string: 1,
                            fret: 5,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// serializeAst + deserializeAst round-trip
// ---------------------------------------------------------------------------

describe('serializeAst / deserializeAst', () => {
  it('round-trips a simple score', () => {
    const ast = makeScore()
    const json = serializeAst(ast)
    const restored = deserializeAst(json)
    expect(restored).toEqual(ast)
  })

  it('round-trips a complex score with multiple tracks and bars', () => {
    const ast = makeScore({
      meta: {
        title: 'Complex',
        subtitle: 'A subtitle',
        artist: 'Artist',
        album: 'Album',
        tempo: 140,
        tempoLabel: 'Allegro',
      },
      tracks: [
        {
          id: nanoid(),
          name: 'Lead',
          instrument: 25,
          tuning: [40, 45, 50, 55, 59, 64],
          capo: 2,
          chordDefs: [{ id: nanoid(), name: 'Am', strings: [0, 0, 2, 2, 1, 0] }],
          staves: [
            {
              id: nanoid(),
              showTabs: true,
              showScore: true,
              bars: [
                {
                  id: nanoid(),
                  timeSignature: { numerator: 4, denominator: 4 },
                  tempo: 140,
                  voices: [
                    {
                      id: nanoid(),
                      beats: [
                        {
                          id: nanoid(),
                          duration: { value: 8, dots: 1 },
                          notes: [
                            { id: nanoid(), string: 1, fret: 5, hammerOrPull: true },
                            { id: nanoid(), string: 2, fret: 7, vibrato: 'slight' },
                          ],
                          dynamics: 'mf',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    const json = serializeAst(ast)
    const restored = deserializeAst(json)
    expect(restored).toEqual(ast)
    expect(restored.tracks[0].chordDefs[0].name).toBe('Am')
    expect(restored.tracks[0].staves[0].bars[0].voices[0].beats[0].dynamics).toBe('mf')
  })

  it('produces pretty-printed JSON (indented with 2 spaces)', () => {
    const ast = makeScore()
    const json = serializeAst(ast)
    expect(json).toContain('\n  ')
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// deserializeAst error cases
// ---------------------------------------------------------------------------

describe('deserializeAst error handling', () => {
  it('throws on malformed JSON', () => {
    expect(() => deserializeAst('{not valid json')).toThrow(/invalid JSON/i)
  })

  it('throws on valid JSON that is not a ScoreNode (missing id)', () => {
    const bad = JSON.stringify({ meta: { tempo: 120 }, tracks: [] })
    expect(() => deserializeAst(bad)).toThrow(/not a valid ScoreNode/i)
  })

  it('throws on valid JSON that is not a ScoreNode (missing meta)', () => {
    const bad = JSON.stringify({ id: 'abc', tracks: [] })
    expect(() => deserializeAst(bad)).toThrow(/not a valid ScoreNode/i)
  })

  it('throws on valid JSON that is not a ScoreNode (missing tracks array)', () => {
    const bad = JSON.stringify({ id: 'abc', meta: { tempo: 120 } })
    expect(() => deserializeAst(bad)).toThrow(/not a valid ScoreNode/i)
  })

  it('throws on null input', () => {
    expect(() => deserializeAst('null')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => deserializeAst('')).toThrow(/invalid JSON/i)
  })
})

// ---------------------------------------------------------------------------
// autoSave / loadAutoSave localStorage round-trip
// ---------------------------------------------------------------------------

describe('autoSave / loadAutoSave', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and restores an AST via localStorage', () => {
    const ast = makeScore()
    autoSave(ast)
    const restored = loadAutoSave()
    expect(restored).toEqual(ast)
  })

  it('saves under the correct localStorage key', () => {
    const ast = makeScore()
    autoSave(ast)
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBeNull()
  })

  it('returns null when nothing is saved', () => {
    expect(loadAutoSave()).toBeNull()
  })

  it('returns null when stored data is corrupt', () => {
    localStorage.setItem(AUTOSAVE_KEY, 'not-json')
    expect(loadAutoSave()).toBeNull()
  })

  it('overwrites a previous save', () => {
    const ast1 = makeScore({ meta: { tempo: 100, title: 'First' } })
    const ast2 = makeScore({ meta: { tempo: 200, title: 'Second' } })
    autoSave(ast1)
    autoSave(ast2)
    const restored = loadAutoSave()
    expect(restored?.meta.title).toBe('Second')
  })
})

// ---------------------------------------------------------------------------
// downloadAst — blob URL creation
// ---------------------------------------------------------------------------

describe('downloadAst', () => {
  it('calls URL.createObjectURL with a Blob', () => {
    const createObjectURL = vi.fn(() => 'blob:test-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    // Mock DOM methods
    const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn() }
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as unknown as HTMLElement)
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(appendChild)
    vi.spyOn(document.body, 'removeChild').mockImplementationOnce(removeChild)

    vi.useFakeTimers()

    const ast = makeScore()
    downloadAst(ast)

    expect(createObjectURL).toHaveBeenCalledOnce()
    // Extract the Blob argument — we know it was called once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blobArg = (createObjectURL.mock as any).calls?.[0]?.[0] as Blob | undefined
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg?.type).toBe('application/json')
    expect(anchor.click).toHaveBeenCalledOnce()

    // URL.revokeObjectURL called after setTimeout
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url')

    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses a sanitised filename derived from the score title', () => {
    const createObjectURL = vi.fn(() => 'blob:url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor as unknown as HTMLElement)
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementationOnce(vi.fn())
    vi.useFakeTimers()

    const ast = makeScore({ meta: { title: 'My Song', tempo: 120 } })
    downloadAst(ast)

    expect(anchor.download).toMatch(/My_Song/)
    expect(anchor.download).toMatch(/\.json$/)

    vi.runAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})

// ---------------------------------------------------------------------------
// loadAstFromFile
// ---------------------------------------------------------------------------

describe('loadAstFromFile', () => {
  it('parses a valid ScoreNode from a File blob', async () => {
    const ast = makeScore()
    const json = serializeAst(ast)
    const file = new File([json], 'score.json', { type: 'application/json' })
    const result = await loadAstFromFile(file)
    expect(result).toEqual(ast)
  })

  it('rejects on invalid JSON inside the file', async () => {
    const file = new File(['{bad json'], 'bad.json', { type: 'application/json' })
    await expect(loadAstFromFile(file)).rejects.toThrow(/invalid JSON/i)
  })

  it('rejects when the file contains valid JSON but not a ScoreNode', async () => {
    const file = new File(['{"foo":1}'], 'bad.json', { type: 'application/json' })
    await expect(loadAstFromFile(file)).rejects.toThrow(/not a valid ScoreNode/i)
  })
})
