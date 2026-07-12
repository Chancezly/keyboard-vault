import { Search, LayoutGrid, List, Plus, Table2, Heart } from 'lucide-react'
import type { ItemStatus, SortOption } from '../lib/types'
import { STATUS_LABELS, SORT_LABELS } from '../lib/types'
import { Dropdown } from './Dropdown'
import type { DropdownOption } from './Dropdown'

const STATUS_FILTER_OPTIONS: DropdownOption[] = [
  { value: 'all', label: '全部状态' },
  ...(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]

const SORT_OPTIONS: DropdownOption[] = (Object.keys(SORT_LABELS) as SortOption[]).map((s) => ({
  value: s,
  label: SORT_LABELS[s],
}))

interface HeaderProps {
  search: string
  onSearchChange: (v: string) => void
  status: ItemStatus | 'all'
  onStatusChange: (s: ItemStatus | 'all') => void
  sortBy: SortOption
  onSortChange: (s: SortOption) => void
  viewMode: 'grid' | 'list' | 'table'
  onViewModeChange: (m: 'grid' | 'list' | 'table') => void
  resultCount: number
  title: string
  onNew: () => void
  readOnly?: boolean
  wishlistCount?: number
}

export function Header({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  resultCount,
  title,
  onNew,
  readOnly = false,
  wishlistCount = 0,
}: HeaderProps) {
  const wishlistActive = status === 'wishlist'

  return (
    <header className="flex flex-col gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8 lg:pt-8 lg:pb-4">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-xl lg:text-2xl font-semibold tracking-tight font-display truncate">{title}</h2>
          <p className="text-[12px] lg:text-[13px] text-text-tertiary mt-0.5 lg:mt-1">{resultCount} 件收藏</p>
        </div>
        <button
          onClick={onNew}
          disabled={readOnly}
          title={readOnly ? '连接本地文件夹后可新增收藏' : '新增收藏'}
          className="lg:hidden shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-accent/90 text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="relative w-full lg:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="search"
          placeholder="搜索收藏..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="
            w-full lg:w-56 pl-9 pr-4 py-2.5 lg:py-2 rounded-xl lg:rounded-lg text-[16px] lg:text-[13px]
            bg-white/[0.06] border border-white/[0.08]
            text-text-primary placeholder:text-text-tertiary
            focus:outline-none focus:border-accent/40 focus:bg-white/[0.09]
            transition-all duration-200
          "
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 lg:mx-0 lg:px-0 lg:overflow-visible lg:pb-0">
        <button
          type="button"
          onClick={() => onStatusChange(wishlistActive ? 'all' : 'wishlist')}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border transition-all min-h-[40px] ${
            wishlistActive
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-white/[0.04] text-text-tertiary border-white/[0.06] hover:text-text-secondary hover:bg-white/[0.06]'
          }`}
          title="心愿单"
        >
          <Heart className={`w-3.5 h-3.5 ${wishlistActive ? 'fill-current' : ''}`} />
          心愿单
          {wishlistCount > 0 ? (
            <span className="tabular-nums text-[11px] opacity-80">{wishlistCount}</span>
          ) : null}
        </button>

        <Dropdown
          value={sortBy}
          onChange={(v) => onSortChange(v as SortOption)}
          options={SORT_OPTIONS}
          fullWidth={false}
        />

        <Dropdown
          value={status}
          onChange={(v) => onStatusChange(v as ItemStatus | 'all')}
          options={STATUS_FILTER_OPTIONS}
          fullWidth={false}
        />

        <div className="flex shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2.5 lg:p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2.5 lg:p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            title="表格管理（桌面）"
            className={`hidden lg:block p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white/10 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onNew}
          disabled={readOnly}
          title={readOnly ? '连接本地文件夹后可新增收藏' : '新增收藏'}
          className="hidden lg:flex shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium bg-accent/90 text-white hover:bg-accent transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>
    </header>
  )
}
