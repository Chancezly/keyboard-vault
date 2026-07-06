---
identity:
  id: schema
  type: schema-definition
  name: Vault Schema
version: 1
principles:
  - Front Matter 只放结构化字段
  - 正文只放自然语言评价和体验（Experience）
  - 字段使用英文键名，内容可写中文
modules:
  identity:
    description: 它是谁
    fields:
      - id
      - name
      - type
      - maker
  specification:
    description: 它是什么（客观参数）
    fields:
      - layout
      - formFactor
      - mount
      - material
      - profile
      - switchType
      - soundProfile
      - feelProfile
  state:
    description: 它现在什么样
    fields:
      - status
      - condition
      - location
      - inUse
  relations:
    description: 它和谁有关（只放 id 引用）
    fields:
      - keyboard
      - keycaps
      - switches
      - stabilizers
      - plate
      - case
  rating:
    description: 你的评价（多维）
    fields:
      - overall
      - sound
      - feel
      - build
      - aesthetics
      - scale
  tags:
    description: 结构化分组标签
    groups:
      - usage
      - sound
      - style
  history:
    description: 它经历了什么（时间线）
    fields:
      - date
      - event
      - note
      - price
      - currency
  images:
    description: 图片
    fields:
      - hero
      - gallery
  ai:
    description: AI 元数据（与 ai/cache 共享字段）
    fields:
      - summary
      - suggestedTags
      - recommendation
      - model
      - generatedAt
statusEnum:
  - owned
  - wishlist
  - sold
  - building
categoryEnum:
  - keyboards
  - keycaps
  - switches
  - builds
---

# Vault Schema

这是收藏库的数据结构定义，作为所有 Markdown 文件的"单一事实来源"。每个文件都是一个**领域对象（Domain Object）**，而不是配置文件。

- `keyboard.md` 描述一个键盘实体
- `switch.md` 描述一个轴体实体
- `build.md` 描述一套搭配（通过 `relations` 关联其它实体）

AI 在总结、推荐、生成描述时，应以此 schema 为准来理解字段含义。
