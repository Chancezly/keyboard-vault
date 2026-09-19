import { useRef, useState } from 'react'
import {
  ChevronRight,
  CircleDot,
  Download,
  FolderOpen,
  FolderSync,
  HardDrive,
  Heart,
  History,
  Images,
  Keyboard,
  Layers,
  Puzzle,
  ScanSearch,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { ItemCategory } from '../lib/types'
import { CATEGORY_LABELS } from '../lib/types'

interface SidebarProps {
  activeCategory: ItemCategory | 'all'
  onCategoryChange: (cat: ItemCategory | 'all') => void
  onOpenAI: () => void
  aiOpen: boolean
  wishlistActive?: boolean
  onWishlistClick?: () => void
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
  onGenerateThumbnails: () => void
  onRunDiagnostics: () => void
  onOpenPreferences: () => void
  onOpenHistory: () => void
  onOpenPrivacy: () => void
}

const NAV_ITEMS: { id: ItemCategory | 'all'; icon: typeof Keyboard }[] = [
  { id: 'all', icon: FolderOpen },
  { id: 'keyboards', icon: Keyboard },
  { id: 'keycaps', icon: Layers },
  { id: 'switches', icon: CircleDot },
  { id: 'builds', icon: Puzzle },
]

interface ToolRowProps {
  icon: typeof Keyboard
  title: string
  description?: string
  badge?: string
  disabled?: boolean
  tone?: 'default' | 'accent' | 'success'
  onClick: () => void
}

function ToolRow({ icon: Icon, title, description, badge, disabled, tone = 'default', onClick }: ToolRowProps) {
  const toneClass = tone === 'accent'
    ? 'text-accent bg-accent/10'
    : tone === 'success'
      ? 'text-emerald-300 bg-emerald-400/10'
      : 'text-text-secondary bg-white/[0.045]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.055] disabled:pointer-events-none disabled:opacity-35"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
          {title}
          {badge ? <span className="rounded-full bg-accent/12 px-1.5 py-0.5 text-[9px] font-semibold text-accent">{badge}</span> : null}
        </span>
        {description ? <span className="mt-0.5 block truncate text-[10px] text-text-tertiary">{description}</span> : null}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-white/15 transition-colors group-hover:text-white/35" />
    </button>
  )
}

