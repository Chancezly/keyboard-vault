import { stringify } from 'yaml'
import type { CollectionItem } from './types'
import { normalizeRatingDetail } from './types'
import { itemDisplayBasename } from './naming'
import { getBuildComposition } from './builds'

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

function cleanPart(part: Record<string, unknown>): Record<string, unknown> {
  return clean(part) as Record<string, unknown>
}

export function serializeItem(item: CollectionItem): string {
  const isBuild = item.category === 'builds'

  const identity = clean({
    id: item.id,
    name: isBuild ? (item.name.trim() || undefined) : item.name,
    brand: isBuild ? undefined : item.brand,
    type: isBuild ? 'build' : undefined,
  })

  const specification = isBuild
    ? {}
    : clean({
        layout: item.layout,
        formFactor: item.formFactor,
        mount: item.mount,
        plate: item.plate,
        filling: item.filling,
        pcbThickness: item.pcbThickness,
        weight: item.weight,
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

  const state = isBuild
    ? {}
    : clean({
        status: item.status,
        condition: item.condition,
        price: item.price,
        soldPrice: item.status === 'sold' ? item.soldPrice : undefined,
        currency: item.price != null || item.soldPrice != null ? item.currency : undefined,
        acquired: item.acquired,
        addedAt: item.addedAt,
      })

  let composition: Record<string, unknown> | undefined
  const relations: Record<string, string> = {}

  if (isBuild) {
    const c = getBuildComposition(item)
    composition = {
      keyboard: cleanPart({ ...c.keyboard }),
      switches: cleanPart({ ...c.switches }),
      keycaps: cleanPart({ ...c.keycaps }),
    }
    if (c.keyboard.name) relations.keyboard = c.keyboard.sourceId ?? c.keyboard.name
    if (c.switches.name) relations.switches = c.switches.sourceId ?? c.switches.name
    if (c.keycaps.name) relations.keycaps = c.keycaps.sourceId ?? c.keycaps.name
  } else {
    for (const rel of item.relations) relations[rel.role] = rel.ref
  }

  const fit = isBuild ? item.fitRating ?? item.rating : undefined
  const normalizedRating = isBuild
    ? fit != null
      ? { overall: fit, scale: 5 }
      : {}
    : (() => {
        const n = normalizeRatingDetail(item.ratingDetail)
        if (n) {
          return clean({
            overall: n.overall,
            sound: n.sound,
            feel: n.feel,
            build: n.build,
            aesthetics: n.aesthetics,
            scale: n.scale,
          })
        }
        return item.rating != null ? { overall: item.rating, scale: 5 } : {}
      })()

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
  if (composition) frontmatter.composition = composition
  if (Object.keys(relations).length) frontmatter.relations = relations
  if (Object.keys(normalizedRating).length) frontmatter.rating = normalizedRating
  if (Object.keys(tags).length) frontmatter.tags = tags
  if (!isBuild && item.history.length) frontmatter.history = item.history
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
  const slug = itemDisplayBasename(item)
  a.href = url
  a.download = `${slug}.md`
  a.click()
  URL.revokeObjectURL(url)
}
