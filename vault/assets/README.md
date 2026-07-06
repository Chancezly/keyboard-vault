# Vault Assets

本地资源目录，强调 KeyVault 的 **Local-first** 属性 —— 图片和收藏数据一样存在本地，不依赖外部图床。

## images/

存放收藏图片。在收藏 Markdown 里用文件名引用即可，程序会自动解析为本地资源：

```yaml
images:
  hero: zoom65-v3.jpg          # 本地图片，放在 vault/assets/images/ 下
  gallery:
    - zoom65-v3-side.jpg
    - zoom65-v3-back.jpg
```

支持的格式：`png` `jpg` `jpeg` `webp` `gif` `avif` `svg`。

## icons/

存放自定义图标（如品牌 logo、分类图标、状态标记等），与照片类的 `images/` 区分开，便于统一管理小尺寸矢量/位图资源。

## 兼容远程 URL

仍然兼容 `https://` 开头的远程图片地址；只有非 URL 的引用才会被当作本地文件名解析。建议逐步把图片下载到本地，实现完全离线可用。
