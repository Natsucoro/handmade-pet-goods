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
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
