import { describe, expect, it } from 'vitest'
import { getExperienceEnvironment } from './vaultCapabilities'

describe('getExperienceEnvironment', () => {
  it('recognizes Xiaohongshu on iPhone', () => {
    const result = getExperienceEnvironment('Mozilla/5.0 (iPhone) XiaoHongShu/9.1')
    expect(result).toEqual({ mobile: true, inAppBrowser: true, inAppName: '小红书' })
  })

  it('keeps desktop Chrome in the full experience', () => {
    const result = getExperienceEnvironment('Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36')
    expect(result).toEqual({ mobile: false, inAppBrowser: false, inAppName: undefined })
  })
})
