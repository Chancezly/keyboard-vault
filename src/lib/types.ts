export type ItemCategory = 'keyboards' | 'keycaps' | 'switches' | 'builds'

export type ItemStatus = 'in-use' | 'collection' | 'wishlist' | 'sold'

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

export const RATING_DIMENSIONS = ['sound', 'feel', 'build', 'aesthetics'] as const
export type RatingDimension = (typeof RATING_DIMENSIONS)[number]

/** 各维度等权平均得出总分（仅统计已填维度） */
export function computeOverallRating(detail: Pick<RatingDetail, RatingDimension> | undefined): number | undefined {
  if (!detail) return undefined
  const values = RATING_DIMENSIONS.map((d) => detail[d]).filter((v): v is number => v != null)
  if (values.length === 0) return undefined
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.round(avg * 2) / 2
}

/** 有维度评分时自动覆盖 overall，无维度时保留旧数据里的 overall */
export function normalizeRatingDetail(detail: RatingDetail | undefined): RatingDetail | undefined {
  if (!detail) return undefined
  const scale = detail.scale ?? 5
  const hasDimension = RATING_DIMENSIONS.some((d) => detail[d] != null)
  if (hasDimension) {
    return { ...detail, scale, overall: computeOverallRating(detail) }
  }
  if (detail.overall != null) return { ...detail, scale }
  return undefined
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
  /** 加入收藏库日期 YYYY-MM-DD */
  addedAt?: string
  price?: number
  soldPrice?: number
  currency?: string
  layout?: string
  mount?: string
  plate?: string
  filling?: string
  pcbThickness?: string
  weight?: string
  material?: string
  profile?: string
  switchType?: string
  color?: string
  actuation?: string
  formFactor?: string
  soundProfile?: string
  feelProfile?: string
  manufacturer?: string
  bottomOut?: string
  preTravel?: string
  bottomTravel?: string
  spring?: string
  lube?: string
  soundTendency?: number
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
  keyboards: '套件',
  keycaps: '键帽',
  switches: '轴体',
  builds: '搭配',
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  'in-use': '使用中',
  collection: '收藏中',
  wishlist: '心愿单',
  sold: '已售出',
}

export type SortOption = 'name' | 'addedAt' | 'acquired'

export const SORT_LABELS: Record<SortOption, string> = {
  name: '按名称',
  addedAt: '按添加时间',
  acquired: '按购买时间',
}

export const STATUS_COLORS: Record<ItemStatus, string> = {
  'in-use': 'bg-emerald-500/20 text-emerald-300',
  collection: 'bg-accent/20 text-accent',
  wishlist: 'bg-amber-500/20 text-amber-300',
  sold: 'bg-zinc-500/20 text-zinc-400',
}

// 卡片封面上的状态徽章：更高对比度、更易辨认
export const STATUS_BADGE_COLORS: Record<ItemStatus, string> = {
  'in-use': 'bg-emerald-500/90 text-white shadow-emerald-500/30',
  collection: 'bg-accent/90 text-white shadow-accent/30',
  wishlist: 'bg-amber-500/90 text-white shadow-amber-500/30',
  sold: 'bg-zinc-600/90 text-zinc-100 shadow-black/30',
}

// 兼容旧数据里的状态取值
export const LEGACY_STATUS_MAP: Record<string, ItemStatus> = {
  owned: 'collection',
  building: 'in-use',
  'in-use': 'in-use',
  collection: 'collection',
  wishlist: 'wishlist',
  sold: 'sold',
}

export function normalizeStatus(raw?: string): ItemStatus {
  return (raw && LEGACY_STATUS_MAP[raw]) || 'collection'
}

export const RELATION_LABELS: Record<string, string> = {
  keyboard: '套件',
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

// 轴体音色取向：1=脆 → 5=闷
export const SOUND_TENDENCY_LABELS: Record<number, string> = {
  1: '脆',
  2: '偏脆',
  3: '中频',
  4: '偏闷',
  5: '闷',
}

export const RATING_DIMENSION_LABELS: Record<string, string> = {
  sound: '声音',
  feel: '手感',
  build: '做工',
  aesthetics: '外观',
}

export const PCB_THICKNESS_OPTIONS = ['1.2mm', '1.6mm']
export const PLATE_OPTIONS = ['Fr4', '铝', 'PP', 'PC', '碳纤维', '铜']
export const FILLING_OPTIONS = ['全棉', '无棉']
export const WEIGHT_OPTIONS = ['无', '铝', '铜', '刀纹', 'PVD']

export type SpecFieldKey =
  | 'layout'
  | 'mount'
  | 'plate'
  | 'filling'
  | 'pcbThickness'
  | 'weight'
  | 'material'
  | 'profile'
  | 'switchType'
  | 'color'
  | 'actuation'
  | 'formFactor'
  | 'manufacturer'
  | 'bottomOut'
  | 'preTravel'
  | 'bottomTravel'
  | 'spring'
  | 'lube'

export interface SpecFieldConfig {
  key: SpecFieldKey
  label: string
  placeholder: string
}

// 各分类在编辑区展示的规格字段
export const CATEGORY_SPEC_FIELDS: Record<ItemCategory, SpecFieldConfig[]> = {
  keyboards: [
    { key: 'layout', label: '配列', placeholder: '65%' },
    { key: 'weight', label: '配重', placeholder: '铝' },
    { key: 'plate', label: '定位板', placeholder: 'Fr4' },
    { key: 'pcbThickness', label: 'PCB厚度', placeholder: '1.6mm' },
    { key: 'filling', label: '填充', placeholder: '全棉' },
  ],
  keycaps: [
    { key: 'profile', label: '高度', placeholder: 'Cherry / KCA' },
    { key: 'material', label: '材质', placeholder: 'PBT / ABS' },
  ],
  switches: [
    { key: 'manufacturer', label: '代工厂', placeholder: 'JWK / Gateron' },
    { key: 'color', label: '颜色', placeholder: '黑 / 白' },
    { key: 'material', label: '材质', placeholder: 'nylon / PC' },
    { key: 'actuation', label: '触发压力', placeholder: '50g' },
    { key: 'bottomOut', label: '触底压力', placeholder: '62g' },
    { key: 'preTravel', label: '触发行程', placeholder: '2.0mm' },
    { key: 'bottomTravel', label: '触底行程', placeholder: '4.0mm' },
    { key: 'spring', label: '弹簧属性', placeholder: '双段长弹簧' },
    { key: 'lube', label: '润滑方案', placeholder: '出厂润 / 手动 205g0' },
  ],
  builds: [],
}

export const SPEC_FIELD_LABELS: Record<SpecFieldKey, string> = {
  layout: '配列',
  mount: '结构',
  plate: '定位板',
  pcbThickness: 'PCB厚度',
  filling: '填充',
  weight: '配重',
  material: '材质',
  profile: '高度',
  switchType: '类型',
  color: '颜色',
  actuation: '触发压力',
  formFactor: '尺寸',
  manufacturer: '代工厂',
  bottomOut: '触底压力',
  preTravel: '触发行程',
  bottomTravel: '触底行程',
  spring: '弹簧属性',
  lube: '润滑方案',
}
