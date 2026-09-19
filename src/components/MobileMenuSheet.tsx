import { useRef } from 'react'
import {
  Download,
  FolderSync,
  HardDrive,
  History,
  Images,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

interface MobileMenuSheetProps {
  open: boolean
  onClose: () => void
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
  onGenerateThumbnails: () => void
  onRunDiagnostics: () => void
  onOpenPreferences: () => void
  onOpenHistory: () => void
  onOpenPrivacy: () => void
}

function MenuButton({ icon: Icon, label, detail, disabled, onClick }: {
  icon: typeof Sparkles
  label: string
  detail?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-white/[0.06] disabled:opacity-35">
      <Icon className="h-[18px] w-[18px] shrink-0 text-text-secondary" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        {detail ? <span className="mt-0.5 block truncate text-[10px] text-text-tertiary">{detail}</span> : null}
      </span>
    </button>
  )
}

export function MobileMenuSheet(props: MobileMenuSheetProps) {
  const {
    open, onClose, vaultSupported, vaultWritable, vaultDirName, vaultBusy, aiOpen,
    onOpenAI, onConnectVault, onRequestDisconnect, onExportZip, onImportZip,
    onGenerateThumbnails, onRunDiagnostics, onOpenPreferences, onOpenHistory, onOpenPrivacy,
  } = props
  const zipInputRef = useRef<HTMLInputElement>(null)
  if (!open) return null

  const runAndClose = (action: () => void) => {
    onClose()
    action()
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" className="absolute inset-0 bg-black/65" aria-label="关闭工具与设置" onClick={onClose} />
      <section className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[26px] border-t border-white/[0.09] bg-[#1b1b1e] pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/60">
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-white/20" />
        <header className="flex items-center justify-between px-5 pb-3 pt-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">工具与设置</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">管理收藏库与个人偏好</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-text-secondary" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-3 pb-3">
          <p className="px-4 pb-1.5 pt-2 text-[10px] font-medium text-text-tertiary">收藏库</p>
          <div className="overflow-hidden rounded-2xl bg-white/[0.035] divide-y divide-white/[0.06]">
            {vaultWritable ? (
              <MenuButton icon={HardDrive} label={vaultDirName ?? '本地收藏库'} detail="已连接 · 点击可断开" onClick={() => runAndClose(onRequestDisconnect)} />
            ) : (
              <MenuButton icon={FolderSync} label={vaultSupported ? '连接本地文件夹' : '手机端浏览模式'} detail={vaultSupported ? '连接后解锁编辑和图片上传' : '请在电脑 Chrome 或 Edge 中编辑'} disabled={!vaultSupported || vaultBusy} onClick={() => runAndClose(onConnectVault)} />
            )}
            {vaultWritable ? (
              <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
                <MenuButton icon={Download} label="导出备份" disabled={vaultBusy} onClick={() => runAndClose(onExportZip)} />
                <MenuButton icon={Upload} label="导入备份" disabled={vaultBusy} onClick={() => zipInputRef.current?.click()} />
              </div>
            ) : null}
          </div>

          <p className="px-4 pb-1.5 pt-4 text-[10px] font-medium text-text-tertiary">功能与设置</p>
          <div className="overflow-hidden rounded-2xl bg-white/[0.035] divide-y divide-white/[0.06]">
            <MenuButton icon={Sparkles} label={aiOpen ? 'AI 助手 · 已打开' : 'AI 助手'} detail="对话、识图与收藏建议" onClick={() => runAndClose(onOpenAI)} />
            {vaultWritable ? <MenuButton icon={Images} label="补齐旧缩略图" disabled={vaultBusy} onClick={() => runAndClose(onGenerateThumbnails)} /> : null}
            {vaultWritable ? <MenuButton icon={ScanSearch} label="收藏库诊断" disabled={vaultBusy} onClick={() => runAndClose(onRunDiagnostics)} /> : null}
            {vaultWritable ? <MenuButton icon={Settings2} label="偏好设置" disabled={vaultBusy} onClick={() => runAndClose(onOpenPreferences)} /> : null}
            {vaultWritable ? <MenuButton icon={History} label="历史版本" disabled={vaultBusy} onClick={() => runAndClose(onOpenHistory)} /> : null}
            <MenuButton icon={ShieldCheck} label="隐私与数据" onClick={() => runAndClose(onOpenPrivacy)} />
          </div>
          <p className="pb-1 pt-5 text-center text-[10px] tracking-wide text-white/25">KeyVault · by 吉尼尔斯_</p>
        </div>
      </section>

      <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) {
          onClose()
          onImportZip(file)
        }
        event.target.value = ''
      }} />
    </div>
  )
}
