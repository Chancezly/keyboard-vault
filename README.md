# KeyVault

客制化键盘收藏库 — Local-first · Markdown · AI Native · 收藏管理

## 定位

| 关键词 | 说明 |
|--------|------|
| **Local-first** | 数据存储在本地 `vault/` 目录，Markdown 文件即数据源 |
| **Markdown** | 每件收藏一个 `.md` 文件，YAML frontmatter + 正文描述 |
| **AI Native** | 数据结构为 AI 可读，未来将支持总结、推荐、描述管理 |
| **收藏管理** | 键盘、键帽、轴体、搭配方案统一管理 |

## 第一版功能

- 收藏浏览（卡片 / 列表视图）
- 分类筛选（键盘 / 键帽 / 轴体 / 搭配）
- 状态筛选（已拥有 / 心愿单 / 已出 / 搭建中）
- 搜索与详情查看
- 图形化编辑：新增 / 编辑信息 / 修改状态 / 上传图片 / 删除
- 连接本地文件夹后**编辑即存盘**（File System Access API）
- AI 助手面板（UI 占位，暂未接入 AI）

## 编辑与本地读写

两种模式：

| 模式 | 触发 | 数据去向 |
|------|------|----------|
| **浏览器模式** | 默认（未连接文件夹） | 编辑存于浏览器 localStorage，可导出 Markdown |
| **本地文件夹模式** | 侧栏「连接本地文件夹」 | 编辑直接读写本地 `vault/` 下的 `.md` 与图片 |

- 本地文件夹模式基于浏览器 **File System Access API**（Chrome / Edge 支持），授权一次后会记住该文件夹（IndexedDB 保存句柄），刷新自动重连
- 编辑保存时按 `vault/<分类>/<id>.md` 写回，上传的图片写入 `vault/assets/images/`
- 原始 Markdown 始终是权威数据源，符合 Local-first 定位

## 快速开始

```bash
npm install
npm run dev
```

## 数据结构

```
vault/
├── keyboards/              # 键盘
├── keycaps/               # 键帽
├── switches/              # 轴体
├── builds/                # 搭配方案
│
├── assets/                 # 本地资源（Local-first）
│   ├── images/             # 收藏图片，Markdown 用文件名引用
│   └── icons/              # 自定义图标
│
├── settings/               # 库配置（非收藏条目）
│   ├── user.md             # 个人偏好（供 AI 理解）
│   ├── tags.md             # 标签词表
│   └── schema.md           # 数据结构定义（单一事实来源）
│
└── ai/                     # AI 数据（预留，暂未接入）
    └── cache/              # AI 生成结果缓存
```

图片优先本地化：把图片放到 `vault/assets/images/`，在 Markdown 里用文件名引用（如 `hero: zoom65-v3.jpg`），程序会自动解析为本地资源；`https://` 远程地址仍兼容。

每件收藏的 Markdown 遵循三个原则：

- Front Matter（`---`）只放结构化字段
- 正文只放自然语言评价和体验
- 字段尽量使用英文键名，内容可以写中文

Front Matter 固定分成 7 个模块：

1. `identity`
2. `specification`
3. `build`
4. `rating`
5. `tags`
6. `images`
7. `notes`

示例：

```markdown
---
identity:
  id: kb-001
  name: Zoom65 V3
  brand: Wuque Studio
  status: owned
specification:
  layout: "65%"
  mount: Gasket
  material: aluminum
build:
  acquired: 2024-03-15
  price: 1899
  currency: CNY
rating:
  score: 4.5
  scale: 5
tags:
  - 65%
  - gasket
  - aluminum
images:
  hero: https://...
  gallery: []
notes:
  role: daily-driver
  soundProfile: muted
---

Zoom65 V3 是我目前最常拿来办公的一把键盘。它的 Gasket 手感比较轻松，
长时间打字不会有太强的疲劳感。
```

## 领域对象（Domain Object）

每个 Markdown 文件不是"配置文件"，而是一个**领域对象**：`keyboard.md` 描述一个键盘实体，`switch.md` 描述一个轴体实体。搭配（build）作为组合实体，采用更完整的模块结构：

| 模块 | 含义 | 说明 |
|------|------|------|
| `identity` | 它是谁 | `id` / `name` / `type` / `maker` |
| `specification` | 它是什么 | 客观参数：`layout` / `mount` / `formFactor` / `soundProfile` |
| `state` | 它现在什么样 | `status` / `condition` / `location` / `inUse` |
| `relations` | 它和谁有关 | 用 `id` 引用其它实体（键盘 / 键帽 / 轴体） |
| `rating` | 你的评价 | 多维评分：`overall` / `sound` / `feel` / `build` / `aesthetics` |
| `tags` | 结构化标签 | 分组标签，而非扁平字符串 |
| `history` | 它经历了什么 | 时间线事件（含购入、改装记录） |
| `ai` | AI 元数据 | AI 生成的总结、标签、推荐 |

原则：

- `relations` 只放 `id` 引用，不复制其它实体的字段
- 购买信息属于 `history`（一次事件），不属于 `build`
- `specification` 只放客观事实，主观评价放正文（Experience）

build 示例：

```markdown
---
identity:
  id: bd-001
  name: Daily Office
  type: build
  maker: self
specification:
  layout: "65%"
  formFactor: 65%
  mount: Gasket
  soundProfile: muted
state:
  status: building
  condition: in-use
  location: desk
relations:
  keyboard: kb-001
  keycaps: kc-002
  switches: sw-001
rating:
  overall: 4.5
  sound: 4
  feel: 5
  build: 4
  aesthetics: 4
  scale: 5
tags:
  usage: [daily, office]
  sound: [muted]
  style: [minimal]
history:
  - date: 2024-03-15
    event: assembled
    note: 初次组装为日常主力
    price: 2200
    currency: CNY
  - date: 2024-06-18
    event: reworked
    note: 补润轴体，调整 gasket 条手感
ai:
  summary: ""
  suggestedTags: []
  recommendation: ""
---

这套日常办公搭配是目前最均衡的一套……（Experience 真实体验）
```

## 技术栈

- Vite + React + TypeScript
- Tailwind CSS v4
- yaml（Front Matter 解析）
- react-markdown（内容渲染）

## UI 风格

Apple × Obsidian × Arc Browser — 深色模式、毛玻璃、大留白、大图卡片
