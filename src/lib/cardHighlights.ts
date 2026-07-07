import type { CollectionItem } from './types'

export interface CardMetric {
  key: string
  label: string
  value: string
  primary?: boolean
}

export function formatItemPrice(item: CollectionItem): string {
  if (item.price == null) return ''
  const sym = !item.currency || item.currency === 'CNY' ? '¥' : `${item.currency} `
  return `${sym}${item.price.toLocaleString('zh-CN')}`
}

export function formatActuation(value?: string): string {
  if (!value?.trim()) return ''
  const v = value.trim()
  if (/g|克|cN|cn/i.test(v)) return v
  return `${v}g`
}

function studioName(item: CollectionItem): string {
  return (item.brand || item.manufacturer || '').trim()
}

/** 卡片顶部的副标题：套件 / 轴体展示工作室 */
export function getCardEyebrow(item: CollectionItem): string {
  if (item.category === 'keyboards' || item.category === 'switches') {
    return studioName(item)
  }
  return ''
}

/** 卡片底部或列表右侧的重点参数（不含已在 eyebrow 展示的工作室） */
export function getCardMetrics(item: CollectionItem): CardMetric[] {
  switch (item.category) {
    case 'keyboards': {
      const price = formatItemPrice(item)
      return price ? [{ key: 'price', label: '价格', value: price, primary: true }] : []
    }
    case 'switches': {
      const actuation = formatActuation(item.actuation)
      return actuation ? [{ key: 'actuation', label: '触发', value: actuation, primary: true }] : []
    }
    case 'keycaps': {
      const profile = item.profile?.trim() ?? ''
      const material = item.material?.trim() ?? ''
      const price = formatItemPrice(item)
      return [
        profile ? { key: 'profile', label: '高度', value: profile, primary: true } : null,
        material ? { key: 'material', label: '材料', value: material, primary: true } : null,
        price ? { key: 'price', label: '价格', value: price, primary: true } : null,
      ].filter(Boolean) as CardMetric[]
    }
    default:
      return []
  }
}
