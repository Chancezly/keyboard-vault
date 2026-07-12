import { X, Star, Tag, ExternalLink, History, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CollectionItem, ItemStatus } from '../lib/types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  HISTORY_LABELS,
  RATING_DIMENSION_LABELS,
  RATING_DIMENSIONS,
  SOUND_TENDENCY_LABELS,
} from '../lib/types'
import { BUILD_PART_META, getBuildComposition, getBuildDisplayName } from '../lib/builds'
import {
  getBuildCompositionFields,
  getExtraSpecFields,
  getSpecificationFields,
  getStateFields,
  specSectionTitle,
  stateSectionTitle,
} from '../lib/itemDisplay'
import { Dropdown } from './Dropdown'
import type { DropdownOption } from './Dropdown'
import { StarRating, formatRating } from './StarRating'
import { CoverImage } from './CoverImage'

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold tracking-tight text-text-primary mb-5">
      {children}
    </h3>
  )
}

/** 规格：图形化 chip 网格，信息密时更易扫读 */
function SpecChipGrid({ fields }: { fields: { label: string; value: string }[] }) {
  const visible = fields.filter((f) => f.value && f.value !== '—')
  if (!visible.length) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visible.map((f) => (
        <div
          key={f.label}
          className="rounded-2xl bg-white/[0.035] px-4 py-3.5 min-h-[4.5rem] flex flex-col justify-center"
        >
          <p className="text-[11px] text-text-tertiary tracking-wide">{f.label}</p>
          <p className="text-[17px] font-semibold tracking-tight text-text-primary mt-1.5 leading-snug tabular-nums">
            {f.value}
          </p>
        </div>
      ))}
    </div>
  )
}

