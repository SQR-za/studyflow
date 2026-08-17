import type {
  AppSettings,
  DailyStore,
  PlanDoneStore,
  ProgressBackup,
  ProgressStore,
  QuestionProgress,
  SyncSettings,
  TestResult,
} from '../types'
import { DAY_MS, GAPS } from './constants'
import { todayString } from './utils'

type UnknownRecord = Record<string, unknown>

export interface RecordedAnswer {
  store: ProgressStore
  progress: QuestionProgress
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function createQuestionProgress(): QuestionProgress {
  return { box: 1, seen: 0, correct: 0, wrong: 0, due: 0, last: 0 }
}

export function createProgressStore(): ProgressStore {
  return { q: {}, star: {}, tests: {}, attempts: [] }
}

export function createDefaultSettings(): AppSettings {
  return {
    includeExtra: true,
    goal: 50,
    sound: false,
    sessionMins: 20,
    fullscreen: true,
    hidden: [],
  }
}

export function createDailyStore(): DailyStore {
  return { dates: {} }
}

export function createSyncSettings(): SyncSettings {
  return { token: '', gistId: '', enabled: false }
}

export function normalizeQuestionProgress(raw: unknown): QuestionProgress {
  if (!isRecord(raw)) return createQuestionProgress()
  return {
    box: finiteNumber(raw.box, 1),
    seen: finiteNumber(raw.seen, 0),
    correct: finiteNumber(raw.correct, 0),
    wrong: finiteNumber(raw.wrong, 0),
    due: finiteNumber(raw.due, 0),
    last: finiteNumber(raw.last, 0),
  }
}

export function normalizeProgressStore(raw: unknown): ProgressStore {
  if (!isRecord(raw)) return createProgressStore()

  const q: ProgressStore['q'] = {}
  if (isRecord(raw.q)) {
    for (const [id, value] of Object.entries(raw.q)) q[id] = normalizeQuestionProgress(value)
  }

  const star: ProgressStore['star'] = {}
  if (isRecord(raw.star)) {
    for (const [id, value] of Object.entries(raw.star)) star[id] = Boolean(value)
  }

  const tests: ProgressStore['tests'] = {}
  if (isRecord(raw.tests)) {
    for (const [id, value] of Object.entries(raw.tests)) {
      if (!isRecord(value)) continue
      tests[id] = {
        at: typeof value.at === 'string' ? value.at : '',
        pct: finiteNumber(value.pct, 0),
        correct: finiteNumber(value.correct, 0),
        total: finiteNumber(value.total, 0),
      }
    }
  }

  const attempts = Array.isArray(raw.attempts)
    ? raw.attempts.filter(isRecord).map((attempt) => ({
        id: typeof attempt.id === 'string' ? attempt.id : `a${finiteNumber(Date.parse(String(attempt.at ?? '')), Date.now())}`,
        at: typeof attempt.at === 'string' ? attempt.at : '',
        code: typeof attempt.code === 'string' || attempt.code === null ? attempt.code : undefined,
        label: typeof attempt.label === 'string' ? attempt.label : undefined,
        pct: finiteNumber(attempt.pct, 0),
        correct: finiteNumber(attempt.correct, 0),
        total: finiteNumber(attempt.total, 0),
        lessonIds: Array.isArray(attempt.lessonIds) ? attempt.lessonIds.filter((id): id is string => typeof id === 'string') : undefined,
        presetId: typeof attempt.presetId === 'string' ? attempt.presetId : undefined,
      }))
    : []

  return { q, star, tests, attempts }
}

export function normalizeSettings(raw: unknown, base: AppSettings = createDefaultSettings()): AppSettings {
  if (!isRecord(raw)) return { ...base, hidden: [...base.hidden] }
  return {
    includeExtra: typeof raw.includeExtra === 'boolean' ? raw.includeExtra : base.includeExtra,
    goal: finiteNumber(raw.goal, base.goal),
    sound: typeof raw.sound === 'boolean' ? raw.sound : base.sound,
    sessionMins: finiteNumber(raw.sessionMins, base.sessionMins),
    fullscreen: typeof raw.fullscreen === 'boolean' ? raw.fullscreen : base.fullscreen,
    hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((code): code is string => typeof code === 'string') : [...base.hidden],
    builtinContentBuild: typeof raw.builtinContentBuild === 'string' ? raw.builtinContentBuild : base.builtinContentBuild,
  }
}

export function normalizePlanDone(raw: unknown): PlanDoneStore {
  if (!isRecord(raw)) return {}
  const plan: PlanDoneStore = {}
  for (const [id, value] of Object.entries(raw)) {
    if (value) plan[id] = true
  }
  return plan
}

export function normalizeDailyStore(raw: unknown): DailyStore {
  if (!isRecord(raw) || !isRecord(raw.dates)) return createDailyStore()
  const dates: Record<string, number> = {}
  for (const [date, count] of Object.entries(raw.dates)) dates[date] = finiteNumber(count, 0)
  return { dates }
}

export function normalizeSyncSettings(raw: unknown): SyncSettings {
  if (!isRecord(raw)) return createSyncSettings()
  return {
    token: typeof raw.token === 'string' ? raw.token : '',
    gistId: typeof raw.gistId === 'string' ? raw.gistId : '',
    enabled: raw.enabled === true,
  }
}

export function questionProgress(store: ProgressStore, id: string): QuestionProgress {
  return store.q[id] ?? createQuestionProgress()
}

/** Immutable equivalent of the legacy qstate + grading update. */
export function recordAnswer(
  store: ProgressStore,
  id: string,
  correct: boolean,
  now = Date.now(),
): RecordedAnswer {
  const previous = questionProgress(store, id)
  const box = correct ? Math.min(5, (previous.box || 1) + 1) : 1
  const progress: QuestionProgress = {
    ...previous,
    box,
    seen: previous.seen + 1,
    correct: previous.correct + (correct ? 1 : 0),
    wrong: previous.wrong + (correct ? 0 : 1),
    last: now,
    due: now + (correct ? GAPS[box] : 1) * DAY_MS,
  }
  return {
    progress,
    store: { ...store, q: { ...store.q, [id]: progress } },
  }
}

export function setQuestionProgress(store: ProgressStore, id: string, next: QuestionProgress): ProgressStore {
  return { ...store, q: { ...store.q, [id]: normalizeQuestionProgress(next) } }
}

export function setStarred(store: ProgressStore, id: string, value: boolean): ProgressStore {
  const star = { ...store.star }
  if (value) star[id] = true
  else delete star[id]
  return { ...store, star }
}

export function setTestResult(store: ProgressStore, id: string, result: TestResult): ProgressStore {
  return { ...store, tests: { ...store.tests, [id]: result } }
}

export function incrementDaily(daily: DailyStore, date = todayString()): DailyStore {
  return { dates: { ...daily.dates, [date]: (daily.dates[date] ?? 0) + 1 } }
}

/** Match the legacy behavior: an unfinished current day does not break yesterday's streak. */
export function streakCount(daily: DailyStore, goal: number, today = new Date()): number {
  let count = 0
  const date = new Date(today)
  for (let index = 0; index < 400; index += 1) {
    const key = todayString(date)
    const answers = daily.dates[key] ?? 0
    if (index === 0 && answers < goal) {
      // Keep checking yesterday while today's target is still in progress.
    } else if (answers >= goal) count += 1
    else break
    date.setDate(date.getDate() - 1)
  }
  return count
}

export function createProgressBackup(
  store: ProgressStore,
  plan: PlanDoneStore,
  daily: DailyStore,
  settings: AppSettings,
): ProgressBackup {
  return { store, plan, daily, settings, _app: 'StudyFlow' }
}

export function parseProgressBackup(raw: unknown, currentSettings = createDefaultSettings()): ProgressBackup {
  if (!isRecord(raw)) throw new Error('ملف غير صالح')
  return {
    store: normalizeProgressStore(raw.store),
    plan: normalizePlanDone(raw.plan),
    daily: normalizeDailyStore(raw.daily),
    settings: normalizeSettings(raw.settings, currentSettings),
    _app: 'StudyFlow',
  }
}
