import { useRef, useState } from 'react'
import { X, Upload, Trash2, Download, Plus, Save } from 'lucide-react'
import type { BuildComposition, CollectionItem, ItemCategory, ItemStatus, SpecFieldKey } from '../lib/types'
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  RATING_DIMENSION_LABELS,
  RATING_DIMENSIONS,
  CATEGORY_SPEC_FIELDS,
  SOUND_TENDENCY_LABELS,
  computeOverallRating,
  normalizeRatingDetail,
  PLATE_OPTIONS,
  FILLING_OPTIONS,
  WEIGHT_OPTIONS,
  PCB_THICKNESS_OPTIONS,
  KEYCAP_PROFILE_OPTIONS,
  KEYCAP_MATERIAL_OPTIONS,
  ACTUATION_PRESETS,
} from '../lib/types'
import {
  collectFieldOptions,
  emptyBuildComposition,
  getBuildComposition,
  getBuildDisplayName,
  inventoryByName,
  inventoryNames,
  isBuildCompositionComplete,
  snapshotFromInventory,
  syncBuildRelations,
} from '../lib/builds'
import { downloadMarkdown } from '../lib/serialize'
import { inferLayoutFromName } from '../lib/inferLayout'
import { Dropdown, ComboSelect, fieldInputClass as inputClass } from './Dropdown'
import type { DropdownOption } from './Dropdown'
import { StarRating, formatRating } from './StarRating'

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
  inventoryItems: CollectionItem[]
  vaultError?: string | null
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


