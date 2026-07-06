export type ItemCategory = 'keyboards' | 'keycaps' | 'switches' | 'builds'

export type ItemStatus = 'owned' | 'wishlist' | 'sold' | 'building'

export interface ItemRelation {
  role: string
  ref: string
  name?: string
  category?: ItemCategory
}

export interface HistoryEvent {
  date?: string
  event: string
  note?: string
  price?: number
  currency?: string
}

export interface RatingDetail {
  overall?: number
  sound?: number
  feel?: number
  build?: number
  aesthetics?: number
  scale: number
}

export interface TagGroup {
  group: string
  values: string[]
}

export interface CollectionItem {
  id: string
  name: string
  brand: string
  category: ItemCategory
  status: ItemStatus
  condition?: string
  location?: string
  tags: string[]
  tagGroups: TagGroup[]
  image: string
  images: string[]
  rating?: number
  ratingDetail?: RatingDetail
  acquired?: string
  price?: number
  currency?: string
  layout?: string
  mount?: string
  material?: string
  profile?: string
  switchType?: string
  formFactor?: string
  soundProfile?: string
  feelProfile?: string
  relations: ItemRelation[]
  history: HistoryEvent[]
  content: string
  filePath: string
}

export interface UserPreferences {
  favoriteLayouts: string[]
  favoriteProfiles: string[]
  favoriteSwitchTypes: string[]
  favoriteBrands: string[]
  budgetRange: [number, number]
  notes: string
}

export type ViewMode = 'grid' | 'list'

export interface FilterState {
  category: ItemCategory | 'all'
  status: ItemStatus | 'all'
  search: string
  tags: string[]
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  keyboards: '键盘',
  keycaps: '键帽',
  switches: '轴体',
  builds: '搭配',
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  owned: '已拥有',
  wishlist: '心愿单',
  sold: '已出',
  building: '搭建中',
}

export const STATUS_COLORS: Record<ItemStatus, string> = {
  owned: 'bg-emerald-500/20 text-emerald-300',
  wishlist: 'bg-amber-500/20 text-amber-300',
  sold: 'bg-zinc-500/20 text-zinc-400',
  building: 'bg-accent/20 text-accent',
}

export const RELATION_LABELS: Record<string, string> = {
  keyboard: '键盘',
  keycaps: '键帽',
  switches: '轴体',
  stabilizers: '卫星轴',
  plate: '定位板',
  case: '外壳',
}

export const HISTORY_LABELS: Record<string, string> = {
  assembled: '组装',
  acquired: '购入',
  displayed: '展示',
  modded: '改装',
  reworked: '重组',
  sold: '出售',
  lubed: '润轴',
}

export const RATING_DIMENSION_LABELS: Record<string, string> = {
  sound: '声音',
  feel: '手感',
  build: '做工',
  aesthetics: '外观',
}
