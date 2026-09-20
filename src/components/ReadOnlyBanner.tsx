import { useState } from 'react'
import { Copy, FolderSync, ShieldCheck, Smartphone, X } from 'lucide-react'
import { getExperienceEnvironment, vaultBrowserHint } from '../lib/vaultCapabilities'

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
  onOpenPrivacy: () => void
  busy?: boolean
}

export function ReadOnlyBanner({ vaultSupported, onConnect, onOpenPrivacy, busy }: ReadOnlyBannerProps) {
  const browserHint = vaultBrowserHint()
  const environment = getExperienceEnvironment()
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [copied, setCopied] = useState(false)

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  if (dismissed) {
    return (
      <div className="mx-4 lg:mx-8 mt-3 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="flex-1 text-[12px] text-text-tertiary truncate">{environment.mobile ? '示例收藏库 · 可在手机完整浏览' : '示例收藏库 · 连接文件夹后创建自己的收藏'}</p>
        {vaultSupported ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="shrink-0 text-[12px] font-medium text-amber-300 hover:text-amber-200 disabled:opacity-40"
          >
            连接
          </button>
        ) : environment.mobile ? <span className="shrink-0 text-[11px] text-sky-300">手机浏览模式</span> : null}
      </div>
    )
  }

  return (
    <div className="mx-4 lg:mx-8 mt-3 lg:mt-4 mb-0 space-y-2">
      <div className="relative flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#151517] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          title="收起"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3 min-w-0 pr-8">
          {environment.mobile ? <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> : <FolderSync className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text-primary">{environment.mobile ? '手机浏览模式' : '欢迎体验示例收藏库'}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
              {environment.mobile ? '这里展示了一套完整收藏示例，可查看规格、评分、笔记与搭配关系。' : '先浏览一套整理好的示例。准备好后，连接本地文件夹即可建立属于自己的收藏库。'}
              {browserHint ? ` ${browserHint}` : ''}
            </p>
            <button type="button" onClick={onOpenPrivacy} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent/80 hover:text-accent">
              <ShieldCheck className="w-3 h-3" /> 为什么需要文件夹权限？
            </button>
          </div>
        </div>
        {vaultSupported ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="min-h-[44px] w-full shrink-0 rounded-xl bg-white px-3.5 py-2.5 text-[12px] font-medium text-[#111113] transition-colors hover:bg-white/90 disabled:opacity-40 sm:min-h-0 sm:w-auto sm:py-2"
          >
            创建我的收藏库
          </button>
        ) : environment.mobile ? (
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { window.prompt('复制下面的网址并在电脑 Chrome 或 Edge 中打开：', window.location.href) } }} className="shrink-0 w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl text-[12px] font-medium bg-sky-500/20 text-sky-200 border border-sky-400/20 min-h-[44px] sm:min-h-0">
            <span className="inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />{copied ? '网址已复制' : '复制网址到电脑'}</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
