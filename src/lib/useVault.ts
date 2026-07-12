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
  stabilizeImageRefs,
  type VaultHandle,
} from './fs'
import { isVaultBrowserSupported } from './vaultCapabilities'
import { hydrateImageCache, persistHeroToImageStore } from './imageStore'
import { assignItemFilePath, collectTakenBasenames } from './naming'

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
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  save: (item: CollectionItem) => Promise<CollectionItem>
  remove: (item: CollectionItem) => Promise<void>
  reload: () => Promise<void>
  exportZip: () => Promise<void>
  importZip: (file: File) => Promise<void>
}

export function useVault(): VaultState {
  const [items, setItems] = useState<CollectionItem[]>(() => getBundledItems())
  const [mode, setMode] = useState<VaultMode>('bundled')
  const [handle, setHandle] = useState<VaultHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const loadFromHandle = useCallback(async (h: VaultHandle) => {
    setBusy(true)
    setError(null)
    try {
      await ensureVaultStructure(h)
      const loaded = await readVault(h)
      setHandle(h)
      setMode('directory')
      setItems(loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setMode('bundled')
      setItems(getBundledItems())
    } finally {
      setBusy(false)
    }
  }, [])

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
    if (!supported) return
    try {
      const h = await pickVaultDirectory()
      if (h) await loadFromHandle(h)
    } catch (e) {
      // user cancelled picker → ignore AbortError
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message)
    }
  }, [supported, loadFromHandle])

  const disconnect = useCallback(async () => {
    await forgetVaultDirectory()
    setHandle(null)
    setMode('bundled')
    setItems(getBundledItems())
  }, [])

  const reload = useCallback(async () => {
    if (mode === 'directory' && handle) {
      setItems(await readVault(handle))
    } else {
      setItems(getBundledItems())
    }
  }, [mode, handle])

  const save = useCallback(
    async (item: CollectionItem): Promise<CollectionItem> => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        setError(null)
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
          return loaded.find((i) => i.id === item.id) ?? toSave
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          setError(message)
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
        return getBundledItems().find((i) => i.id === item.id) ?? saved
      }
    },
    [mode, handle],
  )

  const remove = useCallback(
    async (item: CollectionItem) => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        try {
          await deleteItemFile(handle, item)
          setItems(await readVault(handle))
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        } finally {
          setBusy(false)
        }
      } else {
        deleteLocal(item.id)
        setItems(getBundledItems())
      }
    },
    [mode, handle],
  )

  const exportZip = useCallback(async () => {
    if (mode !== 'directory' || !handle) return
    setBusy(true)
    try {
      const blob = await exportVaultZip(handle)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBackup(blob, `${handle.name || 'vault'}-backup-${stamp}.zip`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [mode, handle, downloadBackup])

  const importZip = useCallback(
    async (file: File) => {
      if (mode !== 'directory' || !handle) return
      const confirmed = window.confirm(
        '恢复会完整替换当前 vault。继续前应用会自动下载一份当前数据备份，是否继续？',
      )
      if (!confirmed) return
      setBusy(true)
      setError(null)
      try {
        const before = await exportVaultZip(handle)
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        downloadBackup(before, `${handle.name || 'vault'}-before-restore-${stamp}.zip`)
        await importVaultZip(handle, file)
        setItems(await readVault(handle))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [mode, handle, downloadBackup],
  )

  return {
    items,
    mode,
    supported,
    writable,
    dirName: handle?.name ?? null,
    busy,
    error,
    connect,
    disconnect,
    save,
    remove,
    reload,
    exportZip,
    importZip,
  }
}
