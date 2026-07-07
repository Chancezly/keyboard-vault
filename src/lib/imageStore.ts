/** 未连接 vault 目录时，将图片暂存 IndexedDB，并用文件名引用 */

import { resolveBundledImageRef } from './collection'
import { fetchImageBytes } from './fetchImage'
import { basenameFromFilePath, itemDisplayBasename } from './naming'

const DB_NAME = 'keyvault-images'
const STORE = 'files'

let urlCache = new Map<string, string>()
let hydrated = false

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function decodeDataUrl(url: string): { ext: string; bytes: Uint8Array } | null {
  const match = url.match(/^data:(.+?);base64,(.*)$/)
  if (!match) return null
  const mime = match[1]
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { ext, bytes }
}

export function itemImageBasename(item: {
  filePath: string
  id: string
  name?: string
  brand?: string
}): string {
  return basenameFromFilePath(item.filePath) ?? itemDisplayBasename({
    id: item.id,
    name: item.name ?? item.id,
    brand: item.brand ?? '',
  })
}

async function idbPut(name: string, bytes: Uint8Array): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(bytes, name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbDelete(name: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

function cacheBlobUrl(name: string, bytes: Uint8Array): string {
  const prev = urlCache.get(name)
  if (prev) URL.revokeObjectURL(prev)
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart]))
  urlCache.set(name, url)
  return url
}

/** 启动时加载 IndexedDB 中所有图片到内存 URL 缓存 */
export async function hydrateImageCache(): Promise<void> {
  if (hydrated) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const name = cursor.key as string
      const bytes = cursor.value as Uint8Array
      cacheBlobUrl(name, bytes)
      cursor.continue()
    }
    tx.oncomplete = () => {
      hydrated = true
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** 解析本地文件名 → 显示 URL（bundled glob 或 IndexedDB） */
export function resolveLocalImageRef(ref: string): string {
  if (!ref) return ''
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('blob:')) return ref
  const name = ref.split('/').pop() ?? ref
  return urlCache.get(name) ?? resolveBundledImageRef(ref)
}

/** 将主图存为本地文件名，返回更新后的 item */
export async function persistHeroToImageStore(item: {
  filePath: string
  id: string
  images: string[]
  image: string
}): Promise<{ images: string[]; image: string }> {
  const ref = item.images[0]
  if (!ref) return { images: [], image: '' }

  let bytes: Uint8Array | null = null
  let ext = 'jpg'

  if (ref.startsWith('data:')) {
    const decoded = decodeDataUrl(ref)
    if (!decoded) return { images: item.images.slice(0, 1), image: item.image }
    bytes = decoded.bytes
    ext = decoded.ext
  } else if (/^(https?:)?\/\//.test(ref) || ref.startsWith('//')) {
    const abs = ref.startsWith('//') ? `https:${ref}` : ref
    const fetched = await fetchImageBytes(abs)
    if (!fetched) return { images: item.images.slice(0, 1), image: item.image }
    bytes = fetched.bytes
    ext = fetched.ext
  } else {
    return { images: item.images.slice(0, 1), image: item.image }
  }

  const fileName = `${itemImageBasename(item)}.${ext}`
  await idbPut(fileName, bytes)
  cacheBlobUrl(fileName, bytes)
  return { images: [fileName], image: fileName }
}

export async function deleteStoredImage(fileName: string): Promise<void> {
  const name = fileName.split('/').pop() ?? fileName
  const prev = urlCache.get(name)
  if (prev) URL.revokeObjectURL(prev)
  urlCache.delete(name)
  await idbDelete(name)
}
