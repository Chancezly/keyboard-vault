import { useRef } from 'react'
import {
  X,
  Keyboard,
  Sparkles,
  HardDrive,
  FolderSync,
  Unplug,
  Download,
  Upload,
} from 'lucide-react'
interface MobileMenuSheetProps {
  open: boolean
  onClose: () => void
  stats: {
    inUse: number
    collection: number
    wishlist: number
    sold: number
  }
  vaultSupported: boolean
  vaultWritable: boolean
  vaultDirName: string | null
  vaultBusy: boolean
  aiOpen: boolean
  onOpenAI: () => void
  onConnectVault: () => void
  onRequestDisconnect: () => void
  onExportZip: () => void
  onImportZip: (file: File) => void
}

export function MobileMenuSheet({
  open,
  onClose,
  stats,
  vaultSupported,
  vaultWritable,
  vaultDirName,
  vaultBusy,
  aiOpen,
  onOpenAI,
  onConnectVault,
  onRequestDisconnect,
  onExportZip,
  onImportZip,
}: MobileMenuSheetProps) {
  const zipInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <aside
        className="
          absolute right-0 top-0 bottom-0 w-[min(100%,300px)]
          glass-strong border-l border-white/[0.08]
          flex flex-col overflow-y-auto
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        "
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">KeyVault</h2>
              <p className="text-[11px] text-text-tertiary">客制化键盘收藏库</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-text-tertiary hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 mx-4 mt-4 rounded-xl bg-white/[0.03] space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-text-tertiary mb-2">
            状态统计
          </p>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="flex justify-between text-text-tertiary">
              <span>使用中</span>
              <span className="text-emerald-400 tabular-nums">{stats.inUse}</span>
            </div>
            <div className="flex justify-between text-text-tertiary">
              <span>收藏中</span>
              <span className="text-accent tabular-nums">{stats.collection}</span>
            </div>
            <div className="flex justify-between text-text-tertiary">
              <span>心愿单</span>
              <span className="text-amber-400 tabular-nums">{stats.wishlist}</span>
            </div>
            <div className="flex justify-between text-text-tertiary">
              <span>已售出</span>
              <span className="text-zinc-400 tabular-nums">{stats.sold}</span>
            </div>
          </div>
        </div>

        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportZip(file)
            e.target.value = ''
          }}
        />

        <div className="px-4 py-4 mt-auto space-y-2">
          <button
            type="button"
            onClick={() => {
              onOpenAI()
              onClose()
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] font-medium min-h-[44px] ${
              aiOpen
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-white/[0.04] text-text-secondary'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI 助手
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent">
              Beta
            </span>
          </button>

          {vaultWritable ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onRequestDisconnect()
                  onClose()
                }}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] text-emerald-300/90 bg-white/[0.03] min-h-[44px]"
              >
                <HardDrive className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left truncate">{vaultDirName ?? '本地文件夹'}</span>
                <Unplug className="w-4 h-4 shrink-0" />
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onExportZip}
                  disabled={vaultBusy}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] bg-white/[0.04] disabled:opacity-40 min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  备份
                </button>
                <button
                  type="button"
                  onClick={() => zipInputRef.current?.click()}
                  disabled={vaultBusy}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] bg-white/[0.04] disabled:opacity-40 min-h-[44px]"
                >
                  <Upload className="w-4 h-4" />
                  导入
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onConnectVault()
                  onClose()
                }}
                disabled={!vaultSupported || vaultBusy}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-[14px] bg-white/[0.04] disabled:opacity-40 min-h-[44px]"
              >
                <FolderSync className="w-4 h-4" />
                {vaultSupported ? '连接本地文件夹' : 'iPhone 仅支持浏览'}
              </button>
              <p className="text-[11px] text-text-tertiary px-1 leading-relaxed">
                {vaultSupported
                  ? '连接后编辑直接写入 .md 文件'
                  : 'iOS Safari 无法连接本地文件夹，可在 Mac/PC 的 Chrome 或 Edge 中编辑。'}
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
