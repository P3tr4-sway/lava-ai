/**
 * MusicXML file import.
 *
 * Reads `.musicxml` (plain XML) and `.mxl` (compressed ZIP) files,
 * then delegates to `parseMusicXmlToScoreDocument()` from scoreDocument.ts.
 */

import type { ScoreDocument } from '@lava/shared'
import { parseMusicXmlToScoreDocument } from '@/lib/scoreDocument'

/**
 * Import a MusicXML file (.musicxml, .mxl, .xml).
 *
 * - `.musicxml` / `.xml`: read as plain text
 * - `.mxl`: decompress as ZIP, extract the first `.xml` entry
 *
 * Returns the parsed ScoreDocument.
 * Throws a descriptive Error on failure.
 */
export async function importMusicXmlFile(file: File): Promise<ScoreDocument> {
  const name = file.name.toLowerCase()

  let xmlString: string

  if (name.endsWith('.mxl')) {
    xmlString = await extractXmlFromMxl(file)
  } else {
    xmlString = await file.text()
  }

  if (!xmlString.trim()) {
    throw new Error(
      `[lava] importMusicXmlFile: "${file.name}" is empty or could not be read.`,
    )
  }

  try {
    return parseMusicXmlToScoreDocument(xmlString)
  } catch (err) {
    throw new Error(
      `[lava] importMusicXmlFile: failed to parse "${file.name}" — ${(err as Error).message ?? String(err)}`,
    )
  }
}

// ---------------------------------------------------------------------------
// MXL (compressed MusicXML) handling
// ---------------------------------------------------------------------------

/**
 * Extract the main XML content from an .mxl (ZIP) file.
 *
 * MXL files are ZIP archives containing a `META-INF/container.xml` that
 * references the main score file, or simply contain a `.xml` file at root.
 * We try the container approach first, then fall back to finding any `.xml`.
 */
async function extractXmlFromMxl(file: File): Promise<string> {
  // Dynamically import fflate for decompression (already used by alphaTab)
  const { unzipSync } = await import('fflate')

  const buffer = await file.arrayBuffer()
  const entries = unzipSync(new Uint8Array(buffer))

  const decoder = new TextDecoder()

  // Try to find the rootfile from META-INF/container.xml
  const containerEntry = entries['META-INF/container.xml']
  if (containerEntry) {
    const containerXml = decoder.decode(containerEntry)
    const rootFileMatch = containerXml.match(/full-path="([^"]+\.xml)"/i)
    if (rootFileMatch) {
      const rootPath = rootFileMatch[1]
      const rootEntry = entries[rootPath]
      if (rootEntry) {
        return decoder.decode(rootEntry)
      }
    }
  }

  // Fallback: find the first .xml file that isn't container.xml
  for (const [path, data] of Object.entries(entries)) {
    if (
      path.toLowerCase().endsWith('.xml') &&
      !path.toLowerCase().includes('meta-inf')
    ) {
      return decoder.decode(data)
    }
  }

  throw new Error(
    `[lava] extractXmlFromMxl: no XML content found inside "${file.name}".`,
  )
}
