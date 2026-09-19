import { CloudOff, FolderLock, KeyRound, ShieldCheck, X } from 'lucide-react'

interface PrivacyDialogProps {
  onClose: () => void
}

export function PrivacyDialog({ onClose }: PrivacyDialogProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="关闭隐私说明" onClick={onClose} />
      <section className="relative w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl glass-strong shadow-2xl shadow-black/50 px-5 sm:px-7 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-white/[0.06]" aria-label="关闭">
          <X className="w-4 h-4" />
        </button>
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
        </div>
        <h2 className="text-[20px] font-semibold tracking-tight">隐私与数据说明</h2>
        <p className="mt-2 text-[13px] leading-6 text-text-secondary">KeyVault 的普通收藏功能不需要账号，也不需要把收藏上传到服务器。</p>

        <div className="mt-6 space-y-4">
          <InfoRow icon={FolderLock} title="本地文件属于你" body="Markdown、图片、设置和历史版本都写入你主动选择的文件夹。断开连接不会删除任何本地文件。" />
          <InfoRow icon={CloudOff} title="普通管理不会联网" body="浏览、搜索、编辑、图片处理、备份和恢复均在当前设备完成。网站不能访问你未选择的文件夹。" />
          <InfoRow icon={KeyRound} title="AI 是可选功能" body="只有你主动使用 AI 对话或识图并再次确认时，必要的收藏摘要或所选图片才会发送到你配置的模型服务。API Key 保存在当前浏览器。" />
        </div>

        <div className="mt-6 rounded-2xl bg-amber-500/[0.07] border border-amber-400/15 p-4">
          <p className="text-[12px] font-medium text-amber-100">建议定期备份</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-100/60">连接收藏库后，可在“数据与安全”中导出 ZIP。恢复操作会先下载当前数据备份，并在失败时尝试自动回滚。</p>
        </div>

        <button type="button" onClick={onClose} className="mt-6 w-full min-h-[46px] rounded-xl bg-white/[0.08] text-[13px] font-medium hover:bg-white/[0.12]">我知道了</button>
      </section>
    </div>
  )
}

function InfoRow({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-accent" /></div>
      <div><p className="text-[13px] font-medium">{title}</p><p className="mt-1 text-[11px] leading-5 text-text-tertiary">{body}</p></div>
    </div>
  )
}
