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

function mergeSection(
  original: unknown,
  replacement: Record<string, unknown>,
  knownKeys: string[],
): Record<string, unknown> {
  const merged = original && typeof original === 'object' && !Array.isArray(original)
    ? { ...(original as Record<string, unknown>) }
    : {}
  for (const key of knownKeys) delete merged[key]
  return { ...merged, ...replacement }
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
        location: item.location,
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

  const frontmatter: Record<string, unknown> = { ...(item.sourceFrontmatter ?? {}) }
  frontmatter.identity = mergeSection(frontmatter.identity, identity, ['id', 'name', 'brand', 'maker', 'type', 'status'])
  if (!isBuild) {
    const mergedSpecification = mergeSection(frontmatter.specification, specification, [
      'layout', 'formFactor', 'mount', 'plate', 'filling', 'pcbThickness', 'weight', 'material',
      'profile', 'switchType', 'color', 'manufacturer', 'actuation', 'bottomOut', 'preTravel',
      'bottomTravel', 'spring', 'lube', 'soundTendency', 'soundProfile', 'feelProfile',
    ])
    if (Object.keys(mergedSpecification).length) frontmatter.specification = mergedSpecification
    else delete frontmatter.specification
    const mergedState = mergeSection(frontmatter.state, state, [
      'status', 'condition', 'location', 'inUse', 'price', 'soldPrice', 'currency', 'acquired', 'addedAt',
    ])
    if (Object.keys(mergedState).length) frontmatter.state = mergedState
    else delete frontmatter.state
  }
  if (composition) frontmatter.composition = mergeSection(frontmatter.composition, composition, ['keyboard', 'switches', 'keycaps'])
  if (Object.keys(relations).length) frontmatter.relations = relations
  else delete frontmatter.relations
  if (Object.keys(normalizedRating).length) frontmatter.rating = mergeSection(frontmatter.rating, normalizedRating, ['score', 'overall', 'sound', 'feel', 'build', 'aesthetics', 'scale'])
  else delete frontmatter.rating
  if (Object.keys(tags).length) frontmatter.tags = tags
  else delete frontmatter.tags
  if (!isBuild && item.history.length) frontmatter.history = item.history
  else if (!isBuild) delete frontmatter.history
  if (Object.keys(images).length) frontmatter.images = mergeSection(frontmatter.images, images, ['hero', 'gallery'])
  else delete frontmatter.images

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
