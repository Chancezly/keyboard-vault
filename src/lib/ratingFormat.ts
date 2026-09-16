/** 显示评分数字：整数不带小数，半星显示一位小数 */
export function formatRating(value?: number): string {
  if (value == null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
