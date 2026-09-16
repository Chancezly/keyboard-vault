import { useCallback, useEffect, useState } from 'react'
import type { CollectionItem } from './types'
import {
  getBundledItems,
  upsertItem as upsertLocal,
  deleteItem as deleteLocal,
} from './store'
import {
  getSavedVaultDirectory,
  pickVaultDirectory,
  forgetVaultDirectory,
  readVault,
  writeItem,
  deleteItemFile,
  exportVaultZip,
  importVaultZip,
  ensureVaultStructure,
  generateMissingThumbnails,
  loadItemHero,
  stabilizeImageRefs,
  type VaultHandle,
} from './fs'
import { isVaultBrowserSupported } from './vaultCapabilities'
import { hydrateImageCache, persistHeroToImageStore } from './imageStore'
import { assignItemFilePath, collectTakenBasenames } from './naming'
import { useNotifications } from '../features/notifications/notification'

export type VaultMode = 'bundled' | 'directory'

export interface VaultState {
  items: CollectionItem[]
  mode: VaultMode
  /** 是否可连接并写入本地文件夹（Chrome / Edge） */
  supported: boolean
  /** 已连接本地文件夹，可编辑存盘 */
  writable: boolean
  dirName: string | null
  busy: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  save: (item: CollectionItem) => Promise<CollectionItem>
  remove: (item: CollectionItem) => Promise<void>
  reload: () => Promise<void>
  exportZip: () => Promise<void>
  importZip: (file: File) => Promise<void>
  generateThumbnails: () => Promise<void>
  loadHero: (item: CollectionItem) => Promise<CollectionItem>
}

