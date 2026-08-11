import { describe, expect, it } from 'vitest'
import { mathTextToSafeHtml } from './MathText'

describe('MathText safety and identifiers', () => {
  it('keeps technical identifiers intact', () => {
    const html = mathTextToSafeHtml('`my_rank` and MPI_Comm_rank; x_i')
    expect(html).toContain('<code class="inline-code">my_rank</code>')
    expect(html).toContain('MPI_Comm_rank')
    expect(html).toContain('x<sub>i</sub>')
  })

  it('escapes untrusted markup before formatting', () => {
    const html = mathTextToSafeHtml('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
