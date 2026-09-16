import { useEffect, useMemo, useState } from 'react'
import {
  filterItems,
  getAllTags,
  getStats,
  loadPreferences,
  sortItems,
} from '../../lib/collection'
import type {
  CollectionItem,
  ItemCategory,
  ItemStatus,
  SortOption,
} from '../../lib/types'

const SORT_STORAGE_KEY = 'keyvault:sort:v1'

export type CollectionViewMode = 'grid' | 'list' | 'table'

function loadSortPreference(): SortOption {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    if (raw === 'name' || raw === 'addedAt' || raw === 'acquired') return raw
  } catch {
    // localStorage may be unavailable in privacy-restricted contexts.
  }
  return 'name'
}

export function useCollectionView(items: CollectionItem[]) {
  const [category, setCategory] = useState<ItemCategory | 'all'>('all')
  const [status, setStatus] = useState<ItemStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>(() => loadSortPreference())
  const [viewMode, setViewMode] = useState<CollectionViewMode>('grid')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const keepMobileViewSupported = () => {
      if (mediaQuery.matches) {
        setViewMode((current) => (current === 'table' ? 'grid' : current))
      }
    }
    keepMobileViewSupported()
    mediaQuery.addEventListener('change', keepMobileViewSupported)
    return () => mediaQuery.removeEventListener('change', keepMobileViewSupported)
  }, [])

  const stats = useMemo(() => getStats(items), [items])
  const allTags = useMemo(() => getAllTags(items), [items])
  const preferences = useMemo(() => loadPreferences(), [])
  const studioSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((item) => item.category === 'keyboards')
            .map((item) => item.brand.trim())
            .filter(Boolean),
        ),
      ),
    [items],
  )
  const filteredItems = useMemo(
    () => sortItems(filterItems(items, category, status, search), sortBy),
    [items, category, status, search, sortBy],
  )

  const changeSort = (next: SortOption) => {
    setSortBy(next)
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next)
    } catch {
      // Sorting still works for the current session.
    }
  }

  return {
    category,
    setCategory,
    status,
    setStatus,
    search,
    setSearch,
    sortBy,
    changeSort,
    viewMode,
    setViewMode,
    filteredItems,
    stats,
    allTags,
    preferences,
    studioSuggestions,
  }
}
