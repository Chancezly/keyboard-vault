import { FolderSync, Heart, Keyboard, Plus } from 'lucide-react'

interface EmptyStateProps {
  search: string
  readOnly?: boolean
  vaultSupported?: boolean
  onConnect?: () => void
  onNew?: () => void
  onWishlist?: () => void
  wishlistCount?: number
}

export function EmptyState({
  search,
  readOnly,
  vaultSupported,
  onConnect,
  onNew,
  onWishlist,
  wishlistCount = 0,
}: EmptyStateProps) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
          <Keyboard className="w-6 h-6 text-text-tertiary" />
        </div>
        <h3 className="text-[17px] font-semibold text-text-primary tracking-tight">没有找到匹配的收藏</h3>
        <p className="text-[13px] text-text-tertiary mt-2 max-w-sm leading-relaxed">
          试试其他关键词，或清除筛选条件
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
        <Keyboard className="w-6 h-6 text-text-tertiary" />
      </div>
      <h3 className="text-[17px] font-semibold text-text-primary tracking-tight">这里还是空的</h3>
      <p className="text-[13px] text-text-tertiary mt-2 max-w-sm leading-relaxed">
        {readOnly
          ? '连接本地文件夹后即可新增收藏；也可先浏览示例，或查看心愿单。'
          : '新增第一件套件、键帽或搭配，开始整理你的收藏库。'}
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-6 w-full max-w-sm">
        {readOnly && vaultSupported && onConnect ? (
          <button
            type="button"
            onClick={onConnect}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium bg-accent/90 text-white hover:bg-accent transition-all min-h-[44px]"
          >
            <FolderSync className="w-4 h-4" />
            连接文件夹
          </button>
        ) : null}
        {!readOnly && onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium bg-accent/90 text-white hover:bg-accent transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            新增收藏
          </button>
        ) : null}
        {onWishlist ? (
          <button
            type="button"
            onClick={onWishlist}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium bg-white/[0.06] text-text-secondary hover:bg-white/[0.09] border border-white/[0.08] transition-all min-h-[44px]"
          >
            <Heart className="w-4 h-4 text-amber-400" />
            心愿单{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
          </button>
        ) : null}
      </div>
    </div>
  )
}
