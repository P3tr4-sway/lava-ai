import { cn } from '@/components/ui/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'code-block'; code: string; language?: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || undefined
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code-block', code: codeLines.join('\n'), language })
      i++ // skip closing ```
      continue
    }

    // Headings — check h3 before h2 before h1 to avoid prefix conflicts
    const h3 = line.match(/^### (.+)/)
    if (h3) { blocks.push({ type: 'h3', text: h3[1] }); i++; continue }

    const h2 = line.match(/^## (.+)/)
    if (h2) { blocks.push({ type: 'h2', text: h2[1] }); i++; continue }

    const h1 = line.match(/^# (.+)/)
    if (h1) { blocks.push({ type: 'h1', text: h1[1] }); i++; continue }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' }); i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', text: line.slice(2) }); i++; continue
    }

    // Bullet list — collect consecutive items
    if (/^[-*+] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, ''))
        i++
      }
      blocks.push({ type: 'bullet-list', items })
      continue
    }

    // Ordered list — collect consecutive items
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    // Skip blank lines
    if (line.trim() === '') { i++; continue }

    // Paragraph — collect until a blank line or block-level element
    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i])
      i++
    }

    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
    }
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Inline renderer — links, **bold**, *italic*, ~~strike~~, `code`
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode {
  // Order matters: links/code/strong before italic to avoid partial matches.
  const regex = /(\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+)\)|`([^`\n]+?)`|\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|\*([^*\n]+?)\*)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2] !== undefined && match[3] !== undefined) {
      parts.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-text-primary underline decoration-border-hover underline-offset-[3px] hover:text-text-secondary"
        >
          {match[2]}
        </a>,
      )
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(
        <code
          key={key++}
          className="font-mono text-[11px] bg-surface-3 border border-border px-[5px] py-px rounded text-text-primary"
        >
          {match[4]}
        </code>,
      )
    } else if (match[5] !== undefined) {
      // **bold**
      parts.push(
        <strong key={key++} className="font-semibold text-text-primary">
          {match[5]}
        </strong>,
      )
    } else if (match[6] !== undefined) {
      // ~~strike~~
      parts.push(
        <span key={key++} className="text-text-secondary line-through decoration-border-hover">
          {match[6]}
        </span>,
      )
    } else if (match[7] !== undefined) {
      // *italic*
      parts.push(
        <em key={key++} className="italic text-text-secondary">
          {match[7]}
        </em>,
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  if (parts.length === 0) return text
  if (parts.length === 1 && typeof parts[0] === 'string') return parts[0]
  return <>{parts}</>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const blocks = parseBlocks(content)

  return (
    <div className={cn('flex flex-col gap-2 text-[15px]', className)}>
      {blocks.map((block, i) => {
        const notFirst = i > 0

        switch (block.type) {
          // ── Headings ────────────────────────────────────────────────────
          case 'h1':
            return (
              <h1
                key={i}
                className={cn(
                  'text-[1.35rem] font-semibold text-text-primary leading-[1.25] tracking-[-0.025em]',
                  notFirst && 'mt-3',
                )}
              >
                {renderInline(block.text)}
              </h1>
            )

          case 'h2':
            return (
              <h2
                key={i}
                className={cn(
                  'text-[1.05rem] font-semibold text-text-primary leading-[1.35] tracking-[-0.015em]',
                  notFirst && 'mt-2.5',
                )}
              >
                {renderInline(block.text)}
              </h2>
            )

          case 'h3':
            return (
              <h3
                key={i}
                className={cn(
                  'text-[0.9rem] font-semibold text-text-secondary leading-[1.45]',
                  notFirst && 'mt-2',
                )}
              >
                {renderInline(block.text)}
              </h3>
            )

          // ── Body ─────────────────────────────────────────────────────────
          case 'paragraph':
            return (
              <p key={i} className="text-[0.95rem] text-text-primary leading-[1.75]">
                {renderInline(block.text)}
              </p>
            )

          // ── Lists ─────────────────────────────────────────────────────────
          case 'bullet-list':
            return (
              <ul key={i} className="flex flex-col gap-2 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[0.95rem] text-text-primary leading-[1.7]">
                    <span className="text-text-muted shrink-0 select-none mt-[2px]">•</span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            )

          case 'ordered-list':
            return (
              <ol key={i} className="flex flex-col gap-2 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[0.95rem] text-text-primary leading-[1.7]">
                    <span className="font-mono text-[11px] text-text-muted shrink-0 select-none mt-[3px] min-w-[18px]">
                      {j + 1}.
                    </span>
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            )

          // ── Code block ───────────────────────────────────────────────────
          case 'code-block':
            return (
              <div key={i} className="rounded-xl border border-border bg-surface-3 overflow-hidden">
                {block.language && (
                  <div className="px-3 py-2 border-b border-border bg-surface-2 text-[11px] font-mono uppercase tracking-[0.12em] text-text-muted">
                    {block.language}
                  </div>
                )}
                <pre className="px-3 py-3 overflow-x-auto">
                  <code className="font-mono text-[12px] text-text-primary leading-[1.7] whitespace-pre">
                    {block.code}
                  </code>
                </pre>
              </div>
            )

          // ── Misc ──────────────────────────────────────────────────────────
          case 'blockquote':
            return (
              <blockquote
                key={i}
                className="border-l-2 border-border-hover bg-surface-2/60 rounded-r-lg pl-4 pr-3 py-2 text-[0.95rem] text-text-secondary leading-[1.7]"
              >
                {renderInline(block.text)}
              </blockquote>
            )

          case 'hr':
            return <hr key={i} className="border-t border-border my-1.5" />

          default:
            return null
        }
      })}
    </div>
  )
}
