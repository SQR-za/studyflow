import type { ComponentPropsWithoutRef } from 'react'
import { CodeBlock } from './CodeBlock'
import { MathText } from './MathText'

export type StudyTextVariant = 'inline' | 'question' | 'choice'

export type StudyTextProps = {
  text: string
  variant?: StudyTextVariant
  className?: string
  dir?: 'auto' | 'rtl' | 'ltr'
} & Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'className' | 'dir'>

type StudyTextPart =
  | { kind: 'text'; text: string; offset: number }
  | { kind: 'code'; text: string; offset: number }

const MPI_NAME = /^MPI_[A-Za-z0-9_]+$/
const MPI_CALL = /\bMPI_[A-Za-z0-9_]+\s*\(/
const C_LIBRARY_CALL = /^(?:(?:f|s|sn)?printf|(?:f|s)?scanf|malloc|calloc|realloc|free|memcpy|memmove|memset|strlen|sizeof|pthread_[A-Za-z0-9_]+|omp_[A-Za-z0-9_]+)\s*\(/
const CALL_EXPRESSION = /^[A-Za-z_][A-Za-z0-9_]*(?:\s*(?:\.|->)\s*[A-Za-z_][A-Za-z0-9_]*)?\s*\([\s\S]*\)\s*;?$/

function unwrappedBackticks(text: string): string | null {
  const match = text.match(/^\s*`([^`\r\n]+)`\s*$/)
  return match?.[1] ?? null
}

/** True when a complete answer choice has the shape of C/MPI source code. */
export function looksLikeCodeChoice(text: string): boolean {
  const unwrapped = unwrappedBackticks(text)
  if (unwrapped !== null) return true

  const value = text.trim()
  if (!value) return false
  if (MPI_NAME.test(value)) return true
  if (looksLikeCodeStatement(value)) return true
  if (!CALL_EXPRESSION.test(value)) return false

  // Avoid treating ordinary mathematical forms such as sin(x) as C. Generic
  // calls need either a statement terminator or recognizably C-like arguments.
  return (
    value.endsWith(';') ||
    C_LIBRARY_CALL.test(value) ||
    /(?:&[A-Za-z_]|\*[A-Za-z_]|->|\+\+|--|"[^"\r\n]*"|'[^'\r\n]*')/.test(value)
  )
}

/** True when inline backticks contain a statement worth promoting to a block. */
export function looksLikeCodeStatement(text: string): boolean {
  const value = text.trim()
  if (!value) return false

  return (
    MPI_CALL.test(value) ||
    /[;{}]/.test(value) ||
    /(?:^|\n)\s*#\s*(?:include|define|if|ifdef|ifndef)\b/.test(value) ||
    /(?:^|\n)\s*(?:if|else|for|while|switch)\s*\(/.test(value) ||
    /(?:^|\n)\s*(?:return|break|continue)\b/.test(value) ||
    /(?:^|\n)\s*(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:char|short|int|long|float|double|size_t|void)\b/.test(value)
  )
}

function splitQuestionText(text: string): StudyTextPart[] {
  const parts: StudyTextPart[] = []
  const backticks = /`([^`\r\n]+)`/g
  let plainStart = 0
  let match: RegExpExecArray | null

  while ((match = backticks.exec(text)) !== null) {
    const code = match[1]
    if (!looksLikeCodeStatement(code)) continue

    if (match.index > plainStart) {
      parts.push({ kind: 'text', text: text.slice(plainStart, match.index), offset: plainStart })
    }
    parts.push({ kind: 'code', text: code, offset: match.index })
    const afterCode = match.index + match[0].length
    const redundantSentenceStop = text[afterCode] === '.' && /[;!?]$/.test(code.trim())
    plainStart = afterCode + (redundantSentenceStop ? 1 : 0)
  }

  if (plainStart < text.length) {
    parts.push({ kind: 'text', text: text.slice(plainStart), offset: plainStart })
  }

  return parts
}

/**
 * StudyFlow text with code-aware presentation.
 *
 * - `inline` retains MathText's existing Markdown/LaTeX behavior.
 * - `question` promotes statement-like backtick spans to LTR code blocks.
 * - `choice` presents a complete C/MPI-looking choice as LTR code.
 */
export function StudyText({
  text,
  variant = 'inline',
  className,
  dir = 'auto',
  ...props
}: StudyTextProps) {
  const classes = ['study-text', `study-text--${variant}`, className].filter(Boolean).join(' ')

  if (variant === 'choice' && looksLikeCodeChoice(text)) {
    return (
      <CodeBlock
        {...props}
        text={unwrappedBackticks(text) ?? text}
        variant="choice"
        className={classes}
      />
    )
  }

  if (variant !== 'question') {
    return <MathText {...props} text={text} className={classes} dir={dir} />
  }

  const parts = splitQuestionText(text)
  if (!parts.some((part) => part.kind === 'code')) {
    return <MathText {...props} text={text} className={classes} dir={dir} />
  }

  return (
    <span {...props} className={classes} dir={dir}>
      {parts.map((part) =>
        part.kind === 'code' ? (
          <CodeBlock key={`code-${part.offset}`} text={part.text} />
        ) : (
          <MathText key={`text-${part.offset}`} text={part.text} />
        ),
      )}
    </span>
  )
}
