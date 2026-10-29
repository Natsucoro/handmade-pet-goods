// ショップのデータの形。画面（web）とサーバー（functions）の両方で使う。
// ここには firebase などの外部ライブラリを import しないこと（両方から読めるようにするため）。

import type { PrefectureCode } from "./prefectures.js";

/** 説明文の文字の飾り。決めた飾りだけを持てる（HTML は保存しない）。 */
export interface RichSpan {
  text: string;
  bold?: boolean;
  /** パレットの色名、または #rrggbb */
  color?: string;
  size?: "large" | "medium" | "small";
  marker?: boolean;
}

export interface RichBlock {
  type: "paragraph" | "bullet";
  align?: "left" | "center";
  spans: RichSpan[];
}

export interface ProductPhoto {
  /** 商品ページ用（長い辺 1600px） */
  url: string;
  /** 一覧用（長い辺 600px） */
  thumbUrl: string;
  caption: string;
  /** 写真置き場の中の場所（消すときに使う）。お試しデータにはない */
  storagePath?: string;
  thumbStoragePath?: string;
}

export interface Choice {
  id: string;
  label: string;
  /** 追加料金（円）。値引きならマイナス */
  extraPrice: number;
}

export interface Question {
  id: string;
  label: string;
  kind: "text" | "choice";
  required: boolean;
  /** kind が "choice" のときだけ使う */
  choices?: Choice[];
}

/** カテゴリ。お姉ちゃんが管理画面で登録する（ステップ2） */
export interface Category {
  id: string;
  name: string;
  /** まとまりの名前（例：「アニマル」「カテゴリ」）。同じまとまりを並べて表示する */
  group: string;
  /** 表示順（小さいほど先） */
  sortOrder: number;
  sample?: boolean;
}

export type StockType = "stock" | "made_to_order";
export type WhenSoldOut = "sold_out" | "made_to_order";

export interface Product {
  id: string;
  name: string;
  /** 基本の値段（円） */
  basePrice: number;
  shippingTableId: string;
  description: RichBlock[];
  /** 並び順どおり。1枚目が一覧の表紙。最大20枚 */
  photos: ProductPhoto[];
  published: boolean;
  stockType: StockType;
  /** stockType が "stock" のときの在庫数 */
  stock: number;
  /** 在庫が0個になったときの扱い */
  whenSoldOut: WhenSoldOut;
  /** お届けまでの目安（日） */
  leadDays: number;
  questions: Question[];
  /** 入っているカテゴリ（複数可） */
  categoryIds: string[];
  /** お姉ちゃんが決める表示順（小さいほど先）。一覧の最初の並び */
  sortOrder: number;
  /** 並べ替え用。新しいほど大きい（ミリ秒） */
  createdAtMs: number;
  /** お試しデータの印 */
  sample?: boolean;
}

export interface ShippingTable {
  id: string;
  /** 例：ゆうパック60サイズ */
  name: string;
  mode: "flat" | "by_prefecture";
  /** mode が "flat" のときの送料（円） */
  flatFee?: number;
  /** mode が "by_prefecture" のときの送料（円） */
  fees?: Partial<Record<PrefectureCode, number>>;
  sample?: boolean;
}

/** お客さんにも見えるショップの設定（settings/public） */
export interface PublicSettings {
  shopName: string;
  /** 注文のときの電話番号を必須にするか */
  phoneRequired: boolean;
}

/** 管理画面だけが読み書きするショップの設定（settings/shop） */
export interface ShopSettings {
  /** 説明文の飾りに使う、自分で登録した色（#rrggbb） */
  customColors: string[];
  /** 取引が終わってから、お客さんの住所・電話・メッセージを消すまでの月数 */
  retentionMonths: number;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = { shopName: "手づくり小動物グッズ（仮）", phoneRequired: false };
export const DEFAULT_SHOP_SETTINGS: ShopSettings = { customColors: [], retentionMonths: 24 };
/** 個人情報を消すまでの期間として選べる月数（3か月〜5年） */
export const RETENTION_CHOICES = [3, 6, 12, 24, 36, 60] as const;

/** 注文の状態（計画書「注文の状態」） */
export type OrderStatus = "pending_payment" | "paid" | "in_production" | "shipped" | "completed" | "cancelled";
export type Carrier = "yamato" | "sagawa" | "japanpost" | "other";

export interface OrderAnswer {
  questionId: string;
  label: string;
  /** 選んだ選択肢の名前、または自由入力の答え */
  answer: string;
  /** そのときの追加料金（円） */
  extraPrice: number;
}

export interface OrderItem {
  productId: string;
  /** 注文したときの商品名（あとで商品名を変えても変わらない） */
  name: string;
  /** 注文したときの1個の値段（基本＋追加料金） */
  unitPrice: number;
  quantity: number;
  answers: OrderAnswer[];
}

export interface ShippingAddress {
  name: string;
  postalCode: string;
  prefecture: PrefectureCode;
  address1: string;
  address2?: string;
  phone?: string;
}

export interface Order {
  id: string;
  /** お客さんに見せる注文番号 */
  number: string;
  createdAtMs: number;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  address: ShippingAddress;
  email: string;
  /** お客さんからの連絡事項 */
  note?: string;
  carrier?: Carrier;
  trackingNumber?: string;
  shippedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  sample?: boolean;
}
