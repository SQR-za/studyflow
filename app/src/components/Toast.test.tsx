import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './Toast'

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('announces the message, animates out, then completes once', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Toast message="تم الحفظ" onDone={onDone} />)

    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('تم الحفظ')
    expect(toast).not.toHaveClass('is-leaving')

    act(() => vi.advanceTimersByTime(2_580))
    expect(toast).toHaveClass('is-leaving')
    expect(onDone).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(220))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancels pending timers when unmounted', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const view = render(<Toast message="رسالة" onDone={onDone} />)
    view.unmount()
    act(() => vi.runAllTimers())
    expect(onDone).not.toHaveBeenCalled()
  })
})
