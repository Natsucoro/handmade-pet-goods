import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { DATA_MODE } from './config.ts'
import { ShopDataContext } from './data/ShopDataContext.tsx'
import { createShopData } from './data/createShopData.ts'
import './index.css'

// お試し表示はどこに置いても動くように、URL を使わずにページを切り替える
const Router = DATA_MODE === 'sample' ? MemoryRouter : BrowserRouter
const root = createRoot(document.getElementById('root')!)

createShopData().then(
  (data) =>
    root.render(
      <StrictMode>
        <ShopDataContext.Provider value={data}>
          <Router>
            <App />
          </Router>
        </ShopDataContext.Provider>
      </StrictMode>,
    ),
  (e) => {
    console.error(e)
    root.render(<p style={{ padding: 16 }}>読み込めませんでした。時間をおいて開き直してください。</p>)
  },
)
