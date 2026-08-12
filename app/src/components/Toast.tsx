import { useEffect, useState } from 'react'

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 2_580)
    const doneTimer = window.setTimeout(onDone, 2_800)
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(doneTimer)
    }
  }, [message, onDone])

  return <div className={`toast ${leaving ? 'is-leaving' : ''}`} role="status">{message}</div>
}
