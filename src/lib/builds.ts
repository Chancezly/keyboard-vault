import type { CollectionItem, ItemCategory, ItemRelation } from './types'

export const BUILD_PARTS = [
  { role: 'keyboard', label: '键盘', category: 'keyboards' as ItemCategory },
  { role: 'keycaps', label: '键帽', category: 'keycaps' as ItemCategory },
  { role: 'switches', label: '轴体', category: 'switches' as ItemCategory },
]

export function getBuildPartName(relations: ItemRelation[], role: string): string {
  const rel = relations.find((r) => r.role === role)
  return rel?.name ?? rel?.ref ?? ''
}

export function setBuildPart(
  relations: ItemRelation[],
  role: string,
  category: ItemCategory,
  displayName: string,
  inventory: CollectionItem[],
): ItemRelation[] {
  const trimmed = displayName.trim()
  const rest = relations.filter((r) => r.role !== role)
  if (!trimmed) return rest

  const match = inventory.find(
    (i) => i.category === category && (i.name === trimmed || i.id === trimmed),
  )

  return [
    ...rest,
    {
      role,
      ref: match?.id ?? trimmed,
      name: match?.name ?? trimmed,
      category,
    },
  ]
}

export function inventoryNames(inventory: CollectionItem[], category: ItemCategory): string[] {
  return inventory.filter((i) => i.category === category).map((i) => i.name)
}
