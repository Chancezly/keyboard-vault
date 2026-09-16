import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { generateMissingThumbnails, importVaultZip, loadItemHero, readVault, writeItem, type VaultHandle } from './fs'
import { serializeItem } from './serialize'
import { createBlankItem } from './store'

class MemoryFile {
  kind = 'file' as const
  name: string
  data = new Blob()
  readCount = 0
  textReadCount = 0
  lastModified = 1
  constructor(name: string) { this.name = name }
  async getFile() {
    this.readCount++
    const file = new File([this.data], this.name, { lastModified: this.lastModified })
    const readText = file.text.bind(file)
    Object.defineProperty(file, 'text', {
      value: async () => {
        this.textReadCount++
        return readText()
      },
    })
    return file
  }
  async createWritable() {
    return {
      write: async (data: Blob | string | BufferSource) => {
        this.data = data instanceof Blob ? data : new Blob([data as BlobPart])
        this.lastModified++
      },
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
  it('reuses one stable Blob URL for an unchanged local thumbnail', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = await root.getDirectoryHandle('keyboards', { create: true })
    const assets = await root.getDirectoryHandle('assets', { create: true })
    const thumbnails = await assets.getDirectoryHandle('thumbnails', { create: true })
    const thumbnail = await thumbnails.getFileHandle('stable-thumb.webp', { create: true })
    thumbnail.data = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    const item = createBlankItem('keyboards')
    item.id = 'stable-blob-thumbnail'
    item.name = 'Stable Blob Thumbnail'
    item.filePath = 'keyboards/stable-blob-thumbnail.md'
    item.thumbnail = 'stable-thumb.webp'
    const markdown = await keyboards.getFileHandle('stable-blob-thumbnail.md', { create: true })
    markdown.data = new Blob([serializeItem(item)], { type: 'text/markdown' })

    const first = await readVault(root as unknown as VaultHandle)
    const second = await readVault(root as unknown as VaultHandle)

    expect(first[0].thumbnail).toMatch(/^blob:/)
    expect(second[0].thumbnail).toBe(first[0].thumbnail)
  })

  it('reuses parsed Markdown until the file signature changes', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = await root.getDirectoryHandle('keyboards', { create: true })
    const item = createBlankItem('keyboards')
    item.id = 'incremental-read'
    item.name = 'Before'
    item.filePath = 'keyboards/incremental-read.md'
    item.thumbnail = 'data:image/webp;base64,BAUG'
    const markdown = await keyboards.getFileHandle('incremental-read.md', { create: true })
    markdown.data = new Blob([serializeItem(item)], { type: 'text/markdown' })

    await readVault(root as unknown as VaultHandle)
    const unchanged = await readVault(root as unknown as VaultHandle)
    expect(markdown.textReadCount).toBe(1)
    expect(unchanged[0].name).toBe('Before')

    const writable = await markdown.createWritable()
    await writable.write(serializeItem({ ...item, name: 'After' }))
    await writable.close()
    const changed = await readVault(root as unknown as VaultHandle)
    expect(markdown.textReadCount).toBe(2)
    expect(changed[0].name).toBe('After')
  })

