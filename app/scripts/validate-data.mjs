import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const finals = JSON.parse(readFileSync(resolve(root, 'public/finals-2026-t3.json'), 'utf8'))
const drills = JSON.parse(readFileSync(resolve(root, 'public/pdc-422-drills-v2.json'), 'utf8'))
const webDrills = JSON.parse(readFileSync(resolve(root, 'public/web-321-drills-v1.json'), 'utf8'))

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

invariant(finals.version === 1, 'finals version must be 1')
invariant(drills.version === 2, 'drills version must be 2')
invariant(drills.subject === 'CCCS422-FINAL', 'drills subject mismatch')
invariant(webDrills.version === 2, 'web drills version must be 2')
invariant(webDrills.subject === 'WEB-EXAM2', 'web drills subject mismatch')

const baseIds = new Set()
for (const code of ['CCCS422-FINAL', 'WEB-EXAM2']) {
  const subject = finals.subjects?.[code]
  invariant(subject, `missing subject ${code}`)
  invariant(subject.chapters.length === 3, `${code} must contain three chapters`)
  const questions = subject.chapters.flatMap(chapter => chapter.questions ?? [])
  invariant(questions.length === 105, `${code} must contain 105 questions`)
  for (const question of questions) {
    invariant(question.id && !baseIds.has(question.id), `duplicate base id ${question.id}`)
    baseIds.add(question.id)
    if (question.type === 'match') {
      invariant(question.pairs.length >= 2, `invalid match ${question.id}`)
      invariant(!question.pairHints_ar || question.pairHints_ar.length === question.pairs.length, `hint mismatch ${question.id}`)
    } else invariant(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `invalid answer ${question.id}`)
  }
}

const drillIds = new Set()
let drillCount = 0
let sectionCount = 0
for (const [chapterId, pack] of Object.entries(drills.chapters)) {
  const chapterQuestionIds = new Set(pack.questions.map(question => question.id))
  for (const question of pack.questions) {
    invariant(!baseIds.has(question.id) && !drillIds.has(question.id), `duplicate drill id ${question.id}`)
    invariant(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `invalid drill answer ${question.id}`)
    drillIds.add(question.id)
    drillCount += 1
  }
  for (const section of pack.sections) {
    invariant(section.questionIds.length > 0, `empty section ${section.id}`)
    for (const id of section.questionIds) invariant(chapterQuestionIds.has(id) || baseIds.has(id), `unresolved section reference ${chapterId}/${section.id}/${id}`)
    sectionCount += 1
  }
}

invariant(drillCount === 67, `expected 67 drill questions, got ${drillCount}`)
invariant(sectionCount === 13, `expected 13 sections, got ${sectionCount}`)
const sectionIds = new Set(Object.values(drills.chapters).flatMap(pack => pack.sections.map(section => section.id)))
const rapidIds = new Set()
const rapidPresets = drills.presets.filter(preset => preset.quick)
for (const preset of rapidPresets) {
  invariant(preset.lessonIds?.length === 1 && sectionIds.has(preset.lessonIds[0]), `invalid rapid section ${preset.id}`)
  invariant(preset.count === 4 && preset.questions?.length === 4, `rapid preset must contain four questions: ${preset.id}`)
  for (const question of preset.questions) {
    invariant(question.id && !baseIds.has(question.id) && !drillIds.has(question.id) && !rapidIds.has(question.id), `duplicate rapid id ${question.id}`)
    invariant(question.section === preset.lessonIds[0], `rapid section mismatch ${question.id}`)
    invariant(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `invalid rapid answer ${question.id}`)
    invariant(question.q_ar && question.hint_ar && question.explanation && question.explanation_ar && question.source, `incomplete rapid question ${question.id}`)
    rapidIds.add(question.id)
  }
}
invariant(drills.presets.length === 18, `expected 18 presets, got ${drills.presets.length}`)
invariant(rapidPresets.length === 13, `expected 13 rapid presets, got ${rapidPresets.length}`)
invariant(rapidIds.size === 52, `expected 52 rapid questions, got ${rapidIds.size}`)
invariant(new Set(rapidPresets.map(preset => preset.lessonIds[0])).size === 13, 'rapid presets must cover every section once')

const webBaseIds = new Set(finals.subjects['WEB-EXAM2'].chapters.flatMap(chapter => chapter.questions.map(question => question.id)))
for (const question of finals.subjects['WEB-EXAM2'].chapters.flatMap(chapter => chapter.questions)) {
  invariant(question.q_ar && question.hint_ar && question.explanation_ar && question.source && question.section, `incomplete enriched web base question ${question.id}`)
}
const webDrillIds = new Set()
const webSectionIds = new Set()
const webLessonAssetRefs = new Set()
const expectedWebChapterQuestionCounts = {
  'web-exam2-t5': 75,
  'web-exam2-t6': 97,
  'web-exam2-t7': 81,
}
let webDrillCount = 0
let webSectionCount = 0
let webComprehensiveQuestionCount = 0

