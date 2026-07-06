---
identity:
  id: tags
  type: tag-taxonomy
  name: Tag Taxonomy
groups:
  usage:
    label: 用途
    values:
      - daily
      - office
      - gaming
      - showcase
      - collectible
      - travel
  sound:
    label: 声音
    values:
      - thocky
      - clacky
      - muted
      - crisp
      - deep
      - marble
  style:
    label: 风格
    values:
      - minimal
      - retro
      - theme
      - colorful
      - monochrome
      - balanced
  layout:
    label: 配列
    values:
      - 60%
      - 65%
      - 75%
      - tkl
      - full-size
      - alice
  material:
    label: 材质
    values:
      - aluminum
      - copper
      - pc
      - abs
      - pbt
      - fr4
---

# Tag Taxonomy

标签词表，用于统一收藏文件里的 `tags` 分组取值，避免同义词发散（例如 `muted` / `静音` / `安静` 混用）。

在收藏文件中，`tags` 按分组书写：

```yaml
tags:
  usage: [daily, office]
  sound: [muted]
  style: [minimal]
```

AI 生成标签时应优先从本词表中选择，若需要新增取值，也应回写到这里，保持词表收敛。
