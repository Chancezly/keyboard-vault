import { Star } from 'lucide-react'
import type { CollectionItem } from '../lib/types'
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS } from '../lib/types'

interface ItemCardProps {
  item: CollectionItem
  onClick: () => void
  viewMode: 'grid' | 'list'
}

export function ItemCard({ item, onClick, viewMode }: ItemCardProps) {
  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className="
          w-full flex items-center gap-5 p-4 rounded-2xl
          glass hover:bg-white/[0.08] hover:border-white/12
          transition-all duration-300 text-left group
        "
      >
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/[0.04]">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-text-tertiary">{item.brand}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${STATUS_COLORS[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
          </div>
          <h3 className="text-[15px] font-semibold truncate">{item.name}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            {item.rating ? (
              <span className="flex items-center gap-1 text-[12px] text-amber-400">
                <Star className="w-3 h-3 fill-current" />
                {item.rating}
              </span>
            ) : null}
            {item.price ? (
              <span className="text-[12px] text-text-tertiary">¥{item.price}</span>
            ) : null}
            <span className="text-[11px] text-text-tertiary">{CATEGORY_LABELS[item.category]}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-text-tertiary">
              {tag}
            </span>
          ))}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="
        group relative flex flex-col rounded-2xl overflow-hidden
        glass hover:bg-white/[0.08] hover:border-white/12
        transition-all duration-300 text-left
        hover:shadow-2xl hover:shadow-black/20
        hover:-translate-y-0.5
      "
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.04]">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Status badge */}
        <span className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-lg font-medium backdrop-blur-md ${STATUS_COLORS[item.status]}`}>
          {STATUS_LABELS[item.status]}
        </span>

        {/* Rating */}
        {item.rating ? (
          <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] text-amber-300 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg">
            <Star className="w-3 h-3 fill-current" />
            {item.rating}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-5 space-y-2">
        <div>
          <p className="text-[11px] text-text-tertiary font-medium">{item.brand}</p>
          <h3 className="text-[15px] font-semibold mt-0.5 leading-snug">{item.name}</h3>
        </div>

        <div className="flex items-center justify-between">
          {item.price ? (
            <span className="text-[13px] text-text-secondary font-medium">¥{item.price}</span>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-text-tertiary">{CATEGORY_LABELS[item.category]}</span>
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-text-tertiary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
