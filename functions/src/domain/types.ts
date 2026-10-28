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
