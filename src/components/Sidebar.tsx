import { useRef } from 'react'
import {
  Keyboard,
  Layers,
  CircleDot,
  Puzzle,
  Sparkles,
  FolderOpen,
  HardDrive,
  FolderSync,
  Unplug,
  Download,
  Upload,
} from 'lucide-react'
import type { ItemCategory } from '../lib/types'
import { CATEGORY_LABELS } from '../lib/types'

interface SidebarProps {
  activeCategory: ItemCategory | 'all'
  onCategoryChange: (cat: ItemCategory | 'all') => void
  onOpenAI: () => void
  aiOpen: boolean
  stats: {
    total: number
    inUse: number
    collection: number
    wishlist: number
    sold: number
    byCategory: Record<ItemCategory, number>
  }
  vaultSupported: boolean
  vaultWritable: boolean
  vaultDirName: string | null
  vaultBusy: boolean
  onConnectVault: () => void
  onRequestDisconnect: () => void
  onExportZip: () => void
  onImportZip: (file: File) => void
}

const NAV_ITEMS: { id: ItemCategory | 'all'; icon: typeof Keyboard; color: string }[] = [
  { id: 'all', icon: FolderOpen, color: 'text-white/70' },
  { id: 'keyboards', icon: Keyboard, color: 'text-blue-400' },
  { id: 'keycaps', icon: Layers, color: 'text-purple-400' },
  { id: 'switches', icon: CircleDot, color: 'text-emerald-400' },
  { id: 'builds', icon: Puzzle, color: 'text-amber-400' },
]

export function Sidebar({
  activeCategory,
  onCategoryChange,
  onOpenAI,
  aiOpen,
  stats,
  vaultSupported,
  vaultWritable,
  vaultDirName,
  vaultBusy,
  onConnectVault,
  onRequestDisconnect,
  onExportZip,
  onImportZip,
}: SidebarProps) {
  const zipInputRef = useRef<HTMLInputElement>(null)
  return (
    <aside className="flex flex-col w-[220px] shrink-0 h-full glass-strong rounded-2xl mx-3 my-3">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Keyboard className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">KeyVault</h1>
            <p className="text-[11px] text-text-tertiary">客制化键盘收藏库</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-text-tertiary">
          收藏
        </p>
        {NAV_ITEMS.map(({ id, icon: Icon, color }) => {
          const isActive = activeCategory === id
          const count = id === 'all' ? stats.total : stats.byCategory[id]

          return (
            <button
              key={id}
              onClick={() => onCategoryChange(id)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-white/10 text-text-primary'
                  : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? color : 'text-text-tertiary'}`} />
              <span className="flex-1 text-left">
                {id === 'all' ? '全部' : CATEGORY_LABELS[id]}
              </span>
              <span className="text-[11px] text-text-tertiary tabular-nums">{count}</span>
            </button>
          )
        })}
      </nav>

      {/* Stats */}
      <div className="px-5 py-4 mx-3 mb-2 rounded-xl bg-white/[0.03] space-y-1.5">
        <div className="flex justify-between text-[11px] text-text-tertiary">
          <span>使用中</span>
          <span className="text-emerald-400 tabular-nums">{stats.inUse}</span>
        </div>
        <div className="flex justify-between text-[11px] text-text-tertiary">
          <span>收藏中</span>
          <span className="text-accent tabular-nums">{stats.collection}</span>
        </div>
        <div className="flex justify-between text-[11px] text-text-tertiary">
          <span>心愿单</span>
          <span className="text-amber-400 tabular-nums">{stats.wishlist}</span>
        </div>
        <div className="flex justify-between text-[11px] text-text-tertiary">
          <span>已售出</span>
          <span className="text-zinc-400 tabular-nums">{stats.sold}</span>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-3 pb-4 space-y-0.5">
        <button
          onClick={onOpenAI}
          className={`
            w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium
            transition-all duration-200
            ${aiOpen
              ? 'bg-accent/20 text-accent border border-accent/30'
              : 'text-text-secondary hover:bg-accent/10 hover:text-accent'
            }
          `}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI 助手</span>
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent">
            Beta
          </span>
        </button>
        {vaultWritable ? (
          <>
            <button
              onClick={onRequestDisconnect}
              title={`已连接：${vaultDirName ?? ''}（点击断开）`}
              className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-emerald-300/90 hover:bg-white/[0.04] transition-all"
            >
              <HardDrive className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{vaultDirName ?? '本地文件夹'}</span>
              <Unplug className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="flex gap-1">
              <button
                onClick={onExportZip}
                disabled={vaultBusy}
                title="将整个文件夹（md + 图片）打包为 ZIP 备份"
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[12px] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>备份</span>
              </button>
              <button
                onClick={() => zipInputRef.current?.click()}
                disabled={vaultBusy}
                title="从 ZIP 恢复到当前文件夹（同名覆盖）"
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[12px] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>导入</span>
              </button>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportZip(f)
                  e.target.value = ''
                }}
              />
            </div>
          </>
        ) : (
          <button
            onClick={onConnectVault}
            disabled={!vaultSupported || vaultBusy}
            title={
              vaultSupported
                ? '连接本地 vault 文件夹，编辑直接写入 .md'
                : '请使用 Chrome 或 Edge 连接本地文件夹'
            }
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderSync className="w-4 h-4" />
            <span>{vaultSupported ? '连接本地文件夹' : '需 Chrome / Edge'}</span>
          </button>
        )}
        {!vaultWritable && (
          <p className="px-3 pt-1 text-[10px] text-text-tertiary leading-relaxed">
            当前为只读演示，连接后解锁全部功能
          </p>
        )}
      </div>
    </aside>
  )
}
