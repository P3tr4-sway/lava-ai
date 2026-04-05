import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Download } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/components/ui/utils'
import { generatePracticePackPdf } from '@/services/pdfExportService'

type ExportLayout = 'tab' | 'staff' | 'split'
type PaperSize = 'A4' | 'Letter'

interface ExportPdfDialogProps {
  open: boolean
  onClose: () => void
  packName: string
  defaultLayout: ExportLayout
  keyValue?: string
  tempo?: number
  timeSignature?: string
  tuningLabel?: string
  capo?: number
  sections?: Array<{ label: string; bars: number }>
}

function layoutOptions(): Array<{ value: ExportLayout; label: string }> {
  return [
    { value: 'tab', label: 'Tabs only' },
    { value: 'split', label: 'Staff + Tabs' },
    { value: 'staff', label: 'Lead sheet' },
  ]
}

export function ExportPdfDialog({
  open,
  onClose,
  packName,
  defaultLayout,
  keyValue,
  tempo,
  timeSignature,
  tuningLabel,
  capo = 0,
  sections = [],
}: ExportPdfDialogProps) {
  const [fileName, setFileName] = useState(packName)
  const [layout, setLayout] = useState<ExportLayout>(defaultLayout)
  const [paperSize, setPaperSize] = useState<PaperSize>('A4')
  const [includeChords, setIncludeChords] = useState(true)
  const [includeTempo, setIncludeTempo] = useState(true)
  const [includeCapo, setIncludeCapo] = useState(true)
  const [status, setStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')

  useEffect(() => {
    if (!open) return
    setFileName(packName)
    setLayout(defaultLayout)
    setPaperSize('A4')
    setIncludeChords(true)
    setIncludeTempo(true)
    setIncludeCapo(true)
    setStatus('idle')
    setError(null)
  }, [defaultLayout, open, packName])

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    }
  }, [downloadUrl])

  const normalizedSections = useMemo(
    () => sections.map((section) => ({ label: section.label, bars: section.bars })),
    [sections],
  )

  const handleExport = async () => {
    setStatus('exporting')
    setError(null)

    try {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
      const result = generatePracticePackPdf({
        fileName,
        packName,
        layout,
        paperSize,
        includeChords,
        includeTempo,
        includeCapo,
        key: keyValue,
        tempo,
        timeSignature,
        tuning: tuningLabel,
        capo,
        sections: normalizedSections,
      })
      setDownloadUrl(result.url)
      setDownloadName(result.fileName)
      setStatus('success')
    } catch (exportError) {
      console.error('Could not export PDF', exportError)
      setStatus('error')
      setError("Couldn't export PDF. Try again.")
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export PDF"
      className="max-w-lg rounded-[24px] border border-border bg-surface-0 p-6"
      backdropClassName="bg-black/40"
    >
      <div className="space-y-5">
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">File name</span>
            <input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className="h-11 rounded-2xl border border-border bg-surface-0 px-4 text-sm text-text-primary outline-none transition-colors focus:border-border-hover"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Layout</span>
            <select
              value={layout}
              onChange={(event) => setLayout(event.target.value as ExportLayout)}
              className="h-11 rounded-2xl border border-border bg-surface-0 px-4 text-sm text-text-primary outline-none transition-colors focus:border-border-hover"
            >
              {layoutOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Paper size</span>
            <select
              value={paperSize}
              onChange={(event) => setPaperSize(event.target.value as PaperSize)}
              className="h-11 rounded-2xl border border-border bg-surface-0 px-4 text-sm text-text-primary outline-none transition-colors focus:border-border-hover"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-surface-1 p-4">
          <div className="grid gap-3">
            <Toggle checked={includeChords} onChange={setIncludeChords} label="Include chords" />
            <Toggle checked={includeTempo} onChange={setIncludeTempo} label="Include tempo" />
            <Toggle checked={includeCapo} onChange={setIncludeCapo} label="Include capo" />
          </div>
        </div>

        {status === 'success' && downloadUrl ? (
          <div className="rounded-2xl border border-border bg-surface-1 p-4">
            <p className="text-sm font-medium text-text-primary">PDF ready</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={downloadUrl}
                download={downloadName}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-text-primary px-4 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                <Download className="size-4" />
                Download PDF
              </a>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface-0 px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
              >
                <ExternalLink className="size-4" />
                Open PDF
              </a>
            </div>
          </div>
        ) : null}

        {status === 'error' && error ? (
          <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-text-primary">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-surface-0 px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-1"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={status === 'exporting'}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-full bg-text-primary px-4 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90',
              status === 'exporting' && 'cursor-not-allowed opacity-60',
            )}
          >
            {status === 'exporting' ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
