// お知らせメールの文面（ステップ3で本当に送る。いまは注文の中に「送るメール」として残す）。
import { prefectureName } from "./checkout.js";
import type { Carrier, Order, OrderMail } from "./types.js";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
const CARRIER: Record<Carrier, string> = { yamato: "ヤマト運輸", sagawa: "佐川急便", japanpost: "日本郵便", other: "その他" };

function itemsText(o: Order): string {
  return o.items
    .map((i) => {
      const ans = i.answers.map((a) => `  ・${a.label}：${a.answer}${a.extraPrice ? `（${a.extraPrice > 0 ? "+" : ""}${yen(a.extraPrice)}）` : ""}`).join("\n");
      return `■ ${i.name}  ${yen(i.unitPrice)} × ${i.quantity}${ans ? `\n${ans}` : ""}`;
    })
    .join("\n");
}

function totalsText(o: Order): string {
  return `商品 ${yen(o.subtotal)}\n送料 ${yen(o.shipping)}\n合計 ${yen(o.total)}`;
}

function addressText(o: Order): string {
  const a = o.address;
  return `〒${a.postalCode}\n${prefectureName(a.prefecture)}${a.address1}${a.address2 ? `\n${a.address2}` : ""}\n${a.name} 様${a.phone ? `\n${a.phone}` : ""}`;
}

export type MailEvent = "paid" | "shipped" | "completed" | "cancelled" | "cancelled_sold_out";

/** その出来事で送るメール（お客さん向け・お姉ちゃん向け） */
export function mailsFor(o: Order, event: MailEvent, shopName: string, statusUrl: string, now: number): OrderMail[] {
  const head = `【${shopName}】`;
  const sign = `\n\n――\n${shopName}\nご注文の状況：${statusUrl}`;
  const m = (to: OrderMail["to"], subject: string, body: string): OrderMail => ({ to, subject: head + subject, body, atMs: now });
  switch (event) {
    case "paid":
      return [
        m(
          "customer",
          `ご注文ありがとうございます（注文番号 ${o.number}）`,
          `${o.address.name} 様\n\nご注文ありがとうございます。お支払いを確認しました。\n\n${itemsText(o)}\n\n${totalsText(o)}\n\nお届け先\n${addressText(o)}\n\nお届けの目安：約${o.leadDays ?? "-"}日${o.note ? `\n\nご連絡事項\n${o.note}` : ""}${sign}`,
        ),
        m("shop", `新しい注文が入りました（${o.number}）`, `${itemsText(o)}\n\n${totalsText(o)}\n\nお届け先\n${addressText(o)}${o.note ? `\n\nお客さんからの連絡\n${o.note}` : ""}\n\n管理画面で確認してください。`),
      ];
    case "shipped":
      return [
        m(
          "customer",
          `発送しました（注文番号 ${o.number}）`,
          `${o.address.name} 様\n\nご注文の商品を発送しました。\n\n配送会社：${o.carrier ? CARRIER[o.carrier] : "-"}\n追跡番号：${o.trackingNumber || "-"}\n\n届きましたら、ご注文の状況のページで「受け取りました」を押してください。${sign}`,
        ),
      ];
    case "completed":
      return [m("shop", `受け取りました（${o.number}）`, `${o.address.name} 様が「受け取りました」を押しました。\n\n${itemsText(o)}`)];
    case "cancelled":
      return [m("customer", `ご注文のキャンセル（注文番号 ${o.number}）`, `${o.address.name} 様\n\nご注文をキャンセルしました。お支払いいただいた代金は返金します。${sign}`)];
    case "cancelled_sold_out":
      return [
        m(
          "customer",
          `ご注文のキャンセルとお詫び（注文番号 ${o.number}）`,
          `${o.address.name} 様\n\n申し訳ありません。ほかのお客さまのご注文と重なり、在庫がなくなってしまいました。ご注文をキャンセルし、代金は全額返金します。${sign}`,
        ),
        m("shop", `在庫切れで自動キャンセルしました（${o.number}）`, `同時に注文が入り、在庫が足りなかったため自動でキャンセルしました。返金を確認してください。`),
      ];
  }
}
