import { sampleProducts } from '../data/sampleData.ts'
import { emptyForm, formFromProduct, formToProduct, type ProductForm } from './productForm.ts'

const base = (patch: Partial<ProductForm>): ProductForm => ({ ...emptyForm('p1', 0, 't1'), name: 'つぼ巣', price: '3000', ...patch })

it('保存してある商品 → フォーム → 保存する形 で同じに戻る', () => {
  for (const p of sampleProducts) {
    const { photos, ...rest } = p
    void photos
    expect(formToProduct(formFromProduct(p)).product).toEqual({ ...rest, sample: undefined, description: rest.description })
  }
})

it('全角の数字やカンマ・「円」も読める', () => {
  expect(formToProduct(base({ price: '３,０００円' })).product?.basePrice).toBe(3000)
})

it('入れ忘れ・おかしな値を教える', () => {
  const { errors, product } = formToProduct(base({ name: ' ', price: 'abc', stock: '-1', leadDays: '', shippingTableId: '' }))
  expect(product).toBeUndefined()
  expect(Object.keys(errors).sort()).toEqual(['leadDays', 'name', 'price', 'shippingTableId', 'stock'])
})

it('受注生産なら在庫数は見ない', () => {
  expect(formToProduct(base({ stockType: 'made_to_order', stock: '' })).product?.stock).toBe(0)
})

it('選択肢の追加料金（空は0円、マイナスは値引き）と、選択肢のない質問', () => {
  const ok = formToProduct(
    base({
      questions: [
        { id: 'q1', label: 'サイズ', kind: 'choice', required: true, choices: [{ id: 'm', label: 'M', extra: '' }, { id: 'l', label: 'L', extra: '+500' }, { id: 's', label: 'S', extra: '-200' }] },
      ],
    }),
  )
  expect(ok.product?.questions[0].choices?.map((c) => c.extraPrice)).toEqual([0, 500, -200])
  const ng = formToProduct(base({ questions: [{ id: 'q1', label: '色', kind: 'choice', required: false, choices: [] }] }))
  expect(ng.errors.questions).toBe('「色」に選択肢を1つ以上入れてください')
})
