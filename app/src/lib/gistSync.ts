import type { DailyStore, PlanDoneStore, ProgressStore, SyncPayload, SyncSettings } from '../types'
import {
  GIST_API_URL,
  GIST_DESCRIPTION,
  GIST_FILENAME,
  GIST_KDF_ITERATIONS,
  GIST_KDF_SALT,
} from './constants'
import {
  normalizeDailyStore,
  normalizePlanDone,
  normalizeProgressStore,
} from './progress'

type UnknownRecord = Record<string, unknown>

interface GistFile {
  content?: string
}

interface GistRecord {
  id: string
  createdAt: string
  files: Record<string, GistFile>
}

export interface SyncData {
  store: ProgressStore
  planDone: PlanDoneStore
  daily: DailyStore
}

export interface PushSyncResult {
  sync: SyncSettings
  skipped: boolean
}

export interface PullSyncResult extends SyncData {
  sync: SyncSettings
  pulled: boolean
}

export interface GistSyncOptions {
  fetcher?: typeof fetch
}

export interface GistTokenTest {
  ok: boolean
  status: number
  hasGistScope: boolean | null
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireFetch(fetcher?: typeof fetch): typeof fetch {
  const resolved = fetcher ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)
  if (!resolved) throw new Error('Fetch غير متاح في هذا المتصفح')
  return resolved
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto غير متاح في هذا المتصفح')
  return globalThis.crypto
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** PBKDF2 parameters are intentionally frozen to the legacy StudyFlow format. */
export async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const cryptoApi = requireCrypto()
  const encoder = new TextEncoder()
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(GIST_KDF_SALT),
      iterations: GIST_KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Base64(12-byte IV + AES-GCM ciphertext/tag), byte-compatible with v1. */
export async function encryptJson(value: unknown, secret: string): Promise<string> {
  const cryptoApi = requireCrypto()
  const key = await deriveAesKey(secret)
  const iv = cryptoApi.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = new Uint8Array(await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))
  const packed = new Uint8Array(iv.length + ciphertext.length)
  packed.set(iv)
  packed.set(ciphertext, iv.length)
  return bytesToBase64(packed)
}

export async function decryptJson<T = unknown>(base64: string, secret: string): Promise<T> {
  const cryptoApi = requireCrypto()
  const key = await deriveAesKey(secret)
  const packed = base64ToBytes(base64)
  if (packed.length <= 12) throw new Error('بيانات المزامنة المشفرة غير صالحة')
  const plaintext = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.slice(0, 12) },
    key,
    packed.slice(12),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

// Familiar aliases make migration from the single-file app straightforward.
export const aesKey = deriveAesKey
export const encJSON = encryptJson
export const decJSON = decryptJson

export function gistHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

function parseGist(value: unknown): GistRecord | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.files)) return null
  const files: Record<string, GistFile> = {}
  for (const [name, fileValue] of Object.entries(value.files)) {
    if (!isRecord(fileValue)) continue
    files[name] = { content: typeof fileValue.content === 'string' ? fileValue.content : undefined }
  }
  return {
    id: value.id,
    createdAt: typeof value.created_at === 'string' ? value.created_at : '',
    files,
  }
}

function studyFlowGists(raw: unknown): GistRecord[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(parseGist)
    .filter((gist): gist is GistRecord => Boolean(gist?.files[GIST_FILENAME]))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

async function listGists(token: string, fetcher: typeof fetch): Promise<{ response: Response; gists: GistRecord[] }> {
  const response = await fetcher(`${GIST_API_URL}?per_page=100`, {
    headers: gistHeaders(token),
    cache: 'no-store',
  })
  if (!response.ok) return { response, gists: [] }
  return { response, gists: studyFlowGists(await response.json()) }
}

export async function ensureGist(sync: SyncSettings, options: GistSyncOptions = {}): Promise<SyncSettings> {
  if (sync.gistId) return sync
  if (!sync.token) throw new Error('رمز GitHub مفقود')
  const fetcher = requireFetch(options.fetcher)
  const { response, gists } = await listGists(sync.token, fetcher)
  if (!response.ok) throw new Error(`قراءة Gists فشلت (${response.status})`)
  if (gists.length) return { ...sync, gistId: gists[0].id }

  const createResponse = await fetcher(GIST_API_URL, {
    method: 'POST',
    headers: gistHeaders(sync.token),
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILENAME]: { content: '{}' } },
    }),
  })
  if (!createResponse.ok) {
    let detail = String(createResponse.status)
    try {
      const body = await createResponse.json() as unknown
      if (isRecord(body) && typeof body.message === 'string') detail += ` — ${body.message}`
    } catch {
      // The status code is enough when GitHub does not return JSON.
    }
    throw new Error(`إنشاء Gist فشل (${detail}). يحتاج Classic token بصلاحية gist`)
  }

  const created = parseGist(await createResponse.json())
  if (!created?.id) throw new Error('استجابة إنشاء Gist غير صالحة')
  return { ...sync, gistId: created.id }
}

export function createSyncPayload(data: SyncData, at = Date.now()): SyncPayload {
  return { store: data.store, plan: data.planDone, daily: data.daily, _at: at }
}

