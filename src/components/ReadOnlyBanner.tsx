import { useState } from 'react'
import { FolderSync, AlertCircle, X } from 'lucide-react'
import { vaultBrowserHint } from '../lib/vaultCapabilities'

const DISMISS_KEY = 'keyvault:readonly-banner-dismissed:v1'

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

interface ReadOnlyBannerProps {
  vaultSupported: boolean
  onConnect: () => void
  busy?: boolean
  error?: string | null
}

export function ReadOnlyBanner({ vaultSupported, onConnect, busy, error }: ReadOnlyBannerProps) {
  const browserHint = vaultBrowserHint()
  const [dismissed, setDismissed] = useState(loadDismissed)

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  if (dismissed && !error) {
    return (
      <div className="mx-4 lg:mx-8 mt-3 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="flex-1 text-[12px] text-text-tertiary truncate">只读演示 · 连接文件夹后可编辑</p>
        {vaultSupported && (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="shrink-0 text-[12px] font-medium text-amber-300 hover:text-amber-200 disabled:opacity-40"
          >
            连接
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-4 lg:mx-8 mt-3 lg:mt-4 mb-0 space-y-2">
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-amber-200/50 hover:text-amber-100 hover:bg-white/[0.06] transition-all"
          title="收起"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3 min-w-0 pr-8">
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
