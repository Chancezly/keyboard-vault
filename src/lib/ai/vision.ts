import { getApiKey, getBaseUrl } from './config'
import { getVisionModel } from './visionConfig'

export type VisionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface VisionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | VisionContentPart[]
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

export async function visionCompletion(
  messages: VisionMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('请先配置 DeepSeek API Key')

  const model = getVisionModel()
  if (!model) throw new Error('请在 AI 设置中配置识图模型')

  const base = getBaseUrl().replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  })

  const data = (await res.json()) as ChatCompletionResponse
  if (!res.ok) {
    const msg = data.error?.message ?? `API 请求失败 (${res.status})`
    if (/image_url|vision|multimodal|variant/i.test(msg)) {
      throw new Error(
        `${msg}。识图需支持视觉的 API：请将 Base URL 设为 SiliconFlow/OpenRouter 等，并配置识图模型（如 Qwen2-VL）。`,
      )
    }
    throw new Error(msg)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('API 返回内容为空')
  return content
}

/** 压缩大图后再识别，减少 token 消耗 */
export async function prepareImageDataUrl(file: File, maxEdge = 1280): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请上传图片文件')

  const blob = file.size <= 900_000 && file.type.startsWith('image/jpeg')
    ? file
    : await compressImage(file, maxEdge)

  return blobToDataUrl(blob)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function compressImage(file: File, maxEdge: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      const scale = Math.min(1, maxEdge / Math.max(width, height))
      width = Math.round(width * scale)
      height = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法处理图片'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))),
        'image/jpeg',
        0.88,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}
