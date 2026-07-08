import { X, Star, Tag, ExternalLink, Link2, History, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CollectionItem, ItemStatus } from '../lib/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  RELATION_LABELS,
  HISTORY_LABELS,
  RATING_DIMENSION_LABELS,
  RATING_DIMENSIONS,
  SOUND_TENDENCY_LABELS,
} from '../lib/types'
import { BUILD_PARTS, getBuildPartName } from '../lib/builds'
import {
  getExtraSpecFields,
  getSpecificationFields,
  getStateFields,
  specSectionTitle,
  stateSectionTitle,
} from '../lib/itemDisplay'
import { Dropdown } from './Dropdown'
import type { DropdownOption } from './Dropdown'
import { StarRating, formatRating } from './StarRating'

const STATUS_OPTIONS: DropdownOption[] = (Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}))

interface ItemDetailProps {
  item: CollectionItem
  readOnly?: boolean
  onClose: () => void
  onEdit?: () => void
  onStatusChange?: (next: ItemStatus) => void
}

function DetailFieldGrid({ fields }: { fields: { label: string; value: string }[] }) {
  if (!fields.length) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
      {fields.map((f) => (
        <div key={f.label}>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">{f.label}</p>
          <p
            className={`text-[14px] mt-1 leading-snug ${
              f.value === '—' ? 'text-text-tertiary' : 'text-text-primary'
            }`}
          >
            {f.value}
          </p>
        </div>
      ))}
    </div>
  )
}

