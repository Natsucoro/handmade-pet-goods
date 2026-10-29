import { fitSize } from './images.ts'

it('長い辺に合わせて縮める（大きくはしない）', () => {
  expect(fitSize(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
  expect(fitSize(3024, 4032, 600)).toEqual({ width: 450, height: 600 })
  expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 })
})
