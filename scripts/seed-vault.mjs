#!/usr/bin/env node
/**
 * 从 zFrontier 链接重置 vault 示例数据（md + 本地图片）
 * 用法: node scripts/seed-vault.mjs
 */
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { stringify } from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const VAULT = path.join(ROOT, 'vault')

const JOBS = [
  { category: 'keyboards', hashId: 'aqVXkar5qKYv' },
  { category: 'keyboards', hashId: 'lRA817WAa63p' },
  { category: 'keyboards', hashId: '76l5XaRR7p7n' },
  { category: 'switches', hashId: 'xp5NbY6OOkY5' },
  { category: 'switches', hashId: 'xNzQwwXWxvkM' },
  { category: 'switches', hashId: 'N5dzXzrl3aaa' },
  { category: 'keycaps', hashId: 'GqjzG76jZpJg' },
  { category: 'keycaps', hashId: 'Rpb7lJbE31GO' },
]

const ID_PREFIX = { keyboards: 'kb', keycaps: 'kc', switches: 'sw', builds: 'bd' }

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex')
}

function clean(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
    out[k] = v
  }
  return out
}

function itemDisplayBasename(item) {
  const name = item.name.trim()
  const brand = (item.brand || '').trim()
  if (!name) return item.id
  if (brand && brand.toLowerCase() !== name.toLowerCase() && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `【${brand}-${name}】`
  }
  return `【${name}】`
}

