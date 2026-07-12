const CHAT_CONSENT = 'keyvault:network-consent:chat:v1'
const VISION_CONSENT = 'keyvault:network-consent:vision:v1'

function endpointKey(key: string, endpoint: string): string {
  return `${key}:${endpoint.trim().replace(/\/$/, '')}`
}

function hasConsent(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function rememberConsent(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // 隐私模式下不持久化，下次再次询问。
  }
}

export function confirmCollectionNetworkUse(endpoint: string): boolean {
  const key = endpointKey(CHAT_CONSENT, endpoint)
  if (hasConsent(key)) return true
  const accepted = window.confirm(
    `此功能需要联网，并会把收藏名称、规格、价格、评分、标签、部分体验文字和用户偏好发送到：\n${endpoint}\n\n普通收藏管理不会联网。是否继续并记住此选择？`,
  )
  if (accepted) rememberConsent(key)
  return accepted
}

export function confirmImageNetworkUse(endpoint: string): boolean {
  const key = endpointKey(VISION_CONSENT, endpoint)
  if (hasConsent(key)) return true
  const accepted = window.confirm(
    `识图需要联网，并会把你选择的图片发送到：\n${endpoint}\n\n是否继续并记住此选择？`,
  )
  if (accepted) rememberConsent(key)
  return accepted
}
