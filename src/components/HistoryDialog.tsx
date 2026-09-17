import { useMemo, useState } from 'react'
import { Eye, Image, RotateCcw, X } from 'lucide-react'
import { describeHistoryVersion, type HistoryVersion } from '../lib/vaultHistory'
import type { CollectionItem } from '../lib/types'

interface Props {
  versions: HistoryVersion[]
  items: CollectionItem[]
  onRestore: (item: CollectionItem, version: HistoryVersion) => Promise<void>
  onClose: () => void
}

function localTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('zh-CN', { hour12: false })
}

export function HistoryDialog({ versions, items, onRestore, onClose }: Props) {
  const [selected, setSelected] = useState<HistoryVersion | null>(null)
  const ranks = useMemo(() => {
    const counts = new Map<string, number>()
    return new Map(versions.map((version) => {
      const rank = (counts.get(version.itemId) ?? 0) + 1
      counts.set(version.itemId, rank)
      return [`${version.itemId}/${version.fileName}`, rank]
    }))
  }, [versions])
  const current = selected ? items.find((item) => item.id === selected.itemId) : undefined
  const description = selected && current ? describeHistoryVersion(selected, current) : null

  return <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <button aria-label="关闭历史版本" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <section role="dialog" aria-modal="true" className="relative flex max-h-[86dvh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#17171b]">
      <header className="flex items-center border-b border-white/[.07] px-5 py-4">
        <div className="flex-1"><h2 className="font-semibold">单文件历史版本</h2><p className="text-xs text-text-tertiary">先预览差异，再决定是否恢复；时间已按本地时区显示</p></div>
        <button aria-label="关闭" onClick={onClose}><X className="h-4 w-4" /></button>
      </header>
      <div className="overflow-y-auto p-5 space-y-2">
        {versions.length === 0 ? <p className="py-10 text-center text-sm text-text-tertiary">保存过修改后，历史版本会显示在这里</p> : versions.map((version) => {
          const item = items.find((candidate) => candidate.id === version.itemId)
          const description = item ? describeHistoryVersion(version, item) : null
          const rank = ranks.get(`${version.itemId}/${version.fileName}`) ?? 1
          return <div key={`${version.itemId}/${version.fileName}`} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{description?.name || item?.name || version.itemId}</p><span className="rounded bg-white/[.07] px-1.5 py-0.5 text-[10px] text-text-tertiary">{rank === 1 ? '最新备份' : `往前第 ${rank} 版`}</span></div>
              <p className="mt-1 text-[11px] text-text-tertiary">{localTime(version.savedAt)} · {description?.imageCount ?? 0} 张图片 · {(version.size / 1024).toFixed(1)} KB</p>
              {description && <p className="mt-1 truncate text-[11px] text-amber-200/70">{description.changes.slice(0, 2).join('；')}</p>}
            </div>
            <button disabled={!item} onClick={() => setSelected(version)} className="flex items-center gap-1.5 rounded-lg bg-white/[.07] px-3 py-2 text-xs disabled:opacity-40"><Eye className="h-3.5 w-3.5" />预览</button>
          </div>
        })}
      </div>
      {selected && current && description && <div className="absolute inset-0 flex flex-col rounded-2xl bg-[#17171b]">
        <header className="flex items-center border-b border-white/[.07] px-5 py-4"><div className="flex-1"><h3 className="font-semibold">版本预览 · {description.name}</h3><p className="text-xs text-text-tertiary">{localTime(selected.savedAt)}</p></div><button aria-label="返回历史列表" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/[.035] p-3"><p className="text-[11px] text-text-tertiary">历史版本</p><p className="mt-1 text-sm">{description.name}</p><p className="mt-1 text-xs text-text-tertiary">状态 {description.status} · {description.imageCount} 张图片</p></div><div className="rounded-xl bg-white/[.035] p-3"><p className="text-[11px] text-text-tertiary">当前版本</p><p className="mt-1 text-sm">{current.name}</p><p className="mt-1 text-xs text-text-tertiary">状态 {current.status} · {current.images.length} 张图片</p></div></div>
          <div><p className="mb-2 text-xs font-medium">与当前版本的差异</p><div className="flex flex-wrap gap-2">{description.changes.map((change) => <span key={change} className="rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-200">{change}</span>)}</div></div>
          <div className="rounded-xl bg-white/[.025] p-3"><p className="flex items-center gap-1.5 text-xs text-text-secondary"><Image className="h-3.5 w-3.5" />历史主图文件</p><p className="mt-1 break-all font-mono text-[11px] text-text-tertiary">{description.hero || '无图片'}</p></div>
          <div className="rounded-xl bg-white/[.025] p-3"><p className="text-xs text-text-secondary">历史备注摘要</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-tertiary">{description.contentPreview || '无备注'}</p></div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/[.07] p-4"><button onClick={() => setSelected(null)} className="rounded-xl px-4 py-2 text-sm text-text-secondary">返回</button><button onClick={async () => { await onRestore(current, selected); setSelected(null) }} className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm text-white"><RotateCcw className="h-4 w-4" />恢复此版本</button></footer>
      </div>}
    </section>
  </div>
}
