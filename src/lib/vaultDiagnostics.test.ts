import { describe, expect, it } from 'vitest'
import { createBlankItem } from './store'
import { serializeItem } from './serialize'
import { diagnoseVault } from './vaultDiagnostics'
import type { VaultHandle } from './fs'

class MemoryFile {
  kind = 'file' as const
  name: string
  data: Blob
  writeCount = 0

  constructor(name: string, content: BlobPart = '') {
    this.name = name
    this.data = new Blob([content])
  }

  async getFile() {
    return new File([this.data], this.name)
  }

  async createWritable() {
    this.writeCount++
    throw new Error('只读诊断不应写入文件')
  }
}

class MemoryDirectory {
  kind = 'directory' as const
  name: string
  children = new Map<string, MemoryDirectory | MemoryFile>()

  constructor(name: string) {
    this.name = name
  }

  directory(name: string) {
    const result = new MemoryDirectory(name)
    this.children.set(name, result)
    return result
  }

  file(name: string, content: BlobPart = '') {
    const result = new MemoryFile(name, content)
    this.children.set(name, result)
    return result
  }

  async *entries() {
    yield* this.children.entries()
  }
}

function markdown(id: string, hero: string, thumbnail?: string): string {
  const item = createBlankItem('keyboards')
  item.id = id
  item.name = id
  item.filePath = `keyboards/${id}.md`
  item.image = hero
  item.images = hero ? [hero] : []
  item.thumbnail = thumbnail
  return serializeItem(item)
}

describe('vault diagnostics', () => {
  it('reports integrity problems and includes history references when finding orphans', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = root.directory('keyboards')
    keyboards.file('first.md', markdown('duplicate', 'present.jpg', 'missing-thumb.webp'))
    keyboards.file('second.md', markdown('duplicate', 'missing.jpg'))
    keyboards.file('broken.md', '---\nidentity: [\n---\n')

    const assets = root.directory('assets')
    const images = assets.directory('images')
    images.file('present.jpg', new Uint8Array([1, 2, 3]))
    images.file('history-only.jpg', new Uint8Array([4]))
    images.file('orphan.jpg', new Uint8Array([5]))
    const thumbnails = assets.directory('thumbnails')
    thumbnails.file('orphan-thumb.webp', new Uint8Array([6]))

    const history = root.directory('.history').directory('keyboards')
    history.file('old.md', markdown('old', 'history-only.jpg'))

    const report = await diagnoseVault(root as unknown as VaultHandle)

    expect(report.counts).toMatchObject({
      markdown: 3,
      originalImages: 3,
      thumbnails: 1,
      brokenMarkdown: 1,
      duplicateIds: 1,
      missingReferences: 2,
      orphanResources: 2,
    })
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'broken-markdown',
      'duplicate-id',
      'missing-image',
      'missing-thumbnail',
      'orphan-image',
      'orphan-thumbnail',
    ]))
    expect(report.issues.some((issue) => issue.path.endsWith('history-only.jpg'))).toBe(false)
    expect(report.bytes.total).toBeGreaterThan(report.bytes.originalImages)
  })

  it('returns a clean report without performing any writes', async () => {
    const root = new MemoryDirectory('vault')
    root.directory('keyboards').file('clean.md', markdown('clean', 'clean.jpg', 'clean.webp'))
    const assets = root.directory('assets')
    const image = assets.directory('images').file('clean.jpg', new Uint8Array([1]))
    const thumbnail = assets.directory('thumbnails').file('clean.webp', new Uint8Array([2]))

    const report = await diagnoseVault(root as unknown as VaultHandle)

    expect(report.issues).toEqual([])
    expect(image.writeCount).toBe(0)
    expect(thumbnail.writeCount).toBe(0)
  })
})
