import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function pagesBase(): string {
  // GitHub Actions sets GITHUB_REPOSITORY = "owner/Repo-Name"
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  return repo ? `/${repo}/` : '/Keyboard-vault/'
}

// GitHub Pages: https://<user>.github.io/<repo-name>/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? pagesBase() : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 开发环境代理 zFrontier API，规避浏览器 CORS
      '/api/zfrontier': {
        target: 'https://www.zfrontier.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/zfrontier/, ''),
        configure: (proxy) => {
          // 浏览器 Origin 是 localhost，zFrontier 会拒绝 → token mismatch
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'https://www.zfrontier.com')
            proxyReq.setHeader('Referer', 'https://www.zfrontier.com/app/')
          })
        },
      },
      '/img/zfrontier': {
        target: 'https://img.zfrontier.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/img\/zfrontier/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Referer', 'https://www.zfrontier.com/')
          })
        },
      },
    },
  },
}))
