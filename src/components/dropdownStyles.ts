// 统一的表单输入框样式（文本框 / 组合框共用）
export const fieldInputClass =
  'w-full px-3 py-2 rounded-lg text-[13px] bg-white/[0.06] border border-white/[0.08] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 focus:bg-white/[0.09] transition-all'

// 统一的下拉弹出层：高不透明度，避免选项被背景穿透
export const dropdownPanelClass =
  'absolute z-30 mt-1 rounded-lg border border-white/10 bg-surface-elevated/95 backdrop-blur-2xl shadow-xl shadow-black/50 py-1 max-h-60 overflow-auto'

export function dropdownItemClass(active: boolean) {
  return `w-full text-left px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
    active ? 'text-accent bg-accent/15' : 'text-text-secondary hover:bg-white/[0.08]'
  }`
}
