import { defineConfig } from '@playwright/test'

// スマホの大きさで、練習用 Firebase に置いた本番と同じ作りの画面を確かめる（npm run test:e2e）
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5050',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'スマホ', use: { browserName: 'chromium' } }],
})
