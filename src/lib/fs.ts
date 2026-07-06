import JSZip from 'jszip'
import { parseItemMarkdown } from './parser'
import { serializeItem } from './serialize'
import type { CollectionItem, ItemCategory, ItemRelation } from './types'

const CATEGORIES: ItemCategory[] = ['keyboards', 'keycaps', 'switches', 'builds']

// Minimal ambient typing for the File System Access API.
type PermissionState = 'granted' | 'denied' | 'prompt'
interface FsPermissionDescriptor {
  mode?: 'read' | 'readwrite'
}
interface FileSystemHandleLike {
  kind: 'file' | 'directory'
  name: string
  queryPermission?: (d?: FsPermissionDescriptor) => Promise<PermissionState>
  requestPermission?: (d?: FsPermissionDescriptor) => Promise<PermissionState>
}
interface FileSystemFileHandleLike extends FileSystemHandleLike {
  kind: 'file'
  getFile: () => Promise<File>
  createWritable: () => Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>
    close: () => Promise<void>
  }>
}
interface FileSystemDirectoryHandleLike extends FileSystemHandleLike {
  kind: 'directory'
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemDirectoryHandleLike>
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandleLike>
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>
  entries: () => AsyncIterableIterator<[string, FileSystemHandleLike]>
}

export type VaultHandle = FileSystemDirectoryHandleLike

export function isFileSystemSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

// ---- IndexedDB handle persistence ----

const DB_NAME = 'keyvault-fs'
const STORE = 'handles'
const HANDLE_KEY = 'vault-dir'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  const result = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// ---- Permission helpers ----

async function verifyPermission(handle: VaultHandle, write: boolean): Promise<boolean> {
  const opts: FsPermissionDescriptor = { mode: write ? 'readwrite' : 'read' }
  if ((await handle.queryPermission?.(opts)) === 'granted') return true
  if ((await handle.requestPermission?.(opts)) === 'granted') return true
  return false
}

export async function pickVaultDirectory(): Promise<VaultHandle | null> {
  const picker = (window as unknown as {
    showDirectoryPicker: (o?: { mode?: string }) => Promise<VaultHandle>
  }).showDirectoryPicker
  const handle = await picker({ mode: 'readwrite' })
  await idbSet(HANDLE_KEY, handle)
  return handle
}

export async function getSavedVaultDirectory(): Promise<VaultHandle | null> {
  const handle = await idbGet<VaultHandle>(HANDLE_KEY)
  if (!handle) return null
  const ok = await verifyPermission(handle, true)
  return ok ? handle : null
}

export async function forgetVaultDirectory(): Promise<void> {
  await idbDelete(HANDLE_KEY)
}

// ---- Image handling ----

let imageObjectUrls: string[] = []
// 反查表：显示用的 blob: URL -> 原始文件名，保存时用它还原引用，避免把 URL 当成文件名写回
let imageNameByUrl = new Map<string, string>()

function revokeImageUrls() {
  imageObjectUrls.forEach((u) => URL.revokeObjectURL(u))
  imageObjectUrls = []
  imageNameByUrl = new Map()
}

async function readImageMap(handle: VaultHandle): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const assets = await handle.getDirectoryHandle('assets')
    const images = await assets.getDirectoryHandle('images')
    for await (const [name, entry] of images.entries()) {
      if (entry.kind !== 'file') continue
      const file = await (entry as FileSystemFileHandleLike).getFile()
      const url = URL.createObjectURL(file)
      imageObjectUrls.push(url)
      map.set(name, url)
      imageNameByUrl.set(url, name)
    }
  } catch {
    // no assets/images yet
  }
  return map
}

function resolveImage(ref: string, map: Map<string, string>): string {
  if (!ref) return ''
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) return ref
  const name = ref.split('/').pop() ?? ref
  return map.get(name) ?? ref
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

// ---- Read ----

