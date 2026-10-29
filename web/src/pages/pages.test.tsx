import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ShopDataContext } from '../data/ShopDataContext.tsx'
import { createSampleShopData } from '../data/sampleShopData.ts'
import { ProductListPage } from './ProductListPage.tsx'
import { ProductPage } from './ProductPage.tsx'

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

function renderAt(path: string) {
  return render(
    <ShopDataContext.Provider value={createSampleShopData()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </ShopDataContext.Provider>,
  )
}

const cardNames = async () =>
  (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent)

describe('商品一覧', () => {
  it('公開中の商品だけを、お姉ちゃんが決めた表示順に、値段と在庫の状態つきで出す', async () => {
    renderAt('/')
    const items = await screen.findAllByRole('listitem')
    expect(items.map((li) => within(li).getByRole('heading').textContent)).toEqual([
      '文鳥のつぼ巣（わら編み）',
      'モモンガの寝袋ポーチ',
      'オカメインコの布ハンモック',
      '文鳥のおやつ入れ',
      '止まり木カバー 3本セット',
    ])
    expect(screen.getByText('件').textContent).toContain('5')
    expect(screen.queryByText(/非公開/)).toBeNull()
    expect(within(items[0]).getByText('3,000円')).toBeInTheDocument()
    expect(within(items[0]).getByText('在庫あり')).toBeInTheDocument()
    expect(within(items[2]).getByText('受注生産（約14日でお届け）')).toBeInTheDocument()
    expect(within(items[1]).getByText('残り2個')).toBeInTheDocument()
    expect(within(items[3]).getByText('受注生産（約7日でお届け）')).toBeInTheDocument()
    expect(within(items[4]).getByText('売り切れ')).toBeInTheDocument()
  })
})

describe('絞り込み', () => {
  it('カテゴリを押すとそのカテゴリだけになり、URL にも残る。もう一度押すと戻る', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('button', { name: 'モモンガ' }))
    expect(await cardNames()).toEqual(['モモンガの寝袋ポーチ'])
    expect(screen.getByTestId('where')).toHaveTextContent('/?cat=sample-cat-momonga')
    await userEvent.click(screen.getByRole('button', { name: 'モモンガ' }))
    expect(await cardNames()).toHaveLength(5)
  })

  it('URL の条件で開くと、その条件の一覧になる', async () => {
    renderAt('/?cat=sample-cat-buncho&sort=price_asc')
    expect(await cardNames()).toEqual(['止まり木カバー 3本セット', '文鳥のおやつ入れ', '文鳥のつぼ巣（わら編み）'])
    expect(screen.getByRole('combobox')).toHaveValue('price_asc')
  })

  it('並び替え・在庫あり・値段で絞り込める', async () => {
    renderAt('/')
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'price_desc')
    expect((await cardNames())[0]).toBe('文鳥のつぼ巣（わら編み）')
    await userEvent.click(screen.getByRole('button', { name: '絞り込み' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'すぐ届くもの（在庫あり）だけ' }))
    expect(await cardNames()).toEqual(['文鳥のつぼ巣（わら編み）', 'モモンガの寝袋ポーチ'])
    await userEvent.click(screen.getByRole('button', { name: '2,000〜2,999円' }))
    expect(await cardNames()).toEqual(['モモンガの寝袋ポーチ'])
    expect(screen.getByRole('button', { name: '絞り込み（2）' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '条件をクリア' }))
    expect(await cardNames()).toHaveLength(5)
  })

  it('キーワードで探せる。見つからなければ「すべての商品を見る」で戻れる', async () => {
    renderAt('/')
    await userEvent.type(await screen.findByRole('searchbox'), 'きりん{enter}')
    expect(await screen.findByText('条件に合う商品がありません。')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'すべての商品を見る' }))
    expect(await cardNames()).toHaveLength(5)
  })
})

describe('戻る導線', () => {
  it('一覧から開いた商品ページの「一覧にもどる」で、同じ条件の一覧に戻る', async () => {
    renderAt('/?cat=sample-cat-buncho')
    await userEvent.click(await screen.findByRole('link', { name: /文鳥のおやつ入れ/ }))
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('文鳥のおやつ入れ')
    await userEvent.click(screen.getAllByRole('button', { name: /一覧にもどる/ })[0])
    expect(await cardNames()).toHaveLength(3)
    expect(screen.getByTestId('where')).toHaveTextContent('/?cat=sample-cat-buncho')
  })

  it('URL を直接開いたときの「一覧にもどる」は、すべての商品の一覧へ', async () => {
    renderAt('/products/sample-hammock')
    await userEvent.click((await screen.findAllByRole('button', { name: /一覧にもどる/ }))[0])
    expect(await cardNames()).toHaveLength(5)
  })

  it('商品ページにカテゴリの場所と、同じカテゴリのおすすめが出る', async () => {
    renderAt('/products/sample-tsubosu')
    const crumb = await screen.findByRole('navigation', { name: '現在の場所' })
    expect(within(crumb).getByRole('link', { name: '文鳥' })).toHaveAttribute('href', '/?cat=sample-cat-buncho')
    const related = await screen.findByRole('region', { name: 'こちらもおすすめ' })
    expect(within(related).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'モモンガの寝袋ポーチ2,800円',
      'オカメインコの布ハンモック2,400円',
      '文鳥のおやつ入れ1,500円',
      '止まり木カバー 3本セット1,200円',
    ])
  })
})

describe('商品ページ', () => {
  it('写真・キャプション・選択肢の値段・説明・送料を出す', async () => {
    renderAt('/products/sample-tsubosu')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('文鳥のつぼ巣（わら編み）')
    expect(within(screen.getByRole('region', { name: '商品の写真' })).getAllByRole('img')).toHaveLength(3)
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
    expect(document.querySelector('.shipping-result')).toHaveTextContent('送料 1,200円')
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
