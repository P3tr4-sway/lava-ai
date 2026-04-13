/**
 * Unified file import utilities.
 *
 * Classifies uploaded files by type and extracts draft metadata from
 * Guitar Pro and MusicXML files for auto-populating the NewPackDialog.
 */

import type { ScoreDocument } from '@lava/shared'
import type { ScoreNode } from '../editor/ast/types'
import type { NewPackDraft, NewPackTuningId } from '../spaces/pack/newPack'
import { NEW_PACK_TUNINGS } from '../spaces/pack/newPack'
import { importGpFile } from './gp-import'
import { importMusicXmlFile } from './musicxml-import'

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

export type ImportFileType = 'gp' | 'musicxml' | 'audio' | 'pdf-image'

const GP_EXTENSIONS = /\.(gp|gp4|gp5|gpx|gp7)$/i
const MUSICXML_EXTENSIONS = /\.(musicxml|mxl|xml)$/i
const PDF_IMAGE_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|bmp|webp|tiff?)$/i

export function classifyImportFile(file: File): ImportFileType {
  const name = file.name.toLowerCase()
  if (GP_EXTENSIONS.test(name)) return 'gp'
  if (MUSICXML_EXTENSIONS.test(name)) return 'musicxml'
  if (file.type.startsWith('audio/')) return 'audio'
  if (PDF_IMAGE_EXTENSIONS.test(name) || file.type.startsWith('image/')) return 'pdf-image'
  // Default to audio for unknown types
  return 'audio'
}

// ---------------------------------------------------------------------------
// Tuning matching
// ---------------------------------------------------------------------------

function matchTuningId(midi: number[]): NewPackTuningId {
  if (midi.length === 0) return 'standard'

  // Sort both tuning arrays descending (high string to low) for comparison
  const sorted = [...midi].sort((a, b) => b - a)

  let bestMatch: NewPackTuningId = 'standard'
  let bestDistance = Infinity

  for (const entry of NEW_PACK_TUNINGS) {
    const refSorted = [...entry.midi].sort((a, b) => b - a)
    const len = Math.min(sorted.length, refSorted.length)
    let distance = 0
    for (let i = 0; i < len; i++) {
      distance += Math.abs(sorted[i] - refSorted[i])
    }
    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = entry.id
    }
  }

  return bestMatch
}

// ---------------------------------------------------------------------------
// Extract draft from Guitar Pro file
// ---------------------------------------------------------------------------

export interface GpImportResult {
  draft: Partial<NewPackDraft>
  scoreNode: ScoreNode
  texString: string
}

export async function extractDraftFromGpFile(file: File): Promise<GpImportResult> {
  const { scoreNode, texString } = await importGpFile(file)
  const draft: Partial<NewPackDraft> = {}

  // Name from file
  draft.name = scoreNode.meta.title || file.name.replace(/\.[^.]+$/, '')

  // Tempo
  if (scoreNode.meta.tempo) {
    draft.tempo = scoreNode.meta.tempo
  }

  // Track info (first track)
  const track = scoreNode.tracks[0]
  if (track) {
    // Tuning
    if (track.tuning.length > 0) {
      draft.tuning = matchTuningId(track.tuning)
    }
    // Capo
    if (track.capo > 0) {
      draft.capo = track.capo
    }
  }

  // Count bars from first track's first staff
  const staff = track?.staves[0]
  if (staff && staff.bars.length > 0) {
    draft.bars = staff.bars.length
  }

  return { draft, scoreNode, texString }
}

// ---------------------------------------------------------------------------
// Extract draft from MusicXML file
// ---------------------------------------------------------------------------

export interface MusicXmlImportResult {
  draft: Partial<NewPackDraft>
  scoreDocument: ScoreDocument
  xmlString: string
}

export async function extractDraftFromMusicXmlFile(file: File): Promise<MusicXmlImportResult> {
  const { scoreDocument, xmlString } = await importMusicXmlFile(file)
  const draft: Partial<NewPackDraft> = {}

  // Name
  draft.name = scoreDocument.title || file.name.replace(/\.[^.]+$/, '')

  // Tempo
  if (scoreDocument.tempo) {
    draft.tempo = Math.round(scoreDocument.tempo)
  }

  // Key
  if (scoreDocument.keySignature?.key) {
    draft.key = scoreDocument.keySignature.key
  }

  // Time signature
  if (scoreDocument.meter) {
    draft.timeSignature = `${scoreDocument.meter.numerator}/${scoreDocument.meter.denominator}`
  }

  // Bars
  if (scoreDocument.measures.length > 0) {
    draft.bars = scoreDocument.measures.length
  }

  // Tuning from first track
  const track = scoreDocument.tracks[0]
  if (track?.tuning?.length > 0) {
    draft.tuning = matchTuningId(track.tuning)
  }

  // Capo
  if (track?.capo && track.capo > 0) {
    draft.capo = track.capo
  }

  return { draft, scoreDocument, xmlString }
}
