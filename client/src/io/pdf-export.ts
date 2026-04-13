/**
 * PDF export via browser print dialog.
 *
 * Collects alphaTab's rendered SVG pages (rendered inside the container element)
 * and triggers window.print() with print-specific CSS.
 *
 * TODO(phase10): Replace window.print() with jsPDF for programmatic PDF
 * generation. jsPDF can be integrated by:
 *   1. `pnpm add jspdf svg2pdf.js` in the client workspace
 *   2. Iterating over `containerEl.querySelectorAll('svg.at-surface-svg')`
 *   3. Using `svg2pdf(svgEl, doc, { x, y, width, height })` for each page
 *   4. Calling `doc.save(filename)` to download
 */

// ---------------------------------------------------------------------------
// Print CSS injected at call time (removed afterwards)
// ---------------------------------------------------------------------------

const PRINT_STYLE_ID = 'lava-tab-print-style'

function injectPrintStyle(containerSelector: string): void {
  // Remove any existing style from a previous call
  document.getElementById(PRINT_STYLE_ID)?.remove()

  const style = document.createElement('style')
  style.id = PRINT_STYLE_ID
  style.textContent = `
@media print {
  body > *:not(#lava-print-root) {
    display: none !important;
  }
  #lava-print-root {
    display: block !important;
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: white;
    overflow: visible;
  }
  ${containerSelector} {
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
  }
}
`
  document.head.appendChild(style)
}

function removePrintStyle(): void {
  document.getElementById(PRINT_STYLE_ID)?.remove()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export the current score as a PDF.
 *
 * Implementation: wraps the container element in a temporary print root div,
 * injects print CSS to hide all other page content, triggers window.print(),
 * then cleans up.
 *
 * The browser's native print dialog lets the user save to PDF on all modern
 * browsers (Chrome, Firefox, Safari, Edge).
 *
 * TODO(phase10): Integrate jsPDF + svg2pdf.js for programmatic PDF generation
 * without the print dialog (see file-level comment).
 *
 * @param containerEl - The element containing the alphaTab SVG render output
 * @param filename    - Suggested filename (currently unused with window.print approach;
 *                      will be used when jsPDF integration lands)
 */
export async function exportPdf(containerEl: HTMLElement, filename?: string): Promise<void> {
  // Create a stable print root element
  const printRoot = document.createElement('div')
  printRoot.id = 'lava-print-root'
  printRoot.style.display = 'none'

  // Clone the rendered SVG content
  const clone = containerEl.cloneNode(true) as HTMLElement
  printRoot.appendChild(clone)
  document.body.appendChild(printRoot)

  // Give the clone a unique selector for the CSS
  const containerClass = 'lava-print-container'
  clone.classList.add(containerClass)

  injectPrintStyle(`.${containerClass}`)

  // Small delay to ensure styles are applied before the print dialog opens
  await new Promise<void>((resolve) => setTimeout(resolve, 50))

  try {
    window.print()
  } finally {
    // Clean up regardless of whether print succeeds
    document.body.removeChild(printRoot)
    removePrintStyle()
  }

  // Suppress unused-variable warning for filename (will be used in jsPDF phase)
  void filename
}
