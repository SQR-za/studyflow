export const STORAGE_KEYS = {
  progress: 'studyflow-v1',
  settings: 'studyflow-set-v1',
  plan: 'studyflow-plan-v1',
  password: 'studyflow-pass-v1',
  daily: 'studyflow-daily-v1',
  sync: 'studyflow-sync-v1',
  content: 'studyflow-content-v1',
  builtin: 'studyflow-builtin-finals-2026-t3-v1',
  drills: 'studyflow-pdc-422-drills-v2',
} as const

export const BUILTIN_CODES = ['CCCS422-FINAL', 'WEB-EXAM2'] as const
export const BUILTIN_FINALS_BUILD = '2026-08-12-v4'
export const PDC_SUBJECT_CODE = 'CCCS422-FINAL'

export const APP_BASE_PATH = import.meta.env.BASE_URL
export const BUILTIN_CONTENT_ASSET = 'finals-2026-t3.json?v=20260812-4'
export const PDC_DRILLS_ASSET = 'pdc-422-drills-v2.json?v=20260813-1'

export const DEFAULT_SUBJECT_COLOR = '#38bdf8'
export const GAPS: Record<number, number> = { 1: 2, 2: 4, 3: 7, 4: 12, 5: 20 }
export const MASTERY_BOX = 4
export const DAY_MS = 86_400_000
export const SESSION_CAP = 5
export const APP_BUILD = 'v2.0.0-preview.6'

export const GIST_API_URL = 'https://api.github.com/gists'
export const GIST_FILENAME = 'studyflow-progress.json'
export const GIST_DESCRIPTION = 'StudyFlow progress (encrypted)'
export const GIST_KDF_SALT = 'studyflow-sf'
export const GIST_KDF_ITERATIONS = 100_000
export const GIST_PUSH_DELAY = 2_500
