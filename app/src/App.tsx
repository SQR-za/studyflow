import { Activity, useCallback, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Button } from './components/Ui'
import { Toast } from './components/Toast'
import { HomeScreen, type StartRequest } from './features/home/HomeScreen'
import { MockScreen, type MockResultPayload } from './features/mock/MockScreen'
import { NotesScreen } from './features/notes/NotesScreen'
import { PlanScreen } from './features/plan/PlanScreen'
import { SearchScreen } from './features/search/SearchScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { WeakScreen } from './features/weak/WeakScreen'
import { SessionScreen, type SessionSummary } from './features/session'
import { createDailyStore, createProgressStore, incrementDaily, recordAnswer, setStarred, setTestResult } from './lib/progress'
import { chapterById, dueQuestions, isWeak, starredQuestions, visibleLessonQuestions, visibleQuestions } from './lib/stats'
import { APP_BUILD, STORAGE_KEYS } from './lib/constants'
import { downloadJson } from './lib/storage'
import { isChoice, shuffle, subjectShortName } from './lib/utils'
import { useApp } from './state/AppContext'
import type { ChoiceQuestion, DrillPreset, Lesson, NotesBlock, Screen, SessionMeta, StudyQuestion } from './types'

interface SessionLaunch {
  items: StudyQuestion[]
  meta: SessionMeta
}

