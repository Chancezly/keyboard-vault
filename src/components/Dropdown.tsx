import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// 统一的表单输入框样式（文本框 / 组合框共用）
export const fieldInputClass =
  'w-full px-3 py-2 rounded-lg text-[13px] bg-white/[0.06] border border-white/[0.08] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 focus:bg-white/[0.09] transition-all'

// 统一的下拉触发按钮样式（不含宽度，由外层控制）
const triggerBase =
  'px-3 py-2 rounded-lg text-[13px] bg-white/[0.06] border border-white/[0.08] text-text-primary hover:bg-white/[0.09] focus:outline-none focus:border-accent/40 transition-all flex items-center justify-between gap-2 cursor-pointer'

// 统一的下拉弹出层：高不透明度，避免选项被背景穿透
export const dropdownPanelClass =
  'absolute z-30 mt-1 rounded-lg border border-white/10 bg-surface-elevated/95 backdrop-blur-2xl shadow-xl shadow-black/50 py-1 max-h-60 overflow-auto'

export function dropdownItemClass(active: boolean) {
  return `w-full text-left px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
    active ? 'text-accent bg-accent/15' : 'text-text-secondary hover:bg-white/[0.08]'
  }`
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])
  return ref
}

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  placeholder?: string
  buttonClassName?: string
  align?: 'left' | 'right'
  fullWidth?: boolean
}

// 非可编辑的选择型下拉
export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  buttonClassName,
  align = 'left',
  fullWidth = true,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))
  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName ?? `${triggerBase} ${fullWidth ? 'w-full' : ''}`}
      >
        <span className={current ? '' : 'text-text-tertiary'}>{current?.label ?? placeholder ?? '请选择'}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`${dropdownPanelClass} ${align === 'right' ? 'right-0' : 'left-0'} ${fullWidth ? 'w-full' : 'w-max min-w-[7rem]'}`}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={dropdownItemClass(o.value === value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ComboSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
}

// 可编辑的组合框：可从预设中选择，也支持自行输入
export function ComboSelect({ value, onChange, options, placeholder }: ComboSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useOutsideClose(open, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <input
        className={`${fieldInputClass} pr-9`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`${dropdownPanelClass} left-0 w-full`}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className={dropdownItemClass(value === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
