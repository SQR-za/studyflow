import type {
  Chapter,
  ContentBundle,
  DrillsBundle,
  Lesson,
  LessonContent,
  LessonSection,
  PlanDay,
  PreparedContent,
  StudyQuestion,
  StudySchedule,
  Subject,
} from '../types'
import { publicAssetUrl } from './assets'
import {
  APP_BASE_PATH,
  BUILTIN_CODES,
  BUILTIN_CONTENT_ASSET,
  DEFAULT_SUBJECT_COLOR,
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

export function createEmptyDrills(subject = ''): DrillsBundle {
  return { version: 2, subject, chapters: {}, presets: [] }
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

function validateStringList(value: unknown, context: string, allowEmpty = true): void {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some(item => typeof item !== 'string' || !item.trim())) {
    validationError(`${context} غير صالح`)
  }
}

function validateOptionalHeading(value: unknown, context: string): void {
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
    validationError(`${context}: العنوان غير صالح`)
  }
}

function validateLessonFigure(value: unknown, context: string): void {
  if (!isRecord(value)
    || typeof value.src !== 'string' || !value.src.trim()
    || typeof value.alt !== 'string' || !value.alt.trim()
    || typeof value.caption !== 'string' || !value.caption.trim()
    || typeof value.source !== 'string' || !value.source.trim()
    || !Number.isInteger(value.width) || (value.width as number) <= 0
    || !Number.isInteger(value.height) || (value.height as number) <= 0) {
    validationError(`${context}: الصورة غير صالحة`)
  }

  try {
    publicAssetUrl(value.src as string, '/')
  } catch {
    validationError(`${context}: مسار الصورة غير صالح`)
  }
}