  it('loads collection metadata without reading original image files', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = await root.getDirectoryHandle('keyboards', { create: true })
    const assets = await root.getDirectoryHandle('assets', { create: true })
    const images = await assets.getDirectoryHandle('images', { create: true })
    const hero = await images.getFileHandle('large-original.jpg', { create: true })
    hero.data = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })

    const item = createBlankItem('keyboards')
    item.id = 'thumbnail-only-home'
    item.name = 'Thumbnail Only Home'
    item.filePath = 'keyboards/thumbnail-only-home.md'
    item.image = 'large-original.jpg'
    item.images = ['large-original.jpg']
    item.thumbnail = 'data:image/webp;base64,BAUG'
    const markdown = await keyboards.getFileHandle('thumbnail-only-home.md', { create: true })
    markdown.data = new Blob([serializeItem(item)], { type: 'text/markdown' })

    const loaded = await readVault(root as unknown as VaultHandle)

    expect(hero.readCount).toBe(0)
    expect(loaded[0]).toMatchObject({
      image: 'large-original.jpg',
      images: ['large-original.jpg'],
      thumbnail: 'data:image/webp;base64,BAUG',
    })

    const detailed = await loadItemHero(root as unknown as VaultHandle, loaded[0], {
      loadImage: async (_handle, ref, directory) => {
        expect(ref).toBe('large-original.jpg')
        expect(directory).toBe('images')
        return 'data:image/jpeg;base64,AQID'
      },
    })
    expect(detailed.image).toBe('data:image/jpeg;base64,AQID')
    expect(detailed.images[0]).toBe('data:image/jpeg;base64,AQID')
  })

  it('writes an uploaded thumbnail separately and records it in Markdown', async () => {
    const root = new MemoryDirectory('vault')
    const item = createBlankItem('keyboards')
    item.name = 'Thumbnail Test'
    item.filePath = '../../vault/keyboards/thumbnail-test.md'
    item.image = 'data:image/jpeg;base64,AQID'
    item.images = [item.image]
    item.thumbnail = 'data:image/webp;base64,BAUG'

    await writeItem(root as unknown as VaultHandle, item)

    const thumbnails = (root.children.get('assets') as MemoryDirectory).children.get('thumbnails') as MemoryDirectory
    expect(thumbnails.children.has('thumbnail-test-thumb.webp')).toBe(true)

    const keyboards = root.children.get('keyboards') as MemoryDirectory
    const markdown = keyboards.children.get('thumbnail-test.md') as MemoryFile
    await expect(markdown.data.text()).resolves.toContain('thumbnail: thumbnail-test-thumb.webp')
  })

  it('keeps the JPEG extension when thumbnail generation falls back from WebP', async () => {
    const root = new MemoryDirectory('vault')
    const item = createBlankItem('keyboards')
    item.name = 'JPEG Thumbnail Fallback'
    item.filePath = 'keyboards/jpeg-thumbnail-fallback.md'
    item.image = 'data:image/jpeg;base64,AQID'
    item.images = [item.image]
    item.thumbnail = 'data:image/jpeg;base64,BAUG'

    await writeItem(root as unknown as VaultHandle, item)

    const thumbnails = (root.children.get('assets') as MemoryDirectory).children.get('thumbnails') as MemoryDirectory
    expect(thumbnails.children.has('jpeg-thumbnail-fallback-thumb.jpg')).toBe(true)
    const keyboards = root.children.get('keyboards') as MemoryDirectory
    const markdown = keyboards.children.get('jpeg-thumbnail-fallback.md') as MemoryFile
    await expect(markdown.data.text()).resolves.toContain(
      'thumbnail: jpeg-thumbnail-fallback-thumb.jpg',
    )
  })

  it('updates one item and removes its previous Markdown without scanning unrelated files', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = await root.getDirectoryHandle('keyboards', { create: true })
    const unrelated = await keyboards.getFileHandle('unrelated.md', { create: true })
    unrelated.data = new Blob(['unrelated'], { type: 'text/markdown' })
    const previousFile = await keyboards.getFileHandle('old-name.md', { create: true })
    previousFile.data = new Blob(['old'], { type: 'text/markdown' })

    const item = createBlankItem('keyboards')
    item.id = 'incremental-save'
    item.name = 'New Name'
    item.filePath = 'keyboards/new-name.md'
    const saved = await writeItem(root as unknown as VaultHandle, item, {
      category: 'keyboards',
      filePath: 'keyboards/old-name.md',
    })

    expect(keyboards.children.has('old-name.md')).toBe(false)
    expect(keyboards.children.has('new-name.md')).toBe(true)
    expect(unrelated.readCount).toBe(0)
    expect(saved.filePath).toBe('keyboards/new-name.md')

    const savedFile = keyboards.children.get('new-name.md') as MemoryFile
    await readVault(root as unknown as VaultHandle)
    expect(savedFile.textReadCount).toBe(0)
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
      createThumbnail: async () => 'data:image/webp;base64,BAUG',
    }
    const first = await generateMissingThumbnails(root as unknown as VaultHandle, dependencies)
    expect(first).toMatchObject({ scanned: 1, generated: 1, failed: 0 })

    const thumbnails = assets.children.get('thumbnails') as MemoryDirectory
    expect(thumbnails.children.has('legacy-thumbnail-test-thumb.webp')).toBe(true)
    await expect(markdown.data.text()).resolves.toContain(
      'thumbnail: legacy-thumbnail-test-thumb.webp',
    )

    const second = await generateMissingThumbnails(root as unknown as VaultHandle, dependencies)
    expect(second).toMatchObject({ scanned: 1, generated: 0, skippedExisting: 1, failed: 0 })
  })
})
