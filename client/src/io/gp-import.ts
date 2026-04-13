/**
 * Guitar Pro file import.
 *
 * Flow: user uploads .gp/.gp5/.gpx/.gp7 → read bytes → alphaTab ScoreLoader
 * → alphaTab Score → AlphaTexExporter → alphaTex string → our parseScore()
 * → ScoreNode.
 *
 * AlphaTexExporter is confirmed available in @coderline/alphatab 1.8.1
 * (verified via `exporter.AlphaTexExporter.prototype.exportToString`).
 */

import type { ScoreNode } from '../editor/ast/types'
import { parse } from '../editor/ast/parser'

// ---------------------------------------------------------------------------
// Lazy imports — alphaTab is large; only pull it in when actually needed
// ---------------------------------------------------------------------------

async function getAlphaTab() {
  // @coderline/alphatab is always bundled (used by AlphaTabBridge),
  // so this import just resolves from the module cache.
  return import('@coderline/alphatab')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import a Guitar Pro file (.gp, .gp5, .gpx, .gp7).
 *
 * Uses alphaTab's built-in ScoreLoader.loadScoreFromBytes() — which selects
 * the correct importer based on file magic bytes — then exports back to
 * alphaTex via AlphaTexExporter.exportToString(), and finally parses that
 * string into our ScoreNode.
 *
 * Returns the parsed ScoreNode and the raw alphaTex string from the exporter
 * on success. Throws a descriptive Error on failure (unsupported format,
 * corrupt file, etc.).
 */
export async function importGpFile(file: File): Promise<{ scoreNode: ScoreNode; texString: string }> {
  const supported = /\.(gp|gp4|gp5|gpx|gp7)$/i.test(file.name)
  if (!supported) {
    throw new Error(
      `[lava-tab] importGpFile: unsupported file type "${file.name}". ` +
      'Supported formats: .gp, .gp4, .gp5, .gpx, .gp7',
    )
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  const { importer, exporter, model } = await getAlphaTab()

  // loadScoreFromBytes auto-detects format from magic bytes
  let score: InstanceType<typeof model.Score>
  try {
    score = importer.ScoreLoader.loadScoreFromBytes(bytes)
  } catch (err) {
    throw new Error(
      `[lava-tab] importGpFile: alphaTab could not parse "${file.name}" — ` +
      `${(err as Error).message ?? String(err)}`,
    )
  }

  // Export to alphaTex using the built-in exporter (confirmed in 1.8.1)
  let texString: string
  try {
    const exp = new exporter.AlphaTexExporter()
    texString = exp.exportToString(score)
  } catch (err) {
    throw new Error(
      `[lava-tab] importGpFile: AlphaTexExporter failed for "${file.name}" — ` +
      `${(err as Error).message ?? String(err)}`,
    )
  }

  // Parse alphaTex string → our ScoreNode
  const { score: scoreNode, errors } = parse(texString)

  if (errors.length > 0) {
    // Non-fatal parse errors are logged; the caller gets the best-effort AST
    console.warn(
      `[lava-tab] importGpFile: ${errors.length} parse warning(s) for "${file.name}"`,
      errors,
    )
  }

  return { scoreNode, texString }
}
