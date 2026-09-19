import { DataTableView } from '../../components/DataTableView'
import { EmptyState } from '../../components/EmptyState'
import { ItemCard } from '../../components/ItemCard'
import type { CollectionItem, ItemCategory } from '../../lib/types'
import type { CollectionViewMode } from './useCollectionView'

interface CollectionContentProps {
  items: CollectionItem[]
  category: ItemCategory | 'all'
  viewMode: CollectionViewMode
  search: string
  readOnly: boolean
  vaultSupported: boolean
  vaultBusy: boolean
  wishlistCount: number
  onConnect: () => void
  onNew: () => void
  onShowWishlist: () => void
  onSelectItem: (item: CollectionItem) => void
  onSave: (item: CollectionItem) => Promise<unknown>
}

function TableUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-center max-w-md mx-auto px-2">
      <p className="text-[15px] text-text-secondary">{title}</p>
      <p className="text-[13px] text-text-tertiary mt-2 leading-relaxed">{detail}</p>
    </div>
  )
}

export function CollectionContent({
  items,
  category,
  viewMode,
  search,
  readOnly,
  vaultSupported,
  vaultBusy,
  wishlistCount,
  onConnect,
  onNew,
  onShowWishlist,
  onSelectItem,
  onSave,
}: CollectionContentProps) {
  const emptyState = (
    <EmptyState
      search={search}
      readOnly={readOnly}
      vaultSupported={vaultSupported}
      onConnect={onConnect}
      onNew={onNew}
      onWishlist={onShowWishlist}
      wishlistCount={wishlistCount}
    />
  )

  if (viewMode === 'table') {
    if (category === 'all') {
      return (
        <TableUnavailable
          title="表格管理需要选定分类"
          detail="请在底部或左侧选择「套件」「键帽」或「轴体」，即可横向浏览并批量编辑所有条目。"
        />
      )
    }
    if (category === 'builds') {
      return (
        <TableUnavailable
          title="搭配暂不支持表格编辑"
          detail="请切换回卡片或列表视图，或选择其他分类。"
        />
      )
    }
    if (readOnly) {
      return (
        <TableUnavailable
          title="表格编辑需要连接本地文件夹"
          detail="连接后可横向浏览并批量修改规格、价格与购买时间。"
        />
      )
    }
    if (items.length === 0) return emptyState
    return <DataTableView items={items} category={category} busy={vaultBusy} onSave={onSave} />
  }

  if (items.length === 0) return emptyState

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
        {items.map((item, index) => (
          <ItemCard
            key={item.id}
            item={item}
            onClick={() => onSelectItem(item)}
            viewMode="grid"
            imagePriority={index < 4}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          onClick={() => onSelectItem(item)}
          viewMode="list"
          imagePriority={index < 6}
        />
      ))}
    </div>
  )
}
