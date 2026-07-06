import { stringify } from 'yaml'
import type { CollectionItem } from './types'
import { normalizeRatingDetail } from './types'

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
    out[k] = v
  }
  return out as Partial<T>
}

export function serializeItem(item: CollectionItem): string {
  const identity = clean({
    id: item.id,
    name: item.name,
    brand: item.brand,
    type: item.category === 'builds' ? 'build' : undefined,
  })

  const specification = clean({
    layout: item.layout,
    formFactor: item.formFactor,
    mount: item.mount,
    material: item.material,
    profile: item.profile,
    switchType: item.switchType,
    color: item.color,
    manufacturer: item.manufacturer,
    actuation: item.actuation,
    bottomOut: item.bottomOut,
    preTravel: item.preTravel,
    bottomTravel: item.bottomTravel,
    spring: item.spring,
    lube: item.lube,
    soundTendency: item.soundTendency,
    soundProfile: item.soundProfile,
    feelProfile: item.feelProfile,
  })

  const state = clean({
    status: item.status,
    condition: item.condition,
    price: item.price,
    soldPrice: item.status === 'sold' ? item.soldPrice : undefined,
    currency: item.price != null || item.soldPrice != null ? item.currency : undefined,
  })

  const relations: Record<string, string> = {}
  for (const rel of item.relations) relations[rel.role] = rel.ref

  const normalizedRating = normalizeRatingDetail(item.ratingDetail)
  const rating = normalizedRating
    ? clean({
        overall: normalizedRating.overall,
        sound: normalizedRating.sound,
        feel: normalizedRating.feel,
        build: normalizedRating.build,
        aesthetics: normalizedRating.aesthetics,
        scale: normalizedRating.scale,
      })
    : item.rating != null
      ? { overall: item.rating, scale: 5 }
      : {}

  const tags: Record<string, string[]> = {}
  for (const tg of item.tagGroups) {
    if (tg.values.length) tags[tg.group || 'tags'] = tg.values
  }

  const images = clean({
    hero: item.images[0],
    gallery: item.images.slice(1),
  })

  const frontmatter: Record<string, unknown> = { identity }
  if (Object.keys(specification).length) frontmatter.specification = specification
  if (Object.keys(state).length) frontmatter.state = state
  if (Object.keys(relations).length) frontmatter.relations = relations
  if (Object.keys(rating).length) frontmatter.rating = rating
  if (Object.keys(tags).length) frontmatter.tags = tags
  if (item.history.length) frontmatter.history = item.history
  if (Object.keys(images).length) frontmatter.images = images
  frontmatter.ai = {
    summary: '',
    suggestedTags: [],
    recommendation: '',
    model: '',
    generatedAt: null,
  }

  const yaml = stringify(frontmatter).trimEnd()
  return `---\n${yaml}\n---\n\n${item.content.trim()}\n`
}

export function downloadMarkdown(item: CollectionItem) {
  const md = serializeItem(item)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const slug = item.id || item.name.toLowerCase().replace(/\s+/g, '-')
  a.href = url
  a.download = `${slug}.md`
  a.click()
  URL.revokeObjectURL(url)
}
