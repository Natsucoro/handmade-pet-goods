#!/usr/bin/env bash
# GitHub Actions が本物の Firebase に上げられるようにする設定（1回だけ）。
# Google Cloud Shell（https://shell.cloud.google.com/）で動かす：
#   bash <(curl -fsSL https://raw.githubusercontent.com/Natsucoro/handmade-pet-goods/claude/shop-step0-1/scripts/setup-github-deploy.sh) プロジェクトID
#
# 合鍵（サービスアカウントの鍵ファイル）は作らない。
# 代わりに「Natsucoro/handmade-pet-goods の main ブランチで動く GitHub Actions だけ」が
# 上げ役のアカウント（github-deploy）として動けるようにする（Workload Identity 連携）。
# あわせて、データベース（東京）・サイト・ウェブアプリの登録も用意する。
# 何度動かしても同じ結果になる（すでにあるものはそのまま）。
set -euo pipefail

PROJECT_ID="${1:-}"
if [ -z "$PROJECT_ID" ]; then
  echo "使い方: bash setup-github-deploy.sh プロジェクトID" >&2
  exit 1
fi
REPO="Natsucoro/handmade-pet-goods"
REPO_ID="1437705706"   # このリポジトリの番号（名前を変えられても、ほかの人の同名リポジトリは通さない）
POOL="github"
SA_NAME="github-deploy"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "▶ プロジェクト ${PROJECT_ID} を設定します"
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

echo "▶ 必要な機能をオンにします"
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com firebase.googleapis.com firebasehosting.googleapis.com \
  firebaserules.googleapis.com firestore.googleapis.com

echo "▶ データベース（Firestore・東京）を用意します"
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --database='(default)' --location=asia-northeast1 --type=firestore-native
fi

TOKEN="$(gcloud auth print-access-token)"
api() { curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT_ID}" -H "Content-Type: application/json" "$@"; }

echo "▶ サイト（Firebase Hosting）を用意します"
api -X POST "https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites?siteId=${PROJECT_ID}" -d '{}' >/dev/null || true

echo "▶ ウェブアプリの登録を確かめます"
if ! api "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" | grep -q '"appId"'; then
  api -X POST "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" -d '{"displayName":"shop"}' >/dev/null
  echo "   登録しました"
fi

echo "▶ 上げ役のアカウント（${SA_NAME}）を作ります"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub Actions から上げる係"

echo "▶ 上げ役にできることを決めます（サイト・ルール・お試しデータだけ）"
for ROLE in roles/firebasehosting.admin roles/firebaserules.admin roles/datastore.indexAdmin \
            roles/datastore.user roles/firebase.viewer roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA}" \
    --role="$ROLE" --condition=None --quiet >/dev/null
  echo "   ${ROLE}"
done

echo "▶ GitHub とつなぎます"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe "$POOL" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$POOL" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository_id=='${REPO_ID}' && assertion.ref=='refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository_id/${REPO_ID}" \
  --condition=None --quiet >/dev/null

PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${POOL}"
echo
echo "✅ できました。下の3行をそのまま Claude に送ってください（合鍵ではないので見せて大丈夫です）"
echo "-----"
echo "FIREBASE_PROJECT_ID=${PROJECT_ID}"
echo "GCP_WIF_PROVIDER=${PROVIDER}"
echo "GCP_DEPLOY_SA=${SA}"
echo "-----"
