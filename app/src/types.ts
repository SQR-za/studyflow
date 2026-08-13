export type QuestionSource = 'exam' | 'slides' | 'extra' | string

export interface NotesBlock {
  draw?: string[]
  formulas?: string[]
  practice?: string[]
  watch?: string[]
}

export interface BaseQuestion {
  id: string
  q: string
  q_ar?: string
  hint_ar?: string
  explanation?: string
  explanation_ar?: string
  src?: QuestionSource
  source?: string
  section?: string
  obj?: string | number
}

export interface ChoiceQuestion extends BaseQuestion {
  type?: 'choice'
  choices: string[]
  answer: number
}

export interface MatchQuestion extends BaseQuestion {
  type: 'match'
  pairs: Array<[string, string]>
  pairHints_ar?: string[] | Record<string, string>
}

export interface PracticeQuestion extends BaseQuestion {
  type?: 'practice'
  solution: string
}

export type StudyQuestion = ChoiceQuestion | MatchQuestion | PracticeQuestion

export interface LessonSection {
  id: string
  label: string
  questionIds: string[]
  notes?: NotesBlock | null
}

export interface Lesson {
  id: string
  label: string
  num?: string | number
  questions: StudyQuestion[]
  notes?: NotesBlock | null
}

export interface Chapter {
  id: string
  num?: string | number
  label: string
  notes?: NotesBlock
  questions: StudyQuestion[]
  practice?: PracticeQuestion[]
  sections?: LessonSection[]
  lessons?: Lesson[]
  objectives?: Array<{ num: string | number; label: string }>
  objNotes?: Record<string, NotesBlock>
}

export interface Subject {
  name: string
  code: string
  color: string
  chapters: Chapter[]
}

export interface PlanTask {
  c: string
  ch: string
  review?: boolean
}

export interface PlanDay {
  d: string
  day?: string
  exam?: string | null
  tasks: PlanTask[]
}

export interface ExamDate {
  c: string
  d: string
  t: string
}

export interface StudySchedule {
  plan: PlanDay[]
  exams: ExamDate[]
}

export interface ContentBundle {
  version: number
  subjects: Record<string, Subject>
  schedule: StudySchedule
}

export interface DrillPresetPart {
  chapterId: string
  count: number
}

export interface DrillPreset {
  id: string
  label: string
  description?: string
  count?: number
  parts?: DrillPresetPart[]
  lessonIds?: string[]
  timed?: boolean
  quick?: boolean
  questions?: ChoiceQuestion[]
}

export interface DrillChapter {
  sections: LessonSection[]
  questions: ChoiceQuestion[]
}

export interface DrillsBundle {
  version: 2
  subject: string
  build?: string
  chapters: Record<string, DrillChapter>
  presets: DrillPreset[]
}

export interface PreparedContent {
  data: Record<string, Subject>
  schedule: StudySchedule
  order: string[]
  drills: DrillsBundle
}

export interface QuestionProgress {
  box: number
  seen: number
  correct: number
  wrong: number
  due: number
  last: number
}

export interface TestResult {
  at: string
  pct: number
  correct: number
  total: number
}

export interface AttemptRecord {
  id: string
  at: string
  code?: string | null
  label?: string
  pct: number
  correct: number
  total: number
  lessonIds?: string[]
  presetId?: string
}

export interface ProgressStore {
  q: Record<string, QuestionProgress>
  star: Record<string, boolean>
  tests: Record<string, TestResult>
  attempts: AttemptRecord[]
}

export interface AppSettings {
  includeExtra: boolean
  goal: number
  sound: boolean
  sessionMins: number
  fullscreen: boolean
  hidden: string[]
  builtinFinalsBuild?: string
}

export interface DailyStore {
  dates: Record<string, number>
}

export interface SyncSettings {
  token: string
  gistId: string
  enabled: boolean
}

export interface SyncPayload {
  store: ProgressStore
  plan: PlanDoneStore
  daily: DailyStore
  _at: number
}

export type PlanDoneStore = Record<string, boolean>

export interface ProgressBackup {
  store: ProgressStore
  plan: PlanDoneStore
  daily: DailyStore
  settings: AppSettings
  _app: 'StudyFlow'
}

export type Screen = 'home' | 'session' | 'mock' | 'notes' | 'plan' | 'weak' | 'search' | 'settings'

export interface ChapterStats {
  mastered: number
  seen: number
  weak: number
  total: number
}

export interface LessonStats {
  mastered: number
  weak: number
  total: number
}

export interface SubjectStats extends ChapterStats {
  percent: number
}

export interface OverallStats extends ChapterStats {
  masteryPercent: number
  seenPercent: number
}

export type SyncPhase = 'off' | 'syncing' | 'synced' | 'error'

export interface SyncState {
  phase: SyncPhase
  message: string
}

export interface SessionMeta {
  code: string | null
  scope: string
  mode: 'all' | 'review' | 'practice' | 'star' | 'due' | 'learn' | 'test'
  color: string
  subject: string
  label: string
  lesson?: Lesson | null
}
