type ExportLayout = 'tab' | 'staff' | 'split'
type PaperSize = 'A4' | 'Letter'

export interface PracticePackPdfOptions {
  fileName: string
  packName: string
  layout: ExportLayout
  paperSize: PaperSize
  includeChords: boolean
  includeTempo: boolean
  includeCapo: boolean
  key?: string
  tempo?: number
  timeSignature?: string
  tuning?: string
  capo?: number
  sections?: Array<{ label: string; bars: number }>
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim() || 'practice-pack'
  return trimmed.replace(/[\\/:*?"<>|]+/g, '-')
}

function layoutLabel(layout: ExportLayout) {
  switch (layout) {
    case 'staff':
      return 'Lead sheet'
    case 'split':
      return 'Staff + Tabs'
    case 'tab':
    default:
      return 'Tabs only'
  }
}

function pageDimensions(size: PaperSize) {
  return size === 'Letter'
    ? { width: 612, height: 792 }
    : { width: 595, height: 842 }
}

function buildLines(options: PracticePackPdfOptions) {
  const lines = [
    options.packName || 'Practice Pack',
    '',
    `Layout: ${layoutLabel(options.layout)}`,
  ]

  if (options.key) lines.push(`Key: ${options.key}`)
  if (options.timeSignature) lines.push(`Meter: ${options.timeSignature}`)
  if (options.includeTempo && options.tempo) lines.push(`Tempo: ${options.tempo} BPM`)
  if (options.tuning) lines.push(`Tuning: ${options.tuning}`)
  if (options.includeCapo) lines.push(`Capo: ${options.capo ?? 0}`)
  if (options.includeChords) lines.push('Chords: Included')

  if (options.sections && options.sections.length > 0) {
    lines.push('')
    lines.push('Sections')
    options.sections.forEach((section) => {
      lines.push(`${section.label} - ${section.bars} bars`)
    })
  }

  return lines
}

export function generatePracticePackPdf(options: PracticePackPdfOptions) {
  const lines = buildLines(options)
  const { width, height } = pageDimensions(options.paperSize)
  const startY = height - 56
  const lineHeight = 18
  const contentLines = ['BT', '/F1 12 Tf', `48 ${startY} Td`]

  lines.forEach((line, index) => {
    if (index > 0) contentLines.push(`0 -${lineHeight} Td`)
    contentLines.push(`(${escapePdfText(line)}) Tj`)
  })

  contentLines.push('ET')
  const contentStream = contentLines.join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj`,
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object) => {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const blob = new Blob([pdf], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  return {
    blob,
    url,
    fileName: `${sanitizeFileName(options.fileName)}.pdf`,
  }
}