export function useVault(): VaultState {
  const notifications = useNotifications()
  const [items, setItems] = useState<CollectionItem[]>(() => getBundledItems())
  const [mode, setMode] = useState<VaultMode>('bundled')
  const [handle, setHandle] = useState<VaultHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const supported = isVaultBrowserSupported()
  const writable = mode === 'directory'

  const downloadBackup = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const loadFromHandle = useCallback(async (h: VaultHandle): Promise<boolean> => {
    setBusy(true)
    try {
      await ensureVaultStructure(h)
      const loaded = await readVault(h)
      setHandle(h)
      setMode('directory')
      setItems(loaded)
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      notifications.error('无法读取收藏库', message)
      setMode('bundled')
      setItems(getBundledItems())
      return false
    } finally {
      setBusy(false)
    }
  }, [notifications])

  // Try to restore a previously connected directory on first load.
  useEffect(() => {
    hydrateImageCache()
      .then(() => setItems(getBundledItems()))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    getSavedVaultDirectory()
      .then((h) => {
        if (h && !cancelled) return loadFromHandle(h)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [supported, loadFromHandle])

  const connect = useCallback(async () => {
    if (!supported) {
      notifications.info('当前浏览器不支持文件夹连接', '请使用最新版 Chrome 或 Edge。')
      return
    }
    try {
      const h = await pickVaultDirectory()
      if (h && (await loadFromHandle(h))) {
        notifications.success('本地收藏库已连接', h.name)
      }
    } catch (e) {
      // user cancelled picker → ignore AbortError
      if (e instanceof Error && e.name !== 'AbortError') {
        notifications.error('连接失败', e.message)
      }
    }
  }, [supported, loadFromHandle, notifications])

  const disconnect = useCallback(async () => {
    try {
      await forgetVaultDirectory()
      setHandle(null)
      setMode('bundled')
      setItems(getBundledItems())
      notifications.success('已断开本地收藏库', '本地文件没有被删除。')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      notifications.error('断开连接失败', message)
    }
  }, [notifications])

  const reload = useCallback(async () => {
    setBusy(true)
    try {
      if (mode === 'directory' && handle) {
        setItems(await readVault(handle))
      } else {
        setItems(getBundledItems())
      }
      notifications.success('收藏库已重新载入')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      notifications.error('重新载入失败', message)
    } finally {
      setBusy(false)
    }
  }, [mode, handle, notifications])

  const loadHero = useCallback(async (item: CollectionItem): Promise<CollectionItem> => {
    if (mode === 'directory' && handle) return loadItemHero(handle, item)
    return item
  }, [mode, handle])

  const save = useCallback(
    async (item: CollectionItem): Promise<CollectionItem> => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        try {
          // 必须在 readVault 之前把 blob: 还原成文件名，否则 revoke 后无法写主图
          const stabilized = stabilizeImageRefs(item)
          const taken = collectTakenBasenames(
            (await readVault(handle)).filter((i) => i.id !== stabilized.id),
          )
          const toSave = assignItemFilePath(stabilized, taken)
          await writeItem(handle, toSave)
          const loaded = await readVault(handle)
          setItems(loaded)
          const savedSummary = loaded.find((i) => i.id === item.id) ?? toSave
          const saved = await loadItemHero(handle, savedSummary)
          notifications.success('收藏已保存', saved.name)
          return saved
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          notifications.error('保存失败', message)
          throw e instanceof Error ? e : new Error(message)
        } finally {
          setBusy(false)
        }
      } else {
        const taken = collectTakenBasenames(
          getBundledItems().filter((i) => i.id !== item.id),
        )
        const withPath = assignItemFilePath(item, taken)
        const withImage = await persistHeroToImageStore(withPath)
        const saved = { ...withPath, ...withImage }
        upsertLocal(saved)
        setItems(getBundledItems())
        const result = getBundledItems().find((i) => i.id === item.id) ?? saved
        notifications.success('收藏已保存', result.name)
        return result
      }
    },
    [mode, handle, notifications],
  )

  const remove = useCallback(
    async (item: CollectionItem) => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        try {
          await deleteItemFile(handle, item)
          setItems(await readVault(handle))
          notifications.success('收藏已删除', item.name)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          notifications.error('删除失败', message)
        } finally {
          setBusy(false)
        }
      } else {
        deleteLocal(item.id)
        setItems(getBundledItems())
        notifications.success('收藏已删除', item.name)
      }
    },
    [mode, handle, notifications],
  )

  const exportZip = useCallback(async () => {
    if (mode !== 'directory' || !handle) return
    setBusy(true)
    try {
      const blob = await exportVaultZip(handle)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBackup(blob, `${handle.name || 'vault'}-backup-${stamp}.zip`)
      notifications.success('备份已导出', `${handle.name || 'vault'} · ${stamp}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      notifications.error('导出备份失败', message)
    } finally {
      setBusy(false)
    }
  }, [mode, handle, downloadBackup, notifications])

  const importZip = useCallback(
    async (file: File) => {
      if (mode !== 'directory' || !handle) return
      const confirmed = window.confirm(
        '恢复会完整替换当前 vault。继续前应用会自动下载一份当前数据备份，是否继续？',
      )
      if (!confirmed) return
      setBusy(true)
      try {
        const before = await exportVaultZip(handle)
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        downloadBackup(before, `${handle.name || 'vault'}-before-restore-${stamp}.zip`)
        await importVaultZip(handle, file)
        setItems(await readVault(handle))
        notifications.success('收藏库恢复完成', '恢复前的原数据已自动下载备份。')
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        notifications.error('恢复失败', message)
      } finally {
        setBusy(false)
      }
    },
    [mode, handle, downloadBackup, notifications],
  )

  const generateThumbnails = useCallback(async () => {
    if (mode !== 'directory' || !handle) return
    setBusy(true)
    const progressId = notifications.notify({
      title: '正在检查旧资料缩略图',
      message: '仅处理缺少缩略图的资料，请保持页面打开。',
      tone: 'info',
      duration: 0,
    })
    try {
      const result = await generateMissingThumbnails(handle)
      if (result.generated > 0) setItems(await readVault(handle))

      if (result.failed > 0) {
        const summary = `已生成 ${result.generated} 张，失败 ${result.failed} 张。${result.errors[0]?.message ?? ''}`
        notifications.error('部分缩略图生成失败', summary)
      } else if (result.generated > 0) {
        notifications.success(
          '旧资料缩略图已生成',
          `新增 ${result.generated} 张，已有 ${result.skippedExisting} 张。`,
        )
      } else {
        notifications.info(
          '无需生成缩略图',
          `已检查 ${result.scanned} 条资料，现有缩略图均已保留。`,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notifications.error('批量生成缩略图失败', message)
    } finally {
      notifications.dismiss(progressId)
      setBusy(false)
    }
  }, [mode, handle, notifications])

  return {
    items,
    mode,
    supported,
    writable,
    dirName: handle?.name ?? null,
    busy,
    connect,
    disconnect,
    save,
    remove,
    reload,
    exportZip,
    importZip,
    generateThumbnails,
    loadHero,
  }
}
