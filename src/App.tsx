import { useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ItemDetail } from './components/ItemDetail'
import { ItemEditor } from './components/ItemEditor'
import { AIPanel } from './components/AIPanel'
import { ReadOnlyBanner } from './components/ReadOnlyBanner'
import { DisconnectDialog } from './components/DisconnectDialog'
import { MobileTabBar } from './components/MobileTabBar'
import { MobileMenuSheet } from './components/MobileMenuSheet'
import { VaultDiagnosticsDialog } from './components/VaultDiagnosticsDialog'
import { PreferencesDialog } from './components/PreferencesDialog'
import { HistoryDialog } from './components/HistoryDialog'
import { ConnectionGuideDialog } from './components/ConnectionGuideDialog'
import { PrivacyDialog } from './components/PrivacyDialog'
import { CollectionContent } from './features/collection/CollectionContent'
import { useCollectionView } from './features/collection/useCollectionView'
import { createBlankItem } from './lib/store'
import { useVault } from './lib/useVault'
import type { CollectionItem, ItemCategory, ItemStatus } from './lib/types'
import { CATEGORY_LABELS } from './lib/types'
import type { VaultDiagnosticsReport } from './lib/vaultDiagnostics'
import type { HistoryVersion } from './lib/vaultHistory'

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
    studioSuggestions,
  } = collection
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [selectedItemLoading, setSelectedItemLoading] = useState(false)
  const selectedItemRequest = useRef(0)
  const [editing, setEditing] = useState<{ item: CollectionItem; isNew: boolean } | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [diagnostics, setDiagnostics] = useState<VaultDiagnosticsReport | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [historyVersions, setHistoryVersions] = useState<HistoryVersion[] | null>(null)
  const [connectionGuideOpen, setConnectionGuideOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  const handleOpenHistory = async () => setHistoryVersions(await vault.getHistory())

  const title = category === 'all' ? '全部收藏' : CATEGORY_LABELS[category]

  const requestConnect = () => setConnectionGuideOpen(true)

  const connectFromGuide = async () => {
    if (await vault.connect()) setConnectionGuideOpen(false)
  }

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

  const handleSelectItem = async (item: CollectionItem) => {
    const request = ++selectedItemRequest.current
    // 原图读取期间先显示小图，不让裸文件名发起无效网络请求。
    setSelectedItem({ ...item, image: item.thumbnail ?? '' })
    setSelectedItemLoading(true)
    try {
      const loaded = await vault.loadHero(item)
      if (selectedItemRequest.current === request) {
        setSelectedItem((current) => (current?.id === item.id ? loaded : current))
      }
    } catch {
      // 单张原图读取失败时保留缩略图，不影响详情其余信息。
    } finally {
      if (selectedItemRequest.current === request) setSelectedItemLoading(false)
    }
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

  const handleRunDiagnostics = async () => {
    const report = await vault.diagnose()
    if (report) setDiagnostics(report)
  }

  const handleRepairDuplicateIds = async () => {
    if (!window.confirm('将保留每组第一条记录，并为后续重复资料生成新的唯一 ID。现有关系仍指向第一条记录，是否继续？')) return
    const report = await vault.repairDuplicateIds()
    if (report) setDiagnostics(report)
  }

  const handleCleanOrphans = async () => {
    if (!diagnostics) return
    const paths = diagnostics.issues
      .filter((issue) => issue.code === 'orphan-image' || issue.code === 'orphan-thumbnail')
      .map((issue) => issue.path)
    if (!paths.length) return
    if (!window.confirm(`将永久删除 ${paths.length} 个未被当前资料或历史记录引用的图片文件。建议先备份，是否继续？`)) return
    const report = await vault.cleanOrphanResources(paths)
    if (report) setDiagnostics(report)
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
        onConnectVault={requestConnect}
        onRequestDisconnect={() => setDisconnectOpen(true)}
        onExportZip={vault.exportZip}
        onImportZip={vault.importZip}
        onGenerateThumbnails={vault.generateThumbnails}
        onRunDiagnostics={() => void handleRunDiagnostics()}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onOpenHistory={() => void handleOpenHistory()}
        onOpenPrivacy={() => setPrivacyOpen(true)}
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
              onConnect={requestConnect}
              onOpenPrivacy={() => setPrivacyOpen(true)}
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
              onConnect={requestConnect}
              onNew={handleNew}
              onShowWishlist={() => setStatus('wishlist')}
              onSelectItem={(item) => void handleSelectItem(item)}
              onSave={vault.save}
            />
          </div>
        </main>

        <AIPanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          items={items}
          preferences={vault.preferences}
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
        onConnectVault={requestConnect}
        onRequestDisconnect={() => setDisconnectOpen(true)}
        onExportZip={vault.exportZip}
        onImportZip={vault.importZip}
        onGenerateThumbnails={vault.generateThumbnails}
        onRunDiagnostics={() => void handleRunDiagnostics()}
        onOpenPreferences={() => setPreferencesOpen(true)}
        onOpenHistory={() => void handleOpenHistory()}
        onOpenPrivacy={() => setPrivacyOpen(true)}
      />

      {selectedItem && !editing && (
        <ItemDetail
          item={selectedItem}
          readOnly={readOnly}
          onClose={() => {
            selectedItemRequest.current++
            setSelectedItem(null)
            setSelectedItemLoading(false)
          }}
          onEdit={readOnly || selectedItemLoading ? undefined : () => setEditing({ item: selectedItem, isNew: false })}
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
          quickStart={editing.isNew && items.length === 0}
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

      {diagnostics && (
        <VaultDiagnosticsDialog
          report={diagnostics}
          onClose={() => setDiagnostics(null)}
          onRepairDuplicateIds={handleRepairDuplicateIds}
          onCleanOrphans={handleCleanOrphans}
        />
      )}
      {preferencesOpen && (
        <PreferencesDialog preferences={vault.preferences} onClose={() => setPreferencesOpen(false)} onSave={async (next) => { await vault.savePreferences(next); setPreferencesOpen(false) }} />
      )}
      {historyVersions && (
        <HistoryDialog versions={historyVersions} items={items} onClose={() => setHistoryVersions(null)} onRestore={async (item, version) => {
          if (!window.confirm(`恢复「${item.name}」的这个历史版本？当前内容会先自动备份。`)) return
          await vault.restoreVersion(item, version)
          setHistoryVersions(await vault.getHistory())
        }} />
      )}
      {connectionGuideOpen && (
        <ConnectionGuideDialog
          supported={vault.supported}
          busy={vault.busy}
          onConnect={() => void connectFromGuide()}
          onClose={() => setConnectionGuideOpen(false)}
          onOpenPrivacy={() => setPrivacyOpen(true)}
        />
      )}
      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </div>
  )
}
