import type {
  Chapter,
  ChoiceQuestion,
  ContentBundle,
  DrillsBundle,
  Lesson,
  LessonSection,
  PlanDay,
  PreparedContent,
  StudyQuestion,
  StudySchedule,
  Subject,
} from '../types'
import {
  APP_BASE_PATH,
  BUILTIN_CODES,
  BUILTIN_CONTENT_ASSET,
  DEFAULT_SUBJECT_COLOR,
  PDC_DRILLS_ASSET,
  PDC_SUBJECT_CODE,
  STORAGE_KEYS,
} from './constants'
import { loadJson, saveJson } from './storage'

type UnknownRecord = Record<string, unknown>

export interface LoadedPreparedContent extends PreparedContent {
  builtinContent: ContentBundle
  customContent: ContentBundle
}

export interface LoadPreparedContentOptions {
  baseUrl?: string
  customContent?: ContentBundle | unknown
  fetcher?: typeof fetch
  storage?: Storage | null
}

export function createEmptyContent(): ContentBundle {
  return { version: 1, subjects: {}, schedule: { plan: [], exams: [] } }
}

export function createEmptyDrills(): DrillsBundle {
  return { version: 2, subject: PDC_SUBJECT_CODE, chapters: {}, presets: [] }
}

// Exported for consumers that only need a read-only fallback. Use the factory
// functions when the value may later be replaced or edited.
export const EMPTY_CONTENT: Readonly<ContentBundle> = createEmptyContent()
export const EMPTY_DRILLS: Readonly<DrillsBundle> = createEmptyDrills()

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function validationError(message: string): never {
  throw new Error(message)
}

/** Validate the public/custom v1 content contract without rewriting any IDs. */
export function validateContent(raw: unknown): ContentBundle {
  if (!isRecord(raw)) validationError('الملف ليس JSON صالحاً')

  const subjectsValue = raw.subjects
  if (!isRecord(subjectsValue)) validationError('الحقل subjects مفقود')

  const ids = new Set<string>()
  for (const [code, subjectValue] of Object.entries(subjectsValue)) {
    if (!code || !isRecord(subjectValue)) validationError('تعريف مادة غير صالح')
    if (typeof subjectValue.name !== 'string' || !subjectValue.name || !Array.isArray(subjectValue.chapters)) {
      validationError(`المادة ${code}: name أو chapters مفقود`)
    }

    for (const chapterValue of subjectValue.chapters) {
      if (!isRecord(chapterValue) || typeof chapterValue.id !== 'string' || !chapterValue.id || typeof chapterValue.label !== 'string' || !chapterValue.label) {
        validationError(`المادة ${code}: كل شابتر يحتاج id و label`)
      }

      if (chapterValue.questions !== undefined && !Array.isArray(chapterValue.questions)) {
        validationError(`الشابتر ${chapterValue.id}: questions غير صالح`)
      }
      for (const questionValue of Array.isArray(chapterValue.questions) ? chapterValue.questions : []) {
        if (!isRecord(questionValue) || typeof questionValue.id !== 'string' || !questionValue.id || typeof questionValue.q !== 'string' || !questionValue.q) {
          validationError(`الشابتر ${chapterValue.id}: كل سؤال يحتاج id و q`)
        }
        if (ids.has(questionValue.id)) validationError(`معرّف سؤال مكرر: ${questionValue.id}`)
        ids.add(questionValue.id)

        if (questionValue.type === 'match') {
          if (!Array.isArray(questionValue.pairs) || questionValue.pairs.length < 2) {
            validationError(`سؤال المطابقة ${questionValue.id}: يحتاج pairs`)
          }
        } else {
          const choices = questionValue.choices
          const answer = questionValue.answer
          if (!Array.isArray(choices) || choices.length < 2 || !Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= choices.length) {
            validationError(`سؤال ${questionValue.id}: choices أو answer غير صالح`)
          }
        }
      }

      if (chapterValue.practice !== undefined && !Array.isArray(chapterValue.practice)) {
        validationError(`مسائل غير صالحة في ${chapterValue.id}`)
      }
      for (const practiceValue of Array.isArray(chapterValue.practice) ? chapterValue.practice : []) {
        if (!isRecord(practiceValue) || typeof practiceValue.id !== 'string' || !practiceValue.id || typeof practiceValue.q !== 'string' || !practiceValue.q || typeof practiceValue.solution !== 'string' || !practiceValue.solution) {
          validationError(`مسألة غير صالحة في ${chapterValue.id}`)
        }
        if (ids.has(practiceValue.id)) validationError(`معرّف مكرر: ${practiceValue.id}`)
        ids.add(practiceValue.id)
      }
    }
  }

  const scheduleValue = raw.schedule ?? { plan: [], exams: [] }
  if (!isRecord(scheduleValue) || !Array.isArray(scheduleValue.plan ?? []) || !Array.isArray(scheduleValue.exams ?? [])) {
    validationError('schedule غير صالح')
  }

  return {
    version: 1,
    subjects: subjectsValue as unknown as Record<string, Subject>,
    schedule: {
      plan: (scheduleValue.plan ?? []) as PlanDay[],
      exams: (scheduleValue.exams ?? []) as StudySchedule['exams'],
    },
  }
}

