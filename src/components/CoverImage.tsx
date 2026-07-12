import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'

interface CoverImageProps {
  src?: string
  alt: string
  className?: string
  imgClassName?: string
}

function isUsableSrc(src?: string): boolean {
  const s = src?.trim() ?? ''
  if (!s) return false
  if (s.startsWith('blob:') || s.startsWith('data:') || /^(https?:)?\/\//.test(s)) return true
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return true
  if (s.includes('/assets/')) return true
  // 裸文件名 / 未解析路径 → 不当作可用图
  return false
}

/** 统一封面：有图显示图片；无图或加载失败显示品牌化占位 */
export function CoverImage({ src, alt, className = '', imgClassName = '' }: CoverImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const showImg = isUsableSrc(src) && !failed

  return (
    <div className={`relative overflow-hidden bg-[#16161a] ${className}`}>
      {showImg ? (
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-white/[0.07] via-[#6b8afd]/[0.12] to-transparent">
          <div className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center ring-1 ring-white/[0.06]">
            <Keyboard className="w-5 h-5 text-white/40" />
          </div>
          <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-white/30">KeyVault</span>
        </div>
      )}
    </div>
  )
}
