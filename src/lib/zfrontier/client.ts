import { signPayload } from './sign'
import type { ZfFlowDetail, ZfFlowListItem, ZfFlowListResponse } from './types'

const SITE = import.meta.env.DEV ? '/api/zfrontier' : 'https://www.zfrontier.com'

let csrfToken: string | null = null

async function fetchCsrfToken(force = false): Promise<string> {
  if (!force && csrfToken) return csrfToken
  const res = await fetch(`${SITE}/app/`, {
    credentials: 'include',
    headers: { Accept: 'text/html' },
  })
  if (!res.ok) throw new Error(`无法连接 zFrontier（${res.status}）`)
  const html = await res.text()
  const match = html.match(/csrf_token\s*=\s*'([^']+)'/)
  if (!match) throw new Error('无法获取 zFrontier CSRF Token')
  csrfToken = match[1]
  return csrfToken
}

function isTokenMismatch(body: unknown): boolean {
  if (typeof body === 'string') return body.includes('token mismatch')
  if (body && typeof body === 'object' && 'msg' in body) {
    const msg = String((body as { msg?: string }).msg ?? '')
    return msg.includes('token mismatch')
  }
  return false
}

async function zfPost<T>(path: string, data: Record<string, string>, retry = true): Promise<T> {
  const csrf = await fetchCsrfToken()
  const { time, t } = signPayload(csrf)
  const body = new URLSearchParams({ ...data, time, t })
  const res = await fetch(`${SITE}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Csrf-Token': csrf,
      Accept: 'application/json, text/plain, */*',
    },
    body,
  })
  if (!res.ok) throw new Error(`zFrontier 请求失败（${res.status}）`)

  const text = await res.text()
  let parsed: T
  try {
    parsed = JSON.parse(text) as T
  } catch {
    if (isTokenMismatch(text) && retry) {
      csrfToken = null
      return zfPost(path, data, false)
    }
    throw new Error(text.slice(0, 120) || 'zFrontier 返回异常')
  }

  if (isTokenMismatch(parsed) && retry) {
    csrfToken = null
    return zfPost(path, data, false)
  }

  return parsed
}

export async function fetchFlowList(
  sortBy: 'new' | 'hot' = 'new',
  offset = '',
): Promise<ZfFlowListResponse> {
  return zfPost('v2/flow/list', {
    offset,
    cid: '1',
    sortBy,
  })
}

export async function fetchFlowDetail(hashId: string): Promise<ZfFlowDetail> {
  const res = await zfPost<{ ok: number; msg: string; data: ZfFlowDetail | null }>(
    'v2/flow/detail',
    { id: hashId },
  )
  if (res.ok !== 0 || !res.data) {
    throw new Error(res.msg || '未找到该帖子')
  }
  return res.data
}

export function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().replace(/[\s_-]+/g, '')
}

export function scoreFlowMatch(item: ZfFlowListItem, keyword: string): number {
  const k = normalizeKeyword(keyword)
  if (!k) return 0

  const title = normalizeKeyword(item.title ?? '')
  const text = normalizeKeyword(item.text ?? '')
  let score = 0

  if (title.includes(k)) score += 120
  else if (text.includes(k)) score += 40

  const rawTitle = item.title ?? ''
  if (/【\s*GB\s*】|\[\s*GB\s*\]/i.test(rawTitle)) score += 25
  if (/neo\s*studio|qwertykeys/i.test(item.text ?? '')) score += 5

  const equips = item.equip_list?.detail?.kit ?? []
  for (const eq of equips) {
    if (normalizeKeyword(eq.name ?? '').includes(k)) score += 90
  }

  if (k === 'neo65' && title.includes('neo80')) score -= 50
  if (k === 'neo65' && title.includes('neo98')) score -= 50

  return score
}

const MAX_PAGES = 20
const MIN_SCORE = 80

/** 在「最新」列表中搜索与关键词最匹配的 GB 帖子 */
export async function searchKitFlow(keyword: string): Promise<ZfFlowListItem | null> {
  csrfToken = null
  let offset = ''
  let best: ZfFlowListItem | null = null
  let bestScore = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchFlowList('new', offset)
    if (res.ok !== 0) throw new Error(res.msg || '搜索失败')

    const list = res.data?.list ?? []
    for (const item of list) {
      const score = scoreFlowMatch(item, keyword)
      if (score > bestScore) {
        bestScore = score
        best = item
      }
    }

    if (bestScore >= MIN_SCORE + 40) break

    offset = res.data?.offset ?? ''
    if (!offset || list.length === 0) break
  }

  return bestScore >= MIN_SCORE ? best : null
}

export function absolutizeImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}

export { fetchImageAsDataUrl } from '../fetchImage'

export function flowPageUrl(hashId: string): string {
  return `https://www.zfrontier.com/app/flow/${hashId}`
}

export function resetZfSession(): void {
  csrfToken = null
}
