// 最初に1回だけ読む設定。ほかのファイルより先に import すること。
import { getApps, initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

if (getApps().length === 0) initializeApp();
// 東京。待機させっぱなしにしない（minInstances は 0 のまま）。
setGlobalOptions({ region: "asia-northeast1", maxInstances: 2 });
