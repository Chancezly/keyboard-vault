import { parse as parseYaml } from 'yaml'
import type {
  BuildComposition,
  BuildKeycapPart,
  BuildKeyboardPart,
  BuildSwitchPart,
  CollectionItem,
  HistoryEvent,
  ItemCategory,
  ItemRelation,
  RatingDetail,
  TagGroup,
  UserPreferences,
} from './types'
import { normalizeStatus, normalizeRatingDetail, RATING_DIMENSIONS } from './types'

interface ItemFrontmatter {
  identity?: {
    id?: string
    name?: string
    brand?: string
    maker?: string
    type?: string
    status?: string
  }
  specification?: {
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
  }
  state?: {
    status?: string
    condition?: string
    location?: string
    inUse?: boolean
    price?: number
    soldPrice?: number
    currency?: string
    acquired?: string
    addedAt?: string
  }
  build?: {
    acquired?: string
    price?: number
    currency?: string
  }
  composition?: {
    keyboard?: Partial<BuildKeyboardPart>
    switches?: Partial<BuildSwitchPart>
    keycaps?: Partial<BuildKeycapPart>
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
  const detail: RatingDetail = {
    overall: rating.overall ?? rating.score,
    sound: rating.sound,
    feel: rating.feel,
    build: rating.build,
    aesthetics: rating.aesthetics,
    scale,
  }
  const hasDimensions = RATING_DIMENSIONS.some((d) => detail[d] != null)
  if (detail.overall == null && !hasDimensions) return undefined
  return normalizeRatingDetail(detail)
}

function parseComposition(
  fm: ItemFrontmatter,
  relations: ItemRelation[],
): BuildComposition | undefined {
  const c = fm.composition
  if (c?.keyboard || c?.switches || c?.keycaps) {
    const findName = (role: string) =>
      relations.find((r) => r.role === role)?.name ??
      relations.find((r) => r.role === role)?.ref ??
      ''
    return {
      keyboard: {
        name: c.keyboard?.name?.trim() || findName('keyboard'),
        brand: c.keyboard?.brand,
        plate: c.keyboard?.plate,
        pcbThickness: c.keyboard?.pcbThickness,
        sourceId: c.keyboard?.sourceId,
      },
      switches: {
        name: c.switches?.name?.trim() || findName('switches'),
        actuation: c.switches?.actuation,
        sourceId: c.switches?.sourceId,
      },
      keycaps: {
        name: c.keycaps?.name?.trim() || findName('keycaps'),
        profile: c.keycaps?.profile,
        material: c.keycaps?.material,
        sourceId: c.keycaps?.sourceId,
      },
    }
  }

  if (!relations.length) return undefined

  const byRole = (role: string) => relations.find((r) => r.role === role)
  const kb = byRole('keyboard')
  const sw = byRole('switches')
  const kc = byRole('keycaps')
  if (!kb && !sw && !kc) return undefined

  return {
    keyboard: { name: kb?.name ?? kb?.ref ?? '', sourceId: kb?.ref },
    switches: { name: sw?.name ?? sw?.ref ?? '', sourceId: sw?.ref },
    keycaps: { name: kc?.name ?? kc?.ref ?? '', sourceId: kc?.ref },
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
  const relations = normalizeRelations(fm.relations)

  const acquisition = history.find((h) => h.price != null) ?? history.find((h) => h.date)
  const acquired = state.acquired ?? legacyBuild.acquired ?? acquisition?.date
  const addedAt = state.addedAt
  const price = state.price ?? legacyBuild.price ?? acquisition?.price
  const soldPrice = state.soldPrice
  const currency = state.currency ?? legacyBuild.currency ?? acquisition?.currency ?? 'CNY'

  const ratingDetail = buildRatingDetail(fm.rating)
  const isBuild = category === 'builds'
  const fitRating = isBuild ? ratingDetail?.overall : undefined
  const buildComposition = isBuild ? parseComposition(fm, relations) : undefined

  return {
    id: identity.id ?? filePath,
    name: identity.name ?? (isBuild ? '' : 'Untitled'),
    brand: identity.brand ?? identity.maker ?? (isBuild ? '' : 'Unknown'),
    category,
    status: normalizeStatus(state.status ?? identity.status),
    condition: state.condition,
    location: state.location,
    tags,
    tagGroups,
    image: images[0] ?? '',
    images,
    rating: isBuild ? fitRating : ratingDetail?.overall,
    ratingDetail: isBuild
      ? fitRating != null
        ? { overall: fitRating, scale: 5 }
        : undefined
      : ratingDetail,
    fitRating,
    acquired,
    addedAt,
    price,
    soldPrice,
    currency,
    layout: specification.layout,
    mount: specification.mount,
    plate: specification.plate,
    filling: specification.filling,
    pcbThickness: specification.pcbThickness,
    weight: specification.weight ?? (category === 'keyboards' ? specification.material : undefined),
    material: category === 'keyboards' ? undefined : specification.material,
    profile: specification.profile,
    switchType: specification.switchType,
    color: specification.color,
    actuation: specification.actuation,
    formFactor: specification.formFactor,
    soundProfile: specification.soundProfile,
    feelProfile: specification.feelProfile,
    manufacturer: specification.manufacturer,
    bottomOut: specification.bottomOut,
    preTravel: specification.preTravel,
    bottomTravel: specification.bottomTravel,
    spring: specification.spring,
    lube: specification.lube,
    soundTendency: specification.soundTendency,
    relations,
    buildComposition,
    history,
    content,
    filePath,
    sourceFrontmatter: data,
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
