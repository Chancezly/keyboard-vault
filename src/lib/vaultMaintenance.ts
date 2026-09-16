import { parseItemMarkdown } from './parser'
import { serializeItem } from './serialize'
import type { ItemCategory } from './types'
import type { VaultHandle } from './fs'

const CATEGORIES: ItemCategory[] = ['keyboards', 'keycaps', 'switches', 'builds']

interface WritableFileHandle {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>
    close: () => Promise<void>
  }>
}

interface WritableDirectoryHandle {
  getDirectoryHandle: (name: string) => Promise<WritableDirectoryHandle>
  entries: () => AsyncIterableIterator<[string, WritableFileHandle | { kind: 'directory'; name: string }]>
}

interface ParsedRecord {
  category: ItemCategory
  path: string
  handle: WritableFileHandle
  item: ReturnType<typeof parseItemMarkdown>
}

export interface DuplicateIdRepair {
  path: string
  previousId: string
  nextId: string
}

function idSuffix(path: string): string {
  const basename = path.split('/').pop()?.replace(/\.md$/i, '') ?? 'item'
  const normalized = basename
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'item'
}

function uniqueReplacementId(id: string, path: string, used: Set<string>): string {
  const base = `${id}-${idSuffix(path)}`
  let candidate = base
  let counter = 2
  while (used.has(candidate)) candidate = `${base}-${counter++}`
  return candidate
}

async function collectRecords(handle: VaultHandle): Promise<ParsedRecord[]> {
  const root = handle as unknown as WritableDirectoryHandle
  const records: ParsedRecord[] = []
  for (const category of CATEGORIES) {
    let directory: WritableDirectoryHandle
    try {
      directory = await root.getDirectoryHandle(category)
    } catch {
      continue
    }
    for await (const [name, entry] of directory.entries()) {
      if (entry.kind !== 'file' || !name.endsWith('.md')) continue
      const path = `${category}/${name}`
      const file = await entry.getFile()
      try {
        records.push({
          category,
          path,
          handle: entry,
          item: parseItemMarkdown(await file.text(), category, path),
        })
      } catch {
        // 损坏文件由读取隔离和诊断功能单独处理，不能在修复 ID 时改写。
      }
    }
  }
  return records.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
}

/** 保留每组首条记录，只为后续重复项生成稳定且唯一的新 ID。 */
export async function repairDuplicateIds(handle: VaultHandle): Promise<DuplicateIdRepair[]> {
  const records = await collectRecords(handle)
  const used = new Set(records.map((record) => record.item.id))
  const seen = new Set<string>()
  const repairs: DuplicateIdRepair[] = []

  for (const record of records) {
    const previousId = record.item.id
    if (!seen.has(previousId)) {
      seen.add(previousId)
      continue
    }

    const nextId = uniqueReplacementId(previousId, record.path, used)
    const writable = await record.handle.createWritable()
    await writable.write(serializeItem({ ...record.item, id: nextId }))
    await writable.close()
    used.add(nextId)
    seen.add(nextId)
    repairs.push({ path: record.path, previousId, nextId })
  }

  return repairs
}
