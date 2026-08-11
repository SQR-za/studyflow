import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Ui'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StudyFlow UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="boot-screen">
        <section className="boot-card">
          <h1>تعذّر فتح هذه الشاشة</h1>
          <p className="muted">تقدمك محفوظ. أعد تحميل الواجهة أو ارجع للنسخة المستقرة.</p>
          <Button onClick={() => window.location.reload()}>إعادة تحميل</Button>
          <details><summary>التفاصيل التقنية</summary><pre dir="ltr">{this.state.error.message}</pre></details>
        </section>
      </main>
    )
  }
}