function ensureUniqueBasename(base, taken) {
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

function getFlowFullText(flow) {
  const article = flow.item?.article
  const articleText = article?.text ?? ''
  const flowText = flow.text ?? ''
  if (articleText.length >= flowText.length) return articleText
  return flowText || articleText
}

function extractKitName(detail) {
  const equips = detail.flow.item?.equips ?? []
  const fromEquip = equips.find((e) => e.name && !/交流群|随机色/.test(e.name))
  if (fromEquip?.name) return fromEquip.name.trim()
  let name = (detail.flow.title ?? detail.flow.item?.title ?? '')
    .replace(/^【\s*GB\s*】/i, '')
    .replace(/^\[\s*GB\s*\]/i, '')
    .trim()
  name = name.split(/[，,！!？?；;]/)[0].trim()
  return name || '未命名'
}

function extractStudio(detail, text) {
  const nickname = detail.flow.user?.nickname?.trim()
  if (nickname) return nickname
  if (/neo\s*studio|qwertykeys/i.test(text)) return 'Neo Studio'
  return ''
}

function extractLayoutFromName(name, text = '') {
  const blob = `${name} ${text}`
  if (/alice|人体工学/i.test(blob)) return 'Alice'
  if (/\btkl\b|tenkeyless/i.test(blob)) return 'TKL'
  const pct = blob.match(/(\d{2,3})\s*%/)
  if (pct) return `${pct[1]}%`
  const sizeInName = name.match(/\b(104|100|98|96|80|75|68|67|65|64|60)\b/)
  const map = { 80: 'TKL', 75: '75%', 68: '68%', 65: '65%', 60: '60%', 98: '98%' }
  if (sizeInName && map[sizeInName[1]]) return map[sizeInName[1]]
  return undefined
}

function extractWeight(text) {
  if (/全铜|铜壳|copper|\bcu版\b/i.test(text)) return '铜'
  if (/pvd/i.test(text)) return 'PVD'
  if (/刀纹/.test(text)) return '刀纹'
  return '铝'
}

function extractPlate(text) {
  const rules = [
    [/(?:定位板|plate)[^\n。]{0,24}(Fr4|FR4)/i, 'Fr4'],
    [/(?:定位板|plate)[^\n。]{0,24}(铝)/i, '铝'],
    [/\bPC\s*(?:定位|板|plate)/i, 'PC'],
    [/\bPP\s*(?:定位|板|plate)/i, 'PP'],
  ]
  for (const [re, val] of rules) if (re.test(text)) return val
  return undefined
}

function extractProfile(text) {
  const m = text.match(/\b(Cherry|KCA|SA|DSA|OEM|MDA|MT3|XDA)\b/i)
  return m ? m[1] : undefined
}

function extractKeycapMaterial(text) {
  if (/PBT/i.test(text)) return 'PBT'
  if (/ABS/i.test(text)) return 'ABS'
  return undefined
}

function extractSwitchType(text) {
  if (/线性|linear/i.test(text)) return 'linear'
  if (/段落|tactile/i.test(text)) return 'tactile'
  if (/静音|silent/i.test(text)) return 'silent'
  return undefined
}

function extractPriceInfo(text) {
  const blob = text.replace(/\s+/g, ' ')
  let price
  let msrp
  const msrpMatch = blob.match(/(?:（|\()?原价[：:\s]*(\d+)\s*元/)
  if (msrpMatch) msrp = parseInt(msrpMatch[1], 10)
  const sale = blob.match(/首发(?:售价|价格)[：:\s]*(\d+)\s*元/)
  if (sale) price = parseInt(sale[1], 10)
  const kit = blob.match(/套件\s*(\d{3,5})\s*元(?:起)?/)
  if (kit && !price) price = parseInt(kit[1], 10)
  if (!price) {
    const all = [...blob.matchAll(/(\d{3,5})\s*元/g)].map((m) => parseInt(m[1], 10)).filter((n) => n >= 200 && n <= 50000)
    if (all.length) price = Math.min(...all)
  }
  let note
  if (msrp && price && msrp !== price) note = `原价${msrp}元，参考价${price}元`
  return { price, currency: price ? 'CNY' : undefined, note }
}

function serializeItem(item) {
  const identity = clean({ id: item.id, name: item.name, brand: item.brand })
  const specification = clean({
    layout: item.layout,
    plate: item.plate,
    filling: item.filling,
    pcbThickness: item.pcbThickness,
    weight: item.weight,
    material: item.material,
    profile: item.profile,
    switchType: item.switchType,
    manufacturer: item.manufacturer,
  })
  const state = clean({
    status: item.status,
    price: item.price,
    currency: item.currency,
    addedAt: item.addedAt,
  })
  const images = clean({ hero: item.heroFile, gallery: [] })
  const frontmatter = { identity }
  if (Object.keys(specification).length) frontmatter.specification = specification
  if (Object.keys(state).length) frontmatter.state = state
  if (item.history?.length) frontmatter.history = item.history
  if (Object.keys(images).length) frontmatter.images = images
  frontmatter.ai = { summary: '', suggestedTags: [], recommendation: '', model: '', generatedAt: null }
  return `---\n${stringify(frontmatter).trimEnd()}\n---\n\n`
}

async function zfPost(pathname, data, csrf) {
  const time = String(Math.floor(Date.now() / 1000))
  const t = md5(time + csrf)
  const body = new URLSearchParams({ ...data, time, t })
  const res = await fetch(`https://www.zfrontier.com/${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Csrf-Token': csrf,
      Origin: 'https://www.zfrontier.com',
      Referer: 'https://www.zfrontier.com/app/',
    },
    body,
  })
  return res.json()
}

async function getCsrf() {
  const res = await fetch('https://www.zfrontier.com/app/', {
    headers: { Accept: 'text/html' },
  })
  const html = await res.text()
  return html.match(/csrf_token\s*=\s*'([^']+)'/)?.[1]
}

async function fetchImage(url) {
  const abs = url.startsWith('//') ? `https:${url}` : url
  const attempts = [
    `${abs.split('?')[0]}?imageView2/2/w/800/format/jpg/q/85`,
    abs.split('?')[0],
  ]
  for (const u of attempts) {
    try {
      const res = await fetch(u, { headers: { Referer: 'https://www.zfrontier.com/' } })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 64) continue
      const mime = res.headers.get('content-type') || 'image/jpeg'
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
      return { bytes: buf, ext }
    } catch {
      // try next
    }
  }
  return null
}

async function pickHeroUrl(flow) {
  const candidates = [
    flow.item?.equips?.[0]?.coverpic,
    ...(flow.imgs ?? []),
    flow.share_config?.bigCover?.split('?')[0],
  ].filter(Boolean)
  for (const ref of candidates) {
    const abs = ref.startsWith('//') ? `https:${ref}` : ref
    const img = await fetchImage(abs)
    if (img) return { url: abs, ...img }
  }
  return null
}

async function clearSamples() {
  for (const dir of ['keyboards', 'keycaps', 'switches', 'builds']) {
    const full = path.join(VAULT, dir)
    try {
      const files = await fs.readdir(full)
      for (const f of files) {
        if (f.endsWith('.md')) await fs.unlink(path.join(full, f))
      }
    } catch {
      await fs.mkdir(full, { recursive: true })
    }
  }
  const imgDir = path.join(VAULT, 'assets', 'images')
  await fs.mkdir(imgDir, { recursive: true })
  try {
    const imgs = await fs.readdir(imgDir)
    for (const f of imgs) {
      if (!f.startsWith('.')) await fs.unlink(path.join(imgDir, f))
    }
  } catch {
    // empty
  }
}

async function main() {
  console.log('Clearing old samples…')
  await clearSamples()

  const csrf = await getCsrf()
  if (!csrf) throw new Error('无法获取 CSRF')

  const items = []
  const takenBasenames = new Set()
  const counters = { keyboards: 0, keycaps: 0, switches: 0 }

  for (const job of JOBS) {
    console.log(`Fetching ${job.category} ${job.hashId}…`)
    const res = await zfPost('v2/flow/detail', { id: job.hashId }, csrf)
    if (res.ok !== 0 || !res.data) {
      console.error('  FAIL:', res.msg || job.hashId)
      continue
    }
    const flow = res.data.flow
    const text = getFlowFullText(flow)
    const name = extractKitName(res.data)
    const brand = extractStudio(res.data, text) || 'Unknown'
    const priceInfo = extractPriceInfo(text)
    counters[job.category]++
    const id = `${ID_PREFIX[job.category]}-${String(counters[job.category]).padStart(3, '0')}`

    const hero = await pickHeroUrl(flow)
    if (!hero) {
      console.error('  No image for', name)
      continue
    }

    let base = itemDisplayBasename({ id, name, brand })
    base = ensureUniqueBasename(base, takenBasenames)
    takenBasenames.add(base)

    const heroFile = `${base}.${hero.ext}`
    await fs.writeFile(path.join(VAULT, 'assets', 'images', heroFile), hero.bytes)

    const item = {
      id,
      name,
      brand,
      category: job.category,
      status: 'wishlist',
      price: priceInfo.price,
      currency: priceInfo.currency,
      addedAt: new Date().toISOString().slice(0, 10),
      heroFile,
      history:
        priceInfo.price || priceInfo.note
          ? [{ event: '参考价', price: priceInfo.price, currency: priceInfo.currency || 'CNY', note: priceInfo.note }]
          : [],
    }

    if (job.category === 'keyboards') {
      item.layout = extractLayoutFromName(name, text)
      item.weight = extractWeight(text)
      item.plate = extractPlate(text)
    } else if (job.category === 'keycaps') {
      item.profile = extractProfile(text)
      item.material = extractKeycapMaterial(text)
    } else if (job.category === 'switches') {
      item.switchType = extractSwitchType(text)
      item.manufacturer = brand !== 'Unknown' ? brand : undefined
    }

    const mdPath = path.join(VAULT, job.category, `${base}.md`)
    await fs.writeFile(mdPath, serializeItem(item), 'utf8')
    items.push({ name, base, category: job.category })
    console.log(`  ✓ ${base}.md`)
  }

  console.log('\nDone:', items.length, 'items')
  for (const i of items) console.log(`  [${i.category}] ${i.name} → ${i.base}.md`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