function validateLessonFigure(figure, context) {
  invariant(figure && typeof figure === 'object', 'missing lesson figure ' + context)
  invariant(typeof figure.src === 'string' && /^lesson-assets\/web-exam2\/t[567]\/[^/]+\.webp$/.test(figure.src), 'invalid lesson image path ' + context)
  invariant(!figure.src.split('/').includes('..'), 'unsafe lesson image path ' + context)
  invariant(typeof figure.alt === 'string' && figure.alt.trim().length >= 20, 'missing lesson image alt ' + context)
  invariant(typeof figure.caption === 'string' && figure.caption.trim(), 'missing lesson image caption ' + context)
  invariant(typeof figure.source === 'string' && /slide \d+/i.test(figure.source), 'missing lesson image source ' + context)
  invariant(Number.isInteger(figure.width) && figure.width > 0 && Number.isInteger(figure.height) && figure.height > 0, 'invalid lesson image dimensions ' + context)
  invariant(existsSync(resolve(root, 'public', figure.src)), 'unresolved lesson image ' + context + ': ' + figure.src)
  invariant(!webLessonAssetRefs.has(figure.src), 'duplicate lesson image reference ' + figure.src)
  webLessonAssetRefs.add(figure.src)
}

function validateLessonContent(content, sectionId) {
  invariant(content && typeof content === 'object', 'missing lesson content ' + sectionId)
  invariant(typeof content.summary === 'string' && content.summary.trim(), 'missing lesson summary ' + sectionId)
  invariant(Array.isArray(content.objectives) && content.objectives.length >= 3 && content.objectives.every(item => typeof item === 'string' && item.trim()), 'invalid lesson objectives ' + sectionId)
  invariant(Array.isArray(content.blocks) && content.blocks.length >= 5, 'lesson is too short ' + sectionId)
  invariant(Array.isArray(content.recap) && content.recap.length >= 3 && content.recap.every(item => typeof item === 'string' && item.trim()), 'invalid lesson recap ' + sectionId)

  let hasEnglishDefinition = false
  let hasArabicExplanation = /[\u0600-\u06FF]/.test(content.summary)
  let hasExamCallout = false
  for (const [index, block] of content.blocks.entries()) {
    const context = sectionId + '/block-' + (index + 1)
    invariant(block && typeof block === 'object' && typeof block.type === 'string', 'invalid lesson block ' + context)
    if (block.type === 'text') {
      invariant(Array.isArray(block.paragraphs) && block.paragraphs.length >= 2 && block.paragraphs.every(item => typeof item === 'string' && item.trim()), 'invalid lesson text ' + context)
      hasEnglishDefinition ||= block.paragraphs.some(item => /^Definition\b/.test(item))
      hasArabicExplanation ||= block.paragraphs.some(item => /[\u0600-\u06FF]/.test(item))
    } else if (block.type === 'list') {
      invariant(Array.isArray(block.items) && block.items.length >= 2 && block.items.every(item => typeof item === 'string' && item.trim()), 'invalid lesson list ' + context)
    } else if (block.type === 'code') {
      invariant(['html', 'css', 'javascript'].includes(block.language) && typeof block.code === 'string' && block.code.trim(), 'invalid typed lesson code ' + context)
      invariant(!block.explanation || /[\u0600-\u06FF]/.test(block.explanation), 'lesson code needs Arabic explanation ' + context)
      if (block.result) validateLessonFigure(block.result, context + '/result')
    } else if (block.type === 'figure') {
      validateLessonFigure(block.figure, context)
    } else if (block.type === 'callout') {
      invariant(['key', 'exam', 'warning'].includes(block.tone) && typeof block.text === 'string' && block.text.trim(), 'invalid lesson callout ' + context)
      hasExamCallout ||= block.tone === 'exam'
    } else invariant(false, 'unknown lesson block type ' + context)
  }
  invariant(hasEnglishDefinition, 'lesson needs an English definition ' + sectionId)
  invariant(hasArabicExplanation, 'lesson needs Arabic explanation ' + sectionId)
  invariant(hasExamCallout, 'lesson needs exam focus ' + sectionId)
}

