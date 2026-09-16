import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ItemDetail } from './components/ItemDetail'
import { ItemEditor } from './components/ItemEditor'
import { AIPanel } from './components/AIPanel'
import { ReadOnlyBanner } from './components/ReadOnlyBanner'
import { DisconnectDialog } from './components/DisconnectDialog'
import { MobileTabBar } from './components/MobileTabBar'
import { MobileMenuSheet } from './components/MobileMenuSheet'
import { CollectionContent } from './features/collection/CollectionContent'
import { useCollectionView } from './features/collection/useCollectionView'
import { createBlankItem } from './lib/store'
import { useVault } from './lib/useVault'
import type { CollectionItem, ItemCategory, ItemStatus } from './lib/types'
import { CATEGORY_LABELS } from './lib/types'

export default function App() {
  const vault = useVault()
  const { items, writable: vaultWritable } = vault
  const readOnly = !vaultWritable
  const collection = useCollectionView(items)
  const {
    category,
    setCategory,
    status,
    setStatus,
    search,
    setSearch,
    sortBy,
    changeSort,
    viewMode,
    setViewMode,
    filteredItems,
    stats,
    allTags,
    preferences,
    studioSuggestions,
  } = collection
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [editing, setEditing] = useState<{ item: CollectionItem; isNew: boolean } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const title = category === 'all' ? '全部收藏' : CATEGORY_LABELS[category]

  const handleSave = async (item: CollectionItem) => {
    if (readOnly) return
    try {
      const saved = await vault.save(item)
      setEditing(null)
      setSelectedItem(saved)
    } catch {
      // 全局通知已显示错误，编辑弹窗保持打开便于重试。
    }
  }

  const handleDelete = async (id: string) => {
    if (readOnly) return
    const target = items.find((i) => i.id === id)
    if (target) await vault.remove(target)
    setEditing(null)
    setSelectedItem(null)
  }

  const handleStatusChange = async (item: CollectionItem, next: ItemStatus) => {
    if (readOnly) return
    const updated = { ...item, status: next }
    try {
      const saved = await vault.save(updated)
      setSelectedItem(saved)
    } catch {
      // useVault 已统一显示失败通知。
    }
  }

  const handleNew = () => {
    if (readOnly) return
    const cat: ItemCategory = category === 'all' ? 'keyboards' : category
    setEditing({ item: createBlankItem(cat), isNew: true })
  }

  const handleApplyTags = async (itemId: string, tags: string[]) => {
    if (readOnly) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const merged = Array.from(new Set([...item.tags, ...tags]))
    const updated = { ...item, tags: merged, tagGroups: [{ group: '', values: merged }] }
    try {
      const saved = await vault.save(updated)
      if (selectedItem?.id === itemId) setSelectedItem(saved)
    } catch {
      // useVault 已统一显示失败通知。
    }
  }

  const handleDisconnectConfirm = async () => {
    setDisconnectOpen(false)
    setEditing(null)
    setSelectedItem(null)
    await vault.disconnect()
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] bg-surface overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-accent/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-purple-500/[0.03] blur-[100px]" />
      </div>

      <Sidebar
        activeCategory={category}
        onCategoryChange={setCategory}
        onOpenAI={() => setAiOpen(!aiOpen)}
        aiOpen={aiOpen}
        wishlistActive={status === 'wishlist'}
        onWishlistClick={() => setStatus((s) => (s === 'wishlist' ? 'all' : 'wishlist'))}
        stats={stats}
        vaultSupported={vault.supported}
        vaultWritable={vaultWritable}
        vaultDirName={vault.dirName}
        vaultBusy={vault.busy}
        onConnectVault={vault.connect}
        onRequestDisconnect={() => setDisconnectOpen(true)}
        onExportZip={vault.exportZip}
        onImportZip={vault.importZip}
        onGenerateThumbnails={vault.generateThumbnails}
      />

      <div className="flex flex-1 min-w-0 flex-col lg:flex-row overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 relative pb-tab-bar">
          <Header
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            sortBy={sortBy}
            onSortChange={changeSort}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={filteredItems.length}
            title={title}
            onNew={handleNew}
            readOnly={readOnly}
            wishlistCount={stats.wishlist}
          />

          {readOnly && (
            <ReadOnlyBanner
              vaultSupported={vault.supported}
              onConnect={vault.connect}
              busy={vault.busy}
            />
          )}

          <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 lg:pb-8 min-h-0 overscroll-y-contain">
            <CollectionContent
              items={filteredItems}
              category={category}
              viewMode={viewMode}
              search={search}
              readOnly={readOnly}
              vaultSupported={vault.supported}
              vaultBusy={vault.busy}
              wishlistCount={stats.wishlist}
              onConnect={vault.connect}
              onNew={handleNew}
              onShowWishlist={() => setStatus('wishlist')}
              onSelectItem={setSelectedItem}
              onSave={vault.save}
            />
          </div>
        </main>

        <AIPanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          items={items}
          preferences={preferences}
          allTags={allTags}
          selectedItem={selectedItem}
          readOnly={readOnly}
          onApplyTags={readOnly ? undefined : handleApplyTags}
          onSaveItem={readOnly ? undefined : async (item) => {
            const saved = await vault.save(item)
            setCategory(item.category)
            setSelectedItem(saved)
          }}
        />
      </div>

      <MobileTabBar
        activeCategory={category}
        onCategoryChange={setCategory}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />

      <MobileMenuSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        stats={stats}
        vaultSupported={vault.supported}
        vaultWritable={vaultWritable}
        vaultDirName={vault.dirName}
        vaultBusy={vault.busy}
        aiOpen={aiOpen}
        onOpenAI={() => setAiOpen(true)}
        onConnectVault={vault.connect}
        onRequestDisconnect={() => setDisconnectOpen(true)}
        onExportZip={vault.exportZip}
        onImportZip={vault.importZip}
        onGenerateThumbnails={vault.generateThumbnails}
      />

      {selectedItem && !editing && (
        <ItemDetail
          item={selectedItem}
          readOnly={readOnly}
          onClose={() => setSelectedItem(null)}
          onEdit={readOnly ? undefined : () => setEditing({ item: selectedItem, isNew: false })}
          onStatusChange={readOnly ? undefined : (next) => handleStatusChange(selectedItem, next)}
        />
      )}

      {editing && !readOnly && (
        <ItemEditor
          item={editing.item}
          isNew={editing.isNew}
          allTags={allTags}
          studioSuggestions={studioSuggestions}
          inventoryItems={items}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {disconnectOpen && vault.dirName && (
        <DisconnectDialog
          dirName={vault.dirName}
          onConfirm={() => void handleDisconnectConfirm()}
          onCancel={() => setDisconnectOpen(false)}
        />
      )}
    </div>
  )
}
