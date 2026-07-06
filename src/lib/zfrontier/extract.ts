import type { ZfFlowDetail } from './types'

/** 去掉 GB 前缀与尾部宣传语，取套件名 */
export function extractKitName(detail: ZfFlowDetail): string {
  const equips = detail.flow.item?.equips ?? []
  const fromEquip = equips.find((e) => e.name && !/交流群|随机色/.test(e.name))
  if (fromEquip?.name) return fromEquip.name.trim()

  const raw = detail.flow.title ?? detail.flow.item?.title ?? ''
  let name = raw
    .replace(/^【\s*GB\s*】/i, '')
    .replace(/^\[\s*GB\s*\]/i, '')
    .trim()
  name = name.split(/[，,！!？?；;]/)[0].trim()
  return name || '未命名'
}

/** 发帖人昵称 → 工作室 */
export function extractStudio(detail: ZfFlowDetail, text: string): string {
  const nickname = detail.flow.user?.nickname?.trim()
  if (nickname) return nickname

  if (/neo\s*studio|qwertykeys/i.test(text)) return 'Neo Studio'
  const brandMatch = text.match(/(?:这里是|来自)\s*([A-Za-z\s]+Studio|[A-Za-z]+(?:\s+Studio)?)/i)
  if (brandMatch) return brandMatch[1].trim()
  return ''
}

const LAYOUT_BY_SIZE: Record<string, string> = {
  '104': '104%',
  '100': '104%',
  '98': '98%',
  '96': '98%',
  '80': 'TKL',
  '75': '75%',
  '68': '68%',
  '67': '65%',
  '65': '65%',
  '64': '60%',
  '60': '60%',
}

/** 从套件名称中的数字推断配列，如 80 → TKL */
export function extractLayoutFromName(name: string, text = ''): string | undefined {
  const blob = `${name} ${text}`
  if (/alice|人体工学/i.test(blob)) return 'Alice'
  if (/\btkl\b|tenkeyless/i.test(blob)) return 'TKL'

  const pct = blob.match(/(\d{2,3})\s*%/)
  if (pct) return `${pct[1]}%`

  const sizeInName = name.match(/\b(104|100|98|96|80|75|68|67|65|64|60)\b/)
  if (sizeInName && LAYOUT_BY_SIZE[sizeInName[1]]) return LAYOUT_BY_SIZE[sizeInName[1]]

  const cn = blob.match(/(\d{2,3})\s*配列/)
  if (cn) return `${cn[1]}%`

  return undefined
}

/** 未强调特殊配重时默认铝 */
export function extractWeight(text: string): string {
  if (/全铜|铜壳|铜底|铜配|copper|\bcu版\b|\bcu\s/i.test(text)) return '铜'
  if (/pvd/i.test(text)) return 'PVD'
  if (/刀纹/.test(text)) return '刀纹'
  return '铝'
}

/** 仅当正文明确提到定位板材质时才填写 */
export function extractPlate(text: string): string | undefined {
  const rules: [RegExp, string][] = [
    [/(?:定位板|plate)[^\n。]{0,24}(Fr4|FR4)/i, 'Fr4'],
    [/(?:定位板|plate)[^\n。]{0,24}(碳纤维)/i, '碳纤维'],
    [/(?:定位板|plate)[^\n。]{0,24}(铝)/i, '铝'],
    [/(?:定位板|plate)[^\n。]{0,24}\b(PP)\b/i, 'PP'],
    [/(?:定位板|plate)[^\n。]{0,24}\b(PC)\b/i, 'PC'],
    [/(?:定位板|plate)[^\n。]{0,24}(铜)/i, '铜'],
    [/(Fr4|FR4)\s*(?:定位|板|plate)/i, 'Fr4'],
    [/碳纤维\s*(?:定位|板|plate)/i, '碳纤维'],
    [/铝\s*(?:定位|板|plate)/i, '铝'],
    [/\bPP\s*(?:定位|板|plate)/i, 'PP'],
    [/\bPC\s*(?:定位|板|plate)/i, 'PC'],
    [/铜\s*(?:定位|板|plate)/i, '铜'],
  ]
  for (const [re, val] of rules) {
    if (re.test(text)) return val
  }
  return undefined
}

export function extractProfile(text: string): string | undefined {
  const m = text.match(/\b(Cherry|KCA|SA|DSA|OEM|MDA|MT3|XDA)\b/i)
  return m ? m[1] : undefined
}

export function extractKeycapMaterial(text: string): string | undefined {
  if (/PBT/i.test(text)) return 'PBT'
  if (/ABS/i.test(text)) return 'ABS'
  return undefined
}

