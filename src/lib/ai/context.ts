import type { CollectionItem, UserPreferences } from '../types'
import { CATEGORY_LABELS, RATING_DIMENSION_LABELS, SOUND_TENDENCY_LABELS, STATUS_LABELS } from '../types'
import { getBuildComposition, getBuildDisplayName } from '../builds'

function itemSummary(item: CollectionItem): Record<string, unknown> {
  if (item.category === 'builds') {
    const c = getBuildComposition(item)
    return {
      id: item.id,
      name: getBuildDisplayName(item),
      customName: item.name.trim() || undefined,
      category: CATEGORY_LABELS.builds,
      fitRating: item.fitRating ?? item.rating,
      composition: {
        keyboard: c.keyboard,
        switches: c.switches,
        keycaps: c.keycaps,
      },
      notes: item.content.trim() ? item.content.trim().slice(0, 400) : undefined,
    }
  }

  const base: Record<string, unknown> = {
    id: item.id,
    name: item.name,
    brand: item.brand,
    category: CATEGORY_LABELS[item.category],
    status: STATUS_LABELS[item.status],
    tags: item.tags,
    price: item.price,
    rating: item.rating,
  }

  if (item.layout) base.layout = item.layout
  if (item.plate) base.plate = item.plate
  if (item.filling) base.filling = item.filling
  if (item.weight) base.weight = item.weight
  if (item.mount) base.mount = item.mount
  if (item.material) base.material = item.material
  if (item.profile) base.profile = item.profile
  if (item.actuation) base.actuation = item.actuation
  if (item.manufacturer) base.manufacturer = item.manufacturer
  if (item.soundTendency != null) base.soundTendency = SOUND_TENDENCY_LABELS[item.soundTendency]

  if (item.ratingDetail) {
    const dims: Record<string, number> = {}
    for (const [key, label] of Object.entries(RATING_DIMENSION_LABELS)) {
      const v = item.ratingDetail[key as keyof typeof item.ratingDetail]
      if (typeof v === 'number') dims[label] = v
    }
    if (Object.keys(dims).length) base.ratingDimensions = dims
  }

  if (item.relations.length) {
    base.relations = item.relations.map((r) => ({
      role: r.role,
      ref: r.ref,
      name: r.name,
    }))
  }

  if (item.content.trim()) {
    base.experience = item.content.trim().slice(0, 400)
  }

  return base
}

export function buildCollectionContext(
  items: CollectionItem[],
  preferences: UserPreferences,
  allTags: string[],
): string {
  const byCategory = {
    keyboards: items.filter((i) => i.category === 'keyboards'),
    keycaps: items.filter((i) => i.category === 'keycaps'),
    switches: items.filter((i) => i.category === 'switches'),
    builds: items.filter((i) => i.category === 'builds'),
  }

  const sections = [
    '## 用户偏好（settings/user.md）',
    JSON.stringify(
      {
        favoriteLayouts: preferences.favoriteLayouts,
        favoriteProfiles: preferences.favoriteProfiles,
        favoriteSwitchTypes: preferences.favoriteSwitchTypes,
        favoriteBrands: preferences.favoriteBrands,
        budgetRange: preferences.budgetRange,
        notes: preferences.notes.trim() || undefined,
      },
      null,
      2,
    ),
    '',
    '## 已有标签词表',
    allTags.length ? allTags.join(', ') : '（暂无）',
    '',
    '## 收藏统计',
    `- 总计 ${items.length} 件：套件 ${byCategory.keyboards.length}、键帽 ${byCategory.keycaps.length}、轴体 ${byCategory.switches.length}、搭配 ${byCategory.builds.length}`,
    `- 使用中 ${items.filter((i) => i.status === 'in-use').length}、收藏中 ${items.filter((i) => i.status === 'collection').length}、心愿单 ${items.filter((i) => i.status === 'wishlist').length}`,
    '',
  ]

  for (const [cat, list] of Object.entries(byCategory) as [keyof typeof byCategory, CollectionItem[]][]) {
    if (!list.length) continue
    const label = { keyboards: '套件', keycaps: '键帽', switches: '轴体', builds: '搭配' }[cat]
    sections.push(`## ${label}（${list.length}）`)
    sections.push(JSON.stringify(list.map(itemSummary), null, 2))
    sections.push('')
  }

  return sections.join('\n')
}
