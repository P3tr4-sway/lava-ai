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

import { nanoid } from 'nanoid'
import type { ScoreNode } from '../editor/ast/types'
import { parse } from '../editor/ast/parser'
import {
  barCapacityUnits,
  durationToUnits,
  getEffectiveTimeSig,
  makeBarBeats,
  voiceUsedUnits,
} from '../editor/ast/barFill'

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
 * Returns the parsed ScoreNode on success.
 * Throws a descriptive Error on failure (unsupported format, corrupt file, etc.).
 */
export async function importGpFile(file: File): Promise<ScoreNode> {
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

  // ── DIAGNOSTIC: stash raw alphaTex + parsed AST on window for inspection ──
  if (typeof window !== 'undefined') {
    ;(window as unknown as Record<string, unknown>).__gpImportTex = texString
    ;(window as unknown as Record<string, unknown>).__gpImportParsed = scoreNode
    ;(window as unknown as Record<string, unknown>).__gpImportErrors = errors
  }
  console.group(`[lava-tab] gp-import diagnostics — "${file.name}"`)
  console.log('alphaTex (first 1500 chars):\n' + texString.slice(0, 1500))
  console.log('total alphaTex length:', texString.length)
  const track0 = scoreNode.tracks[0]
  const bars0 = track0?.staves[0]?.bars ?? []
  console.log('parsed tracks:', scoreNode.tracks.length, 'bars on track 0:', bars0.length)
  let notesInParse = 0
  for (const bar of bars0) {
    for (const v of bar.voices) for (const bt of v.beats) notesInParse += bt.notes.length
  }
  console.log('total parsed notes:', notesInParse)
  console.log('parse errors:', errors)
  console.groupEnd()
  // ──────────────────────────────────────────────────────────────────────────

  if (errors.length > 0) {
    // Non-fatal parse errors are logged; the caller gets the best-effort AST
    console.warn(
      `[lava-tab] importGpFile: ${errors.length} parse warning(s) for "${file.name}"`,
      errors,
    )
  }

  // Defensive post-parse fixup: AlphaTexExporter may omit \ts directives for
  // bars where the time signature matches the previous bar.  If so, our parser
  // leaves bar.timeSignature undefined, causing getEffectiveTimeSig() to fall
  // back to 4/4 for all capacity calculations.  We patch the AST here by
  // reading the authoritative time signatures from alphaTab's Score.masterBars.
  type AtMasterBar = { timeSignatureNumerator: number; timeSignatureDenominator: number }
  const masterBars = (score as unknown as { masterBars?: AtMasterBar[] }).masterBars ?? []
  if (masterBars.length > 0) {
    let prevNumerator = 4
    let prevDenominator = 4
    for (let i = 0; i < masterBars.length; i++) {
      const mb = masterBars[i]
      if (!mb) continue
      const num = mb.timeSignatureNumerator ?? prevNumerator
      const den = mb.timeSignatureDenominator ?? prevDenominator
      const changed = i === 0
        ? (num !== 4 || den !== 4)          // bar 0 differs from implicit default
        : (num !== prevNumerator || den !== prevDenominator)  // mid-piece change
      if (changed) {
        for (const track of scoreNode.tracks) {
          const bar = track.staves[0]?.bars[i]
          if (bar && !bar.timeSignature) {
            bar.timeSignature = { numerator: num, denominator: den }
          }
        }
      }
      prevNumerator = num
      prevDenominator = den
    }
  }

  // Second pass: normalize beats for every bar.
  // AlphaTexExporter pads 3/4 bars with an extra quarter rest to reach 4/4
  // capacity.  We correct this in two ways:
  //   1. All-rest voices with wrong total → rebuild with makeBarBeats.
  //   2. Voices with notes that exceed capacity → trim trailing rests until
  //      the bar fits, then drop any remaining overflow beats (last resort).
  for (let t = 0; t < scoreNode.tracks.length; t++) {
    const bars = scoreNode.tracks[t]?.staves[0]?.bars ?? []
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]
      if (!bar) continue
      const ts = getEffectiveTimeSig(scoreNode, t, i)
      const capacity = barCapacityUnits(ts)
      for (const voice of bar.voices) {
        const used = voiceUsedUnits(voice)
        if (used === capacity) continue  // already correct

        const hasNotes = voice.beats.some(b => !b.rest && b.notes.length > 0)
        if (!hasNotes) {
          // Pure rest bar with wrong duration — rebuild canonically
          voice.beats = makeBarBeats(ts, nanoid)
          continue
        }

        if (used > capacity) {
          // Overfull: trim trailing rests until we fit (or exhaust beats)
          let total = used
          while (voice.beats.length > 0 && total > capacity) {
            const last = voice.beats[voice.beats.length - 1]!
            if (last.rest) {
              total -= durationToUnits(last.duration)
              voice.beats.pop()
            } else {
              // Last beat is a note beat — can't safely trim further; stop
              break
            }
          }
        }
      }
    }
  }

  return scoreNode
}