export function Sidebar(props: SidebarProps) {
  const {
    activeCategory,
    onCategoryChange,
    onOpenAI,
    aiOpen,
    wishlistActive,
    onWishlistClick,
    stats,
    vaultSupported,
    vaultWritable,
    vaultDirName,
    vaultBusy,
    onConnectVault,
    onRequestDisconnect,
    onExportZip,
    onImportZip,
    onGenerateThumbnails,
    onRunDiagnostics,
    onOpenPreferences,
    onOpenHistory,
    onOpenPrivacy,
  } = props
  const [toolsOpen, setToolsOpen] = useState(false)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const runAndClose = (action: () => void) => {
    setToolsOpen(false)
    action()
  }

  return (
    <>
      <aside className="relative z-30 mx-3 my-3 hidden h-[calc(100%-1.5rem)] w-[232px] shrink-0 flex-col rounded-[20px] border border-white/[0.07] bg-[#151517] lg:flex">
        <div className="px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-[#101012]">
              <Keyboard className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-[-0.01em]">KeyVault</h1>
              <p className="mt-0.5 text-[10px] text-text-tertiary">客制化键盘收藏库</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3">
          <p className="px-3 pb-2 pt-1 text-[10px] font-medium tracking-[0.08em] text-text-tertiary">收藏</p>
          <div className="space-y-1">
            {NAV_ITEMS.map(({ id, icon: Icon }) => {
              const isActive = activeCategory === id
              const count = id === 'all' ? stats.total : stats.byCategory[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onCategoryChange(id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    isActive ? 'bg-white text-[#111113]' : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#111113]' : 'text-text-tertiary'}`} />
                  <span className="flex-1 text-left">{id === 'all' ? '全部' : CATEGORY_LABELS[id]}</span>
                  <span className={`text-[11px] tabular-nums ${isActive ? 'text-black/45' : 'text-text-tertiary'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          <div className="my-4 h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={onWishlistClick}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
              wishlistActive ? 'bg-amber-400/12 text-amber-200' : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary'
            }`}
          >
            <Heart className={`h-4 w-4 ${wishlistActive ? 'fill-current' : 'text-text-tertiary'}`} />
            <span className="flex-1 text-left">心愿单</span>
            <span className="text-[11px] tabular-nums text-text-tertiary">{stats.wishlist}</span>
          </button>
        </nav>

        <div className="px-3 pb-4">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-black/15 p-2.5 text-center">
            <div><p className="text-[12px] font-medium tabular-nums">{stats.inUse}</p><p className="mt-0.5 text-[9px] text-text-tertiary">使用中</p></div>
            <div><p className="text-[12px] font-medium tabular-nums">{stats.collection}</p><p className="mt-0.5 text-[9px] text-text-tertiary">收藏中</p></div>
            <div><p className="text-[12px] font-medium tabular-nums">{stats.sold}</p><p className="mt-0.5 text-[9px] text-text-tertiary">已售出</p></div>
          </div>

          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.065]"
          >
            <SlidersHorizontal className="h-4 w-4 text-text-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium">工具与设置</span>
              <span className={`mt-0.5 block truncate text-[9px] ${vaultWritable ? 'text-emerald-300/70' : 'text-text-tertiary'}`}>
                {vaultWritable ? `已连接 · ${vaultDirName ?? '本地收藏库'}` : '只读演示 · 可连接本地收藏库'}
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-white/25" />
          </button>

          <p className="pt-4 text-center text-[10px] tracking-wide text-white/25">by 吉尼尔斯_</p>
        </div>
      </aside>

      {toolsOpen ? (
        <div className="fixed inset-0 z-40 hidden lg:block">
          <button type="button" className="absolute inset-0 bg-black/35" aria-label="关闭工具与设置" onClick={() => setToolsOpen(false)} />
          <section className="absolute bottom-3 left-[252px] flex max-h-[calc(100dvh-1.5rem)] w-[344px] flex-col overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#1b1b1e] shadow-2xl shadow-black/50">
            <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold">工具与设置</h2>
                <p className="mt-0.5 text-[10px] text-text-tertiary">管理收藏库、备份与个人偏好</p>
              </div>
              <button type="button" onClick={() => setToolsOpen(false)} className="rounded-lg p-2 text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="overflow-y-auto p-3">
              <p className="px-3 pb-1.5 pt-1 text-[9px] font-medium tracking-[0.1em] text-text-tertiary">收藏库</p>
              {vaultWritable ? (
                <ToolRow icon={HardDrive} title={vaultDirName ?? '本地收藏库'} description="已连接，修改会直接保存" tone="success" onClick={() => runAndClose(onRequestDisconnect)} />
              ) : (
                <ToolRow icon={FolderSync} title={vaultSupported ? '连接本地文件夹' : '需使用 Chrome / Edge'} description="连接后解锁编辑与图片上传" tone="accent" disabled={!vaultSupported || vaultBusy} onClick={() => runAndClose(onConnectVault)} />
              )}

              {vaultWritable ? (
                <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                  <ToolRow icon={Download} title="导出备份" disabled={vaultBusy} onClick={() => runAndClose(onExportZip)} />
                  <ToolRow icon={Upload} title="导入备份" disabled={vaultBusy} onClick={() => zipInputRef.current?.click()} />
                </div>
              ) : null}

              <div className="my-2 h-px bg-white/[0.06]" />
              <p className="px-3 pb-1.5 pt-1 text-[9px] font-medium tracking-[0.1em] text-text-tertiary">功能</p>
              <ToolRow icon={Sparkles} title="AI 助手" description="对话、识图与收藏建议" badge="BETA" tone={aiOpen ? 'accent' : 'default'} onClick={() => runAndClose(onOpenAI)} />
              {vaultWritable ? (
                <>
                  <ToolRow icon={Images} title="补齐旧缩略图" description="只处理缺少缩略图的资料" disabled={vaultBusy} onClick={() => runAndClose(onGenerateThumbnails)} />
                  <ToolRow icon={ScanSearch} title="收藏库诊断" description="检查文件、图片与重复资料" disabled={vaultBusy} onClick={() => runAndClose(onRunDiagnostics)} />
                </>
              ) : null}

              <div className="my-2 h-px bg-white/[0.06]" />
              <p className="px-3 pb-1.5 pt-1 text-[9px] font-medium tracking-[0.1em] text-text-tertiary">设置</p>
              {vaultWritable ? (
                <>
                  <ToolRow icon={Settings2} title="偏好设置" disabled={vaultBusy} onClick={() => runAndClose(onOpenPreferences)} />
                  <ToolRow icon={History} title="历史版本" disabled={vaultBusy} onClick={() => runAndClose(onOpenHistory)} />
                </>
              ) : null}
              <ToolRow icon={ShieldCheck} title="隐私与数据" onClick={() => runAndClose(onOpenPrivacy)} />
            </div>

            <footer className="border-t border-white/[0.06] px-5 py-3 text-center text-[10px] text-white/25">KeyVault · by 吉尼尔斯_</footer>
          </section>
        </div>
      ) : null}

      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            setToolsOpen(false)
            onImportZip(file)
          }
          event.target.value = ''
        }}
      />
    </>
  )
}
