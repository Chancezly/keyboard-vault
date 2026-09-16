import JSZip from 'jszip'
import { hydrateBuildItems } from './builds'
import { parseItemMarkdown } from './parser'
import { serializeItem } from './serialize'
import type { CollectionItem, ItemCategory, ItemRelation } from './types'
import { itemDisplayBasename, basenameFromFilePath } from './naming'
import { fetchImageBytes } from './fetchImage'
import { createThumbnailDataUrl, heicToJpegBlob, isHeicLike, isHeicName } from './imageNormalize'

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
//
// 显示一律用 data URL（base64），不用 blob: 对象 URL：
// blob URL 会被 revoke，在 StrictMode 重跑、保存、详情页残留旧引用等场景下被提前吊销，
// 导致封面变黑。data URL 只是字符串，永不失效，随引用消失自动被 GC，彻底杜绝“变黑”。

// 文件名（含 NFC/NFD 变体）-> 显示用 data URL
let imageByName = new Map<string, string>()
// data URL -> 磁盘文件名（保存时把显示引用还原成文件名，避免重复写入）
let nameByDataUrl = new Map<string, string>()

/** 文件名的各种规范化写法，兼容 macOS(NFD) 与应用内(NFC) 差异 */
function nameVariants(ref: string): string[] {
  const base = (ref.split('/').pop() ?? ref).trim()
  return Array.from(new Set([base, base.normalize('NFC'), base.normalize('NFD')]))
}

function rememberImage(name: string, dataUrl: string) {
  for (const key of nameVariants(name)) imageByName.set(key, dataUrl)
  nameByDataUrl.set(dataUrl, (name.split('/').pop() ?? name).trim())
}

function lookupImage(ref: string): string {
  for (const key of nameVariants(ref)) {
    const hit = imageByName.get(key)
    if (hit) return hit
  }
  return ''
}

