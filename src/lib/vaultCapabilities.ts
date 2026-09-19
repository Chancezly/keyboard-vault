import { isFileSystemSupported } from './fs'

export interface ExperienceEnvironment {
  mobile: boolean
  inAppBrowser: boolean
  inAppName?: string
}

export function getExperienceEnvironment(userAgent = navigator.userAgent): ExperienceEnvironment {
  const ua = userAgent
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const inAppRules: [RegExp, string][] = [
    [/XiaoHongShu|XHS/i, '小红书'],
    [/MicroMessenger/i, '微信'],
    [/Weibo/i, '微博'],
    [/QQ\//i, 'QQ'],
  ]
  const matched = inAppRules.find(([pattern]) => pattern.test(ua))
  return { mobile, inAppBrowser: Boolean(matched), inAppName: matched?.[1] }
}

/** Chrome / Edge：完整支持 File System Access API 写入 */
export function isVaultBrowserSupported(): boolean {
  if (!isFileSystemSupported()) return false
  if (getExperienceEnvironment().mobile) return false
  const ua = navigator.userAgent
  const isEdge = /Edg\//.test(ua)
  const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)
  return isChrome || isEdge
}

export function vaultBrowserHint(): string {
  if (isVaultBrowserSupported()) return ''
  const environment = getExperienceEnvironment()
  if (environment.inAppBrowser) {
    return `当前是${environment.inAppName ?? '应用'}内置浏览器，可浏览示例；请在电脑 Chrome 或 Edge 中打开本页以创建收藏库。`
  }
  if (environment.mobile) {
    return '手机端当前用于浏览示例；请在电脑 Chrome 或 Edge 中打开本页以创建和编辑收藏。'
  }
  if (!isFileSystemSupported()) {
    return '当前浏览器不支持连接本地文件夹，请使用 Chrome 或 Edge。'
  }
  return '请使用 Chrome 或 Edge 连接本地文件夹（Safari / Firefox 仅支持只读演示）。'
}
