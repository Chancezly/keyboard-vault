import { useCallback, useEffect, useState } from 'react'
import type { CollectionItem, UserPreferences } from './types'
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
  type VaultReadIssue,
} from './fs'
import { isVaultBrowserSupported } from './vaultCapabilities'
import { hydrateImageCache, persistHeroToImageStore } from './imageStore'
import { assignItemFilePath, collectTakenBasenames } from './naming'
import { hydrateBuildItems } from './builds'
import { useNotifications } from '../features/notifications/notification'
import { diagnoseVault, type VaultDiagnosticsReport } from './vaultDiagnostics'
import {
  removeOrphanResources,
  repairDuplicateIds as repairDuplicateVaultIds,
} from './vaultMaintenance'
import { enqueueVaultWrite } from './vaultWriteQueue'
import { readVaultPreferences, writeVaultPreferences } from './vaultPreferences'
import { loadPreferences } from './collection'
import { listHistory, restoreHistory, type HistoryVersion } from './vaultHistory'

export type VaultMode = 'bundled' | 'directory'

export interface VaultState {
  items: CollectionItem[]
  preferences: UserPreferences
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
  diagnose: () => Promise<VaultDiagnosticsReport | null>
  repairDuplicateIds: () => Promise<VaultDiagnosticsReport | null>
  cleanOrphanResources: (paths: string[]) => Promise<VaultDiagnosticsReport | null>
  savePreferences: (preferences: UserPreferences) => Promise<void>
  getHistory: () => Promise<HistoryVersion[]>
  restoreVersion: (item: CollectionItem, version: HistoryVersion) => Promise<void>
  loadHero: (item: CollectionItem) => Promise<CollectionItem>
}

function upsertCollectionItem(items: CollectionItem[], saved: CollectionItem): CollectionItem[] {
  const exists = items.some((item) => item.id === saved.id)
  const merged = exists
    ? items.map((item) => (item.id === saved.id ? saved : item))
    : [...items, saved]
  const byId = new Map(merged.map((item) => [item.id, item]))
  return hydrateBuildItems(merged.map((item) => ({
    ...item,
    relations: item.relations.map((relation) => {
      const target = byId.get(relation.ref)
      return target
        ? { ...relation, name: target.name, category: target.category }
        : relation
    }),
  })))
}

