import { Star, StarHalf } from 'lucide-react'

interface StarRatingProps {
  value?: number
  onChange?: (value: number | undefined) => void
  size?: 'sm' | 'md'
  readonly?: boolean
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6' }

function starState(value: number, index: number): 'full' | 'half' | 'empty' {
  if (value >= index) return 'full'
  if (value >= index - 0.5) return 'half'
  return 'empty'
}

/** 显示评分数字：整数不带小数，半星显示一位小数 */
export function formatRating(value?: number): string {
  if (value == null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const starClass = sizes[size]
  const current = value ?? 0

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const state = starState(current, n)

        if (readonly) {
          if (state === 'full') {
            return (
              <Star key={n} className={`${starClass} text-amber-400 fill-amber-400`} />
            )
          }
          if (state === 'half') {
            return (
              <StarHalf key={n} className={`${starClass} text-amber-400 fill-amber-400`} />
            )
          }
          return <Star key={n} className={`${starClass} text-white/15`} />
        }

        return (
          <div key={n} className={`relative ${starClass} shrink-0`}>
            <Star className={`${starClass} text-white/20`} />
            {state === 'half' && (
              <StarHalf className={`${starClass} absolute inset-0 text-amber-400 fill-amber-400 pointer-events-none`} />
            )}
            {state === 'full' && (
              <Star className={`${starClass} absolute inset-0 text-amber-400 fill-amber-400 pointer-events-none`} />
            )}
            <button
              type="button"
              aria-label={`${n - 0.5} 星`}
              className="absolute inset-y-0 left-0 w-1/2 z-10 hover:scale-110 transition-transform"
              onClick={() => onChange?.(current === n - 0.5 ? undefined : n - 0.5)}
            />
            <button
              type="button"
              aria-label={`${n} 星`}
              className="absolute inset-y-0 right-0 w-1/2 z-10 hover:scale-110 transition-transform"
              onClick={() => onChange?.(current === n ? undefined : n)}
            />
          </div>
        )
      })}
    </div>
  )
}
