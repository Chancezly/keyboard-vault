import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import type { CollectionItem, ItemCategory, ItemStatus } from '../lib/types'
import { CATEGORY_LABELS, STATUS_LABELS } from '../lib/types'
import {
  applyCellValue,
  getCellDisplayValue,
  getDataTableColumns,
  type DataTableColumn,
} from '../lib/dataTableColumns'
import { Dropdown } from './Dropdown'
import type { DropdownOption } from './Dropdown'

const STATUS_OPTIONS: DropdownOption[] = (Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}))

const cellInputClass =
  'w-full px-2 py-1.5 rounded-md text-[12px] bg-transparent border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] focus:outline-none focus:border-accent/35 focus:bg-white/[0.05] text-text-primary placeholder:text-text-tertiary transition-colors'

interface DataTableViewProps {
  items: CollectionItem[]
  category: ItemCategory
  busy?: boolean
  onSave: (item: CollectionItem) => Promise<unknown>
}

function TableCell({
  item,
  col,
  dirty,
  onChange,
}: {
  item: CollectionItem
  col: DataTableColumn
  dirty: boolean
  onChange: (value: string) => void
}) {
  const value = getCellDisplayValue(item, col)

  if (col.kind === 'status') {
    return (
      <Dropdown
        value={value}
        onChange={onChange}
        options={STATUS_OPTIONS}
        fullWidth
        buttonClassName={`${cellInputClass} flex items-center justify-between gap-1 ${dirty ? 'border-amber-500/30 bg-amber-500/[0.06]' : ''}`}
      />
    )
  }

  if (col.kind === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${cellInputClass} ${dirty ? 'border-amber-500/30 bg-amber-500/[0.06]' : ''} [color-scheme:dark]`}
      />
    )
  }

  const input = (
    <input
      type={col.kind === 'price' ? 'number' : 'text'}
      value={value}
      placeholder="—"
      list={col.options?.length ? `dt-${col.id}` : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${cellInputClass} ${dirty ? 'border-amber-500/30 bg-amber-500/[0.06]' : ''}`}
    />
  )

  if (col.options?.length) {
    return (
      <>
        {input}
        <datalist id={`dt-${col.id}`}>
          {col.options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </>
    )
  }

  return input
}

export function DataTableView({ items, category, busy, onSave }: DataTableViewProps) {
  const columns = useMemo(() => getDataTableColumns(category), [category])
  const [drafts, setDrafts] = useState<CollectionItem[]>([])
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [items],
  )

  useEffect(() => {
    setDrafts(sorted.map((i) => ({ ...i })))
    setDirtyIds(new Set())
  }, [sorted])

  const updateCell = useCallback((id: string, col: DataTableColumn, value: string) => {
    setDrafts((prev) =>
      prev.map((row) => (row.id === id ? applyCellValue(row, col, value) : row)),
    )
    setDirtyIds((prev) => new Set(prev).add(id))
  }, [])

  const resetRow = useCallback(
    (id: string) => {
      const original = sorted.find((i) => i.id === id)
      if (!original) return
      setDrafts((prev) => prev.map((row) => (row.id === id ? { ...original } : row)))
      setDirtyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [sorted],
  )

  const saveAll = async () => {
    if (!dirtyIds.size) return
    setSaving(true)
    try {
      const toSave = drafts.filter((d) => dirtyIds.has(d.id))
      for (const item of toSave) {
        await onSave(item)
      }
      setDirtyIds(new Set())
    } finally {
      setSaving(false)
    }
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-tertiary">
        <p className="text-[15px]">暂无{CATEGORY_LABELS[category]}数据</p>
        <p className="text-[13px] mt-2">先在卡片视图添加条目，再回到表格编辑</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <p className="text-[13px] text-text-secondary">
            表格管理 · {CATEGORY_LABELS[category]} · {drafts.length} 行
          </p>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            横向浏览全部字段，直接点击单元格修改；带预设的列支持下拉建议值
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirtyIds.size > 0 ? (
            <span className="text-[11px] text-amber-400/90 tabular-nums">{dirtyIds.size} 行未保存</span>
          ) : (
            <span className="text-[11px] text-text-tertiary">已全部保存</span>
          )}
          <button
            type="button"
            disabled={dirtyIds.size === 0 || saving || busy}
            onClick={() => void saveAll()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium bg-accent/90 text-white hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? '保存中…' : '保存全部'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="sticky left-0 z-20 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary bg-[#121214] border-r border-white/[0.06] min-w-[40px]">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    style={{ minWidth: col.minWidth }}
                    className="px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="sticky right-0 z-20 px-2 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary bg-[#121214] border-l border-white/[0.06] min-w-[52px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((row, index) => {
                const dirty = dirtyIds.has(row.id)
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-white/[0.05] last:border-0 transition-colors ${
                      dirty ? 'bg-amber-500/[0.04]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="sticky left-0 z-10 px-3 py-1 text-[11px] text-text-tertiary tabular-nums bg-[#0c0c0e]/95 border-r border-white/[0.06]">
                      {index + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={col.id} className="px-1.5 py-1 align-middle">
                        <TableCell
                          item={row}
                          col={col}
                          dirty={dirty}
                          onChange={(v) => updateCell(row.id, col, v)}
                        />
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 px-1.5 py-1 bg-[#0c0c0e]/95 border-l border-white/[0.06] text-right">
                      <button
                        type="button"
                        title="撤销本行修改"
                        disabled={!dirty}
                        onClick={() => resetRow(row.id)}
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
