import { AlertTriangle, CheckCircle2, FileText, HardDrive, Image, Images, X } from 'lucide-react'
import type { VaultDiagnosticsReport } from '../lib/vaultDiagnostics'

interface VaultDiagnosticsDialogProps {
  report: VaultDiagnosticsReport
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function VaultDiagnosticsDialog({ report, onClose }: VaultDiagnosticsDialogProps) {
  const errorCount = report.issues.filter((issue) => issue.severity === 'error').length
  const warningCount = report.issues.length - errorCount
  const cards = [
    { label: 'Markdown', value: report.counts.markdown, size: report.bytes.markdown, icon: FileText },
    { label: '原图', value: report.counts.originalImages, size: report.bytes.originalImages, icon: Image },
    { label: '缩略图', value: report.counts.thumbnails, size: report.bytes.thumbnails, icon: Images },
    { label: '目录总体积', value: null, size: report.bytes.total, icon: HardDrive },
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="关闭收藏库诊断"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-diagnostics-title"
        className="relative flex max-h-[86dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171b] shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <HardDrive className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="vault-diagnostics-title" className="text-base font-semibold">收藏库诊断</h2>
            <p className="mt-0.5 text-xs text-text-tertiary">只读检查已完成，没有修改或删除任何文件</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cards.map(({ label, value, size, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums">{value ?? formatBytes(size)}</p>
                {value !== null && <p className="text-[11px] text-text-tertiary">{formatBytes(size)}</p>}
              </div>
            ))}
          </div>

          <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${
            report.issues.length === 0
              ? 'border-emerald-400/20 bg-emerald-400/[0.06]'
              : 'border-amber-400/20 bg-amber-400/[0.06]'
          }`}>
            {report.issues.length === 0 ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div>
              <p className="text-sm font-medium">
                {report.issues.length === 0 ? '未发现完整性问题' : `发现 ${report.issues.length} 个待检查项`}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {report.issues.length === 0
                  ? 'Markdown、图片引用和资源文件状态正常。'
                  : `严重问题 ${errorCount} 个，提醒 ${warningCount} 个。孤立资源仅作提示，不会自动清理。`}
              </p>
            </div>
          </div>

          {report.issues.length > 0 && (
            <div className="mt-4 space-y-2">
              {report.issues.map((issue, index) => (
                <div key={`${issue.code}-${issue.path}-${index}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      issue.severity === 'error'
                        ? 'bg-red-400/15 text-red-300'
                        : 'bg-amber-400/15 text-amber-300'
                    }`}>
                      {issue.severity === 'error' ? '需处理' : '提醒'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs leading-5 text-text-secondary">{issue.message}</p>
                      <p className="mt-0.5 break-all font-mono text-[10px] text-text-tertiary">{issue.path}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-white/[0.07] px-5 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl bg-white/[0.08] px-4 py-2 text-sm hover:bg-white/[0.12]">
            完成
          </button>
        </footer>
      </section>
    </div>
  )
}
