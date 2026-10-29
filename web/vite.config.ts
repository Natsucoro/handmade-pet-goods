/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const domain = fileURLToPath(new URL('../functions/src/domain', import.meta.url))

export default defineConfig({
  plugins: [react()],
  // お試し表示（sample）のときは、どこに置いても動くように相対パスにする
  base: process.env.VITE_DATA_MODE === 'sample' ? './' : '/',
  resolve: { alias: { '@domain': domain } },
  // 写真の変換プログラムは開発中に事前まとめをしない（wasm を正しく読むため）
  optimizeDeps: { exclude: ['@jsquash/webp'] },
  // お試し表示は1つのファイルにまとめる（置き場所によっては分けたファイルを読めないため）
  build: process.env.VITE_DATA_MODE === 'sample' ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