/** Merge rules intentionally match v1: seen count, latest test, union, max/day. */
export function mergeRemotePayload(local: SyncData, remote: unknown): SyncData {
  if (!isRecord(remote)) return local
  let store = normalizeProgressStore(local.store)
  let planDone = normalizePlanDone(local.planDone)
  let daily = normalizeDailyStore(local.daily)

  const remoteStoreValue = remote.store
  if (isRecord(remoteStoreValue) && isRecord(remoteStoreValue.q)) {
    const remoteStore = normalizeProgressStore(remoteStoreValue)
    const q = { ...store.q }
    for (const [id, remoteProgress] of Object.entries(remoteStore.q)) {
      const localProgress = q[id]
      if (!localProgress || (remoteProgress.seen || 0) > (localProgress.seen || 0)) q[id] = remoteProgress
    }

    const star = { ...remoteStore.star, ...store.star }
    const tests = { ...store.tests }
    for (const [id, test] of Object.entries(remoteStore.tests)) {
      if (!tests[id] || String(test.at || '') > String(tests[id].at || '')) tests[id] = test
    }

    const attemptsById = new Map(
      [...remoteStore.attempts, ...store.attempts].map((attempt) => [attempt.id, attempt]),
    )
    const attempts = [...attemptsById.values()]
      .sort((left, right) => String(right.at).localeCompare(String(left.at)))
      .slice(0, 100)
    store = { ...store, q, star, tests, attempts }
  }

  if (isRecord(remote.plan)) planDone = { ...normalizePlanDone(remote.plan), ...planDone }
  if (isRecord(remote.daily) && isRecord(remote.daily.dates)) {
    const remoteDaily = normalizeDailyStore(remote.daily)
    const dates = { ...daily.dates }
    for (const [date, count] of Object.entries(remoteDaily.dates)) dates[date] = Math.max(dates[date] ?? 0, count)
    daily = { dates }
  }
  return { store, planDone, daily }
}

export async function pushGistSync(
  sync: SyncSettings,
  data: SyncData,
  options: GistSyncOptions = {},
): Promise<PushSyncResult> {
  if (!sync.enabled || !sync.token) return { sync, skipped: true }
  const fetcher = requireFetch(options.fetcher)
  const ensured = await ensureGist(sync, { fetcher })
  const blob = await encryptJson(createSyncPayload(data), ensured.token)
  const response = await fetcher(`${GIST_API_URL}/${ensured.gistId}`, {
    method: 'PATCH',
    headers: gistHeaders(ensured.token),
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content: blob } } }),
  })
  if (!response.ok) throw new Error(`تعذّر الحفظ (${response.status})`)
  return { sync: ensured, skipped: false }
}

export async function pullGistSync(
  sync: SyncSettings,
  local: SyncData,
  options: GistSyncOptions = {},
): Promise<PullSyncResult> {
  if (!sync.enabled || !sync.token) return { ...local, sync, pulled: false }
  const fetcher = requireFetch(options.fetcher)
  const listed = await listGists(sync.token, fetcher)
  if (!listed.response.ok) throw new Error(`تعذّر الجلب (${listed.response.status})`)
  if (!listed.gists.length) {
    const ensured = await ensureGist({ ...sync, gistId: '' }, { fetcher })
    return { ...local, sync: ensured, pulled: false }
  }

  const primary = listed.gists[0]
  const nextSync = { ...sync, gistId: primary.id }
  let merged = local
  let pulled = false

  for (const gist of listed.gists) {
    try {
      const response = await fetcher(`${GIST_API_URL}/${gist.id}`, {
        headers: gistHeaders(sync.token),
        cache: 'no-store',
      })
      if (!response.ok) continue
      const detail = parseGist(await response.json())
      const content = detail?.files[GIST_FILENAME]?.content
      if (content && content !== '{}') {
        merged = mergeRemotePayload(merged, await decryptJson(content, sync.token))
        pulled = true
      }
    } catch {
      // One stale/corrupt duplicate must not prevent merging the others.
    }
  }

  for (const duplicate of listed.gists.slice(1)) {
    try {
      await fetcher(`${GIST_API_URL}/${duplicate.id}`, {
        method: 'DELETE',
        headers: gistHeaders(sync.token),
      })
    } catch {
      // Best effort, matching the legacy duplicate cleanup.
    }
  }

  if (listed.gists.length > 1) {
    try {
      const blob = await encryptJson(createSyncPayload(merged), sync.token)
      await fetcher(`${GIST_API_URL}/${primary.id}`, {
        method: 'PATCH',
        headers: gistHeaders(sync.token),
        body: JSON.stringify({ files: { [GIST_FILENAME]: { content: blob } } }),
      })
    } catch {
      // Pull already succeeded; consolidation can be retried on the next sync.
    }
  }

  return { ...merged, sync: nextSync, pulled }
}

export async function testGistToken(token: string, options: GistSyncOptions = {}): Promise<GistTokenTest> {
  const fetcher = requireFetch(options.fetcher)
  const response = await fetcher(`${GIST_API_URL}?per_page=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  })
  const scopes = response.headers.get('X-OAuth-Scopes')
  return {
    ok: response.ok,
    status: response.status,
    hasGistScope: scopes === null ? null : scopes.split(',').map((scope) => scope.trim()).includes('gist'),
  }
}
