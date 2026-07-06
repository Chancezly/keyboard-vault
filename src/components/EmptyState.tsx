import { Keyboard } from 'lucide-react'

interface EmptyStateProps {
  search: string
}

export function EmptyState({ search }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
        <Keyboard className="w-7 h-7 text-text-tertiary" />
      </div>
      <h3 className="text-lg font-medium text-text-secondary">
        {search ? '没有找到匹配的收藏' : '暂无收藏'}
      </h3>
      <p className="text-[13px] text-text-tertiary mt-2 max-w-sm">
        {search
          ? '试试其他关键词，或清除筛选条件'
          : '在 vault/ 目录下添加 Markdown 文件即可自动加载'
        }
      </p>
    </div>
  )
}
