interface BlobCacheEntry {
  key: string
  url: string
  bytes: number
  references: number
  lastUsed: number
}

interface BlobImageCacheOptions {
  maxBytes?: number
  releaseGraceMs?: number
  createUrl?: (blob: Blob) => string
  revokeUrl?: (url: string) => void
}

/**
 * Blob URL 缓存：并发读取去重、引用计数、容量上限和延迟 LRU 淘汰。
 * 延迟淘汰会跨过 React Strict Mode 的 effect 清理/重建间隙，避免图片变黑。
 */
export class BlobImageCache {
  private readonly maxBytes: number
  private readonly releaseGraceMs: number
  private readonly createUrl: (blob: Blob) => string
  private readonly revokeUrl: (url: string) => void
  private readonly entriesByKey = new Map<string, BlobCacheEntry>()
  private readonly entriesByUrl = new Map<string, BlobCacheEntry>()
  private readonly pending = new Map<string, Promise<string>>()
  private readonly revoked = new Set<string>()
  private totalBytes = 0
  private evictionTimer: ReturnType<typeof setTimeout> | null = null
  private evictionSuspensions = 0

  constructor(options: BlobImageCacheOptions = {}) {
    this.maxBytes = options.maxBytes ?? 128 * 1024 * 1024
    this.releaseGraceMs = options.releaseGraceMs ?? 1_500
    this.createUrl = options.createUrl ?? ((blob) => URL.createObjectURL(blob))
    this.revokeUrl = options.revokeUrl ?? ((url) => URL.revokeObjectURL(url))
  }

  async get(key: string, load: () => Promise<Blob>): Promise<string> {
    const cached = this.entriesByKey.get(key)
    if (cached) {
      cached.lastUsed = Date.now()
      return cached.url
    }

    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight

    const request = load().then((blob) => {
      const existing = this.entriesByKey.get(key)
      if (existing) return existing.url
      const url = this.createUrl(blob)
      const entry: BlobCacheEntry = {
        key,
        url,
        bytes: blob.size,
        references: 0,
        lastUsed: Date.now(),
      }
      this.entriesByKey.set(key, entry)
      this.entriesByUrl.set(url, entry)
      this.totalBytes += entry.bytes
      this.scheduleEviction()
      return url
    }).finally(() => {
      this.pending.delete(key)
    })
    this.pending.set(key, request)
    return request
  }

  retain(url: string): void {
    const entry = this.entriesByUrl.get(url)
    if (!entry) return
    entry.references++
    entry.lastUsed = Date.now()
  }

  release(url: string): void {
    const entry = this.entriesByUrl.get(url)
    if (!entry) return
    entry.references = Math.max(0, entry.references - 1)
    entry.lastUsed = Date.now()
    this.scheduleEviction()
  }

  wasRevoked(url: string): boolean {
    return this.revoked.has(url)
  }

  suspendEviction(): () => void {
    this.evictionSuspensions++
    let resumed = false
    return () => {
      if (resumed) return
      resumed = true
      this.evictionSuspensions = Math.max(0, this.evictionSuspensions - 1)
      this.scheduleEviction()
    }
  }

  stats(): { entries: number; bytes: number; referenced: number; pending: number } {
    let referenced = 0
    for (const entry of this.entriesByKey.values()) {
      if (entry.references > 0) referenced++
    }
    return {
      entries: this.entriesByKey.size,
      bytes: this.totalBytes,
      referenced,
      pending: this.pending.size,
    }
  }

  clear(): void {
    if (this.evictionTimer != null) clearTimeout(this.evictionTimer)
    this.evictionTimer = null
    for (const entry of this.entriesByKey.values()) this.evict(entry)
    this.pending.clear()
  }

  private scheduleEviction(): void {
    if (
      this.totalBytes <= this.maxBytes ||
      this.evictionTimer != null ||
      this.evictionSuspensions > 0
    ) return
    this.evictionTimer = setTimeout(() => {
      this.evictionTimer = null
      this.evictUnused()
    }, this.releaseGraceMs)
  }

  private evictUnused(): void {
    if (this.totalBytes <= this.maxBytes) return
    const candidates = [...this.entriesByKey.values()]
      .filter((entry) => entry.references === 0)
      .sort((a, b) => a.lastUsed - b.lastUsed)
    for (const entry of candidates) {
      if (this.totalBytes <= this.maxBytes) break
      this.evict(entry)
    }
  }

  private evict(entry: BlobCacheEntry): void {
    if (!this.entriesByKey.delete(entry.key)) return
    this.entriesByUrl.delete(entry.url)
    this.totalBytes = Math.max(0, this.totalBytes - entry.bytes)
    this.revokeUrl(entry.url)
    this.revoked.add(entry.url)
    if (this.revoked.size > 1_000) {
      const oldest = this.revoked.values().next().value
      if (oldest) this.revoked.delete(oldest)
    }
  }
}

const vaultImageCache = new BlobImageCache()

export function getCachedVaultImage(key: string, load: () => Promise<Blob>): Promise<string> {
  return vaultImageCache.get(key, load)
}

export function retainVaultImage(url: string): void {
  vaultImageCache.retain(url)
}

export function releaseVaultImage(url: string): void {
  vaultImageCache.release(url)
}

export function wasVaultImageRevoked(url: string): boolean {
  return vaultImageCache.wasRevoked(url)
}

export function suspendVaultImageEviction(): () => void {
  return vaultImageCache.suspendEviction()
}

export function getVaultImageCacheStats() {
  return vaultImageCache.stats()
}
