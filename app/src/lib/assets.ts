import { APP_BASE_PATH } from './constants'

/**
 * Resolve a checked-in public asset under the app's deployment base path.
 *
 * Asset paths are always treated as deployment-relative. Traversal segments
 * are rejected so lesson data cannot point outside the public asset tree.
 */
export function publicAssetUrl(asset: string, base = APP_BASE_PATH): string {
  const normalizedAsset = asset.trim().replace(/^\/+/, '')
  if (!normalizedAsset) throw new Error('مسار الملف العام فارغ')

  let decodedPath = normalizedAsset.split(/[?#]/, 1)[0]
  try {
    decodedPath = decodeURIComponent(decodedPath)
  } catch {
    throw new Error('مسار الملف العام غير صالح')
  }

  if (decodedPath.split(/[\\/]/).some(segment => segment === '..')) {
    throw new Error('مسار الملف العام لا يسمح بالتنقل إلى مجلد أعلى')
  }

  const normalizedBase = base.trim() || '/'
  return `${normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`}${normalizedAsset}`
}