for (const [chapterId, pack] of Object.entries(webDrills.chapters)) {
  const chapter = finals.subjects['WEB-EXAM2'].chapters.find(item => item.id === chapterId)
  invariant(chapter, `unknown web chapter ${chapterId}`)
  const availableQuestions = new Map([...chapter.questions, ...pack.questions].map(question => [question.id, question]))
  const available = new Set(availableQuestions.keys())
  invariant(available.size === expectedWebChapterQuestionCounts[chapterId], `unexpected comprehensive count for ${chapterId}: ${available.size}`)
  webComprehensiveQuestionCount += available.size
  for (const question of pack.questions) {
    invariant(question.id && !baseIds.has(question.id) && !webDrillIds.has(question.id), `duplicate web drill id ${question.id}`)
    invariant(question.q_ar && question.hint_ar && question.explanation && question.explanation_ar && question.source && question.section, `incomplete web drill ${question.id}`)
    if (question.type === 'match') invariant(question.pairs?.length >= 2, `invalid web match ${question.id}`)
    else invariant(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `invalid web answer ${question.id}`)
    webDrillIds.add(question.id)
    webDrillCount += 1
  }
  const references = new Map()
  for (const section of pack.sections) {
    invariant(section.questionIds.length > 0, `empty web section ${section.id}`)
    invariant(!webSectionIds.has(section.id), `duplicate web section ${section.id}`)
    validateLessonContent(section.content, section.id)
    webSectionIds.add(section.id)
    for (const id of section.questionIds) {
      invariant(available.has(id), `unresolved web section reference ${chapterId}/${section.id}/${id}`)
      invariant(availableQuestions.get(id).section === section.id, `web question section mismatch ${id}: ${availableQuestions.get(id).section} !== ${section.id}`)
      references.set(id, (references.get(id) ?? 0) + 1)
    }
    webSectionCount += 1
  }
  for (const id of available) invariant(references.get(id) === 1, `web question must map to exactly one section: ${id}`)
}

const webRapidIds = new Set()
const webRapidPresets = webDrills.presets.filter(preset => preset.quick)
for (const preset of webRapidPresets) {
  invariant(preset.lessonIds?.length === 1 && webSectionIds.has(preset.lessonIds[0]), `invalid web rapid section ${preset.id}`)
  invariant(preset.count === 4 && preset.questions?.length === 4, `web rapid preset must contain four questions: ${preset.id}`)
  for (const question of preset.questions) {
    invariant(question.id && !webBaseIds.has(question.id) && !webDrillIds.has(question.id) && !webRapidIds.has(question.id), `duplicate web rapid id ${question.id}`)
    invariant(question.section === preset.lessonIds[0], `web rapid section mismatch ${question.id}`)
    invariant(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `invalid web rapid answer ${question.id}`)
    invariant(question.q_ar && question.hint_ar && question.explanation && question.explanation_ar && question.source, `incomplete web rapid question ${question.id}`)
    webRapidIds.add(question.id)
  }
}
invariant(webDrillCount === 148, `expected 148 web drill questions, got ${webDrillCount}`)
invariant(webComprehensiveQuestionCount === 253, `expected 253 comprehensive web questions, got ${webComprehensiveQuestionCount}`)
invariant(webSectionCount === 18, `expected 18 web sections, got ${webSectionCount}`)
invariant(webRapidPresets.length === 18, `expected 18 web rapid presets, got ${webRapidPresets.length}`)
invariant(webRapidIds.size === 72, `expected 72 web rapid questions, got ${webRapidIds.size}`)
invariant(new Set(webRapidPresets.map(preset => preset.lessonIds[0])).size === 18, 'web rapid presets must cover every section once')

const checkedInLessonAssets = readdirSync(resolve(root, 'public/lesson-assets/web-exam2'), { recursive: true })
  .filter(file => typeof file === 'string' && file.endsWith('.webp'))
invariant(webLessonAssetRefs.size === 36, 'expected 36 referenced lesson images, got ' + webLessonAssetRefs.size)
invariant(checkedInLessonAssets.length === webLessonAssetRefs.size, 'expected every lesson image to be referenced once; found ' + checkedInLessonAssets.length + ' files and ' + webLessonAssetRefs.size + ' references')

console.log(JSON.stringify({ baseQuestions: baseIds.size, pdcDrillQuestions: drillCount, pdcRapidQuestions: rapidIds.size, pdcSections: sectionCount, webDrillQuestions: webDrillCount, webComprehensiveQuestions: webComprehensiveQuestionCount, webRapidQuestions: webRapidIds.size, webSections: webSectionCount, webLessons: webSectionCount, webLessonImages: webLessonAssetRefs.size }, null, 2))
