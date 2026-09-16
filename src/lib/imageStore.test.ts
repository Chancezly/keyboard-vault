import { describe, expect, it } from 'vitest'
import { resolveLocalImageRef } from './imageStore'

describe('local image references', () => {
  it('keeps Vite and GitHub Pages asset URLs usable after repeated resolution', () => {
    expect(resolveLocalImageRef('/assets/keyboard-abc.jpg')).toBe('/assets/keyboard-abc.jpg')
    expect(resolveLocalImageRef('/Keyboard-vault/assets/keyboard-abc.jpg')).toBe(
      '/Keyboard-vault/assets/keyboard-abc.jpg',
    )
  })
})
