import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { generateMissingThumbnails, importVaultZip, writeItem, type VaultHandle } from './fs'
import { serializeItem } from './serialize'
import { createBlankItem } from './store'

class MemoryFile {
  kind = 'file' as const
  name: string
  data = new Blob()
  constructor(name: string) { this.name = name }
  async getFile() { return new File([this.data], this.name) }
  async createWritable() {
    return {
      write: async (data: Blob | string | BufferSource) => { this.data = data instanceof Blob ? data : new Blob([data as BlobPart]) },
      close: async () => {},
    }
  }
}

class MemoryDirectory {
  kind = 'directory' as const
  name: string
  children = new Map<string, MemoryDirectory | MemoryFile>()
  constructor(name: string) { this.name = name }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.children.get(name)
    if (existing?.kind === 'directory') return existing
    if (!options?.create) throw new Error('not found')
    const dir = new MemoryDirectory(name)
    this.children.set(name, dir)
    return dir
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.children.get(name)
    if (existing?.kind === 'file') return existing
    if (!options?.create) throw new Error('not found')
    const file = new MemoryFile(name)
    this.children.set(name, file)
    return file
  }
  async removeEntry(name: string) { this.children.delete(name) }
  async *entries() { yield* this.children.entries() }
}

async function zipFile(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(entries)) zip.file(path, content)
  return new File([await zip.generateAsync({ type: 'arraybuffer' })], 'backup.zip')
}

describe('vault ZIP restore', () => {
  it('fully replaces old content and keeps a single standard root folder', async () => {
    const root = new MemoryDirectory('vault')
    const old = await root.getDirectoryHandle('old', { create: true })
    await old.getFileHandle('stale.txt', { create: true })

    await importVaultZip(
      root as unknown as VaultHandle,
      await zipFile({ 'keyboards/item.md': 'new item' }),
    )

    expect(root.children.has('old')).toBe(false)
    const keyboards = root.children.get('keyboards') as MemoryDirectory
    expect(keyboards?.children.has('item.md')).toBe(true)
    expect(root.children.has('item.md')).toBe(false)
  })

  it('rejects an unsafe archive before deleting current data', async () => {
    const root = new MemoryDirectory('vault')
    await root.getFileHandle('keep.md', { create: true })
    const unsafe = await zipFile({ 'folder/bad:name.md': 'bad' })

    await expect(importVaultZip(root as unknown as VaultHandle, unsafe)).rejects.toThrow('不安全路径')
    expect(root.children.has('keep.md')).toBe(true)
  })
})

describe('vault image persistence', () => {
  it('writes an uploaded thumbnail separately and records it in Markdown', async () => {
    const root = new MemoryDirectory('vault')
    const item = createBlankItem('keyboards')
    item.name = 'Thumbnail Test'
    item.filePath = '../../vault/keyboards/thumbnail-test.md'
    item.image = 'data:image/jpeg;base64,AQID'
    item.images = [item.image]
    item.thumbnail = 'data:image/jpeg;base64,BAUG'

    await writeItem(root as unknown as VaultHandle, item)

    const thumbnails = (root.children.get('assets') as MemoryDirectory).children.get('thumbnails') as MemoryDirectory
    expect(thumbnails.children.has('thumbnail-test-thumb.jpg')).toBe(true)

    const keyboards = root.children.get('keyboards') as MemoryDirectory
    const markdown = keyboards.children.get('thumbnail-test.md') as MemoryFile
    await expect(markdown.data.text()).resolves.toContain('thumbnail: thumbnail-test-thumb.jpg')
  })

  it('backfills only missing thumbnails and is safe to run again', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = await root.getDirectoryHandle('keyboards', { create: true })
    const assets = await root.getDirectoryHandle('assets', { create: true })
    const images = await assets.getDirectoryHandle('images', { create: true })
    const hero = await images.getFileHandle('legacy-hero.jpg', { create: true })
    hero.data = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

    const item = createBlankItem('keyboards')
    item.id = 'legacy-thumbnail-test'
    item.name = 'Legacy Thumbnail Test'
    item.filePath = 'keyboards/legacy-thumbnail-test.md'
    item.image = 'legacy-hero.jpg'
    item.images = ['legacy-hero.jpg']
    item.thumbnail = undefined
    const markdown = await keyboards.getFileHandle('legacy-thumbnail-test.md', { create: true })
    markdown.data = new Blob([serializeItem(item)], { type: 'text/markdown' })

    const dependencies = {
      loadSource: async () => 'data:image/jpeg;base64,AQID',
      createThumbnail: async () => 'data:image/jpeg;base64,BAUG',
    }
    const first = await generateMissingThumbnails(root as unknown as VaultHandle, dependencies)
    expect(first).toMatchObject({ scanned: 1, generated: 1, failed: 0 })

    const thumbnails = assets.children.get('thumbnails') as MemoryDirectory
    expect(thumbnails.children.has('legacy-thumbnail-test-thumb.jpg')).toBe(true)
    await expect(markdown.data.text()).resolves.toContain(
      'thumbnail: legacy-thumbnail-test-thumb.jpg',
    )

    const second = await generateMissingThumbnails(root as unknown as VaultHandle, dependencies)
    expect(second).toMatchObject({ scanned: 1, generated: 0, skippedExisting: 1, failed: 0 })
  })
})
