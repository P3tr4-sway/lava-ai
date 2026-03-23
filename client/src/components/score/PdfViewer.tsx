import { cn } from '@/components/ui/utils'

interface PdfViewerProps {
  pdfUrl: string
  className?: string
}

export function PdfViewer({ pdfUrl, className }: PdfViewerProps) {
  const src = `${pdfUrl}#toolbar=0&navpanes=0&view=FitH`
  return (
    <div className={cn('h-full overflow-y-auto', className)}>
      <object
        data={src}
        type="application/pdf"
        className="w-full h-[1400px]"
      >
        <iframe
          src={src}
          className="w-full h-[1400px] border-0"
          title="Score"
        />
      </object>
    </div>
  )
}
