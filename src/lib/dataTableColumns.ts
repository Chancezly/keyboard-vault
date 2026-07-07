import type { CollectionItem, ItemCategory } from './types'
import {
  CATEGORY_SPEC_FIELDS,
  FILLING_OPTIONS,
  PCB_THICKNESS_OPTIONS,
  PLATE_OPTIONS,
  SPEC_FIELD_LABELS,
  WEIGHT_OPTIONS,
} from './types'

export const KEYBOARD_LAYOUTS = ['60%', '65%', '75%', 'TKL', '98%', '104%', 'Alice']

export type DataTableCellKind = 'text' | 'combo' | 'status' | 'price' | 'date'

export interface DataTableColumn {
  id: string
  label: string
  minWidth: number
  kind: DataTableCellKind
  /** CollectionItem 字段名 */
  field: keyof CollectionItem
  options?: readonly string[]
}

const KEYBOARD_EXTRA: DataTableColumn[] = [
  { id: 'layout', label: '配列', minWidth: 88, kind: 'combo', field: 'layout', options: KEYBOARD_LAYOUTS },
  { id: 'plate', label: '定位板', minWidth: 88, kind: 'combo', field: 'plate', options: PLATE_OPTIONS },
  { id: 'filling', label: '填充', minWidth: 80, kind: 'combo', field: 'filling', options: FILLING_OPTIONS },
  { id: 'pcbThickness', label: 'PCB', minWidth: 80, kind: 'combo', field: 'pcbThickness', options: PCB_THICKNESS_OPTIONS },
  { id: 'weight', label: '配重', minWidth: 72, kind: 'combo', field: 'weight', options: WEIGHT_OPTIONS },
]

const COMBO_OPTIONS: Partial<Record<string, readonly string[]>> = {
  plate: PLATE_OPTIONS,
  filling: FILLING_OPTIONS,
  pcbThickness: PCB_THICKNESS_OPTIONS,
  weight: WEIGHT_OPTIONS,
  layout: KEYBOARD_LAYOUTS,
}

const TAIL_COLUMNS: DataTableColumn[] = [
  { id: 'acquired', label: '购买时间', minWidth: 112, kind: 'date', field: 'acquired' },
  { id: 'status', label: '状态', minWidth: 96, kind: 'status', field: 'status' },
  { id: 'price', label: '价格', minWidth: 88, kind: 'price', field: 'price' },
]

export function getDataTableColumns(category: ItemCategory): DataTableColumn[] {
  const head: DataTableColumn[] = [
    { id: 'name', label: '名称', minWidth: 148, kind: 'text', field: 'name' },
    {
      id: 'brand',
      label: category === 'keyboards' || category === 'switches' ? '工作室' : '品牌',
      minWidth: 108,
      kind: 'text',
      field: 'brand',
    },
  ]

  if (category === 'keyboards') {
    return [...head, ...KEYBOARD_EXTRA, ...TAIL_COLUMNS]
  }

  const specCols: DataTableColumn[] = CATEGORY_SPEC_FIELDS[category].map((f) => ({
    id: f.key,
    label: f.label,
    minWidth: f.key === 'actuation' || f.key === 'bottomOut' ? 96 : 88,
    kind: 'combo' as const,
    field: f.key as keyof CollectionItem,
    options: COMBO_OPTIONS[f.key],
  }))

  return [...head, ...specCols, ...TAIL_COLUMNS]
}

export function getCellDisplayValue(item: CollectionItem, col: DataTableColumn): string {
  const raw = item[col.field]
  if (col.kind === 'price') {
    return raw != null && raw !== '' ? String(raw) : ''
  }
  if (col.kind === 'status') {
    return String(raw ?? '')
  }
  return raw != null ? String(raw) : ''
}

export function applyCellValue(item: CollectionItem, col: DataTableColumn, value: string): CollectionItem {
  if (col.kind === 'price') {
    const trimmed = value.trim()
    if (!trimmed) return { ...item, price: undefined }
    const n = Number(trimmed.replace(/,/g, ''))
    return { ...item, price: Number.isFinite(n) ? n : item.price, currency: item.currency ?? 'CNY' }
  }
  if (col.kind === 'date') {
    const trimmed = value.trim()
    return { ...item, acquired: trimmed || undefined }
  }
  if (col.field === 'name' || col.field === 'brand') {
    return { ...item, [col.field]: value }
  }
  const trimmed = value.trim()
  return { ...item, [col.field]: trimmed || undefined }
}

export function specFieldLabel(field: string): string {
  return SPEC_FIELD_LABELS[field as keyof typeof SPEC_FIELD_LABELS] ?? field
}
