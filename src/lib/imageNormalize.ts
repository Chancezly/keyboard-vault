import { heicTo } from 'heic-to'

const HEIC_EXT = /\.(heic|heif)$/i
const IMAGE_ACCEPT =
  'image/*,.heic,.heif,image/heic,image/heif,image/heic-sequence,image/heif-sequence'

/** 常见 HEIF brand（含较新 iPhone / miaf 系列） */
const HEIF_BRANDS = /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1|miaf|MiHB|MiHE|MiPr|tmap)$/i

export { IMAGE_ACCEPT }

export function isHeicName(name?: string | null): boolean {
  return Boolean(name && HEIC_EXT.test(name))
}

/** 通过 ftyp 盒子嗅探 HEIC/HEIF（扩展名/MIME 不准时） */
async function sniffHeic(blob: Blob): Promise<boolean> {
  try {
    const buf = await blob.slice(0, 64).arrayBuffer()
    const bytes = new Uint8Array(buf)
    if (bytes.length < 16) return false
    const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (tag !== 'ftyp') return false
    // major brand + compatible brands（每 4 字节）
    for (let i = 8; i + 4 <= bytes.length; i += 4) {
      const brand = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3])
      if (HEIF_BRANDS.test(brand)) return true
    }
    return false
  } catch {
    return false
  }
}

export function isHeicLike(file: Blob, name?: string): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.includes('heic') || type.includes('heif')) return true
  if (name && isHeicName(name)) return true
  if (file instanceof File && isHeicName(file.name)) return true
  return false
}

export function isSupportedImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  if (isHeicLike(file)) return true
  return /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name)
}

function formatErr(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown; error?: unknown }
    if (typeof o.message === 'string' && o.message) {
      return o.code != null ? `${o.message} (${String(o.code)})` : o.message
    }
    if (typeof o.error === 'string' && o.error) return o.error
    try {
      const s = JSON.stringify(e)
      if (s && s !== '{}') return s
    } catch {
      // ignore
    }
  }
  return '未知错误'
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片导出失败'))),
      'image/jpeg',
      quality,
    )
  })
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败（格式可能不受支持）'))
    img.src = url
  })
}

/** 系统/浏览器原生解码（Safari、macOS Chrome 等常可直接解 HEIC） */
async function decodeViaNative(blob: Blob, quality: number): Promise<Blob | null> {
  // 1) createImageBitmap — macOS/iOS 上对 HEIC 成功率最高
  try {
    const bitmap = await createImageBitmap(blob)
    try {
      if (!bitmap.width || !bitmap.height) return null
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(bitmap, 0, 0)
      return await canvasToJpeg(canvas, quality)
    } finally {
      bitmap.close()
    }
  } catch {
    // continue
  }

  // 2) HTMLImageElement
  try {
    const url = URL.createObjectURL(blob)
    try {
      const img = await loadHtmlImage(url)
      if (!img.naturalWidth) return null
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0)
      return await canvasToJpeg(canvas, quality)
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    // continue
  }

  // 3) ImageDecoder（Chromium）
  try {
    const ImageDecoderCtor = (globalThis as unknown as {
      ImageDecoder?: new (init: { data: BufferSource; type: string }) => {
        decode: () => Promise<{ image: ImageBitmap }>
        close?: () => void
      }
    }).ImageDecoder
    if (ImageDecoderCtor) {
      const type = blob.type || 'image/heic'
      const data = await blob.arrayBuffer()
      const decoder = new ImageDecoderCtor({ data, type })
      try {
        const { image } = await decoder.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(image, 0, 0)
        image.close()
        return await canvasToJpeg(canvas, quality)
      } finally {
        decoder.close?.()
      }
    }
  } catch {
    // continue
  }

  return null
}

/**
 * 从 HEIC 容器里抠出嵌入的 JPEG（缩略图 / 预览流）。
 * 新机型 libheif 解不动时，仍可能拿到可用封面。
 */
function extractLargestEmbeddedJpeg(bytes: Uint8Array): Blob | null {
  const parts: Uint8Array[] = []
  let i = 0
  while (i < bytes.length - 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
      let j = i + 2
      while (j < bytes.length - 1) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          parts.push(bytes.subarray(i, j + 2))
          i = j + 2
          break
        }
        j++
      }
      if (j >= bytes.length - 1) break
      continue
    }
    i++
  }
  if (!parts.length) return null
  parts.sort((a, b) => b.length - a.length)
  const best = parts[0]
  // 过小基本是图标级，无意义
  if (best.length < 8_000) return null
  return new Blob([best.slice()], { type: 'image/jpeg' })
}

