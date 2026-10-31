import { defineConfig } from '@playwright/test'

// スマホの大きさで、練習用 Firebase に置いた本番と同じ作りの画面を確かめる（npm run test:e2e）
export default defineConfig({
  testDir: 'e2e',
  // 練習用 Firebase のデータを全部のテストで共有するので、1つずつ順番に（ファイル名の番号順）動かす
  workers: 1,
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:5050',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'スマホ', use: { browserName: 'chromium' } }],
})
