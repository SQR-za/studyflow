import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppSettings,
  ContentBundle,
  DailyStore,
  DrillsBundle,
  PlanDoneStore,
  ProgressBackup,
  ProgressStore,
  QuestionProgress,
  StudySchedule,
  Subject,
  SyncSettings,
  SyncState,
} from '../types'
import {
  createEmptyContent,
  loadCachedPreparedContent,
  loadPreparedContent,
  prepareContent,
  validateContent,
} from '../lib/content'
import { BUILTIN_CODES, BUILTIN_FINALS_BUILD, GIST_PUSH_DELAY, STORAGE_KEYS } from '../lib/constants'
import { mergeRemotePayload, pullGistSync, pushGistSync } from '../lib/gistSync'
import {
  createDailyStore,
  createDefaultSettings,
  createProgressBackup,
  createProgressStore,
  createSyncSettings,
  normalizeDailyStore,
  normalizePlanDone,
  normalizeProgressStore,
  normalizeSettings,
  normalizeSyncSettings,
  parseProgressBackup,
  setQuestionProgress,
} from '../lib/progress'
import { loadJson, saveJson } from '../lib/storage'

export type ValueUpdater<T> = T | ((current: T) => T)
export type PatchUpdater<T> = Partial<T> | ((current: T) => Partial<T> | T)

export interface AppContextValue {
  ready: boolean
  error: string | null
  data: Record<string, Subject>
  schedule: StudySchedule
  order: string[]
  drills: DrillsBundle
  store: ProgressStore
  settings: AppSettings
  planDone: PlanDoneStore
  daily: DailyStore
  sync: SyncSettings
  syncState: SyncState
  customContent: ContentBundle
  updateStore: (updater: ValueUpdater<ProgressStore>) => void
  updateQuestionProgress: (id: string, next: QuestionProgress) => void
  updateSettings: (updater: PatchUpdater<AppSettings>) => void
  setPlanDone: (updater: ValueUpdater<PlanDoneStore>) => void
  setDaily: (updater: ValueUpdater<DailyStore>) => void
  replaceCustomContent: (raw: unknown) => ContentBundle
  clearCustomContent: () => void
  updateSync: (updater: PatchUpdater<SyncSettings>) => void
  pullSync: () => Promise<boolean>
  pushSync: () => Promise<boolean>
  importProgress: (raw: unknown) => void
  exportProgress: () => ProgressBackup
}

const AppContext = createContext<AppContextValue | null>(null)

function resolveValue<T>(current: T, updater: ValueUpdater<T>): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(current) : updater
}

function resolvePatch<T extends object>(current: T, updater: PatchUpdater<T>): T {
  const patch = typeof updater === 'function' ? (updater as (value: T) => Partial<T> | T)(current) : updater
  return { ...current, ...patch }
}

function initialCustomContent(): ContentBundle {
  try {
    return validateContent(loadJson<unknown>(STORAGE_KEYS.content, createEmptyContent()))
  } catch {
    return createEmptyContent()
  }
}

