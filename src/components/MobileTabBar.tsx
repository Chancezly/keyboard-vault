import { Keyboard, Layers, CircleDot, Puzzle, FolderOpen, Menu } from 'lucide-react'
import type { ItemCategory } from '../lib/types'
import { CATEGORY_LABELS } from '../lib/types'

const TABS: { id: ItemCategory | 'all'; icon: typeof Keyboard; label: string }[] = [
  { id: 'all', icon: FolderOpen, label: '全部' },
  { id: 'keyboards', icon: Keyboard, label: '套件' },
  { id: 'keycaps', icon: Layers, label: '键帽' },
  { id: 'switches', icon: CircleDot, label: '轴体' },
  { id: 'builds', icon: Puzzle, label: '搭配' },
]

interface MobileTabBarProps {
  activeCategory: ItemCategory | 'all'
  onCategoryChange: (cat: ItemCategory | 'all') => void
  onOpenMenu: () => void
}

export function MobileTabBar({ activeCategory, onCategoryChange, onOpenMenu }: MobileTabBarProps) {
  return (
    <nav
      className="
        lg:hidden fixed bottom-0 inset-x-0 z-30
        border-t border-white/[0.08] bg-[#0c0c0e]/95 backdrop-blur-xl
        pb-[env(safe-area-inset-bottom)]
      "
    >
      <div className="flex items-stretch justify-around px-1 pt-1">
        {TABS.map(({ id, icon: Icon }) => {
          const active = activeCategory === id
          const name = id === 'all' ? '全部' : CATEGORY_LABELS[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => onCategoryChange(id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 min-h-[44px] rounded-lg transition-colors ${
                active ? 'text-accent' : 'text-text-tertiary'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-accent' : ''}`} />
              <span className="text-[10px] font-medium truncate max-w-[3.5rem]">{name}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 min-h-[44px] text-text-tertiary"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">更多</span>
        </button>
      </div>
    </nav>
  )
}
