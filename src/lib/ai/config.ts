const LS_API_KEY = 'keyvault:deepseek-api-key'
const LS_BASE_URL = 'keyvault:deepseek-base-url'

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat'

export function getApiKey(): string {
  try {
    return localStorage.getItem(LS_API_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setApiKey(key: string) {
  localStorage.setItem(LS_API_KEY, key.trim())
}

export function getBaseUrl(): string {
  try {
    return localStorage.getItem(LS_BASE_URL) ?? DEFAULT_DEEPSEEK_BASE_URL
  } catch {
    return DEFAULT_DEEPSEEK_BASE_URL
  }
}

export function setBaseUrl(url: string) {
  localStorage.setItem(LS_BASE_URL, url.trim() || DEFAULT_DEEPSEEK_BASE_URL)
}

export function isConfigured(): boolean {
  return getApiKey().length > 0
}