async function decodeViaEmbeddedJpeg(blob: Blob): Promise<Blob | null> {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return extractLargestEmbeddedJpeg(bytes)
  } catch {
    return null
  }
}

async function decodeViaHeicTo(blob: Blob, quality: number): Promise<Blob> {
  const result = await heicTo({
    blob,
    type: 'image/jpeg',
    quality,
  })
  if (!(result instanceof Blob)) throw new Error('HEIC 转换结果无效')
  return result.type ? result : new Blob([result], { type: 'image/jpeg' })
}

/**
 * HEIC/HEIF → JPEG
 * 顺序：系统原生 → heic-to(WASM) → 容器内嵌 JPEG
 * 覆盖 Safari / macOS Chrome / 以及 iOS 26 等 libheif 尚未跟上的机型
 */
export async function heicToJpegBlob(blob: Blob, quality = 0.9): Promise<Blob> {
  const errors: string[] = []

  const native = await decodeViaNative(blob, quality)
  if (native) return native
  errors.push('原生解码不可用')

  try {
    return await decodeViaHeicTo(blob, quality)
  } catch (e) {
    errors.push(`WASM：${formatErr(e)}`)
  }

  const embedded = await decodeViaEmbeddedJpeg(blob)
  if (embedded) return embedded
  errors.push('未找到可用内嵌 JPEG')

  throw new Error(errors.join('；'))
}

/** 压缩到最长边 maxEdge，输出 JPEG */
export async function compressToJpeg(blob: Blob, maxEdge = 2048, quality = 0.88): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadHtmlImage(url)
    let { width, height } = img
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法处理图片')
    ctx.drawImage(img, 0, 0, width, height)
    return await canvasToJpeg(canvas, quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface NormalizedImage {
  dataUrl: string
  bytes: Uint8Array
  ext: 'jpg'
  mime: 'image/jpeg'
}

/**
 * 统一把用户选中的图片转成浏览器可显示、可落盘的 JPEG。
 */
export async function normalizeImageFile(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<NormalizedImage> {
  if (!isSupportedImageFile(file)) {
    throw new Error('请选择图片文件（支持 JPEG / PNG / WebP / HEIC）')
  }

  const maxEdge = options?.maxEdge ?? 2048
  const quality = options?.quality ?? 0.88

  let needsHeic = isHeicLike(file)
  if (!needsHeic) {
    const type = file.type || ''
    if (!type.startsWith('image/') || type === 'application/octet-stream') {
      needsHeic = await sniffHeic(file)
    }
  }

  let working: Blob = file
  if (needsHeic) {
    try {
      working = await heicToJpegBlob(file, Math.min(0.92, quality + 0.04))
    } catch (e) {
      throw new Error(
        `HEIC 转换失败：${formatErr(e)}。可在 iPhone「照片」→ 分享 →「拷贝照片」或导出 JPEG 后再试。`,
      )
    }
  }

  let jpeg: Blob
  try {
    jpeg = await compressToJpeg(working, maxEdge, quality)
  } catch {
    if (working.type.includes('jpeg') || working.type === '' || needsHeic) {
      jpeg = working.type ? working : new Blob([await working.arrayBuffer()], { type: 'image/jpeg' })
    } else if (await sniffHeic(file)) {
      try {
        working = await heicToJpegBlob(file, Math.min(0.92, quality + 0.04))
        jpeg = await compressToJpeg(working, maxEdge, quality).catch(() => working)
      } catch (e) {
        throw new Error(`图片无法处理：${formatErr(e)}`)
      }
    } else {
      throw new Error('图片无法预览或压缩，请换一张图重试')
    }
  }

  const bytes = await blobToBytes(jpeg)
  const dataUrl = await blobToDataUrl(jpeg)
  return { dataUrl, bytes, ext: 'jpg', mime: 'image/jpeg' }
}

/** 从已可显示的图片引用生成首页缩略图，不改变主图。 */
export async function createThumbnailDataUrl(
  source: string,
  maxEdge = 640,
  quality = 0.74,
): Promise<string> {
  if (!source) return ''
  const response = await fetch(source)
  if (!response.ok) throw new Error('无法读取图片以生成缩略图')
  const thumbnail = await compressToJpeg(await response.blob(), maxEdge, quality)
  return blobToDataUrl(thumbnail)
}

/** 把磁盘上的 HEIC 文件转为可显示的 blob URL（用于 vault 读取） */
export async function heicFileToObjectUrl(file: Blob): Promise<string> {
  const jpeg = await heicToJpegBlob(file, 0.9)
  return URL.createObjectURL(jpeg)
}
