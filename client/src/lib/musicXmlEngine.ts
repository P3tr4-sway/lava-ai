const parser = new DOMParser()
const serializer = new XMLSerializer()

export function parseXml(xml: string): Document {
  const doc = parser.parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error(`MusicXML parse error: ${err.textContent}`)
  return doc
}

export function serializeXml(doc: Document): string {
  return serializer.serializeToString(doc)
}

export function getMeasures(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('part > measure'))
}

function renumberMeasures(doc: Document): void {
  getMeasures(doc).forEach((m, i) => m.setAttribute('number', String(i + 1)))
}

function createRestMeasure(doc: Document, divisions: number, beats: number): Element {
  const m = doc.createElement('measure')
  m.setAttribute('number', '0') // will be renumbered
  const note = doc.createElement('note')
  const rest = doc.createElement('rest')
  const dur = doc.createElement('duration')
  dur.textContent = String(divisions * beats)
  const type = doc.createElement('type')
  type.textContent = 'whole'
  note.appendChild(rest)
  note.appendChild(dur)
  note.appendChild(type)
  m.appendChild(note)
  return m
}

function getTimeInfo(doc: Document): { divisions: number; beats: number } {
  const divEl = doc.querySelector('attributes > divisions')
  const beatsEl = doc.querySelector('time > beats')
  return {
    divisions: divEl ? parseInt(divEl.textContent || '1', 10) : 1,
    beats: beatsEl ? parseInt(beatsEl.textContent || '4', 10) : 4,
  }
}

export function addBars(xml: string, afterIndex: number, count: number): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions, beats } = getTimeInfo(doc)
  const ref = measures[afterIndex]
  const parent = ref.parentNode!

  for (let i = 0; i < count; i++) {
    const newMeasure = createRestMeasure(doc, divisions, beats)
    parent.insertBefore(newMeasure, ref.nextSibling)
  }

  renumberMeasures(doc)
  return serializeXml(doc)
}

export function deleteBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  // Sort descending so removal doesn't shift indices
  const sorted = [...barIndices].sort((a, b) => b - a)
  for (const idx of sorted) {
    if (idx >= 0 && idx < measures.length) {
      measures[idx].parentNode!.removeChild(measures[idx])
    }
  }
  renumberMeasures(doc)
  return serializeXml(doc)
}

export function clearBars(xml: string, barIndices: number[]): string {
  const doc = parseXml(xml)
  const measures = getMeasures(doc)
  const { divisions, beats } = getTimeInfo(doc)

  for (const idx of barIndices) {
    const m = measures[idx]
    if (!m) continue
    // Remove all note, forward, backup, harmony, direction elements
    const toRemove = m.querySelectorAll('note, forward, backup, harmony, direction')
    toRemove.forEach((el) => el.parentNode!.removeChild(el))
    // Add whole rest
    const note = doc.createElement('note')
    const rest = doc.createElement('rest')
    const dur = doc.createElement('duration')
    dur.textContent = String(divisions * beats)
    const type = doc.createElement('type')
    type.textContent = 'whole'
    note.appendChild(rest)
    note.appendChild(dur)
    note.appendChild(type)
    m.appendChild(note)
  }

  return serializeXml(doc)
}
