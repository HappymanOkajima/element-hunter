import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/element-hunter/' : '/',
  build: {
    assetsInlineLimit: 0,
    minify: false,
  },
}))
