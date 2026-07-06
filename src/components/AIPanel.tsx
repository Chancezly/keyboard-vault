import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  X,
  Sparkles,
  MessageSquare,
  Lightbulb,
  FileText,
  Send,
  Bot,
  User,
  Tags,
  Heart,
  Settings,
  Loader2,
  Key,
  Check,
} from 'lucide-react'
import type { CollectionItem, UserPreferences } from '../lib/types'
import { buildCollectionContext } from '../lib/ai/context'
import { chatCompletion, type ChatMessage } from '../lib/ai/deepseek'
import {
  systemPrompt,
  tagUserPrompt,
  recommendUserPrompt,
  parseSuggestedTags,
} from '../lib/ai/prompts'
import { getApiKey, setApiKey, isConfigured } from '../lib/ai/config'
import {
  parseAddWishlistIntent,
  isWishlistImportMessage,
  importFromZFrontierLink,
} from '../lib/zfrontier/wishlist'

interface AIPanelProps {
  open: boolean
  onClose: () => void
  items: CollectionItem[]
  preferences: UserPreferences
  allTags: string[]
  selectedItem?: CollectionItem | null
  onApplyTags?: (itemId: string, tags: string[]) => void
  onSaveWishlistItem?: (item: CollectionItem) => Promise<void>
}

type AIMode = 'chat' | 'summary' | 'recommend' | 'tag' | 'preferences'

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
  suggestedTags?: string[]
}

const MODES: { id: AIMode; label: string; icon: typeof MessageSquare; description: string }[] = [
  { id: 'chat', label: '对话', icon: MessageSquare, description: '与 AI 自由对话，结合你的收藏库存回答' },
  { id: 'summary', label: '总结', icon: FileText, description: '分析收藏结构、品味趋势与库存特点' },
  { id: 'recommend', label: '推荐', icon: Lightbulb, description: '根据库存和偏好推荐键盘搭配方案' },
  { id: 'tag', label: '标签', icon: Tags, description: '根据描述自动推荐标签，可应用到收藏' },
  { id: 'preferences', label: '偏好', icon: Heart, description: '分析显式偏好与实际收藏行为的一致性' },
]

