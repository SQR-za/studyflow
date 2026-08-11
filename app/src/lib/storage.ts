function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function loadJson<T>(key: string, fallback: T, storage: Storage | null = browserStorage()): T {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return fallback
    return (JSON.parse(raw) as T | null) ?? fallback
  } catch {
    return fallback
  }
}

export function saveJson<T>(key: string, value: T, storage: Storage | null = browserStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // The app remains usable in private modes with restricted storage.
  }
}

export function removeStoredValue(key: string, storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Keep local-only features usable when storage access is restricted.
  }
}

export function loadText(key: string, fallback = '', storage: Storage | null = browserStorage()): string {
  try {
    return storage?.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function saveText(key: string, value: string, storage: Storage | null = browserStorage()): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Keep local-only features usable when storage access is restricted.
  }
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000)
}

export async function readJsonFile<T>(file: File): Promise<T> {
  return JSON.parse(await file.text()) as T
}
