import { FolderSync, AlertCircle } from 'lucide-react'
import { vaultBrowserHint } from '../lib/vaultCapabilities'

interface ReadOnlyBannerProps {
  vaultSupported: boolean
  onConnect: () => void
  busy?: boolean
  error?: string | null
}

export function ReadOnlyBanner({ vaultSupported, onConnect, busy, error }: ReadOnlyBannerProps) {
  const browserHint = vaultBrowserHint()

  return (
    <div className="mx-4 lg:mx-8 mt-3 lg:mt-4 mb-0 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
        <div className="flex items-start gap-3 min-w-0">
          <FolderSync className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-amber-200/95">只读演示模式</p>
            <p className="text-[12px] text-amber-200/60 mt-0.5 leading-relaxed">
              当前浏览的是内置示例数据。连接本地文件夹后解锁编辑、表格管理与图片上传。
              {browserHint ? ` ${browserHint}` : ''}
            </p>
          </div>
        </div>
        {vaultSupported && (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="shrink-0 w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl text-[12px] font-medium bg-amber-500/90 text-white hover:bg-amber-500 transition-all disabled:opacity-40 min-h-[44px] sm:min-h-0"
          >
            连接文件夹
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