export async function readVault(handle: VaultHandle): Promise<CollectionItem[]> {
  revokeImageUrls()
  const imageMap = await readImageMap(handle)
  const items: CollectionItem[] = []

  for (const category of CATEGORIES) {
    let dir: FileSystemDirectoryHandleLike
    try {
      dir = await handle.getDirectoryHandle(category)
    } catch {
      continue
    }
    for await (const [name, entry] of dir.entries()) {
      if (entry.kind !== 'file' || !name.endsWith('.md')) continue
      const file = await (entry as FileSystemFileHandleLike).getFile()
      const raw = await file.text()
      const item = parseItemMarkdown(raw, category, `${category}/${name}`)
      item.images = item.images.map((ref) => resolveImage(ref, imageMap))
      item.image = item.images[0] ?? ''
      items.push(item)
    }
  }

  const byId = new Map(items.map((i) => [i.id, i]))
  for (const item of items) {
    if (!item.relations.length) continue
    item.relations = item.relations.map((rel): ItemRelation => {
      const target = byId.get(rel.ref)
      return target ? { ...rel, name: target.name, category: target.category } : rel
    })
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

// ---- Write ----

async function ensureDir(handle: VaultHandle, path: string[]): Promise<FileSystemDirectoryHandleLike> {
  let dir = handle
  for (const segment of path) {
    dir = await dir.getDirectoryHandle(segment, { create: true })
  }
  return dir
}

async function persistImages(handle: VaultHandle, item: CollectionItem): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < item.images.length; i++) {
    const ref = item.images[i]
    if (ref.startsWith('data:')) {
      const decoded = decodeDataUrl(ref)
      if (!decoded) continue
      const fileName = `${item.id}${i === 0 ? '' : `-${i}`}.${decoded.ext}`
      const images = await ensureDir(handle, ['assets', 'images'])
      const fh = await images.getFileHandle(fileName, { create: true })
      const writable = await fh.createWritable()
      await writable.write(new Blob([decoded.bytes as unknown as BlobPart]))
      await writable.close()
      out.push(fileName)
    } else if (imageNameByUrl.has(ref)) {
      // 该图片是从本地读入后生成的 blob: URL，还原成原始文件名
      out.push(imageNameByUrl.get(ref)!)
    } else if (/^(https?:)?\/\//.test(ref)) {
      out.push(ref)
    } else {
      out.push(ref.split('/').pop() ?? ref)
    }
  }
  return out
}

export async function writeItem(handle: VaultHandle, item: CollectionItem): Promise<void> {
  const imageRefs = await persistImages(handle, item)
  const toSerialize: CollectionItem = { ...item, images: imageRefs, image: imageRefs[0] ?? '' }
  const dir = await ensureDir(handle, [item.category])
  const fh = await dir.getFileHandle(`${item.id}.md`, { create: true })
  const writable = await fh.createWritable()
  await writable.write(serializeItem(toSerialize))
  await writable.close()
}

export async function deleteItemFile(handle: VaultHandle, item: CollectionItem): Promise<void> {
  try {
    const dir = await handle.getDirectoryHandle(item.category)
    await dir.removeEntry(`${item.id}.md`)
  } catch {
    // already gone
  }
}

// ---- Backup / migration (ZIP) ----

async function addDirToZip(
  dir: FileSystemDirectoryHandleLike,
  zip: JSZip,
  prefix: string,
): Promise<void> {
  for await (const [name, entry] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandleLike).getFile()
      zip.file(path, file)
    } else {
      await addDirToZip(entry as FileSystemDirectoryHandleLike, zip, path)
    }
  }
}

// 把整个已连接文件夹打包成 ZIP（md + 图片 + 设置等原样保留）
export async function exportVaultZip(handle: VaultHandle): Promise<Blob> {
  const zip = new JSZip()
  await addDirToZip(handle, zip, '')
  return zip.generateAsync({ type: 'blob' })
}

// 把 ZIP 内容写入当前已连接文件夹（同名覆盖），用于换设备快速恢复
export async function importVaultZip(handle: VaultHandle, file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file)
  const files = Object.values(zip.files).filter((f) => !f.dir)

  // 若压缩包内容被包在同一个顶层文件夹里，则自动去掉这层
  let strip = ''
  const firsts = new Set(files.map((f) => f.name.split('/')[0]))
  if (firsts.size === 1 && files.every((f) => f.name.includes('/'))) {
    strip = `${[...firsts][0]}/`
  }

  for (const entry of files) {
    const rel = strip && entry.name.startsWith(strip) ? entry.name.slice(strip.length) : entry.name
    const parts = rel.split('/').filter(Boolean)
    if (!parts.length) continue
    const fileName = parts.pop() as string
    let dir = handle
    for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: true })
    const content = await entry.async('blob')
    const fh = await dir.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    await writable.write(content)
    await writable.close()
  }
}
