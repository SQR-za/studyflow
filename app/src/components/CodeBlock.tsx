import type { ComponentPropsWithoutRef } from 'react'
import './StudyText.css'

export type CodeBlockVariant = 'statement' | 'choice'

export type CodeBlockProps = {
  text: string
  variant?: CodeBlockVariant
} & Omit<ComponentPropsWithoutRef<'code'>, 'children' | 'dir'>

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
  className,
  ...props
}: CodeBlockProps) {
  return (
    <code
      {...props}
      className={['study-code-block', `study-code-block--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      dir="ltr"
    >
      {text}
    </code>
  )
}