/** The checked-in finals bundle intentionally has exactly 3 x 35 questions per subject. */
export function validateBuiltinFinals(raw: unknown): ContentBundle {
  const content = validateContent(raw)
  for (const code of BUILTIN_CODES) {
    const subject = content.subjects[code]
    const total = subject?.chapters.reduce((sum, chapter) => sum + (chapter.questions?.length ?? 0), 0) ?? 0
    if (!subject || subject.chapters.length !== 3 || total !== 105) {
      validationError(`حزمة ${code} غير مكتملة`)
    }
  }
  return content
}

/** Validate the additive CCCS-422 drill/lesson package (v2). */
export function validatePdcDrills(raw: unknown): DrillsBundle {
  if (!isRecord(raw) || raw.version !== 2 || raw.subject !== PDC_SUBJECT_CODE || !isRecord(raw.chapters) || !Array.isArray(raw.presets)) {
    validationError('حزمة تدريبات PDC غير صالحة')
  }

  const ids = new Set<string>()
  for (const [chapterId, packValue] of Object.entries(raw.chapters)) {
    if (!isRecord(packValue) || !Array.isArray(packValue.sections) || !Array.isArray(packValue.questions)) {
      validationError(`حزمة ${chapterId} ناقصة`)
    }
    for (const questionValue of packValue.questions) {
      if (!isRecord(questionValue)) validationError('سؤال PDC غير صالح: بدون id')
      const choices = questionValue.choices
      const answer = questionValue.answer
      const id = questionValue.id
      if (typeof id !== 'string' || !id || typeof questionValue.q !== 'string' || !questionValue.q || ids.has(id) || !Array.isArray(choices) || choices.length < 2 || !Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= choices.length) {
        validationError(`سؤال PDC غير صالح: ${typeof id === 'string' && id ? id : 'بدون id'}`)
      }
      ids.add(id)
    }
    for (const sectionValue of packValue.sections) {
      if (!isRecord(sectionValue) || typeof sectionValue.id !== 'string' || !sectionValue.id || typeof sectionValue.label !== 'string' || !sectionValue.label || !Array.isArray(sectionValue.questionIds) || !sectionValue.questionIds.length) {
        validationError(`قسم PDC غير صالح في ${chapterId}`)
      }
    }
  }

  return raw as unknown as DrillsBundle
}

export function mergeSchedules(builtin: StudySchedule | undefined, custom: StudySchedule | undefined): StudySchedule {
  const days = new Map<string, PlanDay>()
  const exams = new Map<string, StudySchedule['exams'][number]>()

  for (const source of [builtin ?? {}, custom ?? {}] as Array<Partial<StudySchedule>>) {
    for (const day of Array.isArray(source.plan) ? source.plan : []) {
      if (!day?.d) continue
      const current = days.get(day.d) ?? { d: day.d, day: day.day ?? '', exam: null, tasks: [] }
      if (day.day) current.day = day.day
      if (day.exam) current.exam = day.exam
      for (const task of Array.isArray(day.tasks) ? day.tasks : []) {
        const duplicate = current.tasks.some(
          (existing) => existing.c === task.c && existing.ch === task.ch && Boolean(existing.review) === Boolean(task.review),
        )
        if (!duplicate) current.tasks.push({ ...task })
      }
      days.set(day.d, current)
    }
    for (const exam of Array.isArray(source.exams) ? source.exams : []) {
      if (exam?.c) exams.set(exam.c, { ...exam })
    }
  }

  return {
    plan: [...days.values()].sort((left, right) => left.d.localeCompare(right.d)),
    exams: [...exams.values()],
  }
}

function lessonsFromSections(chapter: Chapter, sections: LessonSection[]): Lesson[] {
  const byId = new Map(chapter.questions.map((question) => [question.id, question]))
  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    questions: section.questionIds.map((id) => byId.get(id)).filter((question): question is StudyQuestion => Boolean(question)),
    notes: section.notes ?? null,
  }))
}

