import { Star } from 'lucide-react'

interface StarRatingProps {
  value?: number
  onChange?: (value: number | undefined) => void
  size?: 'sm' | 'md'
  readonly?: boolean
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6' }

export function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const starClass = sizes[size]

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (value ?? 0) >= n
        if (readonly) {
          return (
            <Star
              key={n}
              className={`${starClass} ${active ? 'text-amber-400 fill-amber-400' : 'text-white/15'}`}
            />
          )
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(value === n ? undefined : n)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${n} 星`}
          >
            <Star className={`${starClass} ${active ? 'text-amber-400 fill-amber-400' : 'text-white/20'}`} />
          </button>
        )
      })}
    </div>
  )
}
