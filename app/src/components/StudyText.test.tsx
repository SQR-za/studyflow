import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodeBlock } from './CodeBlock'
import { StudyText, looksLikeCodeChoice } from './StudyText'

describe('StudyText code presentation', () => {
  it('promotes a backtick C/MPI statement in a question to a full LTR block', () => {
    const statement = 'MPI_Isend(&x, ...); x = 99; MPI_Wait(...);'

    render(
      <h1>
        <StudyText
          text={`What can be printed after \`${statement}\` completes?`}
          variant="question"
        />
      </h1>,
    )

    const code = screen.getByText(statement)
    expect(code.tagName).toBe('CODE')
    expect(code).toHaveClass('study-code-block--statement')
    expect(code).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('heading')).toHaveTextContent(
      `What can be printed after ${statement} completes?`,
    )
  })

  it('keeps short backtick identifiers inline', () => {
    const { container } = render(
      <StudyText text="Which call gets `MPI_Comm_rank`?" variant="question" />,
    )

    expect(screen.getByText('MPI_Comm_rank')).toHaveClass('inline-code')
    expect(container.getElementsByClassName('study-code-block')).toHaveLength(0)
  })

  it('does not leave a floating sentence stop after a promoted code statement', () => {
    const { container } = render(
      <h1>
        <StudyText
          text="The program executes `MPI_Isend(&x, ...); x = 99; MPI_Wait(...);`. What is wrong?"
          variant="question"
        />
      </h1>,
    )

    const heading = within(container).getByRole('heading')
    expect(heading).toHaveTextContent(
      'MPI_Isend(&x, ...); x = 99; MPI_Wait(...); What is wrong?',
    )
    expect(heading).not.toHaveTextContent(';. What')
  })

  it.each([
    'MPI_Comm_rank',
    'MPI_Isend(&x, 1, MPI_INT, 1, 0, MPI_COMM_WORLD, &request);',
    'printf("%d\\n", rank);',
  ])('renders a code-looking answer choice as full LTR code: %s', (choice) => {
    const { container } = render(
      <button type="button">
        <StudyText text={choice} variant="choice" />
      </button>,
    )

    const code = within(container).getByText(choice)
    expect(code.tagName).toBe('CODE')
    expect(code).toHaveClass('study-code-block--choice')
    expect(code).toHaveAttribute('dir', 'ltr')
  })

  it('does not mistake prose or a simple math function for C code', () => {
    expect(looksLikeCodeChoice('Runs asynchronously')).toBe(false)
    expect(looksLikeCodeChoice('sin(x)')).toBe(false)

    const { container } = render(
      <StudyText text="Runs asynchronously" variant="choice" />,
    )
    expect(screen.getByText('Runs asynchronously')).toHaveClass('math-text')
    expect(container.getElementsByClassName('study-code-block')).toHaveLength(0)
  })

  it('renders code as text instead of interpreting caller markup', () => {
    const unsafe = 'MPI_Send(<img src=x onerror=alert(1)>);'
    const { container } = render(<CodeBlock text={unsafe} />)

    const code = screen.getByText(unsafe)
    expect(code).toHaveTextContent(unsafe)
    expect(code.children).toHaveLength(0)
    expect(container.getElementsByTagName('img')).toHaveLength(0)
  })
})
