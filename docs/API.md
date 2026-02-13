# API仕様書

## 概要

- **Base URL**: `https://api.tokunori.example.com/v1`
- **認証**: Bearer Token (JWT)
- **レスポンス形式**: JSON
- **エラーレスポンス**: `{ "error": { "code": "ERROR_CODE", "message": "説明" } }`

---

## 認証

### ヘッダー

```
Authorization: Bearer <access_token>
X-Device-Fingerprint: <fingerprint>
```

### エラーコード

| コード | HTTP | 説明 |
|--------|------|------|
| `UNAUTHORIZED` | 401 | トークンなし or 無効 |
| `TOKEN_EXPIRED` | 401 | トークン期限切れ |
| `FORBIDDEN` | 403 | 権限なし |
| `REQUIRES_2FA` | 403 | 2段階認証が必要 |

---

## エンドポイント一覧

### 公開API（認証不要）

| Method | Path | 説明 |
|--------|------|------|
| POST | `/auth/register` | 会員登録 |
| POST | `/auth/verify-email` | メール確認 |
| POST | `/auth/login` | ログイン |
| POST | `/auth/verify-2fa` | 2段階認証コード検証 |
| POST | `/auth/refresh` | トークン更新 |
| POST | `/auth/forgot-password` | パスワードリセット要求 |
| POST | `/auth/reset-password` | パスワードリセット実行 |
| GET | `/car-classes` | 車両クラス一覧 |
| GET | `/car-classes/:id/pricing` | 料金プラン一覧 |
| GET | `/options` | オプション一覧 |
| GET | `/shop/settings` | 店舗設定（営業時間等） |
| GET | `/shop/availability` | 在庫確認 |
| POST | `/stripe/webhook` | Stripe Webhook |

### ユーザーAPI（認証必要）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/me` | 自分の情報取得 |
| PUT | `/me` | プロフィール更新 |
| POST | `/me/change-password` | パスワード変更 |
| DELETE | `/me` | 退会 |
| POST | `/reservations` | 予約作成 |
| GET | `/reservations` | 自分の予約一覧 |
| GET | `/reservations/:id` | 予約詳細 |
| POST | `/reservations/:id/cancel` | キャンセル申請 |
| PUT | `/reservations/:id/planned-return` | 返却予定更新 |

### 管理者API（管理者認証必要）

| Method | Path | 説明 |
|--------|------|------|
| POST | `/admin/auth/login` | 管理者ログイン |
| GET | `/admin/dashboard` | ダッシュボード統計 |
| GET | `/admin/reservations` | 予約一覧 |
| GET | `/admin/reservations/:id` | 予約詳細 |
| POST | `/admin/reservations` | 手動予約作成 |
| PUT | `/admin/reservations/:id/pickup` | 受取処理 |
| PUT | `/admin/reservations/:id/return` | 返却処理 |
| PUT | `/admin/reservations/:id/extend` | 延長処理 |
| PUT | `/admin/reservations/:id/cancel/approve` | キャンセル承認 |
| PUT | `/admin/reservations/:id/cancel/reject` | キャンセル却下 |
| PUT | `/admin/reservations/:id/no-show` | 無断キャンセル処理 |
| GET | `/admin/members` | 会員一覧 |
| GET | `/admin/members/:id` | 会員詳細 |
| PUT | `/admin/members/:id/suspend` | 会員停止 |
| GET | `/admin/car-classes` | 車両クラス一覧 |
| POST | `/admin/car-classes` | 車両クラス作成 |
| PUT | `/admin/car-classes/:id` | 車両クラス更新 |
| GET | `/admin/pricing` | 料金プラン一覧 |
| POST | `/admin/pricing` | 料金プラン作成 |
| PUT | `/admin/pricing/:id` | 料金プラン更新 |
| DELETE | `/admin/pricing/:id` | 料金プラン削除 |
| GET | `/admin/vehicles` | 車両一覧 |
| POST | `/admin/vehicles` | 車両追加 |
| PUT | `/admin/vehicles/:id` | 車両更新 |
| POST | `/admin/vehicles/:id/maintenance` | メンテナンス設定 |
| DELETE | `/admin/vehicles/:id/maintenance` | メンテナンス解除 |
| GET | `/admin/options` | オプション一覧 |
| POST | `/admin/options` | オプション作成 |
| PUT | `/admin/options/:id` | オプション更新 |
| GET | `/admin/settings` | 設定取得 |
| PUT | `/admin/settings/shop` | 店舗設定更新 |
| PUT | `/admin/settings/cancellation` | キャンセルポリシー更新 |
| PUT | `/admin/settings/legal` | 法的文書更新 |

---

## 詳細仕様

### POST /auth/register

会員登録。メール確認コードを送信。

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "name": "山田 太郎",
  "phone": "09012345678"
}
```

**Response: 201**
```json
{
  "message": "確認メールを送信しました",
  "userId": "abc123"
}
```

**Errors:**
- `EMAIL_ALREADY_EXISTS`: メールアドレス登録済み
- `INVALID_EMAIL`: メール形式不正
- `WEAK_PASSWORD`: パスワード要件未達（8文字以上、英数字含む）
- `INVALID_PHONE`: 電話番号形式不正

---

### POST /auth/login

ログイン。新規デバイスの場合は2段階認証が必要。

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "deviceFingerprint": "fp_xxxxx"
}
```

