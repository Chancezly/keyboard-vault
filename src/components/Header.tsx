import { Search, LayoutGrid, List, SlidersHorizontal, Plus } from 'lucide-react'
import type { ItemStatus } from '../lib/types'
import { STATUS_LABELS } from '../lib/types'

interface HeaderProps {
  search: string
  onSearchChange: (v: string) => void
  status: ItemStatus | 'all'
  onStatusChange: (s: ItemStatus | 'all') => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (m: 'grid' | 'list') => void
  resultCount: number
  title: string
  onNew: () => void
}

export function Header({
  search,
  onSearchChange,
  status,
  onStatusChange,
  viewMode,
  onViewModeChange,
  resultCount,
  title,
  onNew,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-6 px-8 pt-8 pb-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-display">{title}</h2>
        <p className="text-[13px] text-text-tertiary mt-1">{resultCount} 件收藏</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索收藏..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="
              w-56 pl-9 pr-4 py-2 rounded-xl text-[13px]
              bg-white/[0.04] border border-white/[0.06]
              text-text-primary placeholder:text-text-tertiary
              focus:outline-none focus:border-accent/40 focus:bg-white/[0.06]
              transition-all duration-200
            "
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as ItemStatus | 'all')}
            className="
              appearance-none pl-8 pr-8 py-2 rounded-xl text-[13px]
              bg-white/[0.04] border border-white/[0.06]
              text-text-secondary cursor-pointer
              focus:outline-none focus:border-accent/40
              transition-all duration-200
            "
          >
            <option value="all">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-0.5">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* New item */}
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium bg-accent/90 text-white hover:bg-accent transition-all"
        >
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>
    </header>
  )
}