function validateLessonContent(value: unknown, context: string): asserts value is LessonContent {
  if (!isRecord(value) || typeof value.summary !== 'string' || !value.summary.trim()) {
    validationError(`${context}: محتوى الدرس غير صالح`)
  }
  validateStringList(value.objectives, `${context}: أهداف الدرس`)
  validateStringList(value.recap, `${context}: ملخص الدرس`)
  if (!Array.isArray(value.blocks) || value.blocks.length === 0) {
    validationError(`${context}: فقرات الدرس غير صالحة`)
  }

  for (const [index, blockValue] of value.blocks.entries()) {
    const blockContext = `${context}: فقرة ${index + 1}`
    if (!isRecord(blockValue) || typeof blockValue.type !== 'string') {
      validationError(`${blockContext} غير صالحة`)
    }
    validateOptionalHeading(blockValue.heading, blockContext)

    switch (blockValue.type) {
      case 'text':
        validateStringList(blockValue.paragraphs, `${blockContext}: النص`, false)
        break
      case 'list':
        validateStringList(blockValue.items, `${blockContext}: القائمة`, false)
        break
      case 'code':
        if (!['html', 'css', 'javascript'].includes(String(blockValue.language))
          || typeof blockValue.code !== 'string' || !blockValue.code.trim()
          || (blockValue.explanation !== undefined && (typeof blockValue.explanation !== 'string' || !blockValue.explanation.trim()))) {
          validationError(`${blockContext}: الكود غير صالح`)
        }
        if (blockValue.result !== undefined) validateLessonFigure(blockValue.result, `${blockContext}: النتيجة`)
        break
      case 'figure':
        validateLessonFigure(blockValue.figure, blockContext)
        break
      case 'callout':
        if (!['key', 'exam', 'warning'].includes(String(blockValue.tone)) || typeof blockValue.text !== 'string' || !blockValue.text.trim()) {
          validationError(`${blockContext}: التنبيه غير صالح`)
        }
        break
      default:
        validationError(`${blockContext}: نوع الفقرة غير معروف`)
    }
  }
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

/** Validate the complete checked-in CompTIA Security+ SY0-701 catalog. */
export function validateBuiltinContent(raw: unknown): ContentBundle {
  const content = validateContent(raw)
  const subject = content.subjects[BUILTIN_CODES[0]]
  const questions = subject?.chapters.flatMap((chapter) => chapter.questions ?? []) ?? []
  const objectives = subject?.chapters.flatMap((chapter) => chapter.objectives ?? []) ?? []
  const matchQuestions = questions.filter((question) => question.type === 'match')
  if (Object.keys(content.subjects).length !== 1
    || !subject
    || subject.chapters.length !== 5
    || questions.length !== 987
    || objectives.length !== 28
    || matchQuestions.length !== 111) {
    validationError('حزمة Security+ SY0-701 غير مكتملة')
  }

  for (const chapter of subject.chapters) {
    const objectiveIds = new Set((chapter.objectives ?? []).map((objective) => String(objective.num)))
    if (!objectiveIds.size || objectiveIds.size !== Object.keys(chapter.objNotes ?? {}).length) {
      validationError(`أهداف ${chapter.id} أو ملاحظاتها غير مكتملة`)
    }
    for (const question of chapter.questions) {
      if (!objectiveIds.has(String(question.obj ?? ''))) {
        validationError(`السؤال ${question.id} غير مربوط بهدف صالح`)
      }
    }
  }
  return content
}

/** Validate an additive drill/lesson package without rewriting question IDs. */
export function validateDrills(raw: unknown, expectedSubject: string, label = expectedSubject): DrillsBundle {
  if (!isRecord(raw) || raw.version !== 2 || raw.subject !== expectedSubject || !isRecord(raw.chapters) || !Array.isArray(raw.presets)) {
    validationError(`حزمة تدريبات ${label} غير صالحة`)
  }

  const ids = new Set<string>()
  const validateDrillQuestion = (questionValue: unknown, context: string) => {
    if (!isRecord(questionValue)) validationError(`سؤال ${label} غير صالح في ${context}: بدون id`)
    const id = questionValue.id
    const validBase = typeof id === 'string' && id.length > 0 && typeof questionValue.q === 'string' && questionValue.q.length > 0 && !ids.has(id)
    const validQuestion = questionValue.type === 'match'
      ? Array.isArray(questionValue.pairs) && questionValue.pairs.length >= 2
      : Array.isArray(questionValue.choices)
        && questionValue.choices.length >= 2
        && Number.isInteger(questionValue.answer)
        && (questionValue.answer as number) >= 0
        && (questionValue.answer as number) < questionValue.choices.length
    if (!validBase || !validQuestion) {
      validationError(`سؤال ${label} غير صالح في ${context}: ${typeof id === 'string' && id ? id : 'بدون id'}`)
    }
    ids.add(id as string)
  }

  for (const [chapterId, packValue] of Object.entries(raw.chapters)) {
    if (!isRecord(packValue) || !Array.isArray(packValue.sections) || !Array.isArray(packValue.questions)) {
      validationError(`حزمة ${chapterId} ناقصة`)
    }
    for (const questionValue of packValue.questions) validateDrillQuestion(questionValue, chapterId)
    for (const sectionValue of packValue.sections) {
      if (!isRecord(sectionValue) || typeof sectionValue.id !== 'string' || !sectionValue.id || typeof sectionValue.label !== 'string' || !sectionValue.label || !Array.isArray(sectionValue.questionIds) || !sectionValue.questionIds.length) {
        validationError(`قسم ${label} غير صالح في ${chapterId}`)
      }
      if (sectionValue.content !== undefined && sectionValue.content !== null) {
        validateLessonContent(sectionValue.content, `قسم ${sectionValue.id}`)
      }
    }
  }

  for (const presetValue of raw.presets) {
    if (!isRecord(presetValue) || typeof presetValue.id !== 'string' || !presetValue.id || typeof presetValue.label !== 'string' || !presetValue.label) {
      validationError(`Preset ${label} غير صالح`)
    }
    if (presetValue.questions !== undefined) {
      if (!presetValue.quick || !Array.isArray(presetValue.questions) || presetValue.questions.length < 2 || !Array.isArray(presetValue.lessonIds) || presetValue.lessonIds.length !== 1) {
        validationError(`الفحص السريع ${presetValue.id} غير صالح`)
      }
      for (const questionValue of presetValue.questions) validateDrillQuestion(questionValue, presetValue.id)
      if (presetValue.count !== undefined && presetValue.count !== presetValue.questions.length) {
        validationError(`عدد أسئلة الفحص السريع ${presetValue.id} غير متطابق`)
      }
    } else if (presetValue.quick && (!Array.isArray(presetValue.lessonIds) || presetValue.lessonIds.length !== 1 || !Number.isInteger(presetValue.count) || (presetValue.count as number) < 2)) {
      validationError(`الفحص السريع ${presetValue.id} يحتاج قسمًا واحدًا وعدد أسئلة صالحًا`)
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
    content: section.content ?? null,
  }))
}