**Response: 200（既知のデバイス）**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "rf_xxxxx",
  "expiresIn": 3600,
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "山田 太郎"
  }
}
```

**Response: 200（新規デバイス）**
```json
{
  "requires2FA": true,
  "tempToken": "tmp_xxxxx",
  "message": "認証コードをメールで送信しました"
}
```

**Errors:**
- `INVALID_CREDENTIALS`: メール or パスワード不正
- `EMAIL_NOT_VERIFIED`: メール未確認
- `ACCOUNT_SUSPENDED`: アカウント停止中
- `TOO_MANY_ATTEMPTS`: ログイン試行回数超過

---

### POST /auth/verify-2fa

2段階認証コードを検証してログイン完了。

**Request:**
```json
{
  "tempToken": "tmp_xxxxx",
  "code": "123456",
  "trustDevice": true
}
```

**Response: 200**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "rf_xxxxx",
  "expiresIn": 3600,
  "user": { ... }
}
```

**Errors:**
- `INVALID_CODE`: コード不正
- `CODE_EXPIRED`: コード期限切れ

---

### GET /shop/availability

指定期間の在庫確認。

**Query Parameters:**
- `carClassId`: 車両クラスID（必須）
- `pickupAt`: 受取日時 ISO8601（必須）
- `returnAt`: 返却日時 ISO8601（必須）

**Response: 200**
```json
{
  "available": true,
  "availableCount": 3,
  "totalCount": 5
}
```

---

### POST /reservations

予約作成。決済方法により処理が分岐。

**Request:**
```json
{
  "carClassId": "class-001",
  "pricingPlanId": "plan-001",
  "pickupAt": "2026-02-15T10:00:00+09:00",
  "returnAt": "2026-02-17T18:00:00+09:00",
  "paymentMethod": "card",
  "insuranceType": "standard",
  "options": [
    { "optionId": "opt-001", "quantity": 1 }
  ]
}
```

**Response: 201（カード決済）**
```json
{
  "reservationId": "R2026021301",
  "status": "pending_payment",
  "stripeCheckoutUrl": "https://checkout.stripe.com/xxx",
  "totalPrice": 12290
}
```

**Response: 201（現地払い）**
```json
{
  "reservationId": "R2026021301",
  "status": "confirmed",
  "totalPrice": 12290,
  "message": "予約が確定しました"
}
```

**Errors:**
- `NO_AVAILABILITY`: 在庫なし
- `INVALID_DATETIME`: 日時不正
- `PAST_DATETIME`: 過去の日時
- `EXCEEDS_MAX_FUTURE`: 6ヶ月以上先
- `SHOP_CLOSED`: 営業時間外
- `INVALID_PLAN`: 料金プラン不正

---

### POST /reservations/:id/cancel

キャンセル申請。管理者の承認が必要。

**Request:**
```json
{
  "reason": "急な予定変更のため"
}
```

**Response: 200**
```json
{
  "status": "cancel_requested",
  "estimatedFee": 3000,
  "feeRate": 0.3,
  "message": "キャンセル申請を受け付けました"
}
```

---

### PUT /admin/reservations/:id/cancel/approve

キャンセル承認。Stripe返金処理を実行。

**Request:**
```json
{
  "refundAmount": 9290,
  "notes": "返金処理完了"
}
```

**Response: 200**
```json
{
  "status": "cancelled",
  "refundAmount": 9290,
  "stripeRefundId": "re_xxxxx"
}
```

**Errors:**
- `REFUND_FAILED`: Stripe返金失敗（手動対応必要）
- `ALREADY_CANCELLED`: 既にキャンセル済み

---

### POST /stripe/webhook

Stripe Webhookエンドポイント。署名検証必須。

**処理するイベント:**
- `checkout.session.completed`: 予約を`confirmed`に更新
- `checkout.session.expired`: 予約を削除
- `payment_intent.payment_failed`: ログ記録
- `refund.created`: 返金ステータス更新
- `refund.failed`: 管理者に通知

**Response: 200**
```json
{ "received": true }
```

---

## バリデーションルール

### メールアドレス
- RFC 5322準拠
- 最大254文字
- 小文字に正規化して保存

### パスワード
- 8文字以上
- 英字と数字を両方含む

### 電話番号
- 10-11桁の数字のみ
- ハイフンは受け付けるが保存時に除去

### 予約日時
- 現在時刻以降
- 6ヶ月以内
- 営業時間内（設定値に依存）
- 15分単位

---

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| `/auth/login` | 5回/分/IP |
| `/auth/register` | 3回/分/IP |
| `/auth/forgot-password` | 3回/時/IP |
| その他認証済み | 100回/分/ユーザー |
| その他公開 | 30回/分/IP |

超過時は `429 Too Many Requests` を返す。
