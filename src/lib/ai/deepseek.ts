import { DEFAULT_DEEPSEEK_MODEL, getApiKey, getBaseUrl } from './config'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('请先配置 DeepSeek API Key')

  const base = getBaseUrl().replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_DEEPSEEK_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  })

  const data = (await res.json()) as ChatCompletionResponse
  if (!res.ok) {
    throw new Error(data.error?.message ?? `API 请求失败 (${res.status})`)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('API 返回内容为空')
  return content
}
