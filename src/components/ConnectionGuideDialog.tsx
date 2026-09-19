import { useState } from 'react'
import { Check, FolderOpen, Laptop, ShieldCheck, X } from 'lucide-react'
import { getExperienceEnvironment } from '../lib/vaultCapabilities'

interface ConnectionGuideDialogProps {
  supported: boolean
  busy?: boolean
  onConnect: () => void
  onClose: () => void
  onOpenPrivacy: () => void
}

export function ConnectionGuideDialog({
  supported,
  busy,
  onConnect,
  onClose,
  onOpenPrivacy,
}: ConnectionGuideDialogProps) {
  const environment = getExperienceEnvironment()
  const [copied, setCopied] = useState(false)

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="关闭连接说明"
        onClick={onClose}
      />
      <section className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl glass-strong shadow-2xl shadow-black/50 px-5 sm:px-7 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-white/[0.06]"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-2xl bg-accent/15 flex items-center justify-center mb-4">
          {supported ? <FolderOpen className="w-5 h-5 text-accent" /> : <Laptop className="w-5 h-5 text-accent" />}
        </div>
        <h2 className="text-[20px] font-semibold tracking-tight">
          {supported ? '创建或连接本地收藏库' : '请在电脑上继续创建收藏库'}
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-text-secondary">
          {supported
            ? '选择一个空文件夹，或选择以前由 KeyVault 创建的文件夹。空文件夹会自动建立所需结构。'
            : environment.inAppBrowser
              ? `当前是${environment.inAppName ?? '应用'}内置浏览器，可放心浏览示例。完整编辑需要在电脑 Chrome 或 Edge 中打开同一网址。`
              : '当前设备或浏览器可浏览示例，但不能直接写入本地文件夹。完整编辑请使用电脑 Chrome 或 Edge。'}
        </p>

        <div className="mt-5 space-y-3 rounded-2xl bg-white/[0.035] border border-white/[0.07] p-4">
          {[
            '照片和资料默认只保存在你选择的文件夹中',
            'KeyVault 无法查看这个文件夹以外的其他文件',
            '随时可以断开连接，不会删除本地资料',
          ].map((line) => (
            <div key={line} className="flex items-start gap-2.5 text-[12px] leading-5 text-text-secondary">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{line}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-sky-500/[0.07] border border-sky-400/15 p-4">
          <ShieldCheck className="w-5 h-5 text-sky-300 shrink-0" />
          <div>
            <p className="text-[12px] font-medium text-sky-100">浏览器会在下一步请求你的授权</p>
            <p className="mt-1 text-[11px] leading-5 text-sky-100/60">只有你明确选择并允许后，网页才能读写该文件夹。</p>
            <button type="button" onClick={onOpenPrivacy} className="mt-2 text-[11px] font-medium text-sky-300 hover:text-sky-200">
              查看隐私与联网说明
            </button>
          </div>
        </div>

        {supported ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="mt-6 w-full min-h-[48px] rounded-xl bg-accent text-white text-[14px] font-medium hover:bg-accent/90 disabled:opacity-40"
          >
            {busy ? '正在连接…' : '选择文件夹并继续'}
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1800)
              } catch {
                window.prompt('复制下面的网址并在电脑 Chrome 或 Edge 中打开：', window.location.href)
              }
            }}
            className="mt-6 w-full min-h-[48px] rounded-xl bg-accent text-white text-[14px] font-medium hover:bg-accent/90"
          >
            {copied ? '网址已复制' : '复制网址，到电脑打开'}
          </button>
        )}
      </section>
    </div>
  )
}
