import { useRef, useState } from 'react'
import { X, Upload, Trash2, Download, Plus, Save } from 'lucide-react'
import type { CollectionItem, ItemCategory, ItemStatus, SpecFieldKey } from '../lib/types'
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  RATING_DIMENSION_LABELS,
  RATING_DIMENSIONS,
  CATEGORY_SPEC_FIELDS,
  SOUND_TENDENCY_LABELS,
  computeOverallRating,
  normalizeRatingDetail,
} from '../lib/types'
import { downloadMarkdown } from '../lib/serialize'
import { Dropdown, ComboSelect, fieldInputClass as inputClass } from './Dropdown'
import type { DropdownOption } from './Dropdown'
import { StarRating } from './StarRating'

const CATEGORY_OPTIONS: DropdownOption[] = (Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

const STATUS_OPTIONS: DropdownOption[] = (Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}))

// 热门轴体代工厂，datalist 提供快速选择同时允许自定义
const POPULAR_MANUFACTURERS = ['键极客', 'HMX', '凯华', '羽树', '旭华']

// 常用键盘配列，主题化下拉可选也可自定义
const KEYBOARD_LAYOUTS = ['60%', '65%', '75%', 'TKL', '98%', '104%', 'Alice']

// 带单位的规格字段：输入数字自动补上单位
const SPEC_UNITS: Partial<Record<SpecFieldKey, string>> = {
  actuation: 'g',
  bottomOut: 'g',
  preTravel: 'mm',
  bottomTravel: 'mm',
}

const stripUnit = (v?: string) => (v ?? '').replace(/[^\d.]/g, '')

interface ItemEditorProps {
  item: CollectionItem
  isNew: boolean
  allTags: string[]
  studioSuggestions: string[]
  onSave: (item: CollectionItem) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-text-tertiary mb-1.5">{children}</label>
}

// 计算灰色预输入提示：优先补全最后一个单词（采用候选词自身的大小写），其次追加后缀
function computeSuggestion(
  value: string,
  completions: string[],
  suffix?: string,
): { ghost: string; accepted: string } {
  if (!value) return { ghost: '', accepted: value }
  const cut = value.lastIndexOf(' ') + 1
  const token = value.slice(cut)
  if (token) {
    const lower = token.toLowerCase()
    for (const w of completions) {
      if (w.length > token.length && w.toLowerCase().startsWith(lower)) {
        // 用候选词的原始大小写替换已输入片段，保证首字母大写
        return { ghost: w.slice(token.length), accepted: value.slice(0, cut) + w }
      }
    }
  }
  if (suffix && !value.endsWith(suffix)) return { ghost: suffix, accepted: value + suffix }
  return { ghost: '', accepted: value }
}

interface SuggestInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  completions?: string[]
  suffix?: string
}

// 带灰色 ghost 提示的输入框，Tab / → 接受补全
function SuggestInput({ value, onChange, placeholder, completions = [], suffix }: SuggestInputProps) {
  const { ghost, accepted } = computeSuggestion(value, completions, suffix)

  return (
    <div className="relative w-full rounded-lg bg-white/[0.06] border border-white/[0.08] focus-within:border-accent/40 focus-within:bg-white/[0.09] transition-all">
      {ghost && (
        <div className="absolute inset-0 px-3 py-2 text-[13px] whitespace-pre overflow-hidden pointer-events-none">
          <span className="invisible">{value}</span>
          <span className="text-text-tertiary/70">{ghost}</span>
        </div>
      )}
      <input
        className="relative w-full px-3 py-2 rounded-lg text-[13px] bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!ghost) return
          const atEnd = e.currentTarget.selectionStart === value.length
          if (e.key === 'Tab' || (e.key === 'ArrowRight' && atEnd)) {
            e.preventDefault()
            onChange(accepted)
          }
        }}
      />
    </div>
  )
}