/** Compose built-in + custom content and add the drill questions/lesson index. */
export function prepareContent(
  builtinContent: ContentBundle = createEmptyContent(),
  customContent: ContentBundle = createEmptyContent(),
  drillsBundle: DrillsBundle = createEmptyDrills(),
): PreparedContent {
  const data = cloneJson({ ...builtinContent.subjects, ...customContent.subjects })
  const schedule = mergeSchedules(builtinContent.schedule, customContent.schedule)
  const order = Object.keys(data)
  const drills = cloneJson(drillsBundle)

  const drillSubject = data[drills.subject]
  if (drillSubject && drills.chapters) {
    for (const chapter of Array.isArray(drillSubject.chapters) ? drillSubject.chapters : []) {
      const pack = drills.chapters[chapter.id]
      if (!pack) continue
      chapter.questions = Array.isArray(chapter.questions) ? chapter.questions : []
      const seen = new Set(chapter.questions.map((question) => question.id))
      for (const question of pack.questions ?? []) {
        if (seen.has(question.id)) continue
        chapter.questions.push(cloneJson(question) as ChoiceQuestion)
        seen.add(question.id)
      }
      chapter.sections = cloneJson(pack.sections ?? [])
    }
  }

  for (const code of order) {
    const subject = data[code]
    subject.code = subject.code || code
    subject.color = subject.color || DEFAULT_SUBJECT_COLOR
    subject.chapters = Array.isArray(subject.chapters) ? subject.chapters : []

    for (const chapter of subject.chapters) {
      chapter.questions = Array.isArray(chapter.questions) ? chapter.questions : []
      chapter.practice = Array.isArray(chapter.practice) ? chapter.practice : []

      if (chapter.sections?.length) {
        chapter.lessons = lessonsFromSections(chapter, chapter.sections)
      } else if (chapter.objectives?.length) {
        chapter.lessons = chapter.objectives.map((objective) => ({
          id: `${chapter.id}-${String(objective.num).replace('.', '_')}`,
          num: objective.num,
          label: objective.label,
          questions: chapter.questions.filter((question) => question.obj === objective.num),
          notes: chapter.objNotes?.[String(objective.num)] ?? null,
        }))
      } else if (!chapter.questions.length && Array.isArray(chapter.lessons)) {
        chapter.questions = chapter.lessons.flatMap((lesson) => lesson.questions ?? [])
      }
    }
  }

  return { data, schedule, order, drills }
}

function joinAssetUrl(baseUrl: string, asset: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${asset.replace(/^\/+/, '')}`
}

function validatedOrFallback<T>(raw: unknown, validator: (value: unknown) => T, fallback: () => T): T {
  try {
    return validator(raw)
  } catch {
    return fallback()
  }
}

async function refreshBundle<T>(
  url: string,
  current: T,
  validator: (value: unknown) => T,
  storageKey: string,
  fetcher: typeof fetch | undefined,
  storage: Storage | null | undefined,
): Promise<T> {
  if (!fetcher) return current
  try {
    const response = await fetcher(url, { cache: 'no-store' })
    if (!response.ok) return current
    const next = validator(await response.json())
    saveJson(storageKey, next, storage)
    return next
  } catch {
    return current
  }
}

/** Read valid cached bundles synchronously so the app can paint before network revalidation. */
export function loadCachedPreparedContent(options: LoadPreparedContentOptions = {}): LoadedPreparedContent {
  const storage = options.storage
  const customRaw = options.customContent ?? loadJson<unknown>(STORAGE_KEYS.content, createEmptyContent(), storage)
  const customContent = validateContent(customRaw)

  const builtinContent = validatedOrFallback(
    loadJson<unknown>(STORAGE_KEYS.builtin, createEmptyContent(), storage),
    validateBuiltinFinals,
    createEmptyContent,
  )
  const drills = validatedOrFallback(
    loadJson<unknown>(STORAGE_KEYS.drills, createEmptyDrills(), storage),
    validatePdcDrills,
    createEmptyDrills,
  )

  return {
    ...prepareContent(builtinContent, customContent, drills),
    builtinContent,
    customContent,
  }
}

/**
 * Load both checked-in public bundles, falling back to their exact legacy
 * localStorage caches, then compose them with the user's private content.
 */
export async function loadPreparedContent(options: LoadPreparedContentOptions = {}): Promise<LoadedPreparedContent> {
  const cached = loadCachedPreparedContent(options)
  const storage = options.storage
  let builtinContent = cached.builtinContent
  let drills = cached.drills
  const customContent = cached.customContent

  const fetcher = options.fetcher ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)
  const baseUrl = options.baseUrl ?? APP_BASE_PATH
  ;[builtinContent, drills] = await Promise.all([
    refreshBundle(
      joinAssetUrl(baseUrl, BUILTIN_CONTENT_ASSET),
      builtinContent,
      validateBuiltinFinals,
      STORAGE_KEYS.builtin,
      fetcher,
      storage,
    ),
    refreshBundle(
      joinAssetUrl(baseUrl, PDC_DRILLS_ASSET),
      drills,
      validatePdcDrills,
      STORAGE_KEYS.drills,
      fetcher,
      storage,
    ),
  ])

  return {
    ...prepareContent(builtinContent, customContent, drills),
    builtinContent,
    customContent,
  }
}
