import type {
  BuildComposition,
  BuildKeycapPart,
  BuildKeyboardPart,
  BuildSwitchPart,
  CollectionItem,
  ItemCategory,
} from './types'

export type { BuildComposition, BuildKeyboardPart, BuildSwitchPart, BuildKeycapPart }

export const BUILD_PART_META = [
  { role: 'keyboard' as const, label: '套件', category: 'keyboards' as ItemCategory },
  { role: 'switches' as const, label: '轴体', category: 'switches' as ItemCategory },
  { role: 'keycaps' as const, label: '键帽', category: 'keycaps' as ItemCategory },
]

/** @deprecated 兼容旧引用 */
export const BUILD_PARTS = BUILD_PART_META

export function emptyBuildComposition(): BuildComposition {
  return {
    keyboard: { name: '' },
    switches: { name: '' },
    keycaps: { name: '' },
  }
}

export function getBuildComposition(item: CollectionItem): BuildComposition {
  if (item.buildComposition) {
    return {
      keyboard: { ...item.buildComposition.keyboard },
      switches: { ...item.buildComposition.switches },
      keycaps: { ...item.buildComposition.keycaps },
    }
  }
  return emptyBuildComposition()
}

/** 展示标题：有自定义名用自定义名，否则「套件名 + 轴体名」 */
export function getBuildDisplayName(item: CollectionItem): string {
  const custom = item.name.trim()
  if (custom) return custom
  const c = getBuildComposition(item)
  const kb = c.keyboard.name.trim()
  const sw = c.switches.name.trim()
  if (kb && sw) return `${kb} + ${sw}`
  if (kb) return kb
  if (sw) return sw
  return '未命名搭配'
}

export function getBuildPartName(
  item: CollectionItem,
  role: 'keyboard' | 'switches' | 'keycaps',
): string {
  return getBuildComposition(item)[role].name.trim()
}

export function snapshotFromInventory(item: CollectionItem): Partial<BuildComposition> {
  if (item.category === 'keyboards') {
    return {
      keyboard: {
        name: item.name,
        brand: item.brand || undefined,
        plate: item.plate,
        pcbThickness: item.pcbThickness,
        sourceId: item.id,
      },
    }
  }
  if (item.category === 'switches') {
    return {
      switches: {
        name: item.name,
        actuation: item.actuation,
        sourceId: item.id,
      },
    }
  }
  if (item.category === 'keycaps') {
    return {
      keycaps: {
        name: item.name,
        profile: item.profile,
        material: item.material,
        sourceId: item.id,
      },
    }
  }
  return {}
}

export function inventoryNames(inventory: CollectionItem[], category: ItemCategory): string[] {
  return inventory.filter((i) => i.category === category).map((i) => i.name)
}

export function inventoryByName(
  inventory: CollectionItem[],
  category: ItemCategory,
  name: string,
): CollectionItem | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  return inventory.find((i) => i.category === category && (i.name === trimmed || i.id === trimmed))
}

/** 从库内汇总某字段的可选值 */
export function collectFieldOptions(
  inventory: CollectionItem[],
  category: ItemCategory,
  field: keyof CollectionItem,
  presets: string[] = [],
): string[] {
  const fromLib = inventory
    .filter((i) => i.category === category)
    .map((i) => {
      const v = i[field]
      return typeof v === 'string' ? v.trim() : ''
    })
    .filter(Boolean)
  return Array.from(new Set([...presets, ...fromLib]))
}

export function isBuildCompositionComplete(c: BuildComposition): boolean {
  return Boolean(c.keyboard.name.trim() && c.switches.name.trim() && c.keycaps.name.trim())
}

/**
 * 旧数据：relations 只有 ref/name 时，尽量拼出 composition。
 * 若能在 inventory 里找到对应条目，则用快照字段；否则只保留名称。
 */
export function compositionFromLegacyRelations(
  item: CollectionItem,
  inventory: CollectionItem[],
): BuildComposition {
  if (item.buildComposition?.keyboard?.name && item.buildComposition.switches?.name && item.buildComposition.keycaps?.name) {
    return getBuildComposition(item)
  }

  const byId = new Map(inventory.map((i) => [i.id, i]))
  const findRel = (role: string) => item.relations.find((r) => r.role === role)

  const kbRel = findRel('keyboard')
  const swRel = findRel('switches')
  const kcRel = findRel('keycaps')

  const kbItem = kbRel ? byId.get(kbRel.ref) : undefined
  const swItem = swRel ? byId.get(swRel.ref) : undefined
  const kcItem = kcRel ? byId.get(kcRel.ref) : undefined

  const base = item.buildComposition ? getBuildComposition(item) : emptyBuildComposition()

  return {
    keyboard: kbItem
      ? snapshotFromInventory(kbItem).keyboard!
      : {
          name: base.keyboard.name || kbRel?.name || kbRel?.ref || '',
          brand: base.keyboard.brand,
          plate: base.keyboard.plate,
          pcbThickness: base.keyboard.pcbThickness,
          sourceId: base.keyboard.sourceId ?? kbRel?.ref,
        },
    switches: swItem
      ? snapshotFromInventory(swItem).switches!
      : {
          name: base.switches.name || swRel?.name || swRel?.ref || '',
          actuation: base.switches.actuation,
          sourceId: base.switches.sourceId ?? swRel?.ref,
        },
    keycaps: kcItem
      ? snapshotFromInventory(kcItem).keycaps!
      : {
          name: base.keycaps.name || kcRel?.name || kcRel?.ref || '',
          profile: base.keycaps.profile,
          material: base.keycaps.material,
          sourceId: base.keycaps.sourceId ?? kcRel?.ref,
        },
  }
}

export function hydrateBuildItems(items: CollectionItem[]): CollectionItem[] {
  return items.map((item) => {
    if (item.category !== 'builds') return item
    const buildComposition = compositionFromLegacyRelations(item, items)
    const fit = item.fitRating ?? item.rating ?? item.ratingDetail?.overall
    return {
      ...item,
      buildComposition,
      name: item.name.trim(),
      fitRating: fit,
      rating: fit,
      ratingDetail: fit != null ? { overall: fit, scale: 5 } : undefined,
    }
  })
}

/** 同步 relations 以便旧 UI / AI context 仍可读到名称 */
export function syncBuildRelations(item: CollectionItem): CollectionItem {
  if (item.category !== 'builds') return item
  const c = getBuildComposition(item)
  const relations = [
    c.keyboard.name
      ? {
          role: 'keyboard',
          ref: c.keyboard.sourceId ?? c.keyboard.name,
          name: c.keyboard.name,
          category: 'keyboards' as ItemCategory,
        }
      : null,
    c.switches.name
      ? {
          role: 'switches',
          ref: c.switches.sourceId ?? c.switches.name,
          name: c.switches.name,
          category: 'switches' as ItemCategory,
        }
      : null,
    c.keycaps.name
      ? {
          role: 'keycaps',
          ref: c.keycaps.sourceId ?? c.keycaps.name,
          name: c.keycaps.name,
          category: 'keycaps' as ItemCategory,
        }
      : null,
  ].filter(Boolean) as CollectionItem['relations']
  return { ...item, relations, buildComposition: c }
}