export function useVault(): VaultState {
  const notifications = useNotifications()
  const [items, setItems] = useState<CollectionItem[]>(() => getBundledItems())
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadPreferences())
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

  const readDirectory = useCallback(async (h: VaultHandle): Promise<CollectionItem[]> => {
    const issues: VaultReadIssue[] = []
    const loaded = await readVault(h, { onIssue: (issue) => issues.push(issue) })
    if (issues.length > 0) {
      const first = issues[0]
      notifications.error(
        `已隔离 ${issues.length} 个损坏文件`,
        `${first.filePath}：${first.message}${issues.length > 1 ? '；其余问题可在收藏库诊断中查看。' : ''}`,
      )
    }
    const idCounts = new Map<string, number>()
    for (const item of loaded) idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1)
    const duplicateGroups = Array.from(idCounts.values()).filter((count) => count > 1).length
    if (duplicateGroups > 0) {
      notifications.info(
        `发现 ${duplicateGroups} 组重复 ID`,
        '请运行“收藏库诊断”，确认后可安全修复后续重复资料。',
      )
    }
    return loaded
  }, [notifications])

  const loadFromHandle = useCallback(async (h: VaultHandle): Promise<boolean> => {
    setBusy(true)
    try {
      await ensureVaultStructure(h)
      const loaded = await readDirectory(h)
      const loadedPreferences = await readVaultPreferences(h)
      setHandle(h)
      setMode('directory')
      setItems(loaded)
      setPreferences(loadedPreferences)
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      notifications.error('无法读取收藏库', message)
      setMode('bundled')
      setItems(getBundledItems())
      setPreferences(loadPreferences())
      return false
    } finally {
      setBusy(false)
    }
  }, [readDirectory, notifications])

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
      setPreferences(loadPreferences())
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
        setItems(await readDirectory(handle))
        setPreferences(await readVaultPreferences(handle))
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
  }, [mode, handle, readDirectory, notifications])

  const loadHero = useCallback(async (item: CollectionItem): Promise<CollectionItem> => {
    if (mode === 'directory' && handle) return loadItemHero(handle, item)
    return item
  }, [mode, handle])

  const save = useCallback(
    async (item: CollectionItem): Promise<CollectionItem> => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        try {
          // 保存前把显示用 data/blob URL 还原成文件名，避免重复写图。
          const stabilized = stabilizeImageRefs(item)
          const previous = items.find((current) => current.id === stabilized.id)
          const taken = collectTakenBasenames(items, stabilized.id)
          const toSave = assignItemFilePath(stabilized, taken)
          const savedSummary = await enqueueVaultWrite(
            handle,
            () => writeItem(handle, toSave, previous),
          )
          setItems((current) => upsertCollectionItem(current, savedSummary))
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
    [mode, handle, items, notifications],
  )

  const remove = useCallback(
    async (item: CollectionItem) => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        try {
          await enqueueVaultWrite(handle, () => deleteItemFile(handle, item))
          setItems(await readDirectory(handle))
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
    [mode, handle, readDirectory, notifications],
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
        await enqueueVaultWrite(handle, async () => {
          const before = await exportVaultZip(handle)
          const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
          downloadBackup(before, `${handle.name || 'vault'}-before-restore-${stamp}.zip`)
          await importVaultZip(handle, file)
        })
        setItems(await readDirectory(handle))
        setPreferences(await readVaultPreferences(handle))
        notifications.success('收藏库恢复完成', '恢复前的原数据已自动下载备份。')
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        notifications.error('恢复失败', message)
      } finally {
        setBusy(false)
      }
    },
    [mode, handle, downloadBackup, readDirectory, notifications],
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
      const result = await enqueueVaultWrite(
        handle,
        () => generateMissingThumbnails(handle),
      )
      if (result.generated > 0) setItems(await readDirectory(handle))

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
  }, [mode, handle, readDirectory, notifications])

  const diagnose = useCallback(async (): Promise<VaultDiagnosticsReport | null> => {
    if (mode !== 'directory' || !handle) return null
    setBusy(true)
    const progressId = notifications.notify({
      title: '正在诊断收藏库',
      message: '只读检查文件和图片引用，请保持页面打开。',
      tone: 'info',
      duration: 0,
    })
    try {
      const report = await diagnoseVault(handle)
      if (report.issues.length === 0) {
        notifications.success('收藏库诊断完成', '未发现完整性问题。')
      } else {
        notifications.info('收藏库诊断完成', `发现 ${report.issues.length} 个待检查项。`)
      }
      return report
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notifications.error('收藏库诊断失败', message)
      return null
    } finally {
      notifications.dismiss(progressId)
      setBusy(false)
    }
  }, [mode, handle, notifications])

  const repairDuplicateIds = useCallback(async (): Promise<VaultDiagnosticsReport | null> => {
    if (mode !== 'directory' || !handle) return null
    setBusy(true)
    try {
      const repairs = await enqueueVaultWrite(
        handle,
        () => repairDuplicateVaultIds(handle),
      )
      if (repairs.length === 0) {
        notifications.info('无需修复重复 ID', '当前收藏库没有重复 ID。')
      } else {
        setItems(await readDirectory(handle))
        notifications.success(
          '重复 ID 已安全修复',
          `已为 ${repairs.length} 条后续重复资料分配新 ID，首条记录保持不变。`,
        )
      }
      return await diagnoseVault(handle)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notifications.error('重复 ID 修复失败', message)
      return null
    } finally {
      setBusy(false)
    }
  }, [mode, handle, readDirectory, notifications])

  const cleanOrphanResources = useCallback(async (
    paths: string[],
  ): Promise<VaultDiagnosticsReport | null> => {
    if (mode !== 'directory' || !handle) return null
    setBusy(true)
    try {
      const result = await enqueueVaultWrite(
        handle,
        () => removeOrphanResources(handle, paths),
      )
      if (result.failed.length > 0) {
        notifications.error(
          '部分孤立资源清理失败',
          `已清理 ${result.removed.length} 个，失败 ${result.failed.length} 个：${result.failed[0].path}`,
        )
      } else {
        notifications.success('孤立资源已清理', `共删除 ${result.removed.length} 个未引用文件。`)
      }
      return await diagnoseVault(handle)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notifications.error('孤立资源清理失败', message)
      return null
    } finally {
      setBusy(false)
    }
  }, [mode, handle, notifications])

  const savePreferences = useCallback(async (next: UserPreferences): Promise<void> => {
    if (mode !== 'directory' || !handle) return
    if (next.budgetRange[0] > next.budgetRange[1]) {
      notifications.error('偏好保存失败', '预算下限不能高于预算上限。')
      throw new Error('预算范围无效')
    }
    setBusy(true)
    try {
      await enqueueVaultWrite(handle, () => writeVaultPreferences(handle, next))
      setPreferences(next)
      notifications.success('收藏库偏好已保存', 'settings/user.md')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      notifications.error('偏好保存失败', message)
      throw error
    } finally {
      setBusy(false)
    }
  }, [mode, handle, notifications])

  const getHistory = useCallback(async () => mode === 'directory' && handle ? listHistory(handle) : [], [mode, handle])
  const restoreVersion = useCallback(async (item: CollectionItem, version: HistoryVersion) => {
    if (mode !== 'directory' || !handle) return
    setBusy(true)
    try {
      await enqueueVaultWrite(handle, () => restoreHistory(handle, item, version))
      setItems(await readDirectory(handle))
      notifications.success('历史版本已恢复', item.name)
    } catch(error) {
      notifications.error('历史版本恢复失败', error instanceof Error ? error.message : String(error))
      throw error
    } finally { setBusy(false) }
  }, [mode, handle, readDirectory, notifications])

  return {
    items,
    preferences,
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
    diagnose,
    repairDuplicateIds,
    cleanOrphanResources,
    savePreferences,
    getHistory,
    restoreVersion,
    loadHero,
  }
}
