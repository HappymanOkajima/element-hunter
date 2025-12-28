import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.BASE_URL || '/',
  build: {
    assetsInlineLimit: 0,
  },
})
