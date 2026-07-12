import { hydrateBuildItems, getBuildComposition, getBuildDisplayName } from './builds'
import { parseItemMarkdown, parsePreferencesMarkdown } from './parser'
import type { CollectionItem, ItemCategory, SortOption, UserPreferences } from './types'

const itemModules = import.meta.glob('../../vault/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const imageModules = import.meta.glob(
  '../../vault/assets/images/**/*.{png,jpg,jpeg,webp,gif,avif,svg}',
  { query: '?url', import: 'default', eager: true },
) as Record<string, string>

const imageByName = new Map<string, string>()
for (const [path, url] of Object.entries(imageModules)) {
  const name = path.split('/').pop()
  if (name) imageByName.set(name, url)
}

function resolveImage(ref: string): string {
  if (!ref) return ''
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('blob:')) return ref
  const name = ref.split('/').pop() ?? ref
  // 找不到本地资源时返回空，交给 UI 占位，避免裸文件名变成破图
  return imageByName.get(name) ?? ''
}

export function resolveBundledImageRef(ref: string): string {
  return resolveImage(ref)
}

function extractCategory(path: string): ItemCategory | null {
  const match = path.match(/vault\/(keyboards|keycaps|switches|builds)\//)
  return match ? (match[1] as ItemCategory) : null
}

export function loadCollection(): CollectionItem[] {
  const items: CollectionItem[] = []

  for (const [path, raw] of Object.entries(itemModules)) {
    if (/\/(settings|assets|ai)\//.test(path)) continue

    const category = extractCategory(path)
    if (!category) continue

    items.push(parseItemMarkdown(raw, category, path))
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  for (const item of items) {
    item.images = item.images.map(resolveImage)
    item.image = item.images[0] ?? ''

    if (!item.relations.length) continue
    item.relations = item.relations.map((rel) => {
      const target = byId.get(rel.ref)
      return target
        ? { ...rel, name: target.name, category: target.category }
        : rel
    })
  }

  return hydrateBuildItems(items)
}

export function loadPreferences(): UserPreferences {
  const prefPath = Object.keys(itemModules).find((p) => p.includes('/settings/user.md'))
  if (!prefPath) {
    return {
      favoriteLayouts: [],
      favoriteProfiles: [],
      favoriteSwitchTypes: [],
      favoriteBrands: [],
      budgetRange: [0, 5000],
      notes: '',
    }
  }

  return parsePreferencesMarkdown(itemModules[prefPath])
}

export function getAllTags(items: CollectionItem[]): string[] {
  const tagSet = new Set<string>()
  items.forEach((item) => item.tags.forEach((t) => tagSet.add(t)))
  return Array.from(tagSet).sort()
}

export function filterItems(
  items: CollectionItem[],
  category: ItemCategory | 'all',
  status: string,
  search: string,
): CollectionItem[] {
  const q = search.toLowerCase().trim()

  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false
    // 搭配暂不按状态筛选
    if (status !== 'all' && item.category !== 'builds' && item.status !== status) return false
    if (!q) return true

    const display = item.category === 'builds' ? getBuildDisplayName(item) : item.name
    const c = item.category === 'builds' ? getBuildComposition(item) : null
    const partHay = c
      ? [c.keyboard.name, c.keyboard.brand, c.switches.name, c.keycaps.name].join(' ')
      : ''

    return (
      display.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      partHay.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      item.content.toLowerCase().includes(q)
    )
  })
}

function sortDateKey(value?: string): number {
  if (!value) return 0
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

export function sortItems(items: CollectionItem[], sortBy: SortOption): CollectionItem[] {
  const sorted = [...items]
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => {
        const an = a.category === 'builds' ? getBuildDisplayName(a) : a.name
        const bn = b.category === 'builds' ? getBuildDisplayName(b) : b.name
        return an.localeCompare(bn, 'zh-CN')
      })
      break
    case 'addedAt':
      sorted.sort(
        (a, b) =>
          sortDateKey(b.addedAt) - sortDateKey(a.addedAt) ||
          a.name.localeCompare(b.name, 'zh-CN'),
      )
      break
    case 'acquired':
      sorted.sort(
        (a, b) =>
          sortDateKey(b.acquired) - sortDateKey(a.acquired) ||
          a.name.localeCompare(b.name, 'zh-CN'),
      )
      break
  }
  return sorted
}

export function getStats(items: CollectionItem[]) {
  return {
    total: items.length,
    inUse: items.filter((i) => i.status === 'in-use').length,
    collection: items.filter((i) => i.status === 'collection').length,
    wishlist: items.filter((i) => i.status === 'wishlist').length,
    sold: items.filter((i) => i.status === 'sold').length,
    byCategory: {
      keyboards: items.filter((i) => i.category === 'keyboards').length,
      keycaps: items.filter((i) => i.category === 'keycaps').length,
      switches: items.filter((i) => i.category === 'switches').length,
      builds: items.filter((i) => i.category === 'builds').length,
    },
  }
}