export function App() {
  const app = useApp()
  const [screen, setScreen] = useState<Screen>('home')
  const [notes, setNotes] = useState<{ notes?: NotesBlock | null; title: string; returnTo: Screen }>({ title: '', returnTo: 'home' })
  const [session, setSession] = useState<SessionLaunch | null>(null)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastIdRef = useRef(0)
  const [passwordVersion, setPasswordVersion] = useState(0)
  const [unlocked, setUnlocked] = useState(() => !localStorage.getItem(STORAGE_KEYS.password))

  const passwordEnabled = useMemo(() => {
    void passwordVersion
    return Boolean(localStorage.getItem(STORAGE_KEYS.password))
  }, [passwordVersion])

  const notify = useCallback((message: string) => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, message })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  function transitionTo(next: Screen, update?: () => void) {
    const apply = () => {
      update?.()
      setScreen(next)
    }
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || typeof document.startViewTransition !== 'function') {
      apply()
      return
    }
    const transition = document.startViewTransition(() => flushSync(apply))
    void transition.finished.catch(() => undefined)
  }

  function openNotes(nextNotes: NotesBlock | undefined | null, title: string) {
    transitionTo('notes', () => setNotes({ notes: nextNotes, title, returnTo: screen === 'session' ? 'session' : 'home' }))
  }

  function launch(items: StudyQuestion[], meta: SessionMeta) {
    if (!items.length) { notify(meta.mode === 'review' ? 'لا توجد أخطاء في هذا القسم 👏' : 'لا توجد أسئلة في هذا الاختيار'); return }
    transitionTo('session', () => setSession({ items, meta }))
  }

  function start(request: StartRequest) {
    const subject = app.data[request.code]
    if (!subject) return
    let items: StudyQuestion[] = []
    let label = ''
    let lesson: Lesson | null = null
    if (request.scope === '__ALL__') {
      items = subject.chapters.flatMap(chapter => [...visibleQuestions(chapter, app.settings.includeExtra), ...(chapter.practice ?? [])])
      label = 'كل الفصول'
    } else if (request.scope === '__LESSONS__' && request.lessonIds?.size) {
      const selected = subject.chapters.flatMap(chapter => chapter.lessons ?? []).filter(item => request.lessonIds?.has(item.id))
      lesson = selected.length === 1 ? selected[0] : null
      items = selected.flatMap(item => visibleLessonQuestions(item, app.settings.includeExtra))
      label = selected.length === 1 ? selected[0].label : `${selected.length} أقسام مختارة`
    } else {
      const chapter = chapterById(app.data, request.code, request.scope)
      if (!chapter) return
      label = chapter.label
      items = request.mode === 'practice' ? [...(chapter.practice ?? [])] : [...visibleQuestions(chapter, app.settings.includeExtra), ...(chapter.practice ?? [])]
    }
    if (request.mode === 'review') items = items.filter(item => isWeak(app.store, item.id))
    launch(items, { code: request.code, scope: request.scope, mode: request.mode, color: subject.color, subject: subjectShortName(subject.name), label, lesson })
  }

  function startStarred() {
    launch(starredQuestions(app.data, app.order, app.store, app.settings.includeExtra), { code: null, scope: '__STAR__', mode: 'star', color: '#fcd34d', subject: 'المميزة ⭐', label: '' })
  }

  function startDue() {
    launch(dueQuestions(app.data, app.order, app.store, app.settings.includeExtra), { code: null, scope: '__DUE__', mode: 'due', color: '#a78bfa', subject: 'مراجعة اليوم 🔁', label: '' })
  }

  function startLessonTest(code: string, lesson: Lesson) {
    const subject = app.data[code]
    if (!subject) return
    launch([...lesson.questions], {
      code,
      scope: '__LESSON_TEST__',
      mode: 'test',
      color: subject.color,
      subject: subjectShortName(subject.name),
      label: `اختبار القسم · ${lesson.label}`,
      lesson,
    })
  }

  function startLessonQuickTest(code: string, lesson: Lesson, preset: DrillPreset) {
    const subject = app.data[code]
    const quickQuestions = preset.questions?.length
      ? [...preset.questions]
      : shuffle(lesson.questions).slice(0, Math.min(preset.count ?? 4, lesson.questions.length))
    if (!subject || !quickQuestions.length) return
    const quickLesson: Lesson = {
      id: preset.id,
      label: preset.label,
      questions: quickQuestions,
    }
    launch(quickQuestions, {
      code,
      scope: '__LESSON_QUICK_TEST__',
      mode: 'test',
      color: subject.color,
      subject: subjectShortName(subject.name),
      label: `فحص سريع · ${lesson.label}`,
      lesson: quickLesson,
    })
  }

  function completeSession(summary: SessionSummary) {
    const currentSession = session
    if (currentSession?.meta.mode === 'test' && currentSession.meta.code && currentSession.meta.lesson) {
      const at = new Date().toISOString()
      const test = { at, pct: summary.accuracy, correct: summary.good, total: summary.totalUnique }
      const lessonId = currentSession.meta.lesson.id
      app.updateStore(current => {
        const next = setTestResult(current, lessonId, test)
        return {
          ...next,
          attempts: [{
            id: `section-test-${Date.now()}`,
            at,
            code: currentSession.meta.code,
            label: currentSession.meta.label,
            pct: summary.accuracy,
            correct: summary.good,
            total: summary.totalUnique,
            lessonIds: [lessonId],
          }, ...next.attempts].slice(0, 100),
        }
      })
      notify(`⚡ انتهى اختبار القسم · ${summary.good}/${summary.totalUnique}`)
      return
    }
    notify(`🎉 انتهت الجلسة · ${summary.good} صحيحة`)
  }

  function recordMock(result: MockResultPayload) {
    const at = new Date().toISOString()
    app.updateStore(current => {
      let next = current
      for (const item of result.items) next = recordAnswer(next, item.question.id, item.pick === item.correct).store
      const test = { at, pct: result.percent, correct: result.correct, total: result.items.length }
      for (const lessonId of result.lessonIds) next = setTestResult(next, lessonId, test)
      return {
        ...next,
        attempts: [{ id: `mock-${Date.now()}`, at, code: result.code, label: result.label, pct: result.percent, correct: result.correct, total: result.items.length, lessonIds: result.lessonIds, presetId: result.presetId }, ...next.attempts].slice(0, 100),
      }
    })
    app.setDaily(current => incrementDaily(current))
  }

  function startComprehensiveMock(questions: StudyQuestion[], code: string, label: string, lessonIds: string[]) {
    const subject = app.data[code]
    if (!subject) return
    const selectionKey = lessonIds.length ? [...lessonIds].sort().join('+') : 'all-sections'
    const lesson: Lesson = { id: `mock-full:${code}:${selectionKey}`, label, questions }
    launch(questions, {
      code,
      scope: '__MOCK_FULL_TEST__',
      mode: 'test',
      color: subject.color,
      subject: subjectShortName(subject.name),
      label,
      lesson,
    })
  }

  function downloadCalendar(time: string) {
    const [hours, minutes] = time.split(':')
    const pad = (value: number) => String(value).padStart(2, '0')
    const escape = (value: string) => value.replace(/[,;\\]/g, character => `\\${character}`).replace(/\n/g, '\\n')
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyFlow//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:StudyFlow']
    for (const day of app.schedule.plan) {
      if (!day.tasks?.length) continue
      const title = day.tasks.map(task => task.review ? `${app.data[task.c] ? subjectShortName(app.data[task.c].name) : task.c} مراجعة` : chapterById(app.data, task.c, task.ch)?.label ?? task.ch).join('، ')
      const date = day.d.replace(/-/g, '')
      lines.push('BEGIN:VEVENT', `UID:sf-s-${day.d}@sf`, 'DTSTAMP:20260812T000000Z', `DTSTART:${date}T${pad(Number(hours))}${pad(Number(minutes))}00`, `DTEND:${date}T${pad((Number(hours) + 2) % 24)}${pad(Number(minutes))}00`, `SUMMARY:${escape(`📚 StudyFlow: ${title}`)}`, 'END:VEVENT')
    }
    for (const exam of app.schedule.exams) {
      if (!app.data[exam.c]) continue
      const date = exam.d.replace(/-/g, '')
      const [examHour, examMinute] = exam.t.split(':').map(Number)
      lines.push('BEGIN:VEVENT', `UID:sf-e-${exam.c}@sf`, 'DTSTAMP:20260812T000000Z', `DTSTART:${date}T${pad(examHour)}${pad(examMinute)}00`, `DTEND:${date}T${pad((examHour + 1) % 24)}${pad(examMinute)}00`, `SUMMARY:${escape(`🎯 اختبار ${subjectShortName(app.data[exam.c].name)}`)}`, 'END:VEVENT')
    }
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = 'studyflow.ics'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000)
  }

  if (!app.ready) return <div className="app-shell"><main className="boot-screen"><section className="boot-card"><div className="boot-spinner" /><h1>نجهّز StudyFlow 2</h1><p className="muted">نقرأ أسئلتك وتقدمك المحفوظ…</p></section></main></div>
  if (app.error && !app.order.length) return <div className="app-shell"><main className="boot-screen"><section className="boot-card"><h1>تعذّر تحميل المحتوى</h1><p className="error-text">{app.error}</p><Button onClick={() => window.location.reload()}>حاول مرة أخرى</Button></section></main></div>

  if (!unlocked && passwordEnabled) return <LockScreen onUnlock={value => { if (value === localStorage.getItem(STORAGE_KEYS.password)) setUnlocked(true); else notify('الرمز غير صحيح') }} />

  return (
    <div className="app-shell">
      <Activity mode={screen === 'home' ? 'visible' : 'hidden'}>
        <HomeScreen data={app.data} order={app.order} schedule={app.schedule} store={app.store} settings={app.settings} daily={app.daily} quickPresets={Object.values(app.drillBundles).flatMap(bundle => bundle.presets.filter(preset => preset.quick))} onOpenScreen={next => transitionTo(next)} onStart={start} onStartStarred={startStarred} onStartDue={startDue} onStartLessonTest={startLessonTest} onStartLessonQuickTest={startLessonQuickTest} onOpenNotes={openNotes} onToggleExtra={() => app.updateSettings(current => ({ includeExtra: !current.includeExtra }))} onChangeDuration={sessionMins => app.updateSettings({ sessionMins })} />
      </Activity>

      {session ? (
        <Activity mode={screen === 'session' ? 'visible' : 'hidden'}>
          <SessionScreen
            questions={session.items}
            meta={session.meta}
            progress={app.store.q}
            starred={app.store.star}
            sessionMinutes={session.meta.scope === '__LESSON_QUICK_TEST__' ? 5 : app.settings.sessionMins}
            sound={app.settings.sound}
            fullscreen={app.settings.fullscreen}
            onProgressChange={app.updateQuestionProgress}
            onStarChange={(id, active) => app.updateStore(current => setStarred(current, id, active))}
            onDailyAnswer={() => app.setDaily(current => incrementDaily(current))}
            onComplete={completeSession}
            onExit={() => transitionTo('home', () => setSession(null))}
            onOpenNotes={() => {
              if (session.meta.lesson?.notes) openNotes(session.meta.lesson.notes, `${session.meta.subject} · ${session.meta.lesson.label}`)
              else if (session.meta.code && !session.meta.scope.startsWith('__')) {
                const chapter = chapterById(app.data, session.meta.code, session.meta.scope)
                openNotes(chapter?.notes, `${session.meta.subject} · ${session.meta.label}`)
              }
            }}
          />
        </Activity>
      ) : null}

      {screen === 'mock' && <MockScreen data={app.data} order={app.order} hidden={app.settings.hidden} drillBundles={app.drillBundles} onBack={() => transitionTo('home')} onRecord={recordMock} onStartComprehensive={startComprehensiveMock} onReviewWrong={(questions, code, label) => launch(questions, { code, scope: '__MOCKREV__', mode: 'review', color: app.data[code]?.color ?? '#2dd4bf', subject: app.data[code] ? subjectShortName(app.data[code].name) : code, label })} />}

      {screen === 'notes' && <NotesScreen title={notes.title} notes={notes.notes} onBack={() => transitionTo(notes.returnTo)} />}
      {screen === 'plan' && <PlanScreen data={app.data} schedule={app.schedule} planDone={app.planDone} onToggle={key => app.setPlanDone(current => { const next = { ...current }; if (next[key]) delete next[key]; else next[key] = true; return next })} onStart={(code, chapterId, review) => start({ code, scope: chapterId, mode: review ? 'review' : 'all' })} onBack={() => transitionTo('home')} />}
      {screen === 'weak' && <WeakScreen data={app.data} order={app.order} settings={app.settings} store={app.store} onStart={(code, chapterId) => start({ code, scope: chapterId, mode: 'all' })} onBack={() => transitionTo('home')} />}
      {screen === 'search' && <SearchScreen data={app.data} order={app.order} onBack={() => transitionTo('home')} />}
      {screen === 'settings' && <SettingsScreen data={app.data} order={app.order} settings={app.settings} sync={app.sync} passwordEnabled={passwordEnabled} syncStatus={app.syncState.message} onBack={() => transitionTo('home')} onUpdateSettings={patch => app.updateSettings(patch)} onToggleSubject={code => app.updateSettings(current => ({ hidden: current.hidden.includes(code) ? current.hidden.filter(item => item !== code) : [...current.hidden, code] }))} onImportContent={async content => { app.replaceCustomContent(content); notify('تم استيراد المحتوى ✓') }} onExportContent={() => downloadJson('studyflow-data.json', app.customContent)} onClearContent={() => { app.clearCustomContent(); notify('تمت إزالة المحتوى الخاص') }} onImportProgress={backup => { app.importProgress(backup); notify('تم استرجاع التقدم ✓') }} onExportProgress={() => downloadJson('studyflow-progress.json', app.exportProgress())} onSetPassword={password => { localStorage.setItem(STORAGE_KEYS.password, password); setPasswordVersion(value => value + 1); notify('تم تفعيل القفل') }} onClearPassword={() => { localStorage.removeItem(STORAGE_KEYS.password); setPasswordVersion(value => value + 1); setUnlocked(true); notify('تم إلغاء القفل') }} onResetProgress={() => { app.updateStore(createProgressStore()); app.setDaily(createDailyStore()); notify('تم تصفير التقدم') }} onEnableSync={async token => { app.updateSync({ token, enabled: true, gistId: '' }); await app.pullSync(); await app.pushSync(); notify('تم تفعيل المزامنة') }} onDisableSync={() => app.updateSync({ enabled: false })} onSyncNow={async () => { await app.pullSync(); await app.pushSync(); }} onTestSync={async token => { const response = await fetch('https://api.github.com/gists?per_page=1', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }); if (!response.ok) throw new Error(`التوكن غير صالح (${response.status})`); notify('الاتصال ناجح ✓') }} onDownloadCalendar={downloadCalendar} />}

      {toast ? <Toast key={toast.id} message={toast.message} onDone={dismissToast} /> : null}
      <span className="build-marker">{APP_BUILD}</span>
    </div>
  )
}

function LockScreen({ onUnlock }: { onUnlock: (value: string) => void }) {
  const [value, setValue] = useState('')
  return <div className="app-shell"><main className="lock-screen"><form className="lock-card" onSubmit={event => { event.preventDefault(); onUnlock(value) }}><div className="brand-mark">SF</div><h1>StudyFlow مقفل</h1><p className="muted">أدخل الرمز المحلي</p><input aria-label="رمز القفل المحلي" autoFocus type="password" inputMode="numeric" value={value} onChange={event => setValue(event.target.value)} /><Button type="submit">دخول</Button></form></main></div>
}
