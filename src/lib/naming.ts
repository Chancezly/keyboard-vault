import { getBuildDisplayName } from './builds'
import type { CollectionItem, ItemCategory } from './types'

const INVALID_FS = /[/\\:*?"<>|]/g

function cleanSegment(value: string): string {
  return value.replace(INVALID_FS, '-').replace(/\s+/g, ' ').trim()
}

/** 显示用文件名：`【工作室-套件名】` 或 `【套件名】`；搭配用展示名 */
export function itemDisplayBasename(
  item: Pick<CollectionItem, 'name' | 'brand' | 'id'> &
    Partial<Pick<CollectionItem, 'category' | 'buildComposition'>>,
): string {
  const raw =
    item.category === 'builds'
      ? getBuildDisplayName(item as CollectionItem)
      : item.name.trim()
  const name = cleanSegment(raw)
  if (!name) return item.id

  if (item.category === 'builds') return `【${name}】`

  const brand = cleanSegment(item.brand?.trim() ?? '')
  if (brand && brand.toLowerCase() !== name.toLowerCase() && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `【${brand}-${name}】`
  }
  return `【${name}】`
}

export function itemVaultRelativePath(category: ItemCategory, basename: string): string {
  return `${category}/${basename}.md`
}

export function itemVaultFilePath(category: ItemCategory, basename: string): string {
  return `../../vault/${itemVaultRelativePath(category, basename)}`
}

export function basenameFromFilePath(filePath: string): string | null {
  return filePath.match(/\/([^/]+)\.md$/)?.[1] ?? null
}

export function ensureUniqueBasename(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/** 根据名称/工作室更新 filePath，并在重名时自动加后缀 */
export function assignItemFilePath(item: CollectionItem, takenBasenames?: Set<string>): CollectionItem {
  const base = itemDisplayBasename(item)
  const basename = takenBasenames ? ensureUniqueBasename(base, takenBasenames) : base
  return {
    ...item,
    filePath: itemVaultFilePath(item.category, basename),
  }
}

export function collectTakenBasenames(items: CollectionItem[], excludeId?: string): Set<string> {
  const set = new Set<string>()
  for (const item of items) {
    if (excludeId && item.id === excludeId) continue
    const base = basenameFromFilePath(item.filePath)
    if (base) set.add(base)
  }
  return set
}
