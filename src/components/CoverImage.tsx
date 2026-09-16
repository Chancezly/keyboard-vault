import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { releaseVaultImage, retainVaultImage } from '../lib/blobImageCache'

interface CoverImageProps {
  src?: string
  alt: string
  className?: string
  imgClassName?: string
  position?: { x: number; y: number }
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
export function CoverImage({ src, alt, className = '', imgClassName = '', position }: CoverImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  useEffect(() => {
    if (!src?.startsWith('blob:')) return
    retainVaultImage(src)
    return () => releaseVaultImage(src)
  }, [src])

  const showImg = isUsableSrc(src) && !failed

  return (
    <div className={`overflow-hidden bg-[#16161a] ${className}`}>
      {showImg ? (
        <img
          src={src}
          alt={alt}
          className={`block w-full h-full object-cover ${imgClassName}`}
          style={{ objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }}
          // 首页使用 640px 缩略图，立即加载不会重新读取原始大图。
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-white/[0.07] via-[#6b8afd]/[0.12] to-transparent">
          <div className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center ring-1 ring-white/[0.06]">
            <Keyboard className="w-5 h-5 text-white/40" />
          </div>
          <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-white/30">KeyVault</span>
        </div>
      )}
    </div>
  )
}
