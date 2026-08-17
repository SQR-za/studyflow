import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const content = JSON.parse(readFileSync(resolve(root, 'public/security-plus-sy0-701.json'), 'utf8'))

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

invariant(content.version === 1, 'content version must be 1')
invariant(Object.keys(content.subjects ?? {}).length === 1, 'the public catalog must contain one subject only')

const subject = content.subjects?.['SEC-PLUS']
invariant(subject?.code === 'SEC-PLUS', 'missing Security+ subject')
invariant(subject.name === 'Security+ · CompTIA SY0-701', 'unexpected Security+ title')
invariant(subject.chapters?.length === 5, 'Security+ must contain five domains')

const ids = new Set()
let questionCount = 0
let choiceCount = 0
let matchCount = 0
let objectiveCount = 0

for (const chapter of subject.chapters) {
  invariant(chapter.id && chapter.label, 'every domain needs an id and label')
  const objectives = chapter.objectives ?? []
  const objectiveIds = new Set(objectives.map(objective => String(objective.num)))
  const noteIds = Object.keys(chapter.objNotes ?? {})
  invariant(objectiveIds.size === objectives.length && objectiveIds.size > 0, `invalid objectives in ${chapter.id}`)
  invariant(noteIds.length === objectiveIds.size && noteIds.every(id => objectiveIds.has(id)), `objective notes mismatch in ${chapter.id}`)
  objectiveCount += objectives.length

  for (const [objectiveId, notes] of Object.entries(chapter.objNotes)) {
    invariant(['draw', 'formulas', 'practice', 'watch'].every(key => Array.isArray(notes[key])), `incomplete notes for objective ${objectiveId}`)
  }

  for (const question of chapter.questions ?? []) {
    invariant(question.id && question.q && !ids.has(question.id), `invalid or duplicate question id ${question.id}`)
    invariant(objectiveIds.has(String(question.obj ?? '')), `unresolved objective for ${question.id}`)
    ids.add(question.id)
    questionCount += 1

    if (question.type === 'match') {
      invariant(Array.isArray(question.pairs) && question.pairs.length >= 2, `invalid matching question ${question.id}`)
      matchCount += 1
    } else {
      invariant(Array.isArray(question.choices) && question.choices.length >= 2, `missing choices for ${question.id}`)
      invariant(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `invalid answer for ${question.id}`)
      choiceCount += 1
    }
  }
}

invariant(objectiveCount === 28, `expected 28 objectives, got ${objectiveCount}`)
invariant(questionCount === 987, `expected 987 questions, got ${questionCount}`)
invariant(choiceCount === 876, `expected 876 choice questions, got ${choiceCount}`)
invariant(matchCount === 111, `expected 111 matching questions, got ${matchCount}`)
invariant(content.schedule?.plan?.length === 0, 'the built-in study plan must be empty')
invariant(content.schedule?.exams?.length === 1 && content.schedule.exams[0].c === 'SEC-PLUS', 'the schedule must contain Security+ only')

console.log(JSON.stringify({ subjects: 1, domains: 5, objectives: objectiveCount, questions: questionCount, choiceQuestions: choiceCount, matchingQuestions: matchCount }, null, 2))