/** 状态区：标签左、数值右，留白更大 */
function StateRows({ fields }: { fields: { label: string; value: string }[] }) {
  if (!fields.length) return null
  return (
    <div className="divide-y divide-white/[0.05] rounded-2xl bg-white/[0.025] overflow-hidden">
      {fields.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-6 px-5 py-4">
          <span className="text-[13px] text-text-tertiary shrink-0">{f.label}</span>
          <span
            className={`text-[15px] font-medium text-right tabular-nums tracking-tight ${
              f.value === '—' ? 'text-text-tertiary' : 'text-text-primary'
            }`}
          >
            {f.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function DetailFieldGrid({ fields }: { fields: { label: string; value: string }[] }) {
  if (!fields.length) return null
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-4">
          <p className="text-[12px] text-text-tertiary shrink-0">{f.label}</p>
          <p
            className={`text-[14px] font-medium text-right leading-snug ${
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
  const displayName = isBuild ? getBuildDisplayName(item) : item.name
  const composition = isBuild ? getBuildComposition(item) : null
  const buildSections = getBuildCompositionFields(item)
  const specFields = isBuild ? [] : [...getSpecificationFields(item), ...getExtraSpecFields(item)]
  const stateFields = getStateFields(item)
  const fit = item.fitRating ?? item.rating

  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:items-center lg:justify-center lg:p-8">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md animate-detail-backdrop" onClick={onClose} />

      <div className="relative w-full h-full lg:h-auto lg:max-w-3xl lg:max-h-[90vh] overflow-hidden bg-[#111113] lg:rounded-[28px] shadow-2xl shadow-black/50 flex flex-col border border-white/[0.06] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:pt-0 lg:pb-0 animate-detail-in">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {!readOnly && onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/45 backdrop-blur-xl text-white/85 hover:text-white hover:bg-black/60 transition-all text-[13px] font-medium"
            >
              <Pencil className="w-3.5 h-3.5" /> 编辑
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-black/45 backdrop-blur-xl text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-y-contain">
          {/* Hero */}
          <div className="relative h-56 sm:h-80 overflow-hidden">
            <CoverImage
              src={item.image}
              alt={displayName}
              className="absolute inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-[#111113]/50 to-transparent pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 pb-8 sm:pb-10">
              <div className="flex items-center gap-2 mb-3">
                {!isBuild &&
                  (readOnly || !onStatusChange ? (
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                  ) : (
                    <Dropdown
                      value={item.status}
                      onChange={(v) => onStatusChange(v as ItemStatus)}
                      options={STATUS_OPTIONS}
                      fullWidth={false}
                      buttonClassName={`flex items-center gap-1.5 text-[11px] pl-2.5 pr-2 py-1 rounded-full font-medium cursor-pointer transition-all ${STATUS_COLORS[item.status]}`}
                    />
                  ))}
                <span className="text-[12px] text-white/45 font-medium tracking-wide">
                  {CATEGORY_LABELS[item.category]}
                </span>
                {readOnly && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">只读</span>
                )}
              </div>
              {!isBuild && item.brand ? (
                <p className="text-[14px] sm:text-[15px] text-white/55 font-medium tracking-wide">
                  {item.brand}
                </p>
              ) : null}
              <h2 className="text-[34px] sm:text-[42px] font-semibold tracking-tight mt-1 font-display leading-[1.1] text-white">
                {displayName}
              </h2>
              {isBuild && composition && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {BUILD_PART_META.map(({ role, label }) => {
                    const name = composition[role].name.trim()
                    if (!name) return null
                    return (
                      <span
                        key={role}
                        className="text-[12px] px-3 py-1.5 rounded-full bg-white/12 backdrop-blur-md text-white/90"
                      >
                        {label} · {name}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-10 space-y-10 pt-2 pb-4">
            {isBuild && buildSections.length > 0 && (
              <section>
                <SectionLabel>{specSectionTitle(item.category)}</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {buildSections.map((section) => (
                    <div
                      key={section.role}
                      className="px-4 py-4 rounded-2xl bg-white/[0.035] space-y-3"
                    >
                      <p className="text-[13px] font-semibold text-accent tracking-tight">{section.label}</p>
                      <DetailFieldGrid fields={section.fields} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {specFields.length > 0 && (
              <section>
                <SectionLabel>{specSectionTitle(item.category)}</SectionLabel>
                <SpecChipGrid fields={specFields} />
              </section>
            )}

            <section>
              <SectionLabel>{stateSectionTitle(item.category)}</SectionLabel>
              {isBuild ? (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.025]">
                  {fit != null ? (
                    <>
                      <StarRating value={fit} readonly size="md" />
                      <span className="text-[20px] font-semibold text-amber-400 tabular-nums tracking-tight">
                        {formatRating(fit)}
                      </span>
                      <span className="text-[13px] text-text-tertiary">适配度</span>
                    </>
                  ) : (
                    <span className="text-[14px] text-text-tertiary">未评分</span>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <StateRows fields={stateFields} />
                  {item.rating != null && (
                    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.025]">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-[20px] font-semibold tabular-nums tracking-tight text-text-primary">
                        {formatRating(item.rating)}
                      </span>
                      <span className="text-[13px] text-text-tertiary">总评分</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {!isBuild && item.tagGroups.length > 0 && (
              <section>
                <SectionLabel>标签</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {item.tagGroups.flatMap((tg) =>
                    tg.values.map((tag) => (
                      <span
                        key={`${tg.group}-${tag}`}
                        className="inline-flex items-center gap-1.5 text-[13px] px-3.5 py-1.5 rounded-full bg-white/[0.06] text-text-secondary"
                      >
                        <Tag className="w-3 h-3 text-text-tertiary" />
                        {tag}
                      </span>
                    )),
                  )}
                </div>
              </section>
            )}

            {!isBuild && item.ratingDetail && (
              <section>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h3 className="text-[13px] font-semibold tracking-tight text-text-primary">评分细节</h3>
                  {item.ratingDetail.overall != null && (
                    <div className="flex items-center gap-2.5">
                      <StarRating value={item.ratingDetail.overall} readonly size="sm" />
                      <span className="text-[18px] font-semibold text-amber-400 tabular-nums tracking-tight">
                        {formatRating(item.ratingDetail.overall)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 px-1">
                  {RATING_DIMENSIONS.map((dim) => {
                    const value = item.ratingDetail?.[dim]
                    if (value == null) return null
                    return (
                      <div key={dim} className="flex items-center justify-between gap-4">
                        <span className="text-[13px] text-text-tertiary shrink-0">
                          {RATING_DIMENSION_LABELS[dim]}
                        </span>
                        <StarRating value={value} readonly size="sm" />
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {!isBuild && item.soundTendency != null && (
              <section>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-[13px] font-semibold tracking-tight text-text-primary">音色取向</h3>
                  <span className="text-[15px] font-semibold text-accent">
                    {SOUND_TENDENCY_LABELS[item.soundTendency]}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className={`w-full h-2.5 rounded-full transition-colors ${
                          n === item.soundTendency ? 'bg-accent' : 'bg-white/[0.06]'
                        }`}
                      />
                      <span
                        className={`text-[11px] ${
                          n === item.soundTendency ? 'text-accent font-medium' : 'text-text-tertiary'
                        }`}
                      >
                        {SOUND_TENDENCY_LABELS[n]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!isBuild && item.history.length > 0 && (
              <section>
                <SectionLabel>
                  <span className="inline-flex items-center gap-2">
                    <History className="w-4 h-4 text-text-tertiary" />
                    历史记录
                  </span>
                </SectionLabel>
                <div className="space-y-4 pl-1">
                  {item.history.map((h, i) => (
                    <div key={i} className="flex gap-3.5">
                      <div className="flex flex-col items-center pt-1.5">
                        <div className="w-2 h-2 rounded-full bg-accent/80" />
                        {i < item.history.length - 1 && (
                          <div className="w-px flex-1 bg-white/[0.08] mt-1.5" />
                        )}
                      </div>
                      <div className="pb-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[14px] font-medium">
                            {HISTORY_LABELS[h.event] ?? h.event}
                          </span>
                          {h.date && <span className="text-[12px] text-text-tertiary">{h.date}</span>}
                          {h.price != null && (
                            <span className="text-[12px] text-text-secondary tabular-nums">¥{h.price}</span>
                          )}
                        </div>
                        {h.note && <p className="text-[13px] text-text-tertiary mt-1 leading-relaxed">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {item.content.trim() ? (
              <section>
                <SectionLabel>{isBuild ? '备注' : '体验'}</SectionLabel>
                <div className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-text-primary prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-p:text-text-secondary prose-p:leading-[1.7] prose-p:text-[15px] prose-li:text-text-secondary prose-strong:text-text-primary prose-table:text-text-secondary prose-th:text-text-primary prose-th:font-medium prose-td:border-white/10 prose-th:border-white/10 prose-blockquote:border-accent/40 prose-blockquote:text-text-secondary prose-blockquote:not-italic">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                </div>
              </section>
            ) : null}

            <div className="pt-2 pb-8">
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.025] text-[11px] text-text-tertiary">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="font-mono truncate">{item.filePath.replace('../../', '')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
