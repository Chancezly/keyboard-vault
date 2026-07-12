/**
 * 从套件名称推断配列。仅在名称中出现明确数字/关键词时返回。
 * 匹配优先级：更具体的数字优先（104 > 100/98 > TKL > 75 > 65 > 60）。
 */
export function inferLayoutFromName(name: string): string | undefined {
  const n = name.trim()
  if (!n) return undefined

  const lower = n.toLowerCase()
  if (/alice/.test(lower)) return 'Alice'

  // 用「非数字边界」匹配，兼容 Neo65 / Evo75 / QK80 这类粘连写法
  const rules: [RegExp, string][] = [
    [/(?:^|[^0-9])104(?:[^0-9]|$)/i, '104%'],
    [/(?:^|[^0-9])(?:98|100)(?:[^0-9]|$)/i, '98%'],
    [/(?:^|[^0-9])(?:80|85|87)(?:[^0-9]|$)/i, 'TKL'],
    [/(?:^|[^0-9])75(?:[^0-9]|$)/i, '75%'],
    [/(?:^|[^0-9])65(?:[^0-9]|$)/i, '65%'],
    [/(?:^|[^0-9])60(?:[^0-9]|$)/i, '60%'],
  ]

  for (const [re, layout] of rules) {
    if (re.test(n)) return layout
  }

  if (/\btkl\b|tenkeyless/i.test(lower)) return 'TKL'
  return undefined
}
