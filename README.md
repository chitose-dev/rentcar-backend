# トクノリレンタカー バックエンドAPI

レンタカー予約システムのバックエンドAPI。

## 技術スタック

- **Runtime**: Node.js 20 (Cloud Run)
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Payment**: Stripe
- **Email**: Resend
- **Language**: TypeScript

## ドキュメント

設計書は `docs/` ディレクトリにあります：

- [SPEC.md](docs/SPEC.md) - 全体仕様
- [DATABASE.md](docs/DATABASE.md) - Firestoreスキーマ
- [API.md](docs/API.md) - APIエンドポイント仕様
- [CLAUDE.md](docs/CLAUDE.md) - Claude Code向け開発指示書
- [ERROR_HANDLING.md](docs/ERROR_HANDLING.md) - エラーハンドリング仕様

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集

# 開発サーバー起動
npm run dev
```

## デプロイ

`main` ブランチにプッシュすると、GitHub Actions経由でCloud Runに自動デプロイされます。

### 必要なGitHub Secrets

- `GCP_PROJECT_ID`: Google CloudプロジェクトID
- `GCP_SA_KEY`: サービスアカウントキー（JSON）

### Cloud Run環境変数

Cloud Runの環境変数はSecret Managerで管理します。

## 開発

```bash
# 開発サーバー（ホットリロード）
npm run dev

# ビルド
npm run build

# テスト
npm test

# リント
npm run lint
```