export function ItemEditor({ item, isNew, allTags, studioSuggestions, inventoryItems, vaultError, onSave, onDelete, onClose }: ItemEditorProps) {
  const [draft, setDraft] = useState<CollectionItem>(() => {
    const base =
      item.category === 'switches' && !item.lube ? { ...item, lube: '厂润' } : { ...item }
    if (base.category === 'builds' && !base.buildComposition) {
      base.buildComposition = emptyBuildComposition()
    }
    return base
  })
  const [tagInput, setTagInput] = useState('')
  /** 用户是否主动上传过搭配封面（否则保存时快照套件图） */
  const [coverUploaded, setCoverUploaded] = useState(() => Boolean(item.image && item.category === 'builds'))
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isBuild = draft.category === 'builds'
  const composition = getBuildComposition(draft)

  const set = <K extends keyof CollectionItem>(key: K, value: CollectionItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  /** 套件改名时：仅当配列为空才自动推断填充 */
  const setKeyboardName = (name: string) => {
    setDraft((d) => {
      const next: CollectionItem = { ...d, name }
      if (d.category === 'keyboards' && !d.layout?.trim()) {
        const inferred = inferLayoutFromName(name)
        if (inferred) next.layout = inferred
      }
      return next
    })
  }

  const setCategory = (c: ItemCategory) =>
    setDraft((d) => ({
      ...d,
      category: c,
      lube: c === 'switches' && !d.lube ? '厂润' : d.lube,
      brand: c === 'builds' ? '' : d.brand,
      buildComposition: c === 'builds' ? d.buildComposition ?? emptyBuildComposition() : undefined,
    }))

  const patchComposition = (patch: Partial<BuildComposition>) => {
    setDraft((d) => {
      const next = { ...getBuildComposition(d), ...patch }
      return { ...d, buildComposition: next }
    })
  }

  const selectPartFromInventory = (
    role: 'keyboard' | 'switches' | 'keycaps',
    category: ItemCategory,
    name: string,
  ) => {
    const match = inventoryByName(inventoryItems, category, name)
    if (match) {
      const snap = snapshotFromInventory(match)
      setDraft((d) => {
        const nextComp = { ...getBuildComposition(d), ...snap }
        const useKbCover = role === 'keyboard' && !coverUploaded && Boolean(match.image)
        return {
          ...d,
          buildComposition: nextComp,
          ...(useKbCover ? { image: match.image, images: [match.image] } : {}),
        }
      })
      return
    }
    // 手填名称：只更新名称，清掉 sourceId
    if (role === 'keyboard') {
      patchComposition({
        keyboard: {
          name: name.trim(),
          brand: composition.keyboard.brand,
          plate: composition.keyboard.plate,
          pcbThickness: composition.keyboard.pcbThickness,
        },
      })
    } else if (role === 'switches') {
      patchComposition({
        switches: {
          name: name.trim(),
          actuation: composition.switches.actuation,
        },
      })
    } else {
      patchComposition({
        keycaps: {
          name: name.trim(),
          profile: composition.keycaps.profile,
          material: composition.keycaps.material,
        },
      })
    }
  }

  const setRating = (dim: (typeof RATING_DIMENSIONS)[number], value: number | undefined) => {
    setDraft((d) => {
      const next = { ...(d.ratingDetail ?? { scale: 5 }), scale: 5, [dim]: value }
      return { ...d, ratingDetail: normalizeRatingDetail(next) }
    })
  }

  const setFitRating = (value: number | undefined) => {
    setDraft((d) => ({
      ...d,
      fitRating: value,
      rating: value,
      ratingDetail: value != null ? { overall: value, scale: 5 } : undefined,
    }))
  }

  const computedOverall = computeOverallRating(draft.ratingDetail)

  const suggestedTags = allTags.filter((t) => !draft.tags.includes(t))

  const brandOptions = collectFieldOptions(inventoryItems, 'keyboards', 'brand', studioSuggestions)
  const plateOptions = collectFieldOptions(inventoryItems, 'keyboards', 'plate', PLATE_OPTIONS)
  const pcbOptions = collectFieldOptions(inventoryItems, 'keyboards', 'pcbThickness', PCB_THICKNESS_OPTIONS)
  const actuationOptions = collectFieldOptions(inventoryItems, 'switches', 'actuation', ACTUATION_PRESETS)
  const profileOptions = collectFieldOptions(inventoryItems, 'keycaps', 'profile', KEYCAP_PROFILE_OPTIONS)
  const materialOptions = collectFieldOptions(inventoryItems, 'keycaps', 'material', KEYCAP_MATERIAL_OPTIONS)

  const handleImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setCoverUploaded(true)
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
    setSaveError(null)

    if (draft.category === 'builds') {
      const c = getBuildComposition(draft)
      if (!isBuildCompositionComplete(c)) {
        setSaveError('请填写套件、轴体、键帽的名称（三项都必须有）')
        return
      }

      let image = draft.image
      let images = draft.images
      if (!coverUploaded || !image) {
        const kb = inventoryByName(inventoryItems, 'keyboards', c.keyboard.name)
          ?? (c.keyboard.sourceId
            ? inventoryItems.find((i) => i.id === c.keyboard.sourceId)
            : undefined)
        if (kb?.image) {
          image = kb.image
          images = [kb.image]
        }
      }

      const fit = draft.fitRating ?? draft.rating
      const normalized = syncBuildRelations({
        ...draft,
        name: draft.name.trim(),
        brand: '',
        image,
        images,
        buildComposition: c,
        fitRating: fit,
        rating: fit,
        ratingDetail: fit != null ? { overall: fit, scale: 5 } : undefined,
        tagGroups: [],
        tags: [],
        status: 'collection',
      })
      onSave(normalized)
      return
    }

    const rd = normalizeRatingDetail(draft.ratingDetail)
    const normalized: CollectionItem = {
      ...draft,
      name: draft.name.trim() || '未命名',
      tagGroups: draft.tags.length ? [{ group: '', values: draft.tags }] : [],
      rating: rd?.overall,
      ratingDetail: rd,
      // 心愿单尚未购入，不保留购买时间
      acquired: draft.status === 'wishlist' ? undefined : draft.acquired,
      soldPrice: draft.status === 'sold' ? draft.soldPrice : undefined,
    }
    onSave(normalized)
  }

  const handleDelete = () => {
    if (isNew) {
      if (window.confirm('确定放弃新建？')) onClose()
      return
    }
    if (!window.confirm(`确定删除「${getBuildDisplayName(draft) || draft.name || '此收藏'}」？此操作不可撤销。`)) return
    onDelete(draft.id)
    onClose()
  }

  const previewTitle = isBuild ? getBuildDisplayName(draft) : draft.name

  return (
    <div className="fixed inset-0 z-[60] flex flex-col lg:items-center lg:justify-center lg:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full h-full lg:h-auto lg:max-w-2xl lg:max-h-[90vh] glass-strong lg:rounded-3xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold">{isNew ? (isBuild ? '新增搭配' : '新增收藏') : (isBuild ? '编辑搭配' : '编辑收藏')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Image uploader */}
          <div>
            <Label>封面图片{isBuild ? '（可选；不上传则使用套件图）' : ''}</Label>
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
                  <span className="text-[12px]">{isBuild ? '点击上传搭配图，或不上传以使用套件图' : '点击上传本地图片'}</span>
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
            {isBuild && draft.image && !coverUploaded && (
              <p className="text-[10px] text-text-tertiary mt-1.5">当前预览为套件图快照，保存后写入本搭配</p>
            )}
          </div>

          {/* Basic */}
          {isBuild ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>搭配名称（选填）</Label>
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="不填则显示「套件名 + 轴体名」"
                  />
                  {previewTitle && !draft.name.trim() && composition.keyboard.name && (
                    <p className="text-[10px] text-text-tertiary mt-1">预览标题：{previewTitle}</p>
                  )}
                </div>
                <div>
                  <Label>分类</Label>
                  <Dropdown
                    value={draft.category}
                    onChange={(v) => setCategory(v as ItemCategory)}
                    options={CATEGORY_OPTIONS}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-accent/5 border border-accent/15 space-y-5">
                <div>
                  <p className="text-[12px] font-medium text-text-primary">搭配组成</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">
                    套件 + 轴体 + 键帽（均必填）。可从库存快速选择自动带入字段，也可手填；内容仅保存在本搭配。
                  </p>
                </div>

                {/* 套件 */}
                <div className="space-y-3">
                  <p className="text-[11px] font-medium text-accent">套件</p>
                  <div>
                    <Label>名称</Label>
                    <ComboSelect
                      value={composition.keyboard.name}
                      onChange={(v) => selectPartFromInventory('keyboard', 'keyboards', v)}
                      options={inventoryNames(inventoryItems, 'keyboards')}
                      placeholder="选择或输入套件名称"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>工作室</Label>
                      <ComboSelect
                        value={composition.keyboard.brand ?? ''}
                        onChange={(v) =>
                          patchComposition({
                            keyboard: { ...composition.keyboard, brand: v || undefined },
                          })
                        }
                        options={brandOptions}
                        placeholder="选填"
                      />
                    </div>
                    <div>
                      <Label>定位板</Label>
                      <ComboSelect
                        value={composition.keyboard.plate ?? ''}
                        onChange={(v) =>
                          patchComposition({
                            keyboard: { ...composition.keyboard, plate: v || undefined },
                          })
                        }
                        options={plateOptions}
                        placeholder="选填"
                      />
                    </div>
                    <div>
                      <Label>PCB厚度</Label>
                      <ComboSelect
                        value={composition.keyboard.pcbThickness ?? ''}
                        onChange={(v) =>
                          patchComposition({
                            keyboard: { ...composition.keyboard, pcbThickness: v || undefined },
                          })
                        }
                        options={pcbOptions}
                        placeholder="选填"
                      />
                    </div>
                  </div>
                </div>

                {/* 轴体 */}
                <div className="space-y-3">
                  <p className="text-[11px] font-medium text-accent">轴体</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>名称</Label>
                      <ComboSelect
                        value={composition.switches.name}
                        onChange={(v) => selectPartFromInventory('switches', 'switches', v)}
                        options={inventoryNames(inventoryItems, 'switches')}
                        placeholder="选择或输入轴体名称"
                      />
                    </div>
                    <div>
                      <Label>触发压力</Label>
                      <ComboSelect
                        value={composition.switches.actuation ?? ''}
                        onChange={(v) =>
                          patchComposition({
                            switches: { ...composition.switches, actuation: v || undefined },
                          })
                        }
                        options={actuationOptions}
                        placeholder="选填，如 50g"
                      />
                    </div>
                  </div>
                </div>

                {/* 键帽 */}
                <div className="space-y-3">
                  <p className="text-[11px] font-medium text-accent">键帽</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>名称</Label>
                      <ComboSelect
                        value={composition.keycaps.name}
                        onChange={(v) => selectPartFromInventory('keycaps', 'keycaps', v)}
                        options={inventoryNames(inventoryItems, 'keycaps')}
                        placeholder="选择或输入键帽名称"
                      />
                    </div>
                    <div>
                      <Label>高度</Label>
                      <ComboSelect
                        value={composition.keycaps.profile ?? ''}
                        onChange={(v) =>
                          patchComposition({
                            keycaps: { ...composition.keycaps, profile: v || undefined },
                          })
                        }
                        options={profileOptions}
                        placeholder="选填"
                      />
                    </div>
                    <div>
                      <Label>材质</Label>
                      <ComboSelect
                        value={composition.keycaps.material ?? ''}
                        onChange={(v) =>
                          patchComposition({
                            keycaps: { ...composition.keycaps, material: v || undefined },
                          })
                        }
                        options={materialOptions}
                        placeholder="选填"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label>适配度（选填）</Label>
                <div className="flex items-center gap-3">
                  <StarRating value={draft.fitRating ?? draft.rating} onChange={setFitRating} />
                  {(draft.fitRating ?? draft.rating) != null && (
                    <span className="text-[13px] font-semibold text-amber-400 tabular-nums">
                      {formatRating(draft.fitRating ?? draft.rating)}
                    </span>
                  )}
                  <span className="text-[10px] text-text-tertiary">可不评</span>
                </div>
              </div>

              <div>
                <Label>备注 / 体验</Label>
                <textarea
                  className={`${inputClass} resize-none leading-relaxed`}
                  rows={4}
                  value={draft.content}
                  onChange={(e) => set('content', e.target.value)}
                  placeholder="记录这套搭配的使用感受、适用场景…"
                />
              </div>

              {(saveError || vaultError) && (
                <p className="text-[12px] text-red-300 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  {saveError || vaultError}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>名称</Label>
                  <SuggestInput
                    value={draft.name}
                    onChange={(v) =>
                      draft.category === 'keyboards' ? setKeyboardName(v) : set('name', v)
                    }
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
            </>
          )}

          {/* Specification (non-build) */}
          {!isBuild && CATEGORY_SPEC_FIELDS[draft.category].length > 0 && (
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
                if (field.key === 'plate') {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <ComboSelect
                        value={(draft.plate as string) ?? ''}
                        onChange={(v) => set('plate', v || undefined)}
                        options={PLATE_OPTIONS}
                        placeholder={field.placeholder}
                      />
                    </div>
                  )
                }
                if (field.key === 'filling') {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <ComboSelect
                        value={(draft.filling as string) ?? ''}
                        onChange={(v) => set('filling', v || undefined)}
                        options={FILLING_OPTIONS}
                        placeholder={field.placeholder}
                      />
                    </div>
                  )
                }
                if (field.key === 'pcbThickness') {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <ComboSelect
                        value={(draft.pcbThickness as string) ?? ''}
                        onChange={(v) => set('pcbThickness', v || undefined)}
                        options={PCB_THICKNESS_OPTIONS}
                        placeholder={field.placeholder}
                      />
                    </div>
                  )
                }
                if (field.key === 'weight') {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <ComboSelect
                        value={(draft.weight as string) ?? ''}
                        onChange={(v) => set('weight', v || undefined)}
                        options={WEIGHT_OPTIONS}
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

          {!isBuild && (
            <>
          {/* Purchase date (keyboards) / price */}
          <div className="grid grid-cols-2 gap-4">
            {draft.category === 'keyboards' && draft.status !== 'wishlist' && (
              <div>
                <Label>购买时间</Label>
                <input
                  type="date"
                  className={inputClass}
                  value={draft.acquired ?? ''}
                  onChange={(e) => set('acquired', e.target.value || undefined)}
                />
              </div>
            )}
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
                  <StarRating value={computedOverall} readonly size="sm" />
                  <span className="text-[13px] font-semibold text-amber-400 tabular-nums">{formatRating(computedOverall)}</span>
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> {isNew ? '放弃' : '删除'}
            </button>
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

