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
}))
