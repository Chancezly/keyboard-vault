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

import { normalizeImageFile } from '../imageNormalize'

/** 压缩大图后再识别，减少 token 消耗（含 HEIC → JPEG） */
export async function prepareImageDataUrl(file: File, maxEdge = 1280): Promise<string> {
  const normalized = await normalizeImageFile(file, { maxEdge, quality: 0.88 })
  return normalized.dataUrl
}