export function AIPanel({
  open,
  onClose,
  items,
  preferences,
  allTags,
  selectedItem,
  onApplyTags,
  onSaveWishlistItem,
}: AIPanelProps) {
  const [mode, setMode] = useState<AIMode>('chat')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [configured, setConfigured] = useState(isConfigured)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const context = useMemo(
    () => buildCollectionContext(items, preferences, allTags),
    [items, preferences, allTags],
  )

  useEffect(() => {
    if (open) {
      setConfigured(isConfigured())
      setApiKeyDraft(getApiKey())
    }
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const runAI = useCallback(
    async (userContent: string) => {
      if (!configured) {
        setShowSettings(true)
        setError('请先配置 DeepSeek API Key')
        return
      }

      setLoading(true)
      setError(null)

      const prior = messagesRef.current
      const userMsg: UIMessage = { role: 'user', content: userContent }
      setMessages([...prior, userMsg])

      try {
        const history: ChatMessage[] = [
          { role: 'system', content: systemPrompt(mode, context) },
          ...prior.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userContent },
        ]

        const reply = await chatCompletion(history)
        const suggestedTags = mode === 'tag' ? parseSuggestedTags(reply) : undefined

        setMessages((prev) => [...prev, { role: 'assistant', content: reply, suggestedTags }])
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [configured, context, mode],
  )

  const runWishlistImport = useCallback(
    async (text: string) => {
      const intent = parseAddWishlistIntent(text)
      if (!intent || !onSaveWishlistItem) return false

      setLoading(true)
      setError(null)
      const userMsg: UIMessage = { role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setInput('')

      try {
        const { item, sourceUrl, matchedTitle, categoryLabel, imageFileName } =
          await importFromZFrontierLink(intent, items)
        await onSaveWishlistItem(item)
        const lines = [
          `已从 zFrontier 链接抓取 **${matchedTitle}**，并加入${categoryLabel}心愿单。`,
          '',
          `- **分类**：${categoryLabel}`,
          `- **名称**：${item.name}`,
          item.brand ? `- **工作室**：${item.brand}` : null,
          item.layout ? `- **配列**：${item.layout}` : null,
          item.weight ? `- **配重**：${item.weight}` : null,
          item.plate ? `- **定位板**：${item.plate}` : null,
          item.profile ? `- **高度**：${item.profile}` : null,
          item.material ? `- **材质**：${item.material}` : null,
          item.switchType ? `- **类型**：${item.switchType}` : null,
          item.price ? `- **参考价**：¥${item.price}${item.currency && item.currency !== 'CNY' ? ` ${item.currency}` : ''}` : null,
          item.history?.[0]?.note ? `- **价格说明**：${item.history[0].note}` : null,
          `- **来源**：[查看原帖](${sourceUrl})`,
          imageFileName ? `- **主图**：\`${imageFileName}\` → vault/assets/images/` : null,
        ].filter(Boolean)
        setMessages((prev) => [...prev, { role: 'assistant', content: lines.join('\n') }])
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
      return true
    },
    [items, onSaveWishlistItem],
  )

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    if (mode === 'chat' && (await runWishlistImport(text))) return
    setInput('')
    runAI(text)
  }

  const handleQuickAction = () => {
    if (loading) return
    switch (mode) {
      case 'summary':
        runAI('请全面分析我的收藏库，给出洞察总结。')
        break
      case 'preferences':
        runAI('请分析我的用户偏好与实际收藏行为。')
        break
      case 'recommend':
        runAI(recommendUserPrompt(input))
        setInput('')
        break
      case 'tag': {
        const desc =
          input.trim() ||
          (selectedItem
            ? `${selectedItem.name}（${selectedItem.brand}）\n${selectedItem.content || '暂无体验描述'}`
            : '')
        if (!desc) {
          setError('请先输入描述，或选中一件收藏')
          return
        }
        runAI(tagUserPrompt(desc, selectedItem))
        setInput('')
        break
      }
    }
  }

  const saveApiKey = () => {
    setApiKey(apiKeyDraft)
    setConfigured(isConfigured())
    setShowSettings(false)
    setError(null)
  }

  const switchMode = (id: AIMode) => {
    setMode(id)
    setMessages([])
    setError(null)
    setInput('')
  }

  if (!open) return null

  const quickActionLabel: Record<AIMode, string | null> = {
    chat: null,
    summary: '分析收藏',
    recommend: '获取推荐',
    tag: '生成标签',
    preferences: '分析偏好',
  }

  return (
    <div className="flex flex-col w-[400px] shrink-0 h-full glass-strong rounded-2xl mr-3 my-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold">AI 助手</h3>
            <p className="text-[10px] text-text-tertiary">
              DeepSeek · {items.length} 件收藏已载入
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-all ${
              showSettings ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary hover:bg-white/[0.06]'
            }`}
            title="API 设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* API Settings */}
      {showSettings && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-text-secondary">
            <Key className="w-3.5 h-3.5" />
            DeepSeek API Key
          </div>
          <input
            type="password"
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg text-[12px] bg-white/[0.06] border border-white/[0.08] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40"
          />
          <div className="flex items-center justify-between">
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-accent hover:underline"
            >
              获取 API Key →
            </a>
            <button
              onClick={saveApiKey}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-accent/90 text-white hover:bg-accent transition-all"
            >
              <Check className="w-3 h-3" /> 保存
            </button>
          </div>
          <p className="text-[10px] text-text-tertiary leading-relaxed">
            Key 仅保存在本浏览器 localStorage，不会上传到任何服务器。
          </p>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-1 px-4 pb-3">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchMode(id)}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
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

      <div className="px-5 pb-2">
        <p className="text-[11px] text-text-tertiary leading-relaxed">
          {MODES.find((m) => m.id === mode)?.description}
        </p>
        {mode === 'tag' && selectedItem && (
          <p className="text-[10px] text-accent/80 mt-1">
            当前选中：{selectedItem.name}
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="w-8 h-8 text-text-tertiary/40 mb-3" />
            <p className="text-[12px] text-text-tertiary max-w-[240px] leading-relaxed">
              {mode === 'chat'
                ? '粘贴 zFrontier 帖子链接，例如：帮我把这个链接中的套件加入愿望单 https://www.zfrontier.com/app/flow/…'
                : `点击下方「${quickActionLabel[mode]}」开始，或在输入框描述需求。`}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center ${
                msg.role === 'assistant' ? 'bg-accent/20' : 'bg-white/10'
              }`}
            >
              {msg.role === 'assistant' ? (
                <Bot className="w-3 h-3 text-accent" />
              ) : (
                <User className="w-3 h-3 text-text-secondary" />
              )}
            </div>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-white/[0.04] text-text-secondary rounded-tl-md'
                  : 'bg-accent/15 text-text-primary rounded-tr-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content.replace(/\{"suggestedTags"[^}]+\}/, '').trim()}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}

              {msg.suggestedTags && msg.suggestedTags.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/[0.06]">
                  <p className="text-[10px] text-text-tertiary mb-1.5">建议标签</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {msg.suggestedTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {selectedItem && onApplyTags && (
                    <button
                      onClick={() => onApplyTags(selectedItem.id, msg.suggestedTags!)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-all"
                    >
                      应用到「{selectedItem.name}」
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-center text-text-tertiary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[12px]">
              {messages.at(-1)?.role === 'user' && isWishlistImportMessage(messages.at(-1)?.content ?? '')
                ? '正在从 zFrontier 链接抓取信息…'
                : 'DeepSeek 思考中…'}
            </span>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/[0.06] space-y-2">
        {quickActionLabel[mode] && (
          <button
            onClick={handleQuickAction}
            disabled={loading || (mode === 'tag' && !input.trim() && !selectedItem)}
            className="w-full py-2 rounded-xl text-[12px] font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {quickActionLabel[mode]}
          </button>
        )}

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && mode === 'chat') {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              mode === 'chat'
                ? '输入消息，或粘贴 zFrontier 链接加入愿望单… (Enter 发送)'
                : mode === 'recommend'
                  ? '描述使用场景，如「日常办公」「闷声打字」…'
                  : mode === 'tag'
                    ? '描述这件收藏的特点、用途、声音…'
                    : '可选：补充分析方向…'
            }
            disabled={loading}
            rows={2}
            className="
              w-full px-4 py-3 pr-12 rounded-xl text-[12px] resize-none
              bg-white/[0.06] border border-white/[0.08]
              text-text-primary placeholder:text-text-tertiary
              focus:outline-none focus:border-accent/30
              disabled:opacity-50 transition-all duration-200
            "
          />
          {mode === 'chat' && (
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="
                absolute right-2.5 bottom-2.5 p-2 rounded-lg
                bg-accent/90 text-white hover:bg-accent
                disabled:opacity-40 disabled:cursor-not-allowed transition-all
              "
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!configured && (
          <p className="text-[10px] text-amber-400/80 text-center">
            点击右上角 ⚙ 配置 DeepSeek API Key 后启用
          </p>
        )}
      </div>
    </div>
  )
}
