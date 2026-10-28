// お試しの商品データ（にせのデータ）。
// - 練習用 Firebase（エミュレーター）と、本物の Firebase のお試し表示に入れる（scripts/seed.ts）
// - 自動テストと、Firebase なしのお試し表示（VITE_DATA_MODE=sample）でも使う
// 送料や値段は説明用の数字で、本物の配送料金ではない。
import type { Product, ShippingTable } from '@domain/types.ts'

const photo = (file: string, caption: string) => ({
  url: `sample/${file}`,
  thumbUrl: `sample/${file}`,
  caption,
})

export const sampleShippingTables: ShippingTable[] = [
  {
    id: 'sample-box60',
    name: 'お試し送料表（箱・都道府県ごと）',
    mode: 'by_prefecture',
    fees: {
      '01': 1200,
      '02': 1000, '03': 1000, '04': 950, '05': 1000, '06': 950, '07': 950,
      '08': 870, '09': 870, '10': 870, '11': 870, '12': 870, '13': 870, '14': 870,
      '15': 870, '16': 870, '17': 870, '18': 870, '19': 870, '20': 870,
      '21': 870, '22': 870, '23': 870,
      '24': 950, '25': 950, '26': 950, '27': 950, '28': 950, '29': 950, '30': 950,
      '31': 1000, '32': 1000, '33': 1000, '34': 1000, '35': 1000,
      '36': 1000, '37': 1000, '38': 1000, '39': 1000,
      '40': 1100, '41': 1100, '42': 1100, '43': 1100, '44': 1100, '45': 1100, '46': 1100,
      '47': 1500,
    },
    sample: true,
  },
  {
    id: 'sample-flat',
    name: 'お試し送料表（ポスト投函・全国一律）',
    mode: 'flat',
    flatFee: 200,
    sample: true,
  },
]

