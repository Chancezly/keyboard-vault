type ErrorContext = 'connect' | 'read' | 'save' | 'image' | 'restore'

const CONTEXT_FALLBACKS: Record<ErrorContext, string> = {
  connect: '请确认使用电脑 Chrome 或 Edge，并重新选择一个可读写的文件夹。',
  read: '请确认文件夹仍在原位置且有访问权限；也可以重新连接或从 ZIP 备份恢复。',
  save: '编辑内容仍保留在当前窗口。请检查文件夹权限和剩余空间后重试。',
  image: '请换用 JPG、PNG、WebP 或 HEIC 图片，并确认文件没有损坏。',
  restore: '当前收藏库不会被静默替换。请检查 ZIP 是否为 KeyVault 备份后重试。',
}

export function userFacingError(error: unknown, context: ErrorContext): string {
  const fallback = CONTEXT_FALLBACKS[context]
  if (!(error instanceof Error)) return fallback

  if (error.name === 'NotAllowedError' || /permission|权限|denied/i.test(error.message)) {
    return context === 'connect'
      ? '没有获得文件夹权限。KeyVault 只会访问你主动选择的文件夹；请再次连接并允许访问。'
      : `文件夹权限已失效。请重新连接收藏库后再试。${context === 'save' ? ' 当前编辑内容仍保留在窗口中。' : ''}`
  }
  if (error.name === 'SecurityError') {
    return '浏览器阻止了本地文件访问。请使用 HTTPS 页面，并在电脑 Chrome 或 Edge 中重试。'
  }
  if (error.name === 'NotFoundError') {
    return '原文件或文件夹已被移动、改名或删除。请重新连接正确的收藏库文件夹。'
  }
  if (/quota|space|空间|容量/i.test(error.message)) {
    return '设备剩余空间不足。请释放空间后重试，当前编辑内容仍保留在窗口中。'
  }

  return error.message ? `${error.message} ${fallback}` : fallback
}
