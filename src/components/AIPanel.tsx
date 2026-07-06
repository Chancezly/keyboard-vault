import { useState } from 'react'
import {
  X,
  Sparkles,
  MessageSquare,
  Lightbulb,
  FileText,
  Send,
  Bot,
  User,
} from 'lucide-react'

interface AIPanelProps {
  open: boolean
  onClose: () => void
}

type AIMode = 'chat' | 'summary' | 'recommend' | 'describe'

const MODES: { id: AIMode; label: string; icon: typeof MessageSquare; description: string }[] = [
  { id: 'chat', label: '对话', icon: MessageSquare, description: '与 AI 自由对话，了解你的收藏' },
  { id: 'summary', label: '总结', icon: FileText, description: 'AI 总结收藏概况与趋势' },
  { id: 'recommend', label: '推荐', icon: Lightbulb, description: '根据库存和偏好推荐搭配' },
  { id: 'describe', label: '描述', icon: Sparkles, description: 'AI 帮你完善收藏描述' },
]

const PLACEHOLDER_MESSAGES = [
  {
    role: 'assistant' as const,
    content: '你好！我是 KeyVault AI 助手。我可以帮你总结收藏、推荐搭配、完善描述。第一版暂未接入 AI 能力，敬请期待。',
  },
  {
    role: 'user' as const,
    content: '帮我推荐一套日常办公的键盘搭配',
  },
  {
    role: 'assistant' as const,
    content: '根据你的收藏和偏好（65% 布局、线性轴、偏闷声音），推荐你的「日常办公套装」：\n\n• 键盘：Zoom65 V3 (Gasket)\n• 键帽：KCA 极简灰 (PBT)\n• 轴体：Gateron Ink Black V2\n\n这套搭配已经在你的收藏中，是目前最均衡的日常方案。',
  },
]

export function AIPanel({ open, onClose }: AIPanelProps) {
  const [mode, setMode] = useState<AIMode>('chat')
  const [input, setInput] = useState('')

  if (!open) return null

  return (
    <div className="
      flex flex-col w-[380px] shrink-0 h-full
      glass-strong rounded-2xl mr-3 my-3
      overflow-hidden
    ">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold">AI 助手</h3>
            <p className="text-[10px] text-text-tertiary">Powered by your collection</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 px-4 pb-3">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
              transition-all duration-200
              ${mode === id
                ? 'bg-accent/20 text-accent'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04]'
              }
            `}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      <div className="px-5 pb-3">
        <p className="text-[11px] text-text-tertiary leading-relaxed">
          {MODES.find((m) => m.id === mode)?.description}
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {PLACEHOLDER_MESSAGES.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`
              w-6 h-6 rounded-lg shrink-0 flex items-center justify-center
              ${msg.role === 'assistant' ? 'bg-accent/20' : 'bg-white/10'}
            `}>
              {msg.role === 'assistant'
                ? <Bot className="w-3 h-3 text-accent" />
                : <User className="w-3 h-3 text-text-secondary" />
              }
            </div>
            <div className={`
              max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed
              ${msg.role === 'assistant'
                ? 'bg-white/[0.04] text-text-secondary rounded-tl-md'
                : 'bg-accent/15 text-text-primary rounded-tr-md'
              }
            `}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Coming soon badge */}
        <div className="flex justify-center py-4">
          <span className="text-[10px] px-3 py-1.5 rounded-full bg-white/[0.04] text-text-tertiary border border-white/[0.06]">
            AI 功能即将上线 · 第一版仅展示界面
          </span>
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息... (第一版暂未接入)"
            disabled
            rows={2}
            className="
              w-full px-4 py-3 pr-12 rounded-xl text-[12px] resize-none
              bg-white/[0.04] border border-white/[0.06]
              text-text-primary placeholder:text-text-tertiary
              focus:outline-none focus:border-accent/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            "
          />
          <button
            disabled
            className="
              absolute right-2.5 bottom-2.5 p-2 rounded-lg
              bg-accent/30 text-accent/50
              cursor-not-allowed
            "
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-text-tertiary mt-2 text-center">
          AI 将读取 vault/ 下的 Markdown 文件理解你的收藏
        </p>
      </div>
    </div>
  )
}
