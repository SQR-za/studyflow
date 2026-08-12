import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, Modal } from './Ui'

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>افتح</button>
      {open ? (
        <Modal title="تأكيد" onClose={() => setOpen(false)} actions={<Button>حفظ</Button>}>
          محتوى النافذة
        </Modal>
      ) : null}
    </>
  )
}

describe('Modal', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.style.overflow = ''
  })

  it('locks scrolling, focuses close, closes with Escape, and restores focus', () => {
    render(<ModalHarness />)
    const opener = screen.getByRole('button', { name: 'افتح' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'تأكيد' })
    expect(document.body).toHaveStyle({ overflow: 'hidden' })
    expect(screen.getByRole('button', { name: 'إغلاق' })).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(opener).toHaveFocus()
  })

  it('keeps inside clicks open and closes from the backdrop', () => {
    render(<ModalHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'افتح' }))
    const dialog = screen.getByRole('dialog', { name: 'تأكيد' })
    fireEvent.pointerDown(dialog)
    expect(dialog).toBeInTheDocument()

    fireEvent.pointerDown(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
