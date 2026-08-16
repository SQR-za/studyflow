import { readFileSync } from 'node:fs'
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
let webDrillCount = 0
let webSectionCount = 0
for (const [chapterId, pack] of Object.entries(webDrills.chapters)) {
  const chapter = finals.subjects['WEB-EXAM2'].chapters.find(item => item.id === chapterId)
  invariant(chapter, `unknown web chapter ${chapterId}`)
  const available = new Set([...chapter.questions.map(question => question.id), ...pack.questions.map(question => question.id)])
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
    webSectionIds.add(section.id)
    for (const id of section.questionIds) {
      invariant(available.has(id), `unresolved web section reference ${chapterId}/${section.id}/${id}`)
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
invariant(webSectionCount === 18, `expected 18 web sections, got ${webSectionCount}`)
invariant(webRapidPresets.length === 18, `expected 18 web rapid presets, got ${webRapidPresets.length}`)
invariant(webRapidIds.size === 72, `expected 72 web rapid questions, got ${webRapidIds.size}`)
invariant(new Set(webRapidPresets.map(preset => preset.lessonIds[0])).size === 18, 'web rapid presets must cover every section once')

console.log(JSON.stringify({ baseQuestions: baseIds.size, pdcDrillQuestions: drillCount, pdcRapidQuestions: rapidIds.size, pdcSections: sectionCount, webDrillQuestions: webDrillCount, webRapidQuestions: webRapidIds.size, webSections: webSectionCount }, null, 2))
