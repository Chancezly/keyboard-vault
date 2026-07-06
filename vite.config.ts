import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: https://<user>.github.io/keyboard-vault/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/keyboard-vault/' : '/',
  plugins: [react(), tailwindcss()],
}))
