export const STORAGE_KEYS = {
  progress: 'studyflow-v1',
  settings: 'studyflow-set-v1',
  plan: 'studyflow-plan-v1',
  password: 'studyflow-pass-v1',
  daily: 'studyflow-daily-v1',
  sync: 'studyflow-sync-v1',
  content: 'studyflow-content-v1',
  builtin: 'studyflow-builtin-security-plus-sy0-701-v1',
} as const

export const SECURITY_SUBJECT_CODE = 'SEC-PLUS'
export const BUILTIN_CODES = [SECURITY_SUBJECT_CODE] as const
export const BUILTIN_CONTENT_BUILD = 'security-plus-sy0-701-2026-08-17-v1'

export const APP_BASE_PATH = import.meta.env.BASE_URL
export const BUILTIN_CONTENT_ASSET = 'security-plus-sy0-701.json?v=20260817-1'

export const DEFAULT_SUBJECT_COLOR = '#38bdf8'
export const GAPS: Record<number, number> = { 1: 2, 2: 4, 3: 7, 4: 12, 5: 20 }
export const MASTERY_BOX = 4
export const DAY_MS = 86_400_000
export const SESSION_CAP = 5
export const APP_BUILD = 'v2.0.0-preview.13'

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  direct: '📌 مباشر',
  predict_output: '🔎 توقّع الناتج',
  predict_result: '🔎 توقّع النتيجة',
  find_fix: '🛠 اكتشف الخطأ',
  slide_example: '🎞 مثال السلايد',
}

export const GIST_API_URL = 'https://api.github.com/gists'
export const GIST_FILENAME = 'studyflow-progress.json'
export const GIST_DESCRIPTION = 'StudyFlow progress (encrypted)'
export const GIST_KDF_SALT = 'studyflow-sf'
export const GIST_KDF_ITERATIONS = 100_000
export const GIST_PUSH_DELAY = 2_500
import type { QuestionKind } from '../types'
