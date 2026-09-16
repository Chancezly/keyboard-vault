import { describe, expect, it } from 'vitest'
import { createBlankItem } from './store'
import { serializeItem } from './serialize'
import { removeOrphanResources, repairDuplicateIds } from './vaultMaintenance'
import type { VaultHandle } from './fs'

class MemoryFile {
  kind = 'file' as const
  name: string
  data: Blob
  constructor(name: string, content: string) {
    this.name = name
    this.data = new Blob([content])
  }
  async getFile() { return new File([this.data], this.name) }
  async createWritable() {
    return {
      write: async (content: string) => { this.data = new Blob([content]) },
      close: async () => {},
    }
  }
}

class MemoryDirectory {
  kind = 'directory' as const
  name: string
  children = new Map<string, MemoryDirectory | MemoryFile>()
  constructor(name: string) { this.name = name }
  directory(name: string) {
    const directory = new MemoryDirectory(name)
    this.children.set(name, directory)
    return directory
  }
  file(name: string, content: string) {
    const file = new MemoryFile(name, content)
    this.children.set(name, file)
    return file
  }
  async getDirectoryHandle(name: string) {
    const entry = this.children.get(name)
    if (entry?.kind !== 'directory') throw new Error('not found')
    return entry
  }
  async removeEntry(name: string) {
    if (!this.children.delete(name)) throw new Error('not found')
  }
  async *entries() { yield* this.children.entries() }
}

function itemMarkdown(id: string, name: string, path: string): string {
  const item = createBlankItem('keyboards')
  item.id = id
  item.name = name
  item.filePath = path
  return serializeItem(item)
}

describe('duplicate ID repair', () => {
  it('keeps the first ID and assigns stable unique IDs to later records', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = root.directory('keyboards')
    const first = keyboards.file('a.md', itemMarkdown('same-id', 'First', 'keyboards/a.md'))
    const second = keyboards.file('b.md', itemMarkdown('same-id', 'Second', 'keyboards/b.md'))
    const third = keyboards.file('c.md', itemMarkdown('same-id', 'Third', 'keyboards/c.md'))

    const repairs = await repairDuplicateIds(root as unknown as VaultHandle)

    expect(repairs).toEqual([
      { path: 'keyboards/b.md', previousId: 'same-id', nextId: 'same-id-b' },
      { path: 'keyboards/c.md', previousId: 'same-id', nextId: 'same-id-c' },
    ])
    await expect(first.data.text()).resolves.toContain('id: same-id\n')
    await expect(second.data.text()).resolves.toContain('id: same-id-b\n')
    await expect(third.data.text()).resolves.toContain('id: same-id-c\n')
  })

  it('does not rewrite valid records when IDs are already unique', async () => {
    const root = new MemoryDirectory('vault')
    const keyboards = root.directory('keyboards')
    const only = keyboards.file('only.md', itemMarkdown('only-id', 'Only', 'keyboards/only.md'))
    const before = await only.data.text()

    await expect(repairDuplicateIds(root as unknown as VaultHandle)).resolves.toEqual([])
    await expect(only.data.text()).resolves.toBe(before)
  })
})

describe('orphan resource cleanup', () => {
  it('only removes explicitly listed files from approved image directories', async () => {
    const root = new MemoryDirectory('vault')
    const assets = root.directory('assets')
    const images = assets.directory('images')
    const thumbnails = assets.directory('thumbnails')
    images.file('orphan.jpg', 'orphan')
    images.file('keep.jpg', 'keep')
    thumbnails.file('orphan.webp', 'orphan')

    const result = await removeOrphanResources(root as unknown as VaultHandle, [
      'assets/images/orphan.jpg',
      'assets/thumbnails/orphan.webp',
      'keyboards/item.md',
      'assets/images/../keep.jpg',
    ])

    expect(result.removed).toEqual(['assets/images/orphan.jpg', 'assets/thumbnails/orphan.webp'])
    expect(result.failed).toHaveLength(2)
    expect(images.children.has('orphan.jpg')).toBe(false)
    expect(images.children.has('keep.jpg')).toBe(true)
  })
})
