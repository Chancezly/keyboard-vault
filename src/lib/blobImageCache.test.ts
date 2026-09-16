import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BlobImageCache } from './blobImageCache'

describe('BlobImageCache', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('deduplicates concurrent reads and never evicts a referenced image', async () => {
    let nextUrl = 1
    const revoked: string[] = []
    const cache = new BlobImageCache({
      maxBytes: 3,
      releaseGraceMs: 100,
      createUrl: () => `blob:test-${nextUrl++}`,
      revokeUrl: (url) => revoked.push(url),
    })
    const load = vi.fn(async () => new Blob([new Uint8Array([1, 2])]))

    const [first, concurrent] = await Promise.all([
      cache.get('vault:image:1', load),
      cache.get('vault:image:1', load),
    ])
    expect(first).toBe(concurrent)
    expect(load).toHaveBeenCalledTimes(1)

    cache.retain(first)
    const unused = await cache.get(
      'vault:image:2',
      async () => new Blob([new Uint8Array([3, 4, 5])]),
    )
    await vi.advanceTimersByTimeAsync(100)

    expect(revoked).toContain(unused)
    expect(revoked).not.toContain(first)
    expect(cache.stats()).toMatchObject({ entries: 1, bytes: 2, referenced: 1 })
  })

  it('survives a Strict Mode style release and immediate retain', async () => {
    const revoked: string[] = []
    const cache = new BlobImageCache({
      maxBytes: 1,
      releaseGraceMs: 100,
      createUrl: () => 'blob:strict-mode',
      revokeUrl: (url) => revoked.push(url),
    })
    const url = await cache.get(
      'vault:image:strict',
      async () => new Blob([new Uint8Array([1, 2])]),
    )

    cache.retain(url)
    cache.release(url)
    cache.retain(url)
    await vi.advanceTimersByTimeAsync(100)

    expect(revoked).toEqual([])
    expect(cache.wasRevoked(url)).toBe(false)
  })

  it('suspends eviction while a vault read is still building the item list', async () => {
    const revoked: string[] = []
    const cache = new BlobImageCache({
      maxBytes: 1,
      releaseGraceMs: 100,
      createUrl: () => 'blob:loading-vault',
      revokeUrl: (url) => revoked.push(url),
    })
    const resume = cache.suspendEviction()
    await cache.get(
      'vault:thumbnail:loading',
      async () => new Blob([new Uint8Array([1, 2])]),
    )

    await vi.advanceTimersByTimeAsync(500)
    expect(revoked).toEqual([])

    resume()
    await vi.advanceTimersByTimeAsync(100)
    expect(revoked).toEqual(['blob:loading-vault'])
  })
})