export function extractSwitchType(text: string): string | undefined {
  if (/线性|linear/i.test(text)) return 'linear'
  if (/段落|tactile/i.test(text)) return 'tactile'
  if (/静音|silent/i.test(text)) return 'silent'
  return undefined
}

export interface PriceInfo {
  price?: number
  msrp?: number
  currency: string
  note?: string
}

/** 优先使用 article 全文（flow.text 常被截断到 500 字） */
export function getFlowFullText(detail: ZfFlowDetail): string {
  const flow = detail.flow
  const article = flow.item?.article
  const articleText = article?.text ?? ''
  const flowText = flow.text ?? ''
  if (articleText.length >= flowText.length) return articleText
  if (flowText) return flowText
  const html = (article as { content?: string } | undefined)?.content ?? ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseAmount(raw: string): number {
  return Math.round(parseFloat(raw.replace(/,/g, '')))
}

function uniqueNums(nums: number[]): number[] {
  return [...new Set(nums)]
}

/** 从帖子正文提取价格（参考价、原价、多档说明） */
export function extractPriceInfo(text: string): PriceInfo {
  const currency = 'CNY'
  const blob = text.replace(/\s+/g, ' ')
  const notes: string[] = []
  let msrp: number | undefined
  let price: number | undefined

  const msrpMatch = blob.match(/(?:（|\()?原价[：:\s]*(\d{1,2}(?:,\d{3})*(?:\.\d+)?)\s*元/)
  if (msrpMatch) msrp = parseAmount(msrpMatch[1])

  const salePatterns: RegExp[] = [
    /首发(?:售价|价格)[：:\s]*(\d{1,2}(?:,\d{3})*(?:\.\d+)?)\s*元/,
    /团购价[：:\s]*(\d{1,2}(?:,\d{3})*(?:\.\d+)?)\s*元/,
    /预售价[：:\s]*(\d{1,2}(?:,\d{3})*(?:\.\d+)?)\s*元/,
    /(?:键帽|套件|整机)?(?:售价|价格|定价)[：:\s]*(\d{1,2}(?:,\d{3})*(?:\.\d+)?)\s*元/,
  ]
  for (const re of salePatterns) {
    const m = blob.match(re)
    if (m) {
      price = parseAmount(m[1])
      break
    }
  }

  const launchLine = blob.match(
    /(?:首发价格|团购价格|GB价格|发售价格)[：:\s]*([^。]{0,120})/,
  )
  if (launchLine) {
    const segment = launchLine[1].trim()
    notes.push(segment)
    const nums = uniqueNums(
      [...segment.matchAll(/(\d{3,5}(?:\.\d+)?)\s*元(?:起)?/g)].map((m) => parseAmount(m[1])),
    )
    const mainNums = nums.filter((n) => n >= 200)
    if (mainNums.length && price == null) price = Math.min(...mainNums)
  }

  const kitMatch = blob.match(/套件\s*(\d{3,5}(?:\.\d+)?)\s*元(?:起)?/)
  if (kitMatch) {
    const kitPrice = parseAmount(kitMatch[1])
    if (price == null) price = kitPrice
  }

  const rangeMatch = blob.match(/(\d{3,5})\s*[-~～至]\s*(\d{3,5})\s*元/)
  if (rangeMatch) {
    const low = parseAmount(rangeMatch[1])
    const high = parseAmount(rangeMatch[2])
    notes.push(`${low}-${high}元`)
    if (price == null) price = low
  }

  const yenMatches = uniqueNums(
    [...blob.matchAll(/[¥￥]\s*(\d{1,2}(?:,\d{3})*(?:\.\d+)?)/g)].map((m) => parseAmount(m[1])),
  ).filter((n) => n >= 38 && n <= 50000)
  if (price == null && yenMatches.length) price = Math.min(...yenMatches)

  if (price == null) {
    const allYuan = uniqueNums(
      [...blob.matchAll(/(\d{2,5}(?:\.\d+)?)\s*元(?:起|\/颗|每颗)?/g)]
        .map((m) => parseAmount(m[1]))
        .filter((n) => n >= 38 && n <= 50000),
    )
    const mainYuan = allYuan.filter((n) => n >= 200)
    if (mainYuan.length) price = Math.min(...mainYuan)
    else if (allYuan.length) price = Math.min(...allYuan)
  }

  let note: string | undefined
  if (notes.length) {
    note = notes.join('；')
  }
  if (msrp != null && price != null && msrp !== price) {
    const msrpPart = `原价${msrp}元`
    note = note ? `${note}；${msrpPart}` : `${msrpPart}，参考价${price}元`
  } else if (msrp != null && price == null) {
    price = msrp
    note = note ?? `原价${msrp}元`
  }

  return { price, msrp, currency, note }
}

export function extractPrice(text: string): number | undefined {
  return extractPriceInfo(text).price
}
