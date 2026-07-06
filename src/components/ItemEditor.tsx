import { useRef, useState } from 'react'
import { X, Upload, Trash2, Download, Plus, Save } from 'lucide-react'
import type { CollectionItem, ItemCategory, ItemStatus } from '../lib/types'
import { CATEGORY_LABELS, STATUS_LABELS, RATING_DIMENSION_LABELS } from '../lib/types'
import { downloadMarkdown } from '../lib/serialize'

interface ItemEditorProps {
  item: CollectionItem
  isNew: boolean
  onSave: (item: CollectionItem) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-text-tertiary mb-1.5">{children}</label>
}

const inputClass =
  'w-full px-3 py-2 rounded-lg text-[13px] bg-white/[0.04] border border-white/[0.08] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 focus:bg-white/[0.06] transition-all'

export function ItemEditor({ item, isNew, onSave, onDelete, onClose }: ItemEditorProps) {
  const [draft, setDraft] = useState<CollectionItem>(item)
  const [tagInput, setTagInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof CollectionItem>(key: K, value: CollectionItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const setRating = (dim: 'overall' | 'sound' | 'feel' | 'build' | 'aesthetics', raw: string) => {
    const value = raw === '' ? undefined : Number(raw)
    setDraft((d) => ({
      ...d,
      ratingDetail: { ...(d.ratingDetail ?? { scale: 5 }), scale: 5, [dim]: value },
    }))
  }

  const handleImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setDraft((d) => ({ ...d, image: url, images: [url, ...d.images.slice(1)] }))
    }
    reader.readAsDataURL(file)
  }

  const addTag = () => {
    const v = tagInput.trim()
    if (!v || draft.tags.includes(v)) return setTagInput('')
    set('tags', [...draft.tags, v])
    setTagInput('')
  }

  const removeTag = (tag: string) => set('tags', draft.tags.filter((t) => t !== tag))

  const handleSave = () => {
    const rd = draft.ratingDetail
    const hasRating =
      rd && (rd.overall != null || rd.sound != null || rd.feel != null || rd.build != null || rd.aesthetics != null)
    const normalized: CollectionItem = {
      ...draft,
      name: draft.name.trim() || '未命名',
      tagGroups: draft.tags.length ? [{ group: '', values: draft.tags }] : [],
      rating: hasRating ? rd?.overall : undefined,
      ratingDetail: hasRating ? rd : undefined,
      soldPrice: draft.status === 'sold' ? draft.soldPrice : undefined,
    }
    onSave(normalized)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] glass-strong rounded-3xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold">{isNew ? '新增收藏' : '编辑收藏'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Image uploader */}
          <div>
            <Label>封面图片</Label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative h-40 rounded-xl overflow-hidden bg-white/[0.03] border border-dashed border-white/[0.12] cursor-pointer hover:border-accent/40 transition-all flex items-center justify-center group"
            >
              {draft.image ? (
                <>
                  <img src={draft.image} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="flex items-center gap-2 text-[12px] text-white">
                      <Upload className="w-4 h-4" /> 更换图片
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-text-tertiary">
                  <Upload className="w-6 h-6" />
                  <span className="text-[12px]">点击上传本地图片</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
            />
          </div>

          {/* Basic */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>名称</Label>
              <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="例如 Zoom65 V3" />
            </div>
            <div>
              <Label>品牌</Label>
              <input className={inputClass} value={draft.brand} onChange={(e) => set('brand', e.target.value)} placeholder="例如 Wuque Studio" />
            </div>
            <div>
              <Label>分类</Label>
              <select className={inputClass} value={draft.category} onChange={(e) => set('category', e.target.value as ItemCategory)}>
                {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>状态</Label>
              <select className={inputClass} value={draft.status} onChange={(e) => set('status', e.target.value as ItemStatus)}>
                {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Specification */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>配列</Label>
              <input className={inputClass} value={draft.layout ?? ''} onChange={(e) => set('layout', e.target.value || undefined)} placeholder="65%" />
            </div>
            <div>
              <Label>结构 / 高度</Label>
              <input className={inputClass} value={draft.mount ?? draft.profile ?? ''} onChange={(e) => set(draft.category === 'keycaps' ? 'profile' : 'mount', e.target.value || undefined)} placeholder="Gasket / Cherry" />
            </div>
          </div>

          {/* State detail + purchase */}
          <div className={`grid gap-4 ${draft.status === 'sold' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <Label>成色 / 状况</Label>
              <input className={inputClass} value={draft.condition ?? ''} onChange={(e) => set('condition', e.target.value || undefined)} placeholder="excellent" />
            </div>
            <div>
              <Label>购买价格 (¥)</Label>
              <input type="number" className={inputClass} value={draft.price ?? ''} onChange={(e) => set('price', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="1899" />
            </div>
            {draft.status === 'sold' && (
              <div>
                <Label>售出价格 (¥)</Label>
                <input type="number" className={inputClass} value={draft.soldPrice ?? ''} onChange={(e) => set('soldPrice', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="1600" />
              </div>
            )}
          </div>

          {/* Rating */}
          <div>
            <Label>评分（0 - 5）</Label>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <span className="text-[10px] text-text-tertiary">总分</span>
                <input type="number" min={0} max={5} step={0.5} className={inputClass} value={draft.ratingDetail?.overall ?? ''} onChange={(e) => setRating('overall', e.target.value)} />
              </div>
              {(['sound', 'feel', 'build', 'aesthetics'] as const).map((dim) => (
                <div key={dim}>
                  <span className="text-[10px] text-text-tertiary">{RATING_DIMENSION_LABELS[dim]}</span>
                  <input type="number" min={0} max={5} step={0.5} className={inputClass} value={draft.ratingDetail?.[dim] ?? ''} onChange={(e) => setRating(dim, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>标签</Label>
            <div className="flex gap-2 mb-2">
              <input
                className={inputClass}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="输入标签后回车"
              />
              <button onClick={addTag} className="px-3 rounded-lg bg-white/[0.06] text-text-secondary hover:bg-white/[0.1] transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.06] text-text-secondary">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <Label>体验 / 评价（正文）</Label>
            <textarea
              className={`${inputClass} resize-none leading-relaxed`}
              rows={5}
              value={draft.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="写下你的真实使用体验……"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={() => onDelete(draft.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除
              </button>
            )}
            <button
              onClick={() => downloadMarkdown(draft)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-all"
            >
              <Download className="w-3.5 h-3.5" /> 导出 Markdown
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-text-secondary hover:bg-white/[0.06] transition-all">
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-accent/90 text-white hover:bg-accent transition-all"
            >
              <Save className="w-3.5 h-3.5" /> 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
