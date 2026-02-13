# トクノリレンタカー バックエンド

レンタカー予約システムのバックエンドAPI

## ドキュメント

| ファイル | 説明 |
|----------|------|
| [SPEC.md](./SPEC.md) | 全体仕様 |
| [DATABASE.md](./DATABASE.md) | Firestoreスキーマ設計 |
| [API.md](./API.md) | APIエンドポイント仕様 |
| [CLAUDE.md](./CLAUDE.md) | Claude Code向け開発指示書 |
| [ERROR_HANDLING.md](./ERROR_HANDLING.md) | エラーハンドリング・フォールバック仕様 |

## 技術スタック

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Payment**: Stripe
- **Email**: Resend
- **Hosting**: Google Cloud Run

## 開発開始

```bash
# 依存インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集

# 開発サーバー起動
npm run dev

# テスト
npm test

# ビルド
npm run build
```

## 必要な環境変数

```env
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
JWT_SECRET=xxx
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@tokunori.example.com
FRONTEND_URL=https://tokunori.example.com
```

## デプロイ

```bash
gcloud builds submit --config cloudbuild.yaml
```

## フロントエンドリポジトリ

https://github.com/chitose-dev/rent