function initialSettings(): AppSettings {
  const loaded = normalizeSettings(loadJson<unknown>(STORAGE_KEYS.settings, createDefaultSettings()))
  if (loaded.builtinFinalsBuild === BUILTIN_FINALS_BUILD) return loaded
  return {
    ...loaded,
    hidden: loaded.hidden.filter((code) => !BUILTIN_CODES.includes(code as (typeof BUILTIN_CODES)[number])),
    builtinFinalsBuild: BUILTIN_FINALS_BUILD,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [customContent, setCustomContent] = useState<ContentBundle>(initialCustomContent)
  const [initialContent] = useState(() => loadCachedPreparedContent({ customContent }))
  const [prepared, setPrepared] = useState(() => prepareContent(initialContent.builtinContent, customContent, initialContent.drills))
  const [store, setStore] = useState(() => normalizeProgressStore(loadJson<unknown>(STORAGE_KEYS.progress, createProgressStore())))
  const [settings, setSettings] = useState<AppSettings>(initialSettings)
  const [planDone, setPlanDoneState] = useState(() => normalizePlanDone(loadJson<unknown>(STORAGE_KEYS.plan, {})))
  const [daily, setDailyState] = useState(() => normalizeDailyStore(loadJson<unknown>(STORAGE_KEYS.daily, createDailyStore())))
  const [sync, setSync] = useState(() => normalizeSyncSettings(loadJson<unknown>(STORAGE_KEYS.sync, createSyncSettings())))
  const [ready, setReady] = useState(initialContent.order.length > 0)
  const [error, setError] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<SyncState>({ phase: 'off', message: 'مطفّأة' })

  const customRef = useRef(customContent)
  const storeRef = useRef(store)
  const settingsRef = useRef(settings)
  const planRef = useRef(planDone)
  const dailyRef = useRef(daily)
  const syncRef = useRef(sync)
  const bundlesRef = useRef({ builtin: initialContent.builtinContent, drills: initialContent.drills })
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushSyncRef = useRef<() => Promise<boolean>>(async () => false)
  const initialPullRef = useRef(false)

  const schedulePush = useCallback(() => {
    if (!syncRef.current.enabled || !syncRef.current.token) return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => void pushSyncRef.current(), GIST_PUSH_DELAY)
  }, [])

  const commitSync = useCallback((next: SyncSettings) => {
    const normalized = normalizeSyncSettings(next)
    syncRef.current = normalized
    setSync(normalized)
    saveJson(STORAGE_KEYS.sync, normalized)
  }, [])

  const updateStore = useCallback((updater: ValueUpdater<ProgressStore>) => {
    const next = normalizeProgressStore(resolveValue(storeRef.current, updater))
    storeRef.current = next
    setStore(next)
    saveJson(STORAGE_KEYS.progress, next)
    schedulePush()
  }, [schedulePush])

  const updateQuestionProgress = useCallback((id: string, next: QuestionProgress) => {
    updateStore((current) => setQuestionProgress(current, id, next))
  }, [updateStore])

  const updateSettings = useCallback((updater: PatchUpdater<AppSettings>) => {
    const next = normalizeSettings(resolvePatch(settingsRef.current, updater), settingsRef.current)
    settingsRef.current = next
    setSettings(next)
    saveJson(STORAGE_KEYS.settings, next)
  }, [])

  const setPlanDone = useCallback((updater: ValueUpdater<PlanDoneStore>) => {
    const next = normalizePlanDone(resolveValue(planRef.current, updater))
    planRef.current = next
    setPlanDoneState(next)
    saveJson(STORAGE_KEYS.plan, next)
    schedulePush()
  }, [schedulePush])

  const setDaily = useCallback((updater: ValueUpdater<DailyStore>) => {
    const next = normalizeDailyStore(resolveValue(dailyRef.current, updater))
    dailyRef.current = next
    setDailyState(next)
    saveJson(STORAGE_KEYS.daily, next)
    schedulePush()
  }, [schedulePush])

  const updateSync = useCallback((updater: PatchUpdater<SyncSettings>) => {
    const next = normalizeSyncSettings(resolvePatch(syncRef.current, updater))
    commitSync(next)
    if (!next.enabled) setSyncState({ phase: 'off', message: 'مطفّأة' })
  }, [commitSync])

  const replaceCustomContent = useCallback((raw: unknown): ContentBundle => {
    const next = validateContent(raw)
    customRef.current = next
    setCustomContent(next)
    saveJson(STORAGE_KEYS.content, next)
    const composed = prepareContent(bundlesRef.current.builtin, next, bundlesRef.current.drills)
    setPrepared(composed)
    updateSettings({ hidden: [] })
    return next
  }, [updateSettings])

  const clearCustomContent = useCallback(() => {
    const next = createEmptyContent()
    customRef.current = next
    setCustomContent(next)
    saveJson(STORAGE_KEYS.content, next)
    setPrepared(prepareContent(bundlesRef.current.builtin, next, bundlesRef.current.drills))
  }, [])

  const pushSync = useCallback(async (): Promise<boolean> => {
    const currentSync = syncRef.current
    if (!currentSync.enabled || !currentSync.token) return false
    setSyncState({ phase: 'syncing', message: 'جارٍ' })
    try {
      const result = await pushGistSync(currentSync, {
        store: storeRef.current,
        planDone: planRef.current,
        daily: dailyRef.current,
      })
      commitSync(result.sync)
      setSyncState({ phase: 'synced', message: 'تمت المزامنة ✓' })
      return !result.skipped
    } catch (syncError) {
      setSyncState({ phase: 'error', message: `تعذّر الحفظ: ${errorMessage(syncError)}` })
      return false
    }
  }, [commitSync])

  pushSyncRef.current = pushSync

  const pullSync = useCallback(async (): Promise<boolean> => {
    const currentSync = syncRef.current
    if (!currentSync.enabled || !currentSync.token) return false
    setSyncState({ phase: 'syncing', message: 'جارٍ' })
    try {
      const result = await pullGistSync(currentSync, {
        store: storeRef.current,
        planDone: planRef.current,
        daily: dailyRef.current,
      })
      const merged = mergeRemotePayload(
        { store: storeRef.current, planDone: planRef.current, daily: dailyRef.current },
        { store: result.store, plan: result.planDone, daily: result.daily },
      )
      storeRef.current = merged.store
      planRef.current = merged.planDone
      dailyRef.current = merged.daily
      setStore(merged.store)
      setPlanDoneState(merged.planDone)
      setDailyState(merged.daily)
      saveJson(STORAGE_KEYS.progress, merged.store)
      saveJson(STORAGE_KEYS.plan, merged.planDone)
      saveJson(STORAGE_KEYS.daily, merged.daily)
      commitSync(result.sync)
      setSyncState({ phase: 'synced', message: result.pulled ? 'مُزامَن ✓' : 'مُزامَن' })
      return result.pulled
    } catch (syncError) {
      setSyncState({ phase: 'error', message: `تعذّر الجلب: ${errorMessage(syncError)}` })
      return false
    }
  }, [commitSync])

  const importProgress = useCallback((raw: unknown) => {
    const backup = parseProgressBackup(raw, settingsRef.current)
    storeRef.current = backup.store
    planRef.current = backup.plan
    dailyRef.current = backup.daily
    settingsRef.current = backup.settings
    setStore(backup.store)
    setPlanDoneState(backup.plan)
    setDailyState(backup.daily)
    setSettings(backup.settings)
    saveJson(STORAGE_KEYS.progress, backup.store)
    saveJson(STORAGE_KEYS.plan, backup.plan)
    saveJson(STORAGE_KEYS.daily, backup.daily)
    saveJson(STORAGE_KEYS.settings, backup.settings)
  }, [])

  const exportProgress = useCallback(() => createProgressBackup(
    storeRef.current,
    planRef.current,
    dailyRef.current,
    settingsRef.current,
  ), [])

  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, settingsRef.current)
    let cancelled = false
    void loadPreparedContent({ customContent: customRef.current })
      .then((loaded) => {
        if (cancelled) return
        bundlesRef.current = { builtin: loaded.builtinContent, drills: loaded.drills }
        setPrepared(prepareContent(loaded.builtinContent, customRef.current, loaded.drills))
        setReady(true)
        setError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(errorMessage(loadError))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || initialPullRef.current) return
    initialPullRef.current = true
    if (syncRef.current.enabled) void pullSync()
  }, [ready, pullSync])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!syncRef.current.enabled) return
      if (document.hidden) void pushSync()
      else void pullSync()
    }
    const onOnline = () => {
      if (syncRef.current.enabled) void pullSync()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
    }
  }, [pullSync, pushSync])

  useEffect(() => () => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
  }, [])

  const value = useMemo<AppContextValue>(() => ({
    ready,
    error,
    data: prepared.data,
    schedule: prepared.schedule,
    order: prepared.order,
    drills: prepared.drills,
    store,
    settings,
    planDone,
    daily,
    sync,
    syncState,
    customContent,
    updateStore,
    updateQuestionProgress,
    updateSettings,
    setPlanDone,
    setDaily,
    replaceCustomContent,
    clearCustomContent,
    updateSync,
    pullSync,
    pushSync,
    importProgress,
    exportProgress,
  }), [
    ready,
    error,
    prepared,
    store,
    settings,
    planDone,
    daily,
    sync,
    syncState,
    customContent,
    updateStore,
    updateQuestionProgress,
    updateSettings,
    setPlanDone,
    setDaily,
    replaceCustomContent,
    clearCustomContent,
    updateSync,
    pullSync,
    pushSync,
    importProgress,
    exportProgress,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp يجب أن يُستخدم داخل AppProvider')
  return context
}
