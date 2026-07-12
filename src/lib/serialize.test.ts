import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { parseItemMarkdown } from './parser'
import { serializeItem } from './serialize'

function frontmatter(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!match) throw new Error('missing frontmatter')
  return parse(match[1]) as Record<string, unknown>
}

describe('Markdown lossless round trip', () => {
  it('preserves local data not edited by the app', () => {
    const raw = `---
identity:
  id: kb-001
  name: Test
  brand: Brand
state:
  status: collection
  location: cabinet
custom:
  keep: yes
notes:
  private: local only
ai:
  summary: existing summary
images:
  hero: hero.jpg
  gallery:
    - gallery-a.jpg
    - gallery-b.jpg
---

体验正文
`
    const item = parseItemMarkdown(raw, 'keyboards', 'keyboards/test.md')
    const output = frontmatter(serializeItem(item))

    expect(output.custom).toEqual({ keep: 'yes' })
    expect(output.notes).toEqual({ private: 'local only' })
    expect(output.ai).toEqual({ summary: 'existing summary' })
    expect(output.state).toMatchObject({ location: 'cabinet' })
    expect(output.images).toEqual({
      hero: 'hero.jpg',
      gallery: ['gallery-a.jpg', 'gallery-b.jpg'],
    })
  })

  it('updates known values while retaining unknown keys in the same section', () => {
    const item = parseItemMarkdown(`---
identity:
  id: kb-002
  name: Before
  brand: Brand
  externalId: abc
state:
  status: collection
  privateFlag: true
---
`, 'keyboards', 'keyboards/before.md')
    item.name = 'After'
    item.location = 'desk'
    const output = frontmatter(serializeItem(item))

    expect(output.identity).toMatchObject({ name: 'After', externalId: 'abc' })
    expect(output.state).toMatchObject({ location: 'desk', privateFlag: true })
  })
})
