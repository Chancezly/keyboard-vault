import { loadCollection } from './collection'
import type { CollectionItem, ItemRelation } from './types'
import { resolveLocalImageRef } from './imageStore'

const LS_OVERRIDES = 'keyvault:overrides:v1'
const LS_CUSTOM = 'keyvault:custom:v1'
const LS_DELETED = 'keyvault:deleted:v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

const baseItems = loadCollection()
const baseIds = new Set(baseItems.map((i) => i.id))

function resolveRelations(items: CollectionItem[]): CollectionItem[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return items.map((item) => {
    if (!item.relations.length) return item
    const relations: ItemRelation[] = item.relations.map((rel) => {
      const target = byId.get(rel.ref)
      return target ? { ...rel, name: target.name, category: target.category } : rel
    })
    return { ...item, relations }
  })
}

function resolveItemImages(item: CollectionItem): CollectionItem {
  const hero = item.images[0]
  if (!hero) return { ...item, images: [], image: '' }
  const resolved = resolveLocalImageRef(hero)
  return { ...item, images: [resolved], image: resolved }
}

/** 只读演示：内置 vault 示例，不合并 localStorage */
export function getBundledItems(): CollectionItem[] {
  return resolveRelations(loadCollection().map(resolveItemImages))
}

/** @deprecated v1 只读演示请用 getBundledItems；保留供旧逻辑兼容 */
export function getEffectiveItems(): CollectionItem[] {
  const overrides = read<Record<string, CollectionItem>>(LS_OVERRIDES, {})
  const custom = read<CollectionItem[]>(LS_CUSTOM, [])
  const deleted = read<string[]>(LS_DELETED, [])
  const deletedSet = new Set(deleted)

  const merged = baseItems
    .filter((i) => !deletedSet.has(i.id))
    .map((i) => overrides[i.id] ?? i)

  const all = [...merged, ...custom.filter((c) => !deletedSet.has(c.id))]
  return resolveRelations(all.map(resolveItemImages))
}

export function isCustom(id: string): boolean {
  return !baseIds.has(id)
}

export function isEdited(id: string): boolean {
  const overrides = read<Record<string, CollectionItem>>(LS_OVERRIDES, {})
  return id in overrides
}

export function upsertItem(item: CollectionItem) {
  if (baseIds.has(item.id)) {
    const overrides = read<Record<string, CollectionItem>>(LS_OVERRIDES, {})
    overrides[item.id] = item
    write(LS_OVERRIDES, overrides)
  } else {
    const custom = read<CollectionItem[]>(LS_CUSTOM, [])
    const idx = custom.findIndex((c) => c.id === item.id)
    if (idx >= 0) custom[idx] = item
    else custom.push(item)
    write(LS_CUSTOM, custom)
  }
}

export function deleteItem(id: string) {
  if (baseIds.has(id)) {
    const deleted = read<string[]>(LS_DELETED, [])
    if (!deleted.includes(id)) {
      deleted.push(id)
      write(LS_DELETED, deleted)
    }
    const overrides = read<Record<string, CollectionItem>>(LS_OVERRIDES, {})
    if (id in overrides) {
      delete overrides[id]
      write(LS_OVERRIDES, overrides)
    }
  } else {
    const custom = read<CollectionItem[]>(LS_CUSTOM, [])
    write(LS_CUSTOM, custom.filter((c) => c.id !== id))
  }
}

export function resetItem(id: string) {
  const overrides = read<Record<string, CollectionItem>>(LS_OVERRIDES, {})
  if (id in overrides) {
    delete overrides[id]
    write(LS_OVERRIDES, overrides)
  }
  const deleted = read<string[]>(LS_DELETED, [])
  if (deleted.includes(id)) {
    write(LS_DELETED, deleted.filter((d) => d !== id))
  }
}

export function createBlankItem(category: CollectionItem['category']): CollectionItem {
  const id = `custom-${Date.now().toString(36)}`
  return {
    id,
    name: '',
    brand: category === 'builds' ? '' : '',
    category,
    status: category === 'builds' ? 'collection' : 'in-use',
    tags: [],
    tagGroups: [],
    image: '',
    images: [],
    relations: [],
    history: [],
    content: '',
    currency: 'CNY',
    addedAt: new Date().toISOString().slice(0, 10),
    filePath: `../../vault/${category}/${id}.md`,
  }
}
