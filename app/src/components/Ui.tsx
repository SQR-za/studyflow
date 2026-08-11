import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function ScreenHeader({ title, subtitle, onBack, actions }: {
  title: string
  subtitle?: string
  onBack: () => void
  actions?: ReactNode
}) {
  return (
    <header className="screen-header">
      <button className="icon-button" type="button" onClick={onBack} aria-label="رجوع">→</button>
      <div className="screen-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="screen-actions">{actions}</div>
    </header>
  )
}

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet'
}) {
  return <button className={`button button--${variant} ${className}`.trim()} type="button" {...props} />
}

export function ProgressRing({ value, color = '#2dd4bf', size = 48 }: { value: number; color?: string; size?: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <span
      className="progress-ring"
      style={{ '--progress': percent, '--ring-color': color, '--ring-size': `${size}px` } as React.CSSProperties}
      aria-label={`الإتقان ${percent}%`}
    >
      <b>{percent}%</b>
    </span>
  )
}

export function EmptyState({ icon, title, children, action }: {
  icon: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      {children && <div className="muted">{children}</div>}
      {action}
    </section>
  )
}

export function Modal({ title, children, actions, onClose }: {
  title: string
  children: ReactNode
  actions?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </section>
    </div>
  )
}

