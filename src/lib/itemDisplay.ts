import type { CollectionItem, ItemCategory, SpecFieldKey } from './types'
import { CATEGORY_SPEC_FIELDS, STATUS_LABELS, SPEC_FIELD_LABELS } from './types'
import { getBuildComposition } from './builds'
import { formatActuation } from './cardHighlights'

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
  if (item.category === 'builds') return []
  return CATEGORY_SPEC_FIELDS[item.category].map((f) => ({
    label: f.label,
    value: getSpecFieldValue(item, f.key),
  }))
}

/** 搭配组成字段（详情页） */
export function getBuildCompositionFields(item: CollectionItem): {
  role: string
  label: string
  fields: DetailField[]
}[] {
  if (item.category !== 'builds') return []
  const c = getBuildComposition(item)
  return [
    {
      role: 'keyboard',
      label: '套件',
      fields: [
        { label: '名称', value: formatDetailValue(c.keyboard.name) },
        { label: '工作室', value: formatDetailValue(c.keyboard.brand) },
        { label: '定位板', value: formatDetailValue(c.keyboard.plate) },
        { label: 'PCB厚度', value: formatDetailValue(c.keyboard.pcbThickness) },
      ],
    },
    {
      role: 'switches',
      label: '轴体',
      fields: [
        { label: '名称', value: formatDetailValue(c.switches.name) },
        {
          label: '触发压力',
          value: formatDetailValue(formatActuation(c.switches.actuation) || c.switches.actuation),
        },
      ],
    },
    {
      role: 'keycaps',
      label: '键帽',
      fields: [
        { label: '名称', value: formatDetailValue(c.keycaps.name) },
        { label: '高度', value: formatDetailValue(c.keycaps.profile) },
        { label: '材质', value: formatDetailValue(c.keycaps.material) },
      ],
    },
  ]
}

/** 状态 / 价格 / 时间等（编辑页下半区） */
export function getStateFields(item: CollectionItem): DetailField[] {
  if (item.category === 'builds') {
    const fit = item.fitRating ?? item.rating
    return [
      {
        label: '适配度',
        value: fit != null ? `${fit} / 5` : '—',
      },
    ]
  }

  const fields: DetailField[] = [
    { label: '状态', value: STATUS_LABELS[item.status] ?? item.status },
  ]

  if (item.category === 'keyboards') {
    fields.push({ label: '购买时间', value: formatDetailValue(item.acquired) })
  } else {
    fields.push({ label: '购入时间', value: formatDetailValue(item.acquired) })
  }

  fields.push({ label: '加入时间', value: formatDetailValue(item.addedAt) })

  if (item.price != null) {
    fields.push({
      label: item.status === 'sold' ? '购入价' : '价格',
      value: `¥${item.price.toLocaleString('zh-CN')}`,
    })
  } else {
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
  if (category === 'builds') return '搭配组成'
  return '规格参数'
}

export function stateSectionTitle(category: ItemCategory): string {
  if (category === 'builds') return '适配度'
  return '状态与记录'
}

/** 轴体音色等特殊字段（编辑页有、规格表未列的） */
export function getExtraSpecFields(item: CollectionItem): DetailField[] {
  if (item.category === 'builds') return []
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
