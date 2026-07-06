# AI

AI 相关的本地数据目录。第一版仅预留结构、不接入 AI；后续接入时，AI 的产出同样以本地 Markdown / JSON 落盘，延续 **Local-first** 与 **AI Native** 定位。

## cache/

AI 生成结果的缓存，避免重复调用模型。

- 按条目 id 缓存，例如 `cache/kb-001.md`
- `_template.md` 是空模板
- 字段与收藏文件里的 `ai` 模块**完全对齐**，方便双向同步：

| 字段 | 说明 | 收藏文件 `ai` | 缓存文件 |
|------|------|:---:|:---:|
| `summary` | AI 总结 | ✓ | ✓ |
| `suggestedTags` | AI 建议标签 | ✓ | ✓ |
| `recommendation` | AI 推荐搭配 | ✓ | ✓ |
| `model` | 生成所用模型 | ✓ | ✓ |
| `generatedAt` | 生成时间 | ✓ | ✓ |
| `ref` | 指向条目 id | — | ✓ |

缓存文件示例（`cache/kb-001.md`）：

```yaml
---
ref: kb-001
model: gpt-x
generatedAt: 2026-07-06T00:00:00Z
summary: AI 生成的收藏总结……
suggestedTags:
  - daily
  - muted
recommendation: 推荐搭配建议……
---
```

## 设计原则

- AI 只**读取** `vault/` 下的结构化数据（收藏 + `settings/`）来理解收藏与偏好
- AI 的**写入**集中在这里（cache）或收藏文件的 `ai` 模块，与用户手写字段分离
- 缓存可安全删除并重新生成，不影响原始收藏数据