export const sampleProducts: Product[] = [
  {
    id: 'sample-tsubosu',
    name: '文鳥のつぼ巣（わら編み）',
    basePrice: 3000,
    shippingTableId: 'sample-box60',
    description: [
      {
        type: 'paragraph',
        align: 'center',
        spans: [{ text: 'ひとつずつ手で編んだ、ふっくらつぼ巣です', bold: true, color: 'pink', size: 'large' }],
      },
      {
        type: 'paragraph',
        spans: [
          { text: '文鳥が' },
          { text: 'すっぽり入れる', marker: true },
          { text: '大きさに仕上げています。入口は少し広めにしてあります。' },
        ],
      },
      { type: 'bullet', spans: [{ text: 'M：直径 約12cm（文鳥1羽）' }] },
      { type: 'bullet', spans: [{ text: 'L：直径 約15cm（文鳥2羽・オカメインコの若鳥）' }] },
      {
        type: 'paragraph',
        spans: [{ text: '※ 手づくりのため、形や色が写真と少しちがうことがあります。', size: 'small', color: 'brown' }],
      },
    ],
    photos: [
      photo('tsubosu-1.svg', 'ふっくらした丸い形です'),
      photo('tsubosu-2.svg', '入口は少し広めです'),
      photo('tsubosu-3.svg', 'ケージの横に取り付けたところ'),
    ],
    published: true,
    stockType: 'stock',
    stock: 5,
    whenSoldOut: 'made_to_order',
    leadDays: 4,
    questions: [
      {
        id: 'size',
        label: 'サイズ',
        kind: 'choice',
        required: true,
        choices: [
          { id: 'm', label: 'M', extraPrice: 0 },
          { id: 'l', label: 'L', extraPrice: 500 },
        ],
      },
      {
        id: 'nameplate',
        label: '名入れ札',
        kind: 'choice',
        required: false,
        choices: [
          { id: 'none', label: 'なし', extraPrice: 0 },
          { id: 'yes', label: 'あり', extraPrice: 300 },
        ],
      },
      { id: 'request', label: 'ご要望（鳥さんのお名前など）', kind: 'text', required: false },
    ],
    createdAtMs: Date.UTC(2026, 9, 28, 6),
    sample: true,
  },
  {
    id: 'sample-hammock',
    name: 'オカメインコの布ハンモック',
    basePrice: 2400,
    shippingTableId: 'sample-flat',
    description: [
      {
        type: 'paragraph',
        spans: [
          { text: 'やわらかいコットン生地のハンモックです。' },
          { text: 'ご注文を受けてから縫います。', bold: true },
        ],
      },
      { type: 'bullet', spans: [{ text: '大きさ：約20cm × 15cm' }] },
      { type: 'bullet', spans: [{ text: '洗濯機で洗えます（ネット使用）' }] },
    ],
    photos: [
      photo('hammock-1.svg', 'ミント色の生地'),
      photo('hammock-2.svg', 'ピンク色の生地'),
    ],
    published: true,
    stockType: 'made_to_order',
    stock: 0,
    whenSoldOut: 'made_to_order',
    leadDays: 14,
    questions: [
      {
        id: 'color',
        label: '生地の色',
        kind: 'choice',
        required: true,
        choices: [
          { id: 'mint', label: 'ミント', extraPrice: 0 },
          { id: 'pink', label: 'ピンク', extraPrice: 0 },
          { id: 'cream', label: 'クリーム', extraPrice: 0 },
        ],
      },
    ],
    createdAtMs: Date.UTC(2026, 9, 27, 6),
    sample: true,
  },
  {
    id: 'sample-pouch',
    name: 'モモンガの寝袋ポーチ',
    basePrice: 2800,
    shippingTableId: 'sample-flat',
    description: [
      {
        type: 'paragraph',
        spans: [{ text: 'もぐりこむのが好きなモモンガのための、ふわふわ寝袋です。' }],
      },
      {
        type: 'paragraph',
        spans: [{ text: '在庫がなくなったら、受注生産（約10日）に切り替わります。', color: 'sky' }],
      },
    ],
    photos: [photo('pouch-1.svg', 'フリース生地で冬も暖か')],
    published: true,
    stockType: 'stock',
    stock: 2,
    whenSoldOut: 'made_to_order',
    leadDays: 10,
    questions: [],
    createdAtMs: Date.UTC(2026, 9, 26, 6),
    sample: true,
  },
  {
    id: 'sample-oyatsu',
    name: '文鳥のおやつ入れ',
    basePrice: 1500,
    shippingTableId: 'sample-flat',
    description: [{ type: 'paragraph', spans: [{ text: 'ケージに掛けられる、小さなおやつ入れです。' }] }],
    photos: [photo('oyatsu-1.svg', '粟穂がちょうど入る大きさ')],
    published: true,
    stockType: 'stock',
    stock: 0,
    whenSoldOut: 'made_to_order',
    leadDays: 7,
    questions: [],
    createdAtMs: Date.UTC(2026, 9, 25, 6),
    sample: true,
  },
  {
    id: 'sample-perch',
    name: '止まり木カバー 3本セット',
    basePrice: 1200,
    shippingTableId: 'sample-flat',
    description: [{ type: 'paragraph', spans: [{ text: '足にやさしい布の止まり木カバーです。' }] }],
    photos: [photo('perch-1.svg', '3色セット')],
    published: true,
    stockType: 'stock',
    stock: 0,
    whenSoldOut: 'sold_out',
    leadDays: 3,
    questions: [],
    createdAtMs: Date.UTC(2026, 9, 24, 6),
    sample: true,
  },
  {
    id: 'sample-draft',
    name: '試作中のブランコ（非公開）',
    basePrice: 2000,
    shippingTableId: 'sample-flat',
    description: [],
    photos: [],
    published: false,
    stockType: 'made_to_order',
    stock: 0,
    whenSoldOut: 'made_to_order',
    leadDays: 14,
    questions: [],
    createdAtMs: Date.UTC(2026, 9, 28, 7),
    sample: true,
  },
]
