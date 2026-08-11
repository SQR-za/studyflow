import { useRef, useState } from 'react'
import { Button, ScreenHeader } from '../../components/Ui'
import type { AppSettings, ContentBundle, ProgressStore, Subject, SyncSettings } from '../../types'

interface ProgressBackup {
  store?: ProgressStore
  plan?: Record<string, boolean>
  daily?: { dates: Record<string, number> }
  settings?: Partial<AppSettings>
}

export function SettingsScreen({ data, order, settings, sync, passwordEnabled, syncStatus, onBack, onUpdateSettings, onToggleSubject, onImportContent, onExportContent, onClearContent, onImportProgress, onExportProgress, onSetPassword, onClearPassword, onResetProgress, onEnableSync, onDisableSync, onSyncNow, onTestSync, onDownloadCalendar }: {
  data: Record<string, Subject>
  order: string[]
  settings: AppSettings
  sync: SyncSettings
  passwordEnabled: boolean
  syncStatus: string
  onBack: () => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  onToggleSubject: (code: string) => void
  onImportContent: (content: ContentBundle) => Promise<void> | void
  onExportContent: () => void
  onClearContent: () => void
  onImportProgress: (backup: ProgressBackup) => void
  onExportProgress: () => void
  onSetPassword: (password: string) => void
  onClearPassword: () => void
  onResetProgress: () => void
  onEnableSync: (token: string) => Promise<void>
  onDisableSync: () => void
  onSyncNow: () => Promise<void>
  onTestSync: (token: string) => Promise<void>
  onDownloadCalendar: (time: string) => void
}) {
  const [token, setToken] = useState(sync.token)
  const [password, setPassword] = useState('')
  const [calendarTime, setCalendarTime] = useState('19:00')
  const [busy, setBusy] = useState(false)
  const contentInput = useRef<HTMLInputElement>(null)
  const progressInput = useRef<HTMLInputElement>(null)

  async function readFile<T>(file: File | undefined): Promise<T | null> {
    if (!file) return null
    try { return JSON.parse(await file.text()) as T } catch { window.alert('ملف JSON غير صالح'); return null }
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    try { await task() } finally { setBusy(false) }
  }

  return (
    <main className="screen settings-screen">
      <ScreenHeader title="⚙️ الإعدادات" onBack={onBack} />

      <section className="settings-section">
        <h2>📚 المحتوى الدراسي</h2>
        <p>حزمتا الاختبارات مدمجتان تلقائيًا. أي محتوى إضافي تستورده يبقى في هذا المتصفح.</p>
        <div className="settings-actions">
          <Button onClick={() => { if (contentInput.current) { contentInput.current.value = ''; contentInput.current.click() } }}>⬆ استورد المحتوى</Button>
          <Button variant="secondary" onClick={onExportContent}>⬇ صدّر المحتوى</Button>
          <Button variant="danger" onClick={() => window.confirm('إزالة المحتوى المخصص؟ سيبقى تقدمك والحزمتان المدمجتان.') && onClearContent()}>إزالة المحتوى الخاص</Button>
        </div>
        <input ref={contentInput} hidden type="file" accept=".json,application/json" onChange={async event => { const value = await readFile<ContentBundle>(event.target.files?.[0]); if (value) await onImportContent(value) }} />
      </section>

      <section className="settings-section">
        <h2>🎯 الهدف والجلسة</h2>
        <div className="settings-row"><label htmlFor="goal">الهدف اليومي</label><input id="goal" type="number" min="5" step="5" value={settings.goal} onChange={event => onUpdateSettings({ goal: Math.max(5, Number(event.target.value) || 5) })} /><span>سؤال</span></div>
        <div className="settings-row"><label htmlFor="duration">مدة الجلسة</label><input id="duration" type="number" min="5" max="120" step="5" value={settings.sessionMins} onChange={event => onUpdateSettings({ sessionMins: Math.max(5, Math.min(120, Number(event.target.value) || 20)) })} /><span>دقيقة</span></div>
        <Toggle label="ملء الشاشة أثناء الجلسة" checked={settings.fullscreen} onChange={value => onUpdateSettings({ fullscreen: value })} />
        <Toggle label="صوت عند الإجابة" checked={settings.sound} onChange={value => onUpdateSettings({ sound: value })} />
        <Toggle label="إظهار الأسئلة الإضافية" checked={settings.includeExtra} onChange={value => onUpdateSettings({ includeExtra: value })} />
      </section>

      <section className="settings-section">
        <h2>👁 المواد الظاهرة</h2>
        <p>إخفاء المادة لا يحذف بياناتها أو تقدمك.</p>
        <div className="subject-toggles">{order.map(code => <button type="button" key={code} className={settings.hidden.includes(code) ? '' : 'selected'} onClick={() => onToggleSubject(code)}>{data[code]?.name ?? code}</button>)}</div>
      </section>

      <section className="settings-section">
        <h2>🔔 التقويم</h2>
        <div className="settings-row"><label htmlFor="calendar-time">وقت المذاكرة</label><input id="calendar-time" type="time" value={calendarTime} onChange={event => setCalendarTime(event.target.value)} /><Button variant="secondary" onClick={() => onDownloadCalendar(calendarTime)}>⬇ نزّل التقويم</Button></div>
      </section>

      <section className="settings-section">
        <h2>🔄 المزامنة المشفرة عبر GitHub Gist</h2>
        <p>التوكن يبقى محليًا في جهازك، ويُستخدم لتشفير ملف تقدمك قبل رفعه إلى Gist خاص.</p>
        <div className="settings-row settings-row--token"><input aria-label="GitHub gist token" type="password" value={token} onChange={event => setToken(event.target.value)} placeholder="Classic token بصلاحية gist" /><Button disabled={busy || !token.trim()} onClick={() => run(() => onEnableSync(token.trim()))}>تفعيل</Button></div>
        <div className="settings-actions"><Button variant="secondary" disabled={busy || !token.trim()} onClick={() => run(() => onTestSync(token.trim()))}>🔌 اختبر الاتصال</Button><Button variant="secondary" disabled={busy || !sync.enabled} onClick={() => run(onSyncNow)}>⟳ زامن الآن</Button><Button variant="danger" disabled={busy || !sync.enabled} onClick={onDisableSync}>إيقاف</Button></div>
        <div className={`sync-status ${syncStatus.includes('فشل') || syncStatus.includes('تعذّر') ? 'bad' : syncStatus.includes('✓') ? 'good' : ''}`}>الحالة: {busy ? 'جارٍ…' : syncStatus}</div>
      </section>

      <section className="settings-section">
        <h2>💾 النسخة الاحتياطية</h2>
        <div className="settings-actions"><Button onClick={onExportProgress}>⬇ نزّل نسخة</Button><Button variant="secondary" onClick={() => { if (progressInput.current) { progressInput.current.value = ''; progressInput.current.click() } }}>⬆ استرجع</Button></div>
        <input ref={progressInput} hidden type="file" accept=".json,application/json" onChange={async event => { const value = await readFile<ProgressBackup>(event.target.files?.[0]); if (value) onImportProgress(value) }} />
      </section>

      <section className="settings-section">
        <h2>🔒 قفل محلي</h2>
        <p>الحالة: {passwordEnabled ? 'مفعّل ✓' : 'مطفأ'}. هذا قفل واجهة على هذا الجهاز، وليس حساب مستخدم.</p>
        <div className="settings-row"><input aria-label="رمز القفل" type="password" inputMode="numeric" value={password} onChange={event => setPassword(event.target.value)} placeholder="رمز" /><Button disabled={!password.trim()} onClick={() => { onSetPassword(password.trim()); setPassword('') }}>حفظ</Button><Button variant="danger" disabled={!passwordEnabled} onClick={onClearPassword}>إزالة</Button></div>
      </section>

      <section className="settings-section settings-section--danger">
        <h2>↺ تصفير التقدم</h2>
        <Button variant="danger" onClick={() => window.confirm('تصفير تقدم الأسئلة والعداد اليومي؟ لا يمكن التراجع إلا من نسخة احتياطية.') && onResetProgress()}>تصفير التقدم</Button>
      </section>
    </main>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="settings-row"><span>{label}</span><button type="button" className={`toggle-switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><i /></button></div>
}
