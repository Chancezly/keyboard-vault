import { useCallback, useEffect, useState } from 'react'
import type { CollectionItem } from './types'
import {
  getEffectiveItems,
  upsertItem as upsertLocal,
  deleteItem as deleteLocal,
} from './store'
import {
  isFileSystemSupported,
  getSavedVaultDirectory,
  pickVaultDirectory,
  forgetVaultDirectory,
  readVault,
  writeItem,
  deleteItemFile,
  exportVaultZip,
  importVaultZip,
  type VaultHandle,
} from './fs'
import { hydrateImageCache, persistHeroToImageStore } from './imageStore'

export type VaultMode = 'bundled' | 'directory'

export interface VaultState {
  items: CollectionItem[]
  mode: VaultMode
  supported: boolean
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
  const [items, setItems] = useState<CollectionItem[]>(() => getEffectiveItems())
  const [mode, setMode] = useState<VaultMode>('bundled')
  const [handle, setHandle] = useState<VaultHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supported = isFileSystemSupported()

  const loadFromHandle = useCallback(async (h: VaultHandle) => {
    setBusy(true)
    setError(null)
    try {
      const loaded = await readVault(h)
      setHandle(h)
      setMode('directory')
      setItems(loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setMode('bundled')
      setItems(getEffectiveItems())
    } finally {
      setBusy(false)
    }
  }, [])

  // Try to restore a previously connected directory on first load.
  useEffect(() => {
    hydrateImageCache()
      .then(() => setItems(getEffectiveItems()))
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
    setItems(getEffectiveItems())
  }, [])

  const reload = useCallback(async () => {
    if (mode === 'directory' && handle) {
      setItems(await readVault(handle))
    } else {
      setItems(getEffectiveItems())
    }
  }, [mode, handle])

  const save = useCallback(
    async (item: CollectionItem): Promise<CollectionItem> => {
      if (mode === 'directory' && handle) {
        setBusy(true)
        setError(null)
        try {
          await writeItem(handle, item)
          const loaded = await readVault(handle)
          setItems(loaded)
          return loaded.find((i) => i.id === item.id) ?? item
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          setError(message)
          throw e instanceof Error ? e : new Error(message)
        } finally {
          setBusy(false)
        }
      } else {
        const withImage = await persistHeroToImageStore(item)
        const saved = { ...item, ...withImage }
        upsertLocal(saved)
        setItems(getEffectiveItems())
        return getEffectiveItems().find((i) => i.id === item.id) ?? saved
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
        setItems(getEffectiveItems())
      }
    },
    [mode, handle],
  )

  const exportZip = useCallback(async () => {
    if (mode !== 'directory' || !handle) return
    setBusy(true)
    try {
      const blob = await exportVaultZip(handle)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `${handle.name || 'vault'}-backup-${stamp}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [mode, handle])

  const importZip = useCallback(
    async (file: File) => {
      if (mode !== 'directory' || !handle) return
      setBusy(true)
      setError(null)
      try {
        await importVaultZip(handle, file)
        setItems(await readVault(handle))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [mode, handle],
  )

  return {
    items,
    mode,
    supported,
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
