import JSZip from 'jszip'
import { parseItemMarkdown } from './parser'
import { serializeItem } from './serialize'
import type { CollectionItem, ItemCategory, ItemRelation } from './types'
import { itemDisplayBasename, basenameFromFilePath } from './naming'
import { fetchImageBytes } from './fetchImage'

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
// 文件名 -> blob URL，跨 readVault 刷新保留已解析的本地图
let diskImageByName = new Map<string, string>()

function trackImageUrl(name: string, url: string) {
  diskImageByName.set(name, url)
  imageNameByUrl.set(url, name)
  imageObjectUrls.push(url)
}

function revokeImageUrls() {
  imageObjectUrls.forEach((u) => URL.revokeObjectURL(u))
  imageObjectUrls = []
  imageNameByUrl = new Map()
  diskImageByName = new Map()
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
      map.set(name, url)
      trackImageUrl(name, url)
    }
  } catch {
    // no assets/images yet
  }
  return map
}

async function loadImageByName(handle: VaultHandle, name: string): Promise<string | null> {
  const cached = diskImageByName.get(name)
  if (cached) return cached
  try {
    const images = await handle.getDirectoryHandle('assets').then((a) => a.getDirectoryHandle('images'))
    const file = await (images.getFileHandle(name) as Promise<FileSystemFileHandleLike>).then((fh) => fh.getFile())
    const url = URL.createObjectURL(file)
    trackImageUrl(name, url)
    return url
  } catch {
    return null
  }
}

function resolveImage(ref: string, map: Map<string, string>): string {
  if (!ref) return ''
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('blob:')) return ref
  const name = ref.split('/').pop() ?? ref
  return map.get(name) ?? diskImageByName.get(name) ?? ref
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
      const rawHero = (raw.match(/hero:\s*(.+)/)?.[1] ?? '').trim()
      item.images = item.images.map((ref) => resolveImage(ref, imageMap))
      item.image = item.images[0] ?? ''

      if (rawHero && !item.image.startsWith('blob:') && !/^https?:\/\//.test(item.image)) {
        const fileName = rawHero.split('/').pop() ?? rawHero
        const url = await loadImageByName(handle, fileName)
        if (url) {
          item.image = url
          item.images = [url]
        }
      }

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

  return items
}

async function removeStaleItemMd(
  handle: VaultHandle,
  item: CollectionItem,
  keepFileName: string,
): Promise<void> {
  let dir: FileSystemDirectoryHandleLike
  try {
    dir = await handle.getDirectoryHandle(item.category)
  } catch {
    return
  }
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind !== 'file' || !name.endsWith('.md') || name === keepFileName) continue
    const file = await (entry as FileSystemFileHandleLike).getFile()
    const raw = await file.text()
    const parsed = parseItemMarkdown(raw, item.category, `${item.category}/${name}`)
    if (parsed.id === item.id) {
      try {
        await dir.removeEntry(name)
      } catch {
        // ignore
      }
    }
  }
}

async function removeImageIfExists(handle: VaultHandle, fileName: string): Promise<void> {
  if (!fileName) return
  try {
    const images = await handle.getDirectoryHandle('assets').then((a) => a.getDirectoryHandle('images'))
    await images.removeEntry(fileName)
  } catch {
    // ignore
  }
}

async function ensureDir(handle: VaultHandle, path: string[]): Promise<FileSystemDirectoryHandleLike> {
  let dir = handle
  for (const segment of path) {
    dir = await dir.getDirectoryHandle(segment, { create: true })
  }
  return dir
}

/** 空文件夹连接后自动创建标准 vault 目录结构 */
export async function ensureVaultStructure(handle: VaultHandle): Promise<void> {
  const paths = [
    ['keyboards'],
    ['keycaps'],
    ['switches'],
    ['builds'],
    ['assets', 'images'],
    ['settings'],
    ['ai', 'cache'],
  ]
  for (const path of paths) {
    await ensureDir(handle, path)
  }
}

async function fetchRemoteImage(
  ref: string,
): Promise<{ ext: string; bytes: Uint8Array } | null> {
  const fetched = await fetchImageBytes(ref)
  if (!fetched) return null
  return { ext: fetched.ext, bytes: fetched.bytes }
}

function itemImageBasename(item: CollectionItem): string {
  return basenameFromFilePath(item.filePath) ?? itemDisplayBasename(item)
}

