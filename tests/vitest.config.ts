import { defineConfig } from 'vitest/config'

// 練習用 Firebase（エミュレーター）を使うテスト。`npm run test:emulator` から動かす
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
