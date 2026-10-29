import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { SampleSwitch } from './components/SampleSwitch.tsx'
import { DATA_MODE } from './config.ts'
import { ShopDataContext } from './data/ShopDataContext.tsx'
import { createShopData } from './data/createShopData.ts'
import './index.css'

const root = createRoot(document.getElementById('root')!)

createShopData().then(
  (data) =>
    root.render(
      <StrictMode>
        <ShopDataContext.Provider value={data}>
          {DATA_MODE === 'sample' ? (
            // お試し表示は「#admin」付きで開くと管理画面から始まる
            <MemoryRouter initialEntries={[location.hash === '#admin' ? '/admin' : '/']}>
              <App />
              <SampleSwitch />
            </MemoryRouter>
          ) : (
            <BrowserRouter>
              <App />
            </BrowserRouter>
          )}
        </ShopDataContext.Provider>
      </StrictMode>,
    ),
  (e) => {
    console.error(e)
    root.render(<p style={{ padding: 16 }}>読み込めませんでした。時間をおいて開き直してください。</p>)
  },
)