async function persistImages(handle: VaultHandle, item: CollectionItem): Promise<string[]> {
  const ref = item.images[0]
  if (!ref) return []

  const baseName = itemImageBasename(item)

  if (ref.startsWith('data:')) {
    const decoded = decodeDataUrl(ref)
    if (!decoded) throw new Error('主图数据无效，无法写入本地')
    const fileName = `${baseName}.${decoded.ext}`
    await writeImageFile(handle, fileName, decoded.bytes)
    return [fileName]
  }

  if (ref.startsWith('blob:')) {
    const known = imageNameByUrl.get(ref)
    if (known) return [known]
    try {
      const res = await fetch(ref)
      if (!res.ok) throw new Error('blob 读取失败')
      const bytes = new Uint8Array(await res.arrayBuffer())
      const mime = res.headers.get('content-type') || 'image/jpeg'
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const fileName = `${baseName}.${ext}`
      await writeImageFile(handle, fileName, bytes)
      return [fileName]
    } catch {
      throw new Error('主图 blob 无法写入 vault/assets/images/')
    }
  }

  if (imageNameByUrl.has(ref)) {
    return [imageNameByUrl.get(ref)!]
  }

  if (/^(https?:)?\/\//.test(ref)) {
    const fetched = await fetchRemoteImage(ref)
    if (fetched) {
      const fileName = `${baseName}.${fetched.ext}`
      await writeImageFile(handle, fileName, fetched.bytes)
      return [fileName]
    }
    throw new Error(`主图无法下载：${ref.split('?')[0].slice(-60)}`)
  }

  const fileName = ref.split('/').pop() ?? ref
  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(fileName)) {
    return [fileName]
  }
  return []
}

function heroFileNameFromRef(ref: string | undefined): string | null {
  if (!ref) return null
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('blob:')) return null
  const name = ref.split('/').pop() ?? ref
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(name) ? name : null
}

async function writeImageFile(handle: VaultHandle, fileName: string, bytes: Uint8Array): Promise<void> {
  const images = await ensureDir(handle, ['assets', 'images'])
  const fh = await images.getFileHandle(fileName, { create: true })
  const writable = await fh.createWritable()
  await writable.write(new Blob([bytes as unknown as BlobPart]))
  await writable.close()
  const file = await fh.getFile()
  const url = URL.createObjectURL(file)
  trackImageUrl(fileName, url)
}

export async function writeItem(handle: VaultHandle, item: CollectionItem): Promise<void> {
  const mdBase = itemImageBasename(item)
  const mdFileName = `${mdBase}.md`
  const previousHero = heroFileNameFromRef(item.images[0])

  await removeStaleItemMd(handle, item, mdFileName)

  const hadImage = !!item.images[0]
  const imageRefs = await persistImages(handle, item)
  if (hadImage && imageRefs.length === 0) {
    throw new Error('主图未能写入 vault/assets/images/，请重试')
  }

  const newHero = imageRefs[0]
  if (previousHero && newHero && previousHero !== newHero) {
    await removeImageIfExists(handle, previousHero)
  }

  const toSerialize: CollectionItem = { ...item, images: imageRefs, image: imageRefs[0] ?? '' }
  const dir = await ensureDir(handle, [item.category])
  const fh = await dir.getFileHandle(mdFileName, { create: true })
  const writable = await fh.createWritable()
  await writable.write(serializeItem(toSerialize))
  await writable.close()
}

export async function deleteItemFile(handle: VaultHandle, item: CollectionItem): Promise<void> {
  let dir: FileSystemDirectoryHandleLike
  try {
    dir = await handle.getDirectoryHandle(item.category)
  } catch {
    return
  }

  const preferred = basenameFromFilePath(item.filePath)
  if (preferred) {
    try {
      await dir.removeEntry(`${preferred}.md`)
    } catch {
      // fall through to id scan
    }
  }

  for await (const [name, entry] of dir.entries()) {
    if (entry.kind !== 'file' || !name.endsWith('.md')) continue
    const file = await (entry as FileSystemFileHandleLike).getFile()
    const raw = await file.text()
    const parsed = parseItemMarkdown(raw, item.category, `${item.category}/${name}`)
    if (parsed.id === item.id) {
      try {
        await dir.removeEntry(name)
      } catch {
        // ignore
      }
    }
  }

  const hero = heroFileNameFromRef(item.images[0] ?? item.image)
  if (hero) await removeImageIfExists(handle, hero)
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
