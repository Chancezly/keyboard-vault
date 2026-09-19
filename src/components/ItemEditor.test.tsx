import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlankItem } from '../lib/store'
import { ItemEditor } from './ItemEditor'

describe('ItemEditor quick start', () => {
  it('shows only the essential first-item fields until expanded', () => {
    const html = renderToStaticMarkup(
      <ItemEditor
        item={createBlankItem('keyboards')}
        isNew
        quickStart
        allTags={[]}
        studioSuggestions={[]}
        inventoryItems={[]}
        onSave={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    )

    expect(html).toContain('先添加第一件收藏')
    expect(html).toContain('完善规格、价格、评分和体验')
    expect(html).not.toContain('购买价格')
    expect(html).not.toContain('导出 Markdown')
  })
})
