import { parseItemMarkdown } from './parser'
import type { ItemCategory } from './types'
import type { VaultHandle } from './fs'

const CATEGORIES = new Set<ItemCategory>(['keyboards', 'keycaps', 'switches', 'builds'])

interface ReadableFileHandle {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
}

interface ReadableDirectoryHandle {
  kind: 'directory'
  name: string
  entries: () => AsyncIterableIterator<[string, ReadableFileHandle | ReadableDirectoryHandle]>
}

export type VaultDiagnosticIssueCode =
  | 'broken-markdown'
  | 'duplicate-id'
  | 'missing-image'
  | 'missing-thumbnail'
  | 'orphan-image'
  | 'orphan-thumbnail'

export interface VaultDiagnosticIssue {
  code: VaultDiagnosticIssueCode
  severity: 'error' | 'warning'
  path: string
  message: string
}

export interface VaultDiagnosticsReport {
  scannedAt: string
  counts: {
    markdown: number
    originalImages: number
    thumbnails: number
    brokenMarkdown: number
    duplicateIds: number
    missingReferences: number
    orphanResources: number
  }
  bytes: {
    markdown: number
    originalImages: number
    thumbnails: number
    total: number
  }
  issues: VaultDiagnosticIssue[]
}

interface ScannedFile {
  path: string
  file: File
}

async function walkDirectory(
  directory: ReadableDirectoryHandle,
  prefix = '',
  result: ScannedFile[] = [],
): Promise<ScannedFile[]> {
  for await (const [name, entry] of directory.entries()) {
    if (name === '.DS_Store') continue
    const path = prefix ? `${prefix}/${name}` : name
    if (entry.kind === 'directory') {
      await walkDirectory(entry, path, result)
    } else {
      result.push({ path, file: await entry.getFile() })
    }
  }
  return result
}

function normalizedBasename(reference: string): string | null {
  const trimmed = reference.trim()
  if (!trimmed || /^(?:data:|blob:|https?:|\/\/)/i.test(trimmed)) return null
  const withoutQuery = trimmed.split(/[?#]/, 1)[0]
  const basename = withoutQuery.split('/').pop() ?? withoutQuery
  try {
    return decodeURIComponent(basename).normalize('NFC')
  } catch {
    return basename.normalize('NFC')
  }
}

function categoryFromPath(path: string): ItemCategory | null {
  const first = path.split('/')[0] as ItemCategory
  return CATEGORIES.has(first) ? first : null
}

function historyCategoryFromPath(path: string): ItemCategory {
  const segments = path.split('/')
  return segments.find((part): part is ItemCategory => CATEGORIES.has(part as ItemCategory)) ?? 'keyboards'
}

/** 对收藏库执行只读完整性检查，不创建、修改或删除任何文件。 */
export async function diagnoseVault(handle: VaultHandle): Promise<VaultDiagnosticsReport> {
  const files = await walkDirectory(handle as unknown as ReadableDirectoryHandle)
  const issues: VaultDiagnosticIssue[] = []
  const ids = new Map<string, string[]>()
  const referencedImages = new Set<string>()
  const referencedThumbnails = new Set<string>()
  const imageFiles = new Map<string, ScannedFile>()
  const thumbnailFiles = new Map<string, ScannedFile>()

  let markdown = 0
  let markdownBytes = 0
  let originalImageBytes = 0
  let thumbnailBytes = 0
  let brokenMarkdown = 0

  for (const scanned of files) {
    const normalizedPath = scanned.path.normalize('NFC')
    if (normalizedPath.startsWith('assets/images/')) {
      imageFiles.set(normalizedBasename(normalizedPath) ?? normalizedPath, scanned)
      originalImageBytes += scanned.file.size
      continue
    }
    if (normalizedPath.startsWith('assets/thumbnails/')) {
      thumbnailFiles.set(normalizedBasename(normalizedPath) ?? normalizedPath, scanned)
      thumbnailBytes += scanned.file.size
      continue
    }

    const category = categoryFromPath(normalizedPath)
    const isActiveMarkdown = category !== null && normalizedPath.endsWith('.md')
    const isHistoryMarkdown = normalizedPath.startsWith('.history/') && normalizedPath.endsWith('.md')
    if (!isActiveMarkdown && !isHistoryMarkdown) continue

    if (isActiveMarkdown) {
      markdown++
      markdownBytes += scanned.file.size
    }

    try {
      const item = parseItemMarkdown(
        await scanned.file.text(),
        category ?? historyCategoryFromPath(normalizedPath),
        normalizedPath,
      )
      for (const reference of item.images) {
        const basename = normalizedBasename(reference)
        if (basename) referencedImages.add(basename)
      }
      const thumbnail = item.thumbnail ? normalizedBasename(item.thumbnail) : null
      if (thumbnail) referencedThumbnails.add(thumbnail)

      if (isActiveMarkdown) {
        const paths = ids.get(item.id) ?? []
        paths.push(normalizedPath)
        ids.set(item.id, paths)
      }
    } catch (error) {
      if (!isActiveMarkdown) continue
      brokenMarkdown++
      issues.push({
        code: 'broken-markdown',
        severity: 'error',
        path: normalizedPath,
        message: `Markdown 无法解析：${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  let duplicateIds = 0
  for (const [id, paths] of ids) {
    if (paths.length < 2) continue
    duplicateIds++
    issues.push({
      code: 'duplicate-id',
      severity: 'error',
      path: paths.join('、'),
      message: `ID “${id}” 被 ${paths.length} 条资料重复使用`,
    })
  }

  for (const name of referencedImages) {
    if (!imageFiles.has(name)) {
      issues.push({
        code: 'missing-image',
        severity: 'error',
        path: `assets/images/${name}`,
        message: `资料引用的原图不存在：${name}`,
      })
    }
  }
  for (const name of referencedThumbnails) {
    if (!thumbnailFiles.has(name)) {
      issues.push({
        code: 'missing-thumbnail',
        severity: 'warning',
        path: `assets/thumbnails/${name}`,
        message: `资料引用的缩略图不存在：${name}`,
      })
    }
  }
  for (const [name, scanned] of imageFiles) {
    if (!referencedImages.has(name)) {
      issues.push({
        code: 'orphan-image',
        severity: 'warning',
        path: scanned.path,
        message: `原图未被当前资料或历史记录引用：${name}`,
      })
    }
  }
  for (const [name, scanned] of thumbnailFiles) {
    if (!referencedThumbnails.has(name)) {
      issues.push({
        code: 'orphan-thumbnail',
        severity: 'warning',
        path: scanned.path,
        message: `缩略图未被当前资料或历史记录引用：${name}`,
      })
    }
  }

  const missingReferences = issues.filter((issue) =>
    issue.code === 'missing-image' || issue.code === 'missing-thumbnail',
  ).length
  const orphanResources = issues.filter((issue) =>
    issue.code === 'orphan-image' || issue.code === 'orphan-thumbnail',
  ).length

  return {
    scannedAt: new Date().toISOString(),
    counts: {
      markdown,
      originalImages: imageFiles.size,
      thumbnails: thumbnailFiles.size,
      brokenMarkdown,
      duplicateIds,
      missingReferences,
      orphanResources,
    },
    bytes: {
      markdown: markdownBytes,
      originalImages: originalImageBytes,
      thumbnails: thumbnailBytes,
      total: files.reduce((sum, scanned) => sum + scanned.file.size, 0),
    },
    issues: issues.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
      return a.path.localeCompare(b.path, 'zh-CN')
    }),
  }
}
