/** 下载远程图片为字节（开发环境走 Vite 代理） */

export function absolutizeImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}

function toDevProxyUrl(abs: string): string {
  if (!import.meta.env.DEV) return abs
  if (abs.includes('img.zfrontier.com')) {
    return abs.replace('https://img.zfrontier.com', '/img/zfrontier')
  }
  return abs
}

function extFromMime(mime: string): string {
  const t = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  return t.split(';')[0] || 'jpg'
}

function extFromUrl(url: string): string {
  const m = url.split('?')[0].match(/\.(\w+)$/)
  return m?.[1]?.replace('jpeg', 'jpg') ?? 'jpg'
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  // 小块拼接，避免 String.fromCharCode(...大数组) 触发 call stack 溢出
  for (let i = 0; i < bytes.length; i += 0x800) {
    const slice = bytes.subarray(i, Math.min(i + 0x800, bytes.length))
    binary += String.fromCharCode(...slice)
  }
  return `data:${mime};base64,${btoa(binary)}`
}

function zfImageAttempts(base: string): string[] {
  const proxied = toDevProxyUrl(base)
  const jpg800 = toDevProxyUrl(`${base}?imageView2/2/w/800/format/jpg/q/85`)
  const jpgRaw = toDevProxyUrl(`${base}?imageView2/0/format/jpg`)
  // 优先小图，避免大图在浏览器中转 base64 失败
  return [jpg800, proxied, jpgRaw, base]
}

async function fetchImageResponse(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length < 64) return null
    const mime =
      res.headers.get('content-type')?.split(';')[0] ||
      (url.includes('format/jpg') ? 'image/jpeg' : `image/${extFromUrl(url)}`)
    return { bytes, mime }
  } catch {
    return null
  }
}

export async function fetchImageBytes(
  url: string,
): Promise<{ bytes: Uint8Array; ext: string; mime: string } | null> {
  const base = absolutizeImageUrl(url).split('?')[0]
  const attempts = zfImageAttempts(base)

  for (const fetchUrl of attempts) {
    const result = await fetchImageResponse(fetchUrl)
    if (!result) continue
    const ext = extFromMime(result.mime)
    return { bytes: result.bytes, ext, mime: result.mime }
  }
  return null
}

export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const fetched = await fetchImageBytes(url)
  if (!fetched) return null
  return bytesToDataUrl(fetched.bytes, fetched.mime)
}

/** 保存前确保主图为 data URL，便于写入本地文件 */
export async function ensureHeroDataUrl(ref: string): Promise<string | null> {
  if (!ref) return null
  if (ref.startsWith('data:')) return ref
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('//')) {
    return fetchImageAsDataUrl(ref)
  }
  return null
}
