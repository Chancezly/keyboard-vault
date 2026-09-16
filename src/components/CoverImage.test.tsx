import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CoverImage } from './CoverImage'

describe('CoverImage layout', () => {
  it('lets an absolute card cover fill its frame instead of forcing relative positioning', () => {
    const html = renderToStaticMarkup(
      <CoverImage
        src="data:image/jpeg;base64,AQID"
        alt="cover"
        className="absolute inset-0"
      />,
    )

    expect(html).toContain('class="overflow-hidden bg-[#16161a] absolute inset-0"')
    expect(html).toContain('class="block w-full h-full object-cover')
    expect(html).not.toContain('relative overflow-hidden')
  })
})
