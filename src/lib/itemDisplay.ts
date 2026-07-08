import type { CollectionItem, ItemCategory, SpecFieldKey } from './types'
import { CATEGORY_SPEC_FIELDS, STATUS_LABELS, SPEC_FIELD_LABELS } from './types'

export function formatDetailValue(value: unknown): string {
  if (value == null || value === '') return '—'
  return String(value)
}

export function getSpecFieldValue(item: CollectionItem, key: SpecFieldKey): string {
  return formatDetailValue(item[key])
}

export interface DetailField {
  label: string
  value: string
}

/** 与编辑页 CATEGORY_SPEC_FIELDS 对齐的规格区 */
export function getSpecificationFields(item: CollectionItem): DetailField[] {
  return CATEGORY_SPEC_FIELDS[item.category].map((f) => ({
    label: f.label,
    value: getSpecFieldValue(item, f.key),
  }))
}

/** 状态 / 价格 / 时间等（编辑页下半区） */
export function getStateFields(item: CollectionItem): DetailField[] {
  const fields: DetailField[] = [
    { label: '状态', value: STATUS_LABELS[item.status] ?? item.status },
  ]

  if (item.category === 'keyboards') {
    fields.push({ label: '购买时间', value: formatDetailValue(item.acquired) })
  } else if (item.category !== 'builds') {
    fields.push({ label: '购入时间', value: formatDetailValue(item.acquired) })
  }

  if (item.category !== 'builds') {
    fields.push({ label: '加入时间', value: formatDetailValue(item.addedAt) })
  }

  if (item.price != null) {
    fields.push({
      label: item.status === 'sold' ? '购入价' : '价格',
      value: `¥${item.price.toLocaleString('zh-CN')}`,
    })
  } else if (item.category !== 'builds') {
    fields.push({ label: '价格', value: '—' })
  }

  if (item.status === 'sold') {
    fields.push({
      label: '售出价',
      value: item.soldPrice != null ? `¥${item.soldPrice.toLocaleString('zh-CN')}` : '—',
    })
  }

  if (item.condition) {
    fields.push({ label: '品相', value: item.condition })
  }

  if (item.location) {
    fields.push({ label: '位置', value: item.location })
  }

  return fields
}

export function specSectionTitle(category: ItemCategory): string {
  if (category === 'builds') return '搭配信息'
  return '规格参数'
}

export function stateSectionTitle(category: ItemCategory): string {
  if (category === 'builds') return '状态与价格'
  return '状态与记录'
}

/** 轴体音色等特殊字段（编辑页有、规格表未列的） */
export function getExtraSpecFields(item: CollectionItem): DetailField[] {
  const extras: DetailField[] = []
  if (item.switchType && item.category === 'switches') {
    extras.push({ label: SPEC_FIELD_LABELS.switchType, value: formatDetailValue(item.switchType) })
  }
  if (item.soundProfile) {
    extras.push({ label: '声音取向', value: item.soundProfile })
  }
  if (item.feelProfile) {
    extras.push({ label: '手感取向', value: item.feelProfile })
  }
  return extras
}