/** 保存前把显示用引用（data URL）还原成磁盘文件名，避免把整串 base64 当文件名写回。 */
export function stabilizeImageRefs(item: CollectionItem): CollectionItem {
  const refs = (item.images.length ? item.images : item.image ? [item.image] : []).map((ref) => {
    if (ref.startsWith('data:') || ref.startsWith('blob:')) return nameByDataUrl.get(ref) ?? ref
    return ref
  })
  const thumbnail = item.thumbnail && (item.thumbnail.startsWith('data:') || item.thumbnail.startsWith('blob:'))
    ? nameByDataUrl.get(item.thumbnail) ?? item.thumbnail
    : item.thumbnail
  return { ...item, images: refs, image: refs[0] ?? '', thumbnail }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

/** 文件 -> 显示用 data URL：HEIC/HEIF 先转 JPEG；失败返回 null 交给占位。 */
async function fileToDataUrl(file: File, name: string): Promise<string | null> {
  try {
    if (isHeicName(name) || isHeicLike(file, name)) {
      const jpeg = await heicToJpegBlob(file)
      return await blobToDataUrl(jpeg)
    }
    return await blobToDataUrl(file)
  } catch {
    return null
  }
}

/** 读取主图与缩略图目录，填充文件名 -> data URL 缓存。 */
async function loadAllImages(handle: VaultHandle): Promise<void> {
  try {
    const assets = await handle.getDirectoryHandle('assets')
    for (const dirName of ['images', 'thumbnails']) {
      try {
        const images = await assets.getDirectoryHandle(dirName)
        for await (const [name, entry] of images.entries()) {
          if (entry.kind !== 'file') continue
          try {
            const file = await (entry as FileSystemFileHandleLike).getFile()
            const dataUrl = await fileToDataUrl(file, name)
            if (dataUrl) rememberImage(name, dataUrl)
          } catch {
            // 单张损坏/无法解码 → 跳过，不影响其它封面
          }
        }
      } catch {
        // 兼容尚未创建缩略图目录的旧 vault
      }
    }
  } catch {
    // 尚无 assets
  }
}

/** 按文件名精确取图（缓存未命中时直接读盘，并做 NFC/NFD 与枚举兜底）。 */
async function loadImageByName(
  handle: VaultHandle,
  name: string,
  directory: 'images' | 'thumbnails' = 'images',
): Promise<string | null> {
  const cached = lookupImage(name)
  if (cached) return cached
  let images: FileSystemDirectoryHandleLike
  try {
    images = await handle.getDirectoryHandle('assets').then((a) => a.getDirectoryHandle(directory))
  } catch {
    return null
  }
  for (const candidate of nameVariants(name)) {
    try {
      const file = await (images.getFileHandle(candidate) as Promise<FileSystemFileHandleLike>).then((fh) =>
        fh.getFile(),
      )
      const dataUrl = await fileToDataUrl(file, candidate)
      if (dataUrl) {
        rememberImage(candidate, dataUrl)
        return dataUrl
      }
    } catch {
      // 试下一个写法
    }
  }
  // 最后兜底：枚举目录，按 NFC 归一后比对
  try {
    const want = (name.split('/').pop() ?? name).trim().normalize('NFC')
    for await (const [entryName, entry] of images.entries()) {
      if (entry.kind !== 'file') continue
      if (entryName.trim().normalize('NFC') !== want) continue
      const file = await (entry as FileSystemFileHandleLike).getFile()
      const dataUrl = await fileToDataUrl(file, entryName)
      if (dataUrl) {
        rememberImage(entryName, dataUrl)
        return dataUrl
      }
    }
  } catch {
    // ignore
  }
  return null
}

function resolveImage(ref: string): string {
  if (!ref) return ''
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) return ref
  if (ref.startsWith('blob:')) return '' // 旧的 blob 引用一律作废，交给文件名重新解析
  // 裸文件名 → 查缓存；查不到返回空，交给 UI 占位
  return lookupImage(ref)
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

// 串行化：StrictMode / 保存等会并发触发 readVault，串行执行保证图片缓存构建期间不被并发清空。
let readVaultChain: Promise<unknown> = Promise.resolve()

export function readVault(handle: VaultHandle): Promise<CollectionItem[]> {
  const run = readVaultChain.then(
    () => doReadVault(handle),
    () => doReadVault(handle),
  )
  readVaultChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function doReadVault(handle: VaultHandle): Promise<CollectionItem[]> {
  // 重新构建图片缓存（data URL，无需吊销；旧字符串随引用消失自动 GC）
  imageByName = new Map()
  nameByDataUrl = new Map()
  await loadAllImages(handle)

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
      item.images = item.images.map((ref) => resolveImage(ref))
      item.image = item.images[0] ?? ''
      const rawThumbnail = item.thumbnail
      item.thumbnail = resolveImage(rawThumbnail ?? '')

      // 缓存没命中时（例如文件名规范化差异）按 hero 名再直接读盘一次
      if (rawHero && !item.image) {
        const url = await loadImageByName(handle, rawHero)
        if (url) {
          item.image = url
          item.images = [url]
        }
      }

      if (rawThumbnail && !item.thumbnail) {
        item.thumbnail = await loadImageByName(handle, rawThumbnail, 'thumbnails') ?? undefined
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

  return hydrateBuildItems(items)
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
    ['assets', 'thumbnails'],
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

async function persistImage(handle: VaultHandle, item: CollectionItem, ref: string, index: number): Promise<string | null> {
  const baseName = itemImageBasename(item)
  const targetBase = index === 0 ? baseName : `${baseName}-gallery-${index}`

  // 显示引用（data URL）若能还原成已有文件名，直接复用，避免重复写盘
  const knownName = nameByDataUrl.get(ref)
  if (knownName) return knownName

  if (ref.startsWith('data:')) {
    const decoded = decodeDataUrl(ref)
    if (!decoded) throw new Error('主图数据无效，无法写入本地')
    const ext = decoded.ext === 'jpeg' ? 'jpg' : (decoded.ext.replace(/[^a-z0-9]/gi, '') || 'jpg')
    const fileName = `${targetBase}.${ext}`
    await writeImageFile(handle, fileName, decoded.bytes)
    return fileName
  }

  if (ref.startsWith('blob:')) {
    try {
      const res = await fetch(ref)
      if (!res.ok) throw new Error('blob 读取失败')
      const bytes = new Uint8Array(await res.arrayBuffer())
      const mime = res.headers.get('content-type') || 'image/jpeg'
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      const fileName = `${targetBase}.${ext}`
      await writeImageFile(handle, fileName, bytes)
      return fileName
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      throw new Error(`主图无法写入 vault/assets/images/（${detail}）`)
    }
  }

  if (/^(https?:)?\/\//.test(ref)) {
    const fetched = await fetchRemoteImage(ref)
    if (fetched) {
      const fileName = `${targetBase}.${fetched.ext}`
      await writeImageFile(handle, fileName, fetched.bytes)
      return fileName
    }
    throw new Error(`主图无法下载：${ref.split('?')[0].slice(-60)}`)
  }

  const fileName = ref.split('/').pop() ?? ref
  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(fileName)) {
    return fileName
  }
  return null
}

async function persistImages(handle: VaultHandle, item: CollectionItem): Promise<string[]> {
  const refs = item.images.length ? item.images : item.image ? [item.image] : []
  const persisted: string[] = []
  for (let i = 0; i < refs.length; i++) {
    const fileName = await persistImage(handle, item, refs[i], i)
    if (!fileName) throw new Error(`第 ${i + 1} 张图片无法写入本地`)
    persisted.push(fileName)
  }
  return persisted
}

async function writeImageFile(
  handle: VaultHandle,
  fileName: string,
  bytes: Uint8Array,
  directory: 'images' | 'thumbnails' = 'images',
): Promise<void> {
  const images = await ensureDir(handle, ['assets', directory])
  const fh = await images.getFileHandle(fileName, { create: true })
  const writable = await fh.createWritable()
  await writable.write(new Blob([bytes as unknown as BlobPart]))
  await writable.close()
  // 写盘后立即缓存 data URL，保存后无需等下一次 readVault 也能显示
  try {
    const file = await fh.getFile()
    const dataUrl = await fileToDataUrl(file, fileName)
    if (dataUrl) rememberImage(fileName, dataUrl)
  } catch {
    // 缓存失败无碍，下次 readVault 会重建
  }
}

async function persistThumbnail(
  handle: VaultHandle,
  item: CollectionItem,
  ref: string,
): Promise<string | undefined> {
  if (!ref) return undefined
  const knownName = nameByDataUrl.get(ref)
  if (knownName) return knownName

  if (ref.startsWith('data:')) {
    const decoded = decodeDataUrl(ref)
    if (!decoded) throw new Error('缩略图数据无效，无法写入本地')
    const fileName = `${itemImageBasename(item)}-thumb.jpg`
    await writeImageFile(handle, fileName, decoded.bytes, 'thumbnails')
    return fileName
  }

  const fileName = ref.split('/').pop() ?? ref
  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(fileName)) return fileName
  return undefined
}

export async function writeItem(handle: VaultHandle, item: CollectionItem): Promise<void> {
  const mdBase = itemImageBasename(item)
  const mdFileName = `${mdBase}.md`
  const hadImage = !!item.images[0]
  const imageRefs = await persistImages(handle, item)
  if (hadImage && imageRefs.length === 0) {
    throw new Error('主图未能写入 vault/assets/images/，请重试')
  }

  let thumbnailRef = item.thumbnail ?? ''
  if (!thumbnailRef && /^(data:|blob:|https?:|\/\/)/.test(item.image)) {
    thumbnailRef = await createThumbnailDataUrl(item.image).catch(() => '')
  }
  const thumbnail = await persistThumbnail(handle, item, thumbnailRef)
  const toSerialize: CollectionItem = {
    ...item,
    images: imageRefs,
    image: imageRefs[0] ?? '',
    thumbnail,
  }
  const dir = await ensureDir(handle, [item.category])
  const fh = await dir.getFileHandle(mdFileName, { create: true })
  const writable = await fh.createWritable()
  await writable.write(serializeItem(toSerialize))
  await writable.close()
  // 新文件完整落盘后再清理旧名称，避免写入失败导致原 Markdown 丢失。
  await removeStaleItemMd(handle, item, mdFileName)
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

  // 图片可能被其他条目共享引用。数据安全优先，不在删除条目时自动清理图片。
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
  const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024
  const MAX_UNPACKED_BYTES = 500 * 1024 * 1024
  const MAX_FILE_BYTES = 40 * 1024 * 1024
  const MAX_FILES = 2500
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('ZIP 超过 250 MB，已拒绝导入')

  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const files = Object.values(zip.files).filter((f) => !f.dir)
  if (!files.length) throw new Error('ZIP 中没有可恢复的文件')
  if (files.length > MAX_FILES) throw new Error(`ZIP 文件数量超过 ${MAX_FILES} 个，已拒绝导入`)

  // 若压缩包内容被包在同一个顶层文件夹里，则自动去掉这层
  let strip = ''
  const firsts = new Set(files.map((f) => f.name.split('/')[0]))
  const vaultRoots = new Set(['keyboards', 'keycaps', 'switches', 'builds', 'assets', 'settings', 'ai'])
  const onlyRoot = firsts.size === 1 ? [...firsts][0] : ''
  if (onlyRoot && !vaultRoots.has(onlyRoot) && files.every((f) => f.name.includes('/'))) {
    strip = `${[...firsts][0]}/`
  }

  const prepared: { parts: string[]; content: Blob }[] = []
  let totalBytes = 0
  for (const entry of files) {
    const rel = strip && entry.name.startsWith(strip) ? entry.name.slice(strip.length) : entry.name
    const parts = rel.split('/').filter(Boolean)
    if (!parts.length) continue
    if (
      rel.startsWith('/') ||
      parts.some((part) => part === '.' || part === '..' || /[\\:*?"<>|]/.test(part))
    ) {
      throw new Error(`ZIP 包含不安全路径：${entry.name}`)
    }
    const content = await entry.async('blob')
    if (content.size > MAX_FILE_BYTES) throw new Error(`文件超过 40 MB：${entry.name}`)
    totalBytes += content.size
    if (totalBytes > MAX_UNPACKED_BYTES) throw new Error('ZIP 解压后超过 500 MB，已拒绝导入')
    prepared.push({ parts, content })
  }

  // 所有内容先在内存中完成校验，确认无误后才清空当前 vault。
  for await (const [name] of handle.entries()) {
    await handle.removeEntry(name, { recursive: true })
  }

  for (const { parts: originalParts, content } of prepared) {
    const parts = [...originalParts]
    const fileName = parts.pop() as string
    let dir = handle
    for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create: true })
    const fh = await dir.getFileHandle(fileName, { create: true })
    const writable = await fh.createWritable()
    await writable.write(content)
    await writable.close()
  }
}
