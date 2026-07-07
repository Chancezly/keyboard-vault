import type { ItemCategory } from '../types'
import { visionCompletion } from './vision'

export interface VisionIdentifyResult {
  category: ItemCategory
  name: string
  brand: string
  layout?: string
  weight?: string
  plate?: string
  profile?: string
  material?: string
  switchType?: string
  color?: string
  manufacturer?: string
  price?: number
  confidence: 'high' | 'medium' | 'low'
  notes?: string
}

const SYSTEM = `你是机械键盘领域的识图助手。根据用户上传的图片，判断是「套件 keyboards」「键帽 keycaps」还是「轴体 switches」，并提取能看出的信息。

只输出一个 JSON 对象，不要 markdown 代码块，不要其它文字。字段：
{
  "category": "keyboards|keycaps|switches",
  "name": "产品名称",
  "brand": "工作室/品牌，看不出则空字符串",
  "layout": "套件配列如 65%/TKL/Alice，非套件留空",
  "weight": "套件配重：铝/铜/刀纹/PVD 等，看不出默认铝",
  "plate": "定位板材质，仅明确可见时填写",
  "profile": "键帽高度 Cherry/SA 等",
  "material": "键帽材质 PBT/ABS 等",
  "switchType": "轴体类型 linear/tactile/silent",
  "color": "配色描述",
  "manufacturer": "轴体代工厂",
  "price": null,
  "confidence": "high|medium|low",
  "notes": "简短识别依据或不确定之处"
}

规则：
- 优先根据键帽形状、轴体透明上盖、套件外壳等判断分类
- 名称尽量具体，如 neo65、GMK Olivia
- 看不准时用 notes 说明，confidence 设为 low`

function parseVisionJson(raw: string): VisionIdentifyResult {
  const trimmed = raw.trim()
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  const data = JSON.parse(jsonText) as Record<string, unknown>

  const category = normalizeCategory(String(data.category ?? 'keyboards'))
  const confidence = normalizeConfidence(String(data.confidence ?? 'medium'))

  return {
    category,
    name: String(data.name ?? '未识别').trim() || '未识别',
    brand: String(data.brand ?? '').trim(),
    layout: optStr(data.layout),
    weight: optStr(data.weight),
    plate: optStr(data.plate),
    profile: optStr(data.profile),
    material: optStr(data.material),
    switchType: optStr(data.switchType),
    color: optStr(data.color),
    manufacturer: optStr(data.manufacturer),
    price: typeof data.price === 'number' ? data.price : undefined,
    confidence,
    notes: optStr(data.notes),
  }
}

function optStr(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  return s || undefined
}

function normalizeCategory(raw: string): ItemCategory {
  if (raw === 'keycaps' || raw === 'switches' || raw === 'keyboards') return raw
  if (/键帽|keycap/i.test(raw)) return 'keycaps'
  if (/轴|switch/i.test(raw)) return 'switches'
  return 'keyboards'
}

function normalizeConfidence(raw: string): 'high' | 'medium' | 'low' {
  if (raw === 'high' || raw === 'low') return raw
  return 'medium'
}

export async function identifyGearFromImage(dataUrl: string): Promise<VisionIdentifyResult> {
  const reply = await visionCompletion([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: '请识别这张机械键盘相关图片中的产品信息。' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ])

  try {
    return parseVisionJson(reply)
  } catch {
    throw new Error(`识图结果解析失败：${reply.slice(0, 120)}`)
  }
}
