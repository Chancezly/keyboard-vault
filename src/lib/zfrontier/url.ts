import type { ItemCategory } from '../types'

export interface ZfParsedLink {
  kind: 'flow' | 'eqp'
  hashId: string
  url: string
}

const LINK_RE =
  /(?:https?:\/\/)?(?:www\.)?zfrontier\.com\/app\/(flow|eqp)\/([A-Za-z0-9]+)/i

export function parseZFrontierLink(input: string): ZfParsedLink | null {
  const m = input.match(LINK_RE)
  if (!m) return null
  const kind = m[1].toLowerCase() as 'flow' | 'eqp'
  const hashId = m[2]
  return {
    kind,
    hashId,
    url: `https://www.zfrontier.com/app/${kind}/${hashId}`,
  }
}

export interface AddWishlistIntent {
  url: string
  link: ZfParsedLink
  category?: ItemCategory
}

function inferCategoryFromText(text: string): ItemCategory | undefined {
  if (/套件|键盘(?:kit)?/i.test(text)) return 'keyboards'
  if (/键帽|keycap/i.test(text)) return 'keycaps'
  if (/轴体|switch/i.test(text)) return 'switches'
  return undefined
}

/** 识别「帮我把链接中的套件/键帽/轴体加入愿望单 + zFrontier URL」 */
export function parseAddWishlistIntent(text: string): AddWishlistIntent | null {
  const trimmed = text.trim()
  const link = parseZFrontierLink(trimmed)
  if (!link) return null

  const wantsWishlist =
    /愿望单|心愿单/i.test(trimmed) &&
    /(?:帮我把|加入|添加|增加到|导入|放进|加到)/i.test(trimmed)

  if (!wantsWishlist) return null

  return {
    url: link.url,
    link,
    category: inferCategoryFromText(trimmed),
  }
}

export function isWishlistImportMessage(text: string): boolean {
  return parseAddWishlistIntent(text) != null
}
