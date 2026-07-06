import { parse as parseYaml } from 'yaml'
import type {
  CollectionItem,
  HistoryEvent,
  ItemCategory,
  ItemRelation,
  ItemStatus,
  RatingDetail,
  TagGroup,
  UserPreferences,
} from './types'

interface ItemFrontmatter {
  identity?: {
    id?: string
    name?: string
    brand?: string
    maker?: string
    type?: string
    status?: ItemStatus
  }
  specification?: {
    layout?: string
    mount?: string
    material?: string
    profile?: string
    switchType?: string
    formFactor?: string
    soundProfile?: string
    feelProfile?: string
  }
  state?: {
    status?: ItemStatus
    condition?: string
    location?: string
    inUse?: boolean
  }
  build?: {
    acquired?: string
    price?: number
    currency?: string
  }
  relations?: Record<string, string>
  rating?: {
    score?: number
    overall?: number
    sound?: number
    feel?: number
    build?: number
    aesthetics?: number
    scale?: number
  }
  tags?: string[] | Record<string, string[]>
  history?: HistoryEvent[]
  images?: {
    hero?: string
    gallery?: string[]
  }
  notes?: Record<string, unknown>
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/)
  if (!match) {
    return { data: {}, content: raw.trim() }
  }

  const data = (parseYaml(match[1]) ?? {}) as Record<string, unknown>
  return { data, content: match[2].trim() }
}

function normalizeTags(tags: ItemFrontmatter['tags']): { flat: string[]; groups: TagGroup[] } {
  if (!tags) return { flat: [], groups: [] }

  if (Array.isArray(tags)) {
    return { flat: tags, groups: tags.length ? [{ group: '', values: tags }] : [] }
  }

  const groups: TagGroup[] = []
  const flat: string[] = []
  for (const [group, values] of Object.entries(tags)) {
    const list = Array.isArray(values) ? values : []
    if (!list.length) continue
    groups.push({ group, values: list })
    flat.push(...list)
  }
  return { flat, groups }
}

function normalizeRelations(relations: ItemFrontmatter['relations']): ItemRelation[] {
  if (!relations) return []
  return Object.entries(relations)
    .filter(([, ref]) => Boolean(ref))
    .map(([role, ref]) => ({ role, ref }))
}

function buildRatingDetail(rating: ItemFrontmatter['rating']): RatingDetail | undefined {
  if (!rating) return undefined
  const scale = rating.scale ?? 5
  const overall = rating.overall ?? rating.score
  const hasDimensions =
    rating.sound != null ||
    rating.feel != null ||
    rating.build != null ||
    rating.aesthetics != null
  if (overall == null && !hasDimensions) return undefined

  return {
    overall,
    sound: rating.sound,
    feel: rating.feel,
    build: rating.build,
    aesthetics: rating.aesthetics,
    scale,
  }
}

export function parseItemMarkdown(
  raw: string,
  category: ItemCategory,
  filePath: string,
): CollectionItem {
  const { data, content } = parseFrontmatter(raw)
  const fm = data as unknown as ItemFrontmatter
  const identity = fm.identity ?? {}
  const specification = fm.specification ?? {}
  const state = fm.state ?? {}
  const legacyBuild = fm.build ?? {}
  const history = fm.history ?? []
  const images = [fm.images?.hero, ...(fm.images?.gallery ?? [])].filter(Boolean) as string[]
  const { flat: tags, groups: tagGroups } = normalizeTags(fm.tags)

  const acquisition = history.find((h) => h.price != null) ?? history.find((h) => h.date)
  const acquired = legacyBuild.acquired ?? acquisition?.date
  const price = legacyBuild.price ?? acquisition?.price
  const currency = legacyBuild.currency ?? acquisition?.currency ?? 'CNY'

  const ratingDetail = buildRatingDetail(fm.rating)

  return {
    id: identity.id ?? filePath,
    name: identity.name ?? 'Untitled',
    brand: identity.brand ?? identity.maker ?? 'Unknown',
    category,
    status: state.status ?? identity.status ?? 'owned',
    condition: state.condition,
    location: state.location,
    tags,
    tagGroups,
    image: images[0] ?? '',
    images,
    rating: ratingDetail?.overall,
    ratingDetail,
    acquired,
    price,
    currency,
    layout: specification.layout,
    mount: specification.mount,
    material: specification.material,
    profile: specification.profile,
    switchType: specification.switchType,
    formFactor: specification.formFactor,
    soundProfile: specification.soundProfile,
    feelProfile: specification.feelProfile,
    relations: normalizeRelations(fm.relations),
    history,
    content,
    filePath,
  }
}

export function parsePreferencesMarkdown(raw: string): UserPreferences {
  const { data, content } = parseFrontmatter(raw)
  const specification = (data.specification as Record<string, unknown> | undefined) ?? data

  return {
    favoriteLayouts: (specification.favoriteLayouts as string[]) ?? [],
    favoriteProfiles: (specification.favoriteProfiles as string[]) ?? [],
    favoriteSwitchTypes: (specification.favoriteSwitchTypes as string[]) ?? [],
    favoriteBrands: (specification.favoriteBrands as string[]) ?? [],
    budgetRange: (specification.budgetRange as [number, number]) ?? [0, 5000],
    notes: content,
  }
}
