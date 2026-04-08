/**
 * Tests for io/gp-import.ts
 *
 * These tests mock the alphaTab module entirely — we are testing our
 * integration logic (file-type guard, error wrapping, parse pipeline),
 * not alphaTab itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nanoid } from 'nanoid'

// ---------------------------------------------------------------------------
// Mock @coderline/alphatab before importing the module under test
// ---------------------------------------------------------------------------

const mockScore = {
  title: 'Mock GP Song',
  tracks: [],
}

const mockTexString = `\\title "Mock GP Song"\n. 5.1 {4} |`

const mockExportToString = vi.fn(() => mockTexString)
const AlphaTexExporterMock = vi.fn(() => ({ exportToString: mockExportToString }))
const loadScoreFromBytesMock = vi.fn(() => mockScore)

vi.mock('@coderline/alphatab', () => ({
  importer: {
    ScoreLoader: {
      loadScoreFromBytes: loadScoreFromBytesMock,
    },
  },
  exporter: {
    AlphaTexExporter: AlphaTexExporterMock,
  },
  model: {},
}))

// Also mock the parser so we control its output precisely
const mockScoreNode = {
  id: nanoid(),
  meta: { title: 'Mock GP Song', tempo: 120 },
  tracks: [],
}

vi.mock('../../editor/ast/parser', () => ({
  parse: vi.fn(() => ({ score: mockScoreNode, errors: [] })),
}))

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

import { importGpFile } from '../gp-import'
import { parse } from '../../editor/ast/parser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, content = new Uint8Array([0x49, 0x44, 0x33])): File {
  return new File([content], name, { type: 'application/octet-stream' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importGpFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportToString.mockReturnValue(mockTexString)
    loadScoreFromBytesMock.mockReturnValue(mockScore)
    ;(parse as ReturnType<typeof vi.fn>).mockReturnValue({ score: mockScoreNode, errors: [] })
  })

  it('returns a ScoreNode for a .gpx file', async () => {
    const file = makeFile('song.gpx')
    const result = await importGpFile(file)
    expect(result).toBe(mockScoreNode)
    expect(loadScoreFromBytesMock).toHaveBeenCalledOnce()
    expect(AlphaTexExporterMock).toHaveBeenCalledOnce()
    expect(mockExportToString).toHaveBeenCalledWith(mockScore)
    expect(parse).toHaveBeenCalledWith(mockTexString)
  })

  it('returns a ScoreNode for a .gp7 file', async () => {
    const file = makeFile('song.gp7')
    const result = await importGpFile(file)
    expect(result).toBe(mockScoreNode)
  })

  it('returns a ScoreNode for a .gp5 file', async () => {
    const file = makeFile('song.gp5')
    const result = await importGpFile(file)
    expect(result).toBe(mockScoreNode)
  })

  it('returns a ScoreNode for a .gp file', async () => {
    const file = makeFile('song.gp')
    const result = await importGpFile(file)
    expect(result).toBe(mockScoreNode)
  })

  it('throws a descriptive error for an unsupported file extension', async () => {
    const file = makeFile('song.mp3')
    await expect(importGpFile(file)).rejects.toThrow(/unsupported file type/i)
    await expect(importGpFile(file)).rejects.toThrow(/song\.mp3/i)
  })

  it('throws a descriptive error for a .xml file', async () => {
    const file = makeFile('score.xml')
    await expect(importGpFile(file)).rejects.toThrow(/unsupported file type/i)
  })

  it('wraps alphaTab ScoreLoader errors with a helpful message', async () => {
    loadScoreFromBytesMock.mockImplementation(() => {
      throw new Error('Unknown binary format')
    })
    const file = makeFile('corrupt.gpx')
    await expect(importGpFile(file)).rejects.toThrow(/alphaTab could not parse/i)
    await expect(importGpFile(file)).rejects.toThrow(/Unknown binary format/i)
  })

  it('wraps AlphaTexExporter errors with a helpful message', async () => {
    loadScoreFromBytesMock.mockReturnValue(mockScore)
    mockExportToString.mockImplementation(() => {
      throw new Error('Exporter internal error')
    })
    const file = makeFile('song.gpx')
    await expect(importGpFile(file)).rejects.toThrow(/AlphaTexExporter failed/i)
    await expect(importGpFile(file)).rejects.toThrow(/Exporter internal error/i)
  })

  it('logs parse warnings and still returns the best-effort AST', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(parse as ReturnType<typeof vi.fn>).mockReturnValue({
      score: mockScoreNode,
      errors: [{ message: 'unknown keyword', line: 1, col: 5 }],
    })

    const file = makeFile('song.gp7')
    const result = await importGpFile(file)

    expect(result).toBe(mockScoreNode)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('1 parse warning'),
      expect.anything(),
    )

    warn.mockRestore()
  })
})
