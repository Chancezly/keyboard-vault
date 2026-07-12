import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { importVaultZip, type VaultHandle } from './fs'

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
