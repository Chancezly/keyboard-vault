# Keyboard Vault

客制化键盘收藏库 — Local-first · Markdown · AI Native · 收藏管理

## 定位

| 关键词 | 说明 |
|--------|------|
| **Local-first** | 数据存储在本地 `vault/` 目录，Markdown 文件即数据源 |
| **Markdown** | 每件收藏一个 `.md` 文件，YAML frontmatter + 正文描述 |
| **AI Native** | 数据结构为 AI 可读，支持对话、总结、推荐（需自配 API Key） |
| **收藏管理** | 键盘、键帽、轴体、搭配方案统一管理 |

## v1 使用方式

1. 使用 **Chrome 或 Edge** 打开应用
2. 侧栏点击 **「连接本地文件夹」**，选择或新建 vault 目录
3. 空文件夹会自动创建 `keyboards/`、`keycaps/` 等标准结构
4. 连接后所有编辑 **直接写入 `.md` 与本地图片**

未连接时为 **只读演示模式**（浏览内置示例），不可新增 / 编辑 / 删除。

## 功能

- 收藏浏览（卡片 / 列表 / 表格管理）
- 分类筛选（套件 / 键帽 / 轴体 / 搭配）
- 状态筛选（使用中 / 收藏中 / 心愿单 / 已售出）
- 搜索、排序、详情查看（字段与编辑页对齐）
- 图形化编辑：新增 / 编辑 / 上传图片 / 删除（需连接文件夹）
- 表格批量编辑规格、价格、购买时间
- ZIP 备份与恢复（已连接文件夹时）
- AI 助手（可选，需配置 DeepSeek API Key）

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:5173/`，侧栏连接本地 vault 文件夹即可。

## 部署到 GitHub Pages

仓库名建议：`keyboard-vault`  
线上地址：`https://<你的用户名>.github.io/keyboard-vault/`

GitHub Pages 为静态站点，同样支持「连接本地文件夹」。未连接时仅只读演示。

push 到 `main` 后 GitHub Actions 自动构建发布（见 `.github/workflows/deploy.yml`）。

## 浏览器支持

| 浏览器 | 连接本地文件夹 | 说明 |
|--------|----------------|------|
| Chrome / Edge | ✅ | 完整功能 |
| Safari / Firefox | ❌ | 仅只读演示 |

## 数据结构

```
vault/
├── keyboards/              # 套件
├── keycaps/                # 键帽
├── switches/               # 轴体
├── builds/                 # 搭配
├── assets/images/          # 本地图片
├── settings/               # 用户偏好等
└── ai/cache/               # AI 缓存（预留）
```

每件收藏一个 `.md` 文件，frontmatter 存结构化字段，正文存体验描述。

## 技术栈

- Vite + React + TypeScript
- Tailwind CSS v4
- yaml（Front Matter 解析）
- File System Access API（本地读写）
- react-markdown

## UI 风格

Apple × Obsidian — 深色模式、毛玻璃、大留白
