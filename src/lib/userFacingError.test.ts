import { describe, expect, it } from 'vitest'
import { userFacingError } from './userFacingError'

describe('userFacingError', () => {
  it('explains denied folder permissions', () => {
    const error = new Error('Permission denied')
    error.name = 'NotAllowedError'
    expect(userFacingError(error, 'connect')).toContain('只会访问你主动选择的文件夹')
  })

  it('preserves useful technical detail with a next step', () => {
    expect(userFacingError(new Error('frontmatter 无法解析'), 'read')).toContain('重新连接')
  })

  it('explains that unsaved edits remain available', () => {
    expect(userFacingError(new Error('disk full'), 'save')).toContain('编辑内容仍保留')
  })
})
