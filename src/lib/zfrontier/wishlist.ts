import type { CollectionItem, ItemCategory } from '../types'
import { CATEGORY_LABELS } from '../types'
import {
  absolutizeImageUrl,
  fetchFlowDetail,
  resetZfSession,
} from './client'
import { fetchImageBytes } from '../fetchImage'
import {
  extractKitName,
  extractStudio,
  extractLayoutFromName,
  extractWeight,
  extractPlate,
  extractProfile,
  extractKeycapMaterial,
  extractSwitchType,
  extractPriceInfo,
  getFlowFullText,
} from './extract'
import type { ZfFlowDetail } from './types'
import { parseZFrontierLink, type AddWishlistIntent } from './url'

export type { AddWishlistIntent }
export { parseAddWishlistIntent, isWishlistImportMessage } from './url'

const ID_PREFIX: Record<ItemCategory, string> = {
  keyboards: 'kb',
  keycaps: 'kc',
  switches: 'sw',
  builds: 'bd',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nextItemId(items: CollectionItem[], category: ItemCategory): string {
  const prefix = ID_PREFIX[category]
  let max = 0
  for (const item of items) {
    const m = item.id.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

function inferCategoryFromFlow(detail: ZfFlowDetail, hint?: ItemCategory): ItemCategory {
  if (hint) return hint

  const title = detail.flow.title ?? ''
  const text = detail.flow.text ?? detail.flow.item?.article?.text ?? ''
  const blob = `${title} ${text}`

  if (/键帽|keycap|\bGMK\b|\bPBT\b|\bABS\b/i.test(blob) && !/套件|键盘\s*kit|客制化键盘/i.test(title)) {
    return 'keycaps'
  }
  if (/轴体|\bswitch\b|线性轴|段落轴|静音轴/i.test(blob)) return 'switches'
  return 'keyboards'
}

async function pickHeroImage(detail: ZfFlowDetail): Promise<string | null> {
  const flow = detail.flow
  const raw = [
    flow.item?.equips?.[0]?.coverpic,
    ...(flow.imgs ?? []),
    flow.share_config?.bigCover?.split('?')[0],
    flow.share_config?.thumb?.split('?')[0],
  ].filter(Boolean) as string[]

  const seen = new Set<string>()
  const candidates = raw.filter((ref) => {
    const key = absolutizeImageUrl(ref).split('?')[0]
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  for (const ref of candidates) {
    const abs = absolutizeImageUrl(ref)
    const fetched = await fetchImageBytes(abs)
    if (fetched) return abs
  }

  if (candidates[0]) return absolutizeImageUrl(candidates[0])
  return null
}

export interface ImportWishlistResult {
  item: CollectionItem
  sourceUrl: string
  matchedTitle: string
  categoryLabel: string
  imageFileName?: string
}

export async function importFromZFrontierLink(
  intent: AddWishlistIntent,
  existingItems: CollectionItem[],
): Promise<ImportWishlistResult> {
  const parsed = intent.link ?? parseZFrontierLink(intent.url)
  if (!parsed) {
    throw new Error('无法识别 zFrontier 链接，请使用 www.zfrontier.com/app/flow/… 格式的帖子链接')
  }
  if (parsed.kind === 'eqp') {
    throw new Error('暂不支持装备详情页链接，请粘贴对应的 GB 帖子链接（/app/flow/…）')
  }

  resetZfSession()
  const detail = await fetchFlowDetail(parsed.hashId)
  const category = inferCategoryFromFlow(detail, intent.category)
  const text = getFlowFullText(detail)
  const priceInfo = extractPriceInfo(text)
  const name = extractKitName(detail)
  const brand = extractStudio(detail, text)
  const sourceUrl = parsed.url

  const duplicate = existingItems.find(
    (i) =>
      i.category === category &&
      i.name.toLowerCase() === name.toLowerCase(),
  )
  if (duplicate) {
    throw new Error(
      `「${duplicate.name}」已在收藏库中（${duplicate.status === 'wishlist' ? '心愿单' : duplicate.status}）`,
    )
  }

  const id = nextItemId(existingItems, category)
  const slug = slugify(name) || id
  const hero = await pickHeroImage(detail)
  const heroExt =
    hero?.match(/^data:image\/(\w+)/)?.[1]?.replace('jpeg', 'jpg') ??
    hero?.match(/\.(\w+)(?:\?|$)/)?.[1]?.replace('jpeg', 'jpg') ??
    'jpg'

  if (!hero) {
    throw new Error('该帖子没有可用主图，请换一条 zFrontier 帖子链接')
  }

  const item: CollectionItem = {
    id,
    name,
    brand,
    category,
    status: 'wishlist',
    tags: [],
    tagGroups: [],
    image: hero,
    images: [hero],
    relations: [],
    history:
      priceInfo.price != null || priceInfo.note
        ? [
            {
              event: '参考价',
              price: priceInfo.price,
              currency: priceInfo.currency,
              note: priceInfo.note,
            },
          ]
        : [],
    price: priceInfo.price,
    currency: priceInfo.price != null ? priceInfo.currency : undefined,
    content: '',
    filePath: `../../vault/${category}/${slug}.md`,
    addedAt: new Date().toISOString().slice(0, 10),
  }

  if (category === 'keyboards') {
    item.layout = extractLayoutFromName(name, text)
    item.weight = extractWeight(text)
    const plate = extractPlate(text)
    if (plate) item.plate = plate
  } else if (category === 'keycaps') {
    item.profile = extractProfile(text)
    item.material = extractKeycapMaterial(text)
  } else if (category === 'switches') {
    item.switchType = extractSwitchType(text)
    item.manufacturer = brand || undefined
  }

  return {
    item,
    sourceUrl,
    matchedTitle: name,
    categoryLabel: CATEGORY_LABELS[category],
    imageFileName: `${slug}.${heroExt}`,
  }
}
