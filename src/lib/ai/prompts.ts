import type { CollectionItem } from '../types'

const BASE_RULES = `你是 KeyVault 客制化键盘收藏库的 AI 助手。
你会收到用户 vault 文件夹中的结构化收藏数据（Markdown front matter 解析结果）和用户偏好。
回答时请：
- 使用中文，简洁专业，像资深客制化玩家
- 推荐必须基于用户**实际库存**中的 id/名称，不要编造不存在的装备
- 搭配推荐需说明键盘、键帽、轴体的组合及理由
- 标签优先从已有词表中选择，必要时可建议新标签并说明原因`

export function systemPrompt(mode: string, context: string): string {
  const ctx = `\n\n---\n以下为用户收藏库数据：\n\n${context}\n---`

  switch (mode) {
    case 'summary':
      return `${BASE_RULES}\n\n当前任务：**收藏总结**\n分析用户的收藏结构、品味趋势、库存缺口、价格分布与评分特点，给出 3-5 条洞察。${ctx}`

    case 'recommend':
      return `${BASE_RULES}\n\n当前任务：**搭配推荐**\n根据库存和偏好，推荐 1-3 套完整键盘搭配（键盘+键帽+轴体）。每套需包含：名称、适用场景、声音/手感预期、是否全部来自现有库存、若缺件则说明替代方案。${ctx}`

    case 'tag':
      return `${BASE_RULES}\n\n当前任务：**自动打标签**\n根据用户对某件收藏的自然语言描述，从已有标签词表中选择最合适的标签（3-8 个）。\n\n回复格式：\n1. 先用 2-3 句话解释标签选择理由\n2. 最后一行必须是纯 JSON（无 markdown 代码块）：\n{"suggestedTags":["标签1","标签2"]}${ctx}`

    case 'preferences':
      return `${BASE_RULES}\n\n当前任务：**用户偏好分析**\n结合 settings/user.md 中的显式偏好与用户收藏的实际数据（配列、品牌、声音取向、轴体类型、评分等），分析：\n1. 显式偏好 vs 实际行为是否一致\n2. 用户的审美与手感画像\n3. 未来购买/搭配建议方向\n4. 可写入 user.md 的偏好补充建议${ctx}`

    default:
      return `${BASE_RULES}\n\n当前任务：**自由对话**\n你可以回答关于收藏、搭配、选购、润轴等问题，始终结合用户实际库存。${ctx}`
  }
}

export function tagUserPrompt(description: string, item?: CollectionItem | null): string {
  let prompt = `请为以下描述推荐标签：\n\n${description}`
  if (item) {
    prompt += `\n\n关联收藏条目：${item.name}（${item.brand}，id: ${item.id}）`
    if (item.tags.length) prompt += `\n已有标签：${item.tags.join(', ')}`
  }
  return prompt
}

export function recommendUserPrompt(scenario: string): string {
  if (!scenario.trim()) return '请根据我的收藏和偏好，推荐最适合的日常使用搭配，并说明理由。'
  return `使用场景：${scenario.trim()}\n\n请推荐最适合的键盘搭配方案。`
}

/** 从 AI 回复中解析 suggestedTags JSON */
export function parseSuggestedTags(content: string): string[] {
  const lines = content.trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line.startsWith('{')) continue
    try {
      const parsed = JSON.parse(line) as { suggestedTags?: string[] }
      if (Array.isArray(parsed.suggestedTags)) {
        return parsed.suggestedTags.filter((t) => typeof t === 'string' && t.trim())
      }
    } catch {
      // try next line
    }
  }
  const match = content.match(/\{"suggestedTags"\s*:\s*\[[^\]]*\]\s*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { suggestedTags?: string[] }
      return parsed.suggestedTags ?? []
    } catch {
      return []
    }
  }
  return []
}
