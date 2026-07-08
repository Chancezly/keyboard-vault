import { useState, useMemo } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ItemCard } from './components/ItemCard'
import { ItemDetail } from './components/ItemDetail'
import { ItemEditor } from './components/ItemEditor'
import { AIPanel } from './components/AIPanel'
import { EmptyState } from './components/EmptyState'
import { DataTableView } from './components/DataTableView'
import { ReadOnlyBanner } from './components/ReadOnlyBanner'
import { DisconnectDialog } from './components/DisconnectDialog'
import { MobileTabBar } from './components/MobileTabBar'
import { MobileMenuSheet } from './components/MobileMenuSheet'
import { filterItems, sortItems, getStats, getAllTags, loadPreferences } from './lib/collection'
import { createBlankItem } from './lib/store'
import { useVault } from './lib/useVault'
import type { CollectionItem, ItemCategory, ItemStatus, SortOption } from './lib/types'
import { CATEGORY_LABELS } from './lib/types'

const SORT_STORAGE_KEY = 'keyvault:sort:v1'

function loadSortPreference(): SortOption {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    if (raw === 'name' || raw === 'addedAt' || raw === 'acquired') return raw
  } catch {
    // ignore
  }
  return 'name'
}

export default function App() {
  const vault = useVault()
  const { items, writable: vaultWritable } = vault
  const readOnly = !vaultWritable

  const [category, setCategory] = useState<ItemCategory | 'all'>('all')
  const [status, setStatus] = useState<ItemStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>(() => loadSortPreference())
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid')
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [editing, setEditing] = useState<{ item: CollectionItem; isNew: boolean } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const stats = useMemo(() => getStats(items), [items])
  const allTags = useMemo(() => getAllTags(items), [items])
  const preferences = useMemo(() => loadPreferences(), [])
  const studioSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((i) => i.category === 'keyboards')
            .map((i) => i.brand.trim())
            .filter(Boolean),
        ),
      ),
    [items],
  )

  const filtered = useMemo(() => {
    const list = filterItems(items, category, status, search)
    return sortItems(list, sortBy)
  }, [items, category, status, search, sortBy])

  const handleSortChange = (next: SortOption) => {
    setSortBy(next)
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  const title = category === 'all' ? '全部收藏' : CATEGORY_LABELS[category]

  const handleSave = async (item: CollectionItem) => {
    if (readOnly) return
    await vault.save(item)
    setEditing(null)
    setSelectedItem(item)
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
    await vault.save(updated)
    setSelectedItem(updated)
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
    await vault.save(updated)
    if (selectedItem?.id === itemId) setSelectedItem(updated)
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
        stats={stats}
        vaultSupported={vault.supported}
        vaultWritable={vaultWritable}
        vaultDirName={vault.dirName}
        vaultBusy={vault.busy}
        onConnectVault={vault.connect}
        onRequestDisconnect={() => setDisconnectOpen(true)}
        onExportZip={vault.exportZip}
        onImportZip={vault.importZip}
      />

      <div className="flex flex-1 min-w-0 flex-col lg:flex-row overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 relative pb-tab-bar">
          <Header
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={filtered.length}
            title={title}
            onNew={handleNew}
            readOnly={readOnly}
          />

          {readOnly && (
            <ReadOnlyBanner
              vaultSupported={vault.supported}
              onConnect={vault.connect}
              busy={vault.busy}
              error={vault.error}
            />
          )}

          {!readOnly && vault.error && (
            <div className="mx-4 lg:mx-8 mt-3 lg:mt-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-300">
              {vault.error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 lg:pb-8 min-h-0 overscroll-y-contain">
            {viewMode === 'table' ? (
              category === 'all' ? (
                <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-center max-w-md mx-auto px-2">
                  <p className="text-[15px] text-text-secondary">表格管理需要选定分类</p>
                  <p className="text-[13px] text-text-tertiary mt-2 leading-relaxed">
                    请在底部或左侧选择「套件」「键帽」或「轴体」，即可横向浏览并批量编辑所有条目。
                  </p>
                </div>
              ) : category === 'builds' ? (
                <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-center max-w-md mx-auto px-2">
                  <p className="text-[15px] text-text-secondary">搭配暂不支持表格编辑</p>
                  <p className="text-[13px] text-text-tertiary mt-2">请切换回卡片或列表视图，或选择其他分类。</p>
                </div>
              ) : readOnly ? (
                <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-center max-w-md mx-auto px-2">
                  <p className="text-[15px] text-text-secondary">表格编辑需要连接本地文件夹</p>
                  <p className="text-[13px] text-text-tertiary mt-2 leading-relaxed">
                    连接后可横向浏览并批量修改规格、价格与购买时间。
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState search={search} />
              ) : (
                <DataTableView
                  items={filtered}
                  category={category}
                  busy={vault.busy}
                  onSave={vault.save}
                />
              )
            ) : filtered.length === 0 ? (
              <EmptyState search={search} />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
                {filtered.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-4xl">
                {filtered.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
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
