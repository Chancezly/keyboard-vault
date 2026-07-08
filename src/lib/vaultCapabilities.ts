import { isFileSystemSupported } from './fs'

/** Chrome / Edge：完整支持 File System Access API 写入 */
export function isVaultBrowserSupported(): boolean {
  if (!isFileSystemSupported()) return false
  const ua = navigator.userAgent
  const isEdge = /Edg\//.test(ua)
  const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)
  return isChrome || isEdge
}

export function vaultBrowserHint(): string {
  if (isVaultBrowserSupported()) return ''
  if (!isFileSystemSupported()) {
    return '当前浏览器不支持连接本地文件夹，请使用 Chrome 或 Edge。'
  }
  return '请使用 Chrome 或 Edge 连接本地文件夹（Safari / Firefox 仅支持只读演示）。'
}