/** Compose built-in + custom content and add the drill questions/lesson index. */
export function prepareContent(
  builtinContent: ContentBundle = createEmptyContent(),
  customContent: ContentBundle = createEmptyContent(),
  ...drillBundlesInput: DrillsBundle[]
): PreparedContent {
  const data = cloneJson({ ...builtinContent.subjects, ...customContent.subjects })
  const schedule = mergeSchedules(builtinContent.schedule, customContent.schedule)
  const order = Object.keys(data)
  const bundles = drillBundlesInput.map(cloneJson)
  const drills = bundles[0] ?? createEmptyDrills()
  const customSubjectCodes = new Set(Object.keys(customContent.subjects ?? {}))
  const drillBundles = bundles.reduce<Record<string, DrillsBundle>>((catalog, bundle) => {
    // A user-imported subject is a complete override. Built-in additive drills
    // and presets must not leak back into a subject with the same code.
    if (bundle.subject && !customSubjectCodes.has(bundle.subject)) catalog[bundle.subject] = bundle
    return catalog
  }, {})

  for (const bundle of Object.values(drillBundles)) {
    const drillSubject = data[bundle.subject]
    if (drillSubject && bundle.chapters) {
      for (const chapter of Array.isArray(drillSubject.chapters) ? drillSubject.chapters : []) {
        const pack = bundle.chapters[chapter.id]
        if (!pack) continue
        chapter.questions = Array.isArray(chapter.questions) ? chapter.questions : []
        const seen = new Set(chapter.questions.map((question) => question.id))
        for (const question of pack.questions ?? []) {
          if (seen.has(question.id)) continue
          chapter.questions.push(cloneJson(question) as StudyQuestion)
          seen.add(question.id)
        }
        chapter.sections = cloneJson(pack.sections ?? [])
      }
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
          content: null,
        }))
      } else if (!chapter.questions.length && Array.isArray(chapter.lessons)) {
        chapter.questions = chapter.lessons.flatMap((lesson) => lesson.questions ?? [])
      }
    }
  }

  return { data, schedule, order, drills, drillBundles }
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
    validateBuiltinContent,
    createEmptyContent,
  )
  return {
    ...prepareContent(builtinContent, customContent),
    builtinContent,
    customContent,
  }
}

/**
 * Load the checked-in Security+ catalog, falling back to its localStorage
 * cache, then compose it with the user's private content.
 */
export async function loadPreparedContent(options: LoadPreparedContentOptions = {}): Promise<LoadedPreparedContent> {
  const cached = loadCachedPreparedContent(options)
  const storage = options.storage
  let builtinContent = cached.builtinContent
  const customContent = cached.customContent

  const fetcher = options.fetcher ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)
  const baseUrl = options.baseUrl ?? APP_BASE_PATH
  builtinContent = await refreshBundle(
    publicAssetUrl(BUILTIN_CONTENT_ASSET, baseUrl),
    builtinContent,
    validateBuiltinContent,
    STORAGE_KEYS.builtin,
    fetcher,
    storage,
  )

  return {
    ...prepareContent(builtinContent, customContent),
    builtinContent,
    customContent,
  }
}
