import { useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import type { LessonCodeLanguage } from '../types'
import './StudyText.css'

export type CodeBlockVariant = 'statement' | 'choice' | 'lesson'
export type CodeLanguage = LessonCodeLanguage | 'c' | 'code'

export type CodeBlockProps = {
  text: string
  variant?: CodeBlockVariant
  language?: CodeLanguage
  copyable?: boolean
} & Omit<ComponentPropsWithoutRef<'code'>, 'children' | 'dir'>

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Copy command failed')
}

/**
 * Displays trusted or untrusted source text as code without parsing it as HTML.
 *
 * A `code` element is used for both variants so the component remains valid
 * inside the session heading and choice buttons. CSS gives the statement
 * variant its full block presentation.
 */
export function CodeBlock({
  text,
  variant = 'statement',
  language,
  copyable = false,
  className,
  ...props
}: CodeBlockProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const code = (
    <code
      {...props}
      className={['study-code-block', `study-code-block--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      data-language={language ?? 'code'}
      dir="ltr"
    >
      {text}
    </code>
  )

  if (!copyable) return code

  async function handleCopy() {
    try {
      await copyToClipboard(text)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  const copyLabel = copyState === 'copied' ? 'تم النسخ' : copyState === 'error' ? 'تعذّر النسخ' : 'نسخ الكود'
  return (
    <div className="study-code-panel" dir="ltr" role="group" aria-label={`كود ${language ?? ''}`.trim()}>
      <div className="study-code-panel__bar">
        <span>{language ?? 'code'}</span>
        <button type="button" onClick={() => void handleCopy()} aria-label={copyLabel}>
          {copyState === 'copied' ? '✓ ' : ''}{copyLabel}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  )
}