export function ItemEditor({ item, isNew, allTags, studioSuggestions, onSave, onDelete, onClose }: ItemEditorProps) {
  const [draft, setDraft] = useState<CollectionItem>(() =>
    item.category === 'switches' && !item.lube ? { ...item, lube: '厂润' } : item,
  )
  const [tagInput, setTagInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof CollectionItem>(key: K, value: CollectionItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const setCategory = (c: ItemCategory) =>
    setDraft((d) => ({ ...d, category: c, lube: c === 'switches' && !d.lube ? '厂润' : d.lube }))

  const setRating = (dim: (typeof RATING_DIMENSIONS)[number], value: number | undefined) => {
    setDraft((d) => {
      const next = { ...(d.ratingDetail ?? { scale: 5 }), scale: 5, [dim]: value }
      return { ...d, ratingDetail: normalizeRatingDetail(next) }
    })
  }

  const computedOverall = computeOverallRating(draft.ratingDetail)

  const suggestedTags = allTags.filter((t) => !draft.tags.includes(t))

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
    const rd = normalizeRatingDetail(draft.ratingDetail)
    const normalized: CollectionItem = {
      ...draft,
      name: draft.name.trim() || '未命名',
      tagGroups: draft.tags.length ? [{ group: '', values: draft.tags }] : [],
      rating: rd?.overall,
      ratingDetail: rd,
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
              <SuggestInput
                value={draft.name}
                onChange={(v) => set('name', v)}
                placeholder={draft.category === 'switches' ? '例如 北极星轴' : '例如 Zoom65 V3'}
                suffix={draft.category === 'switches' ? '轴' : undefined}
              />
            </div>
            <div>
              <Label>{draft.category === 'keyboards' ? '工作室' : '品牌'}</Label>
              <SuggestInput
                value={draft.brand}
                onChange={(v) => set('brand', v)}
                placeholder="例如 Wuque Studio"
                completions={
                  draft.category === 'keyboards'
                    ? [...studioSuggestions, 'Studio', 'Lab']
                    : []
                }
              />
            </div>
            <div>
              <Label>分类</Label>
              <Dropdown
                value={draft.category}
                onChange={(v) => setCategory(v as ItemCategory)}
                options={CATEGORY_OPTIONS}
              />
            </div>
            <div>
              <Label>状态</Label>
              <Dropdown
                value={draft.status}
                onChange={(v) => set('status', v as ItemStatus)}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Specification (category-specific) */}
          {CATEGORY_SPEC_FIELDS[draft.category].length > 0 && (
            <div
              className={`grid gap-4 ${
                CATEGORY_SPEC_FIELDS[draft.category].length >= 3 ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              {CATEGORY_SPEC_FIELDS[draft.category].map((field) => {
                const unit = SPEC_UNITS[field.key]
                if (field.key === 'layout') {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <ComboSelect
                        value={(draft.layout as string) ?? ''}
                        onChange={(v) => set('layout', v || undefined)}
                        options={KEYBOARD_LAYOUTS}
                        placeholder={field.placeholder}
                      />
                    </div>
                  )
                }
                if (field.key === 'manufacturer') {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <input
                        list="manufacturer-options"
                        className={inputClass}
                        value={(draft[field.key] as string) ?? ''}
                        onChange={(e) => set(field.key, e.target.value || undefined)}
                        placeholder="选择或输入"
                      />
                      <datalist id="manufacturer-options">
                        {POPULAR_MANUFACTURERS.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                  )
                }
                if (unit) {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <div className="relative">
                        <input
                          type="number"
                          className={`${inputClass} pr-9`}
                          value={stripUnit(draft[field.key] as string)}
                          onChange={(e) =>
                            set(field.key, e.target.value === '' ? undefined : `${e.target.value}${unit}`)
                          }
                          placeholder={stripUnit(field.placeholder) || field.placeholder}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary pointer-events-none">
                          {unit}
                        </span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={field.key}>
                    <Label>{field.label}</Label>
                    <input
                      className={inputClass}
                      value={(draft[field.key] as string) ?? ''}
                      onChange={(e) => set(field.key, e.target.value || undefined)}
                      placeholder={field.placeholder}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Purchase / sold price */}
          <div className="grid grid-cols-2 gap-4">
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
            <Label>评分</Label>
            <div className="space-y-4">
              {computedOverall != null && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <span className="text-[11px] text-text-tertiary shrink-0">总分</span>
                  <StarRating value={Math.round(computedOverall)} readonly size="sm" />
                  <span className="text-[13px] font-semibold text-amber-400 tabular-nums">{computedOverall}</span>
                  <span className="text-[10px] text-text-tertiary">自动加权</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {RATING_DIMENSIONS.map((dim) => (
                  <div key={dim} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-tertiary shrink-0 w-8">
                      {RATING_DIMENSION_LABELS[dim]}
                    </span>
                    <StarRating
                      value={draft.ratingDetail?.[dim]}
                      onChange={(v) => setRating(dim, v)}
                    />
                  </div>
                ))}
              </div>
              {draft.category === 'switches' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-text-tertiary">音色取向</span>
                    <span className="text-[10px] text-text-tertiary">脆 → 闷</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => set('soundTendency', draft.soundTendency === n ? undefined : n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          draft.soundTendency === n
                            ? 'bg-accent text-white'
                            : 'bg-white/[0.06] text-text-tertiary border border-white/[0.08] hover:bg-white/[0.10]'
                        }`}
                      >
                        {SOUND_TENDENCY_LABELS[n]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-accent/15 text-accent">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {suggestedTags.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-text-tertiary mb-1.5">常用标签（点击添加）</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => set('tags', [...draft.tags, tag])}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] text-text-tertiary border border-white/[0.08] hover:bg-white/[0.08] hover:text-text-secondary transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      {tag}
                    </button>
                  ))}
                </div>
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
