import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const finals = JSON.parse(readFileSync(resolve(root, 'public/finals-2026-t3.json'), 'utf8'))
const drills = JSON.parse(readFileSync(resolve(root, 'public/pdc-422-drills-v2.json'), 'utf8'))

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

invariant(finals.version === 1, 'finals version must be 1')
invariant(drills.version === 2, 'drills version must be 2')
invariant(drills.subject === 'CCCS422-FINAL', 'drills subject mismatch')

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
invariant(drills.presets.length === 5, `expected 5 presets, got ${drills.presets.length}`)

console.log(JSON.stringify({ baseQuestions: baseIds.size, drillQuestions: drillCount, sections: sectionCount, presets: drills.presets.length }, null, 2))