export function ItemDetail({ item, readOnly = false, onClose, onEdit, onStatusChange }: ItemDetailProps) {
  const isBuild = item.category === 'builds'
  const specFields = [...getSpecificationFields(item), ...getExtraSpecFields(item)]
  const stateFields = getStateFields(item)

  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:items-center lg:justify-center lg:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full h-full lg:h-auto lg:max-w-4xl lg:max-h-[90vh] overflow-hidden glass-strong lg:rounded-3xl shadow-2xl shadow-black/40 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0">
        <div className="absolute top-5 right-5 z-10 flex items-center gap-2">
          {!readOnly && onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/60 transition-all text-[12px] font-medium"
            >
              <Pencil className="w-3.5 h-3.5" /> 编辑
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          <div className="relative h-48 sm:h-72 overflow-hidden">
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-[#141416]/40 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-center gap-2 mb-2">
                {!isBuild &&
                  (readOnly || !onStatusChange ? (
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${STATUS_COLORS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  ) : (
                    <Dropdown
                      value={item.status}
                      onChange={(v) => onStatusChange(v as ItemStatus)}
                      options={STATUS_OPTIONS}
                      fullWidth={false}
                      buttonClassName={`flex items-center gap-1.5 text-[11px] pl-2.5 pr-2 py-1 rounded-lg font-medium cursor-pointer transition-all ${STATUS_COLORS[item.status]}`}
                    />
                  ))}
                <span className="text-[11px] text-text-tertiary">{CATEGORY_LABELS[item.category]}</span>
                {readOnly && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/70">只读</span>
                )}
              </div>
              {!isBuild && item.brand ? (
                <p className="text-[13px] text-text-secondary font-medium">{item.brand}</p>
              ) : null}
              <h2 className="text-3xl font-semibold tracking-tight mt-1 font-display">{item.name}</h2>
              {isBuild && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {BUILD_PARTS.map(({ role, label }) => {
                    const name = getBuildPartName(item.relations, role)
                    if (!name) return null
                    return (
                      <span
                        key={role}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md text-white/90"
                      >
                        {label} · {name}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {specFields.length > 0 && (
            <div className="px-8 py-6 border-b border-white/[0.06]">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary mb-4">
                {specSectionTitle(item.category)}
              </h3>
              <DetailFieldGrid fields={specFields} />
            </div>
          )}

          <div className="px-8 py-6 border-b border-white/[0.06]">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary mb-4">
              {stateSectionTitle(item.category)}
            </h3>
            <DetailFieldGrid fields={stateFields} />
            {item.rating ? (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-[14px] font-medium">{formatRating(item.rating)}</span>
                <span className="text-[12px] text-text-tertiary">总评分</span>
              </div>
            ) : null}
          </div>

          {item.tagGroups.length > 0 && (
            <div className="px-8 py-6 border-b border-white/[0.06]">
              <div className="space-y-2">
                {item.tagGroups.map((tg) => (
                  <div key={tg.group || 'tags'} className="flex items-center gap-2 flex-wrap">
                    {tg.group ? (
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-tertiary min-w-[52px]">
                        <Tag className="w-3 h-3" />
                        {tg.group}
                      </span>
                    ) : (
                      <Tag className="w-3.5 h-3.5 text-text-tertiary" />
                    )}
                    {tg.values.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.06] text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.relations.length > 0 && (
            <div className="px-8 py-6 border-b border-white/[0.06]">
              <h3 className="flex items-center gap-2 text-[12px] font-medium text-text-secondary mb-4">
                <Link2 className="w-3.5 h-3.5" />
                关联部件
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {item.relations.map((rel) => (
                  <div key={rel.role} className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {RELATION_LABELS[rel.role] ?? rel.role}
                    </p>
                    <p className="text-[13px] font-medium mt-1 truncate">{rel.name ?? rel.ref}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5 font-mono">{rel.ref}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.ratingDetail && (
            <div className="px-8 py-6 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                  <Star className="w-3.5 h-3.5" />
                  评分细节
                </h3>
                {item.ratingDetail.overall != null && (
                  <div className="flex items-center gap-2">
                    <StarRating value={item.ratingDetail.overall} readonly size="sm" />
                    <span className="text-[15px] font-semibold text-amber-400 tabular-nums">
                      {formatRating(item.ratingDetail.overall)}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {RATING_DIMENSIONS.map((dim) => {
                  const value = item.ratingDetail?.[dim]
                  if (value == null) return null
                  return (
                    <div key={dim} className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-text-tertiary shrink-0">
                        {RATING_DIMENSION_LABELS[dim]}
                      </span>
                      <StarRating value={value} readonly size="sm" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {item.soundTendency != null && (
            <div className="px-8 py-6 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 text-[12px] font-medium text-text-secondary">
                  <Star className="w-3.5 h-3.5" />
                  音色取向
                </h3>
                <span className="text-[13px] font-semibold text-accent">
                  {SOUND_TENDENCY_LABELS[item.soundTendency]}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className={`w-full h-2 rounded-full ${
                        n === item.soundTendency ? 'bg-accent' : 'bg-white/[0.06]'
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        n === item.soundTendency ? 'text-accent font-medium' : 'text-text-tertiary'
                      }`}
                    >
                      {SOUND_TENDENCY_LABELS[n]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.history.length > 0 && (
            <div className="px-8 py-6 border-b border-white/[0.06]">
              <h3 className="flex items-center gap-2 text-[12px] font-medium text-text-secondary mb-4">
                <History className="w-3.5 h-3.5" />
                历史记录
              </h3>
              <div className="space-y-3">
                {item.history.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2 h-2 rounded-full bg-accent/70" />
                      {i < item.history.length - 1 && (
                        <div className="w-px flex-1 bg-white/[0.08] mt-1" />
                      )}
                    </div>
                    <div className="pb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium">
                          {HISTORY_LABELS[h.event] ?? h.event}
                        </span>
                        {h.date && <span className="text-[11px] text-text-tertiary">{h.date}</span>}
                        {h.price != null && (
                          <span className="text-[11px] text-text-secondary">¥{h.price}</span>
                        )}
                      </div>
                      {h.note && <p className="text-[12px] text-text-tertiary mt-0.5">{h.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-8 py-8 prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-text-primary prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-p:text-text-secondary prose-p:leading-relaxed prose-li:text-text-secondary prose-strong:text-text-primary prose-table:text-text-secondary prose-th:text-text-primary prose-th:font-medium prose-td:border-white/10 prose-th:border-white/10 prose-blockquote:border-accent/40 prose-blockquote:text-text-secondary prose-blockquote:not-italic">
            {item.content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
            ) : (
              <p className="text-text-tertiary not-prose text-[13px]">暂无体验描述</p>
            )}
          </div>

          <div className="px-8 pb-8">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] text-[11px] text-text-tertiary">
              <ExternalLink className="w-3 h-3" />
              <span className="font-mono truncate">{item.filePath.replace('../../', '')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
