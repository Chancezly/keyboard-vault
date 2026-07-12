import { Star } from 'lucide-react'
import { formatRating, StarRating } from './StarRating'
import type { CollectionItem } from '../lib/types'
import { STATUS_LABELS, STATUS_BADGE_COLORS } from '../lib/types'
import { BUILD_PART_META, getBuildComposition, getBuildDisplayName } from '../lib/builds'
import { getCardEyebrow, getCardMetrics } from '../lib/cardHighlights'
import { CoverImage } from './CoverImage'

interface ItemCardProps {
  item: CollectionItem
  onClick: () => void
  viewMode: 'grid' | 'list'
}

function SpecMetric({
  label,
  value,
  primary,
  align = 'start',
}: {
  label: string
  value: string
  primary?: boolean
  align?: 'start' | 'end'
}) {
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${align === 'end' ? 'items-end text-right' : ''}`}>
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </span>
      <span
        className={`truncate max-w-[140px] ${
          primary
            ? 'text-[15px] font-semibold text-text-primary tabular-nums tracking-tight'
            : 'text-[13px] font-medium text-text-secondary'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function CardMetrics({
  item,
  layout,
}: {
  item: CollectionItem
  layout: 'grid' | 'list-trailing'
}) {
  const metrics = getCardMetrics(item)
  if (!metrics.length) return null

  if (layout === 'list-trailing') {
    return (
      <div className="flex items-center gap-5 shrink-0">
        {metrics.map((m) => (
          <SpecMetric key={m.key} label={m.label} value={m.value} primary={m.primary} align="end" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-6 pt-3.5 mt-3.5 border-t border-white/[0.06]">
      {metrics.map((m) => (
        <SpecMetric key={m.key} label={m.label} value={m.value} primary={m.primary} />
      ))}
    </div>
  )
}

function BuildPartTags({ item }: { item: CollectionItem }) {
  const composition = getBuildComposition(item)
  return (
    <div className="flex flex-col gap-1.5 mt-2.5">
      {BUILD_PART_META.map(({ role, label }) => {
        const name = composition[role].name.trim()
        if (!name) return null
        return (
          <div key={role} className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-text-tertiary">
              {label}
            </span>
            <span className="text-[12px] text-text-secondary truncate">{name}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ItemCard({ item, onClick, viewMode }: ItemCardProps) {
  const isBuild = item.category === 'builds'
  const eyebrow = getCardEyebrow(item)
  const displayName = isBuild ? getBuildDisplayName(item) : item.name
  const fit = item.fitRating ?? item.rating
  const composition = isBuild ? getBuildComposition(item) : null

  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className="
          w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl
          bg-white/[0.03] hover:bg-white/[0.06]
          border border-white/[0.06] hover:border-white/10
          transition-all duration-300 text-left group
        "
      >
        <CoverImage
          src={item.image}
          alt={displayName}
          className="w-[68px] h-[68px] rounded-[14px] shrink-0 ring-1 ring-white/[0.06]"
          imgClassName="group-hover:scale-[1.03] transition-transform duration-500 ease-out"
        />

        <div className="flex-1 min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-medium text-text-tertiary tracking-wide truncate">{eyebrow}</p>
          ) : null}
          <h3 className="text-[15px] font-semibold font-display tracking-tight truncate text-text-primary mt-0.5">
            {displayName}
          </h3>
          {isBuild && composition ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BUILD_PART_META.map(({ role, label }) => {
                const name = composition[role].name.trim()
                if (!name) return null
                return (
                  <span
                    key={role}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-text-tertiary truncate max-w-[7rem]"
                  >
                    {label} {name}
                  </span>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-5 shrink-0">
          {!isBuild ? <CardMetrics item={item} layout="list-trailing" /> : null}
          {(isBuild ? fit : item.rating) != null ? (
            <span className="flex items-center gap-1 text-[12px] text-amber-400/90 tabular-nums">
              <Star className="w-3.5 h-3.5 fill-current" />
              {formatRating(isBuild ? fit : item.rating)}
            </span>
          ) : null}
          {!isBuild ? (
            <span
              className={`text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE_COLORS[item.status]}`}
            >
              {STATUS_LABELS[item.status]}
            </span>
          ) : (
            <span className="text-[10px] px-2.5 py-1 rounded-full font-medium bg-amber-500/15 text-amber-300">
              搭配
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="
        group relative flex flex-col rounded-[20px] overflow-hidden
        bg-white/[0.03] border border-white/[0.06]
        hover:bg-white/[0.05] hover:border-white/10
        transition-all duration-300 text-left
        hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)]
        hover:-translate-y-0.5
      "
    >
      <div className="relative aspect-[4/3]">
        <CoverImage
          src={item.image}
          alt={displayName}
          className="absolute inset-0"
          imgClassName="group-hover:scale-[1.04] transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />

        {!isBuild ? (
          <span
            className={`absolute top-3 left-3 z-10 text-[11px] px-2.5 py-1 rounded-full font-medium backdrop-blur-xl ${STATUS_BADGE_COLORS[item.status]}`}
          >
            {STATUS_LABELS[item.status]}
          </span>
        ) : (
          <span className="absolute top-3 left-3 z-10 text-[11px] px-2.5 py-1 rounded-full font-medium backdrop-blur-xl bg-amber-500/80 text-white">
            搭配
          </span>
        )}

        {(isBuild ? fit : item.rating) != null ? (
          <span className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[11px] text-amber-200/95 bg-black/35 backdrop-blur-xl px-2 py-1 rounded-full tabular-nums">
            <Star className="w-3 h-3 fill-current" />
            {formatRating(isBuild ? fit : item.rating)}
          </span>
        ) : null}
      </div>

      <div className="p-4 pb-4.5">
        {eyebrow ? (
          <p className="text-[11px] font-medium text-text-tertiary tracking-wide truncate">{eyebrow}</p>
        ) : null}

        <h3
          className={`font-semibold font-display tracking-tight leading-snug text-text-primary ${
            eyebrow ? 'mt-1' : ''
          } ${item.category === 'switches' ? 'text-[16px]' : 'text-[15px]'} line-clamp-2`}
        >
          {displayName}
        </h3>

        {isBuild ? (
          <>
            <BuildPartTags item={item} />
            {fit != null ? (
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/[0.06]">
                <span className="text-[10px] text-text-tertiary shrink-0">适配度</span>
                <StarRating value={fit} readonly size="sm" />
                <span className="text-[12px] font-medium text-amber-400/90 tabular-nums">
                  {formatRating(fit)}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <CardMetrics item={item} layout="grid" />
        )}
      </div>
    </button>
  )
}
