import { extraYen, yen } from './format.ts'

it('金額の表示', () => {
  expect(yen(3000)).toBe('3,000円')
  expect(extraYen(500)).toBe('+500円')
  expect(extraYen(-200)).toBe('-200円')
  expect(extraYen(0)).toBe('')
})
