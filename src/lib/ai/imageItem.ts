import type { CollectionItem, ItemCategory } from '../types'
import { assignItemFilePath, collectTakenBasenames, itemDisplayBasename } from '../naming'
import type { VisionIdentifyResult } from './identify'

const ID_PREFIX: Record<ItemCategory, string> = {
  keyboards: 'kb',
  keycaps: 'kc',
  switches: 'sw',
  builds: 'bd',
}

function nextItemId(items: CollectionItem[], category: ItemCategory): string {
  const prefix = ID_PREFIX[category]
  let max = 0
  for (const item of items) {
    const m = item.id.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

export function buildItemFromVision(
  result: VisionIdentifyResult,
  imageDataUrl: string,
  existingItems: CollectionItem[],
  status: CollectionItem['status'] = 'collection',
): CollectionItem {
  const id = nextItemId(existingItems, result.category)
  const draft: CollectionItem = {
    id,
    name: result.name,
    brand: result.brand || 'Unknown',
    category: result.category,
    status,
    tags: [],
    tagGroups: [],
    image: imageDataUrl,
    images: [imageDataUrl],
    relations: [],
    history: [],
    price: result.price,
    currency: result.price != null ? 'CNY' : undefined,
    content: '',
    filePath: '',
    addedAt: new Date().toISOString().slice(0, 10),
    layout: result.layout,
    weight: result.category === 'keyboards' ? result.weight ?? '铝' : undefined,
    plate: result.plate,
    profile: result.profile,
    material: result.material,
    switchType: result.switchType,
    color: result.color,
    manufacturer: result.manufacturer,
  }

  return assignItemFilePath(draft, collectTakenBasenames(existingItems))
}

export function formatVisionSummary(result: VisionIdentifyResult, item: CollectionItem): string {
  const lines = [
    '**识图完成**，已解析为以下信息：',
    '',
    `- **分类**：${item.category === 'keyboards' ? '套件' : item.category === 'keycaps' ? '键帽' : '轴体'}`,
    `- **名称**：${item.name}`,
    item.brand && item.brand !== 'Unknown' ? `- **工作室**：${item.brand}` : null,
    item.layout ? `- **配列**：${item.layout}` : null,
    item.weight ? `- **配重**：${item.weight}` : null,
    item.plate ? `- **定位板**：${item.plate}` : null,
    item.profile ? `- **高度**：${item.profile}` : null,
    item.material ? `- **材质**：${item.material}` : null,
    item.switchType ? `- **类型**：${item.switchType}` : null,
    item.color ? `- **配色**：${item.color}` : null,
    item.manufacturer ? `- **代工**：${item.manufacturer}` : null,
    item.price ? `- **参考价**：¥${item.price}` : null,
    `- **置信度**：${result.confidence}`,
    result.notes ? `- **说明**：${result.notes}` : null,
    `- **文件名**：\`${itemDisplayBasename(item)}.md\``,
    '',
    '点击下方 **保存到收藏** 写入 vault。',
  ]
  return lines.filter(Boolean).join('\n')
}
