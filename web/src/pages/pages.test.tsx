import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopDataContext } from '../data/ShopDataContext.tsx'
import { createSampleShopData } from '../data/sampleShopData.ts'
import { ProductListPage } from './ProductListPage.tsx'
import { ProductPage } from './ProductPage.tsx'

function renderAt(path: string) {
  return render(
    <ShopDataContext.Provider value={createSampleShopData()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    </ShopDataContext.Provider>,
  )
}

describe('商品一覧', () => {
  it('公開中の商品だけを新しい順に、値段と在庫の状態つきで出す', async () => {
    renderAt('/')
    const items = await screen.findAllByRole('listitem')
    expect(items.map((li) => within(li).getByRole('heading').textContent)).toEqual([
      '文鳥のつぼ巣（わら編み）',
      'オカメインコの布ハンモック',
      'モモンガの寝袋ポーチ',
      '文鳥のおやつ入れ',
      '止まり木カバー 3本セット',
    ])
    expect(screen.queryByText(/非公開/)).toBeNull()
    expect(within(items[0]).getByText('3,000円')).toBeInTheDocument()
    expect(within(items[0]).getByText('在庫あり')).toBeInTheDocument()
    expect(within(items[1]).getByText('受注生産（約14日でお届け）')).toBeInTheDocument()
    expect(within(items[2]).getByText('残り2個')).toBeInTheDocument()
    expect(within(items[3]).getByText('受注生産（約7日でお届け）')).toBeInTheDocument()
    expect(within(items[4]).getByText('売り切れ')).toBeInTheDocument()
  })
})

describe('商品ページ', () => {
  it('写真・キャプション・選択肢の値段・説明・送料を出す', async () => {
    renderAt('/products/sample-tsubosu')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('文鳥のつぼ巣（わら編み）')
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getByText('入口は少し広めです')).toBeInTheDocument()
    expect(screen.getByText('+500円')).toBeInTheDocument()
    expect(screen.getByText('ひとつずつ手で編んだ、ふっくらつぼ巣です')).toBeInTheDocument()
    expect(screen.getByText('ご注文から約4日でお届けします。')).toBeInTheDocument()
    expect(screen.getByText('870円〜1,500円（お届け先で変わります）')).toBeInTheDocument()
  })

  it('都道府県を選ぶと送料が出る', async () => {
    renderAt('/products/sample-tsubosu')
    const select = await screen.findByRole('combobox', { name: 'お届け先の都道府県' })
    await userEvent.selectOptions(select, '01')
    expect(screen.getByText('1,200円')).toBeInTheDocument()
  })

  it('全国一律の送料', async () => {
    renderAt('/products/sample-hammock')
    expect(await screen.findByText('200円')).toBeInTheDocument()
    expect(screen.getByText('ご注文を受けてから作ります。約14日でお届けします。')).toBeInTheDocument()
  })

  it('非公開やない商品は「見つかりません」', async () => {
    renderAt('/products/sample-draft')
    expect(await screen.findByText('この商品は見つかりませんでした。')).toBeInTheDocument()
  })

  it('売り切れの商品は買えないことがわかる', async () => {
    renderAt('/products/sample-perch')
    expect(await screen.findByRole('button', { name: '売り切れ' })).toBeDisabled()
  })
})
