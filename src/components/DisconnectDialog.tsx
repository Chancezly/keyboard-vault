import { X } from 'lucide-react'

interface DisconnectDialogProps {
  dirName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectDialog({ dirName, onConfirm, onCancel }: DisconnectDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[17px] font-semibold font-display tracking-tight">断开本地连接？</h3>
            <p className="text-[13px] text-text-tertiary mt-1.5 leading-relaxed">
              断开后将回到只读演示模式，你的数据仍安全保存在本地文件夹中。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary mb-1.5">
            当前连接的文件夹
          </p>
          <p className="text-[15px] font-semibold text-text-primary truncate">{dirName}</p>
          <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
            浏览器无法显示完整系统路径，请自行记住授权时选择的文件夹位置。
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-text-secondary hover:bg-white/[0.06] transition-all"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-[13px] font-medium bg-white/10 text-text-primary hover:bg-white/15 transition-all"
          >
            确认断开
          </button>
        </div>
      </div>
    </div>
  )
}
