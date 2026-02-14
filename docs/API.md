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
| POST | `/auth/logout` | ログアウト |
| POST | `/auth/forgot-password` | パスワードリセット要求 |
| POST | `/auth/reset-password` | パスワードリセット実行 |
| GET | `/car-classes` | 車両クラス一覧 |
| GET | `/car-classes/:id/pricing` | 料金プラン一覧 |
| GET | `/options` | オプション一覧 |
| GET | `/shop/settings` | 店舗設定（営業時間等） |
| GET | `/shop/availability` | 在庫確認 |
| GET | `/insurance-plans` | 保険プラン一覧 |
| POST | `/auth/resend-verification` | メール確認コード再送信 |
| POST | `/stripe/webhook` | Stripe Webhook |

### ユーザーAPI（認証必要）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/me` | 自分の情報取得 |
| PUT | `/me` | プロフィール更新 |
| POST | `/me/change-password` | パスワード変更 |
| DELETE | `/me` | 退会（条件付き） |
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
| GET | `/admin/insurance-plans` | 保険プラン一覧 |
| POST | `/admin/insurance-plans` | 保険プラン作成 |
| PUT | `/admin/insurance-plans/:id` | 保険プラン更新 |
| POST | `/admin/auth/verify-2fa` | 管理者2段階認証 |
| POST | `/admin/auth/logout` | 管理者ログアウト |
| GET | `/admin/settings` | 設定取得 |
| PUT | `/admin/settings/shop` | 店舗設定更新 |
| PUT | `/admin/settings/cancellation` | キャンセルポリシー更新 |
| PUT | `/admin/settings/legal` | 法的文書更新 |

---

## 共通仕様

### ページネーション

一覧取得APIは共通のページネーションパラメータを使用。

**Query Parameters:**
| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|----------|------|
| `page` | number | 1 | ページ番号（1始まり） |
| `limit` | number | 20 | 1ページあたりの件数（最大100） |
| `sortBy` | string | `createdAt` | ソート対象フィールド |
| `sortOrder` | string | `desc` | ソート順（`asc` or `desc`） |

**Response（共通形式）:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 日時形式

すべての日時はISO 8601形式（タイムゾーン付き）で送受信。

- **リクエスト例**: `"2026-02-15T10:00:00+09:00"`
- **レスポンス例**: `"2026-02-15T10:00:00.000+09:00"`

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

### POST /auth/logout

現在のセッションを無効化。

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response: 200**
```json
{
  "message": "ログアウトしました"
}
```

**Errors:**
- `UNAUTHORIZED`: トークン無効

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

### GET /insurance-plans

保険プラン一覧取得。

**Response: 200**
```json
{
  "data": [
    {
      "id": "none",
      "name": "補償なし",
      "description": "基本補償なし、全額自己負担",
      "pricePerDay": 0,
      "deductible": null,
      "coverageDetails": {
        "personalLiability": null,
        "propertyDamage": null,
        "vehicleDamage": null,
        "nocCoverage": false,
        "roadService": false
      }
    },
    {
      "id": "standard",
      "name": "スタンダード補償",
      "description": "対人・対物・車両保険付き",
      "pricePerDay": 1100,
      "deductible": 50000,
      "coverageDetails": {
        "personalLiability": "無制限",
        "propertyDamage": "無制限",
        "vehicleDamage": "時価額まで",
        "nocCoverage": false,
        "roadService": false
      }
    },
    {
      "id": "premium",
      "name": "プレミアム補償",
      "description": "フル補償 + NOC + ロードサービス",
      "pricePerDay": 2200,
      "deductible": 0,
      "coverageDetails": {
        "personalLiability": "無制限",
        "propertyDamage": "無制限",
        "vehicleDamage": "時価額まで",
        "nocCoverage": true,
        "roadService": true
      }
    }
  ]
}
```

---

### POST /auth/resend-verification

メール確認コードを再送信。

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response: 200**
```json
{
  "message": "確認メールを再送信しました"
}
```

**Errors:**
- `EMAIL_NOT_FOUND`: メールアドレスが登録されていない
- `ALREADY_VERIFIED`: 既に確認済み
- `TOO_MANY_REQUESTS`: 送信回数制限超過（3回/時）

---

### DELETE /me

退会処理。未完了の予約がある場合は退会不可。

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "password": "Password123",
  "reason": "サービスを使わなくなったため"
}
```

**Response: 200**
```json
{
  "message": "退会処理が完了しました"
}
```

**退会条件:**
- 未完了の予約がないこと（`pending_payment`, `confirmed`, `picked_up`, `cancel_requested`）
- パスワードが正しいこと

**データ処理:**
| データ | 処理 |
|--------|------|
| ユーザー情報 | `status: 'withdrawn'`に更新、個人情報は保持（法的要件） |
| 予約履歴 | 保持（監査目的、30日後に匿名化） |
| デバイス情報 | 削除 |
| セッション | 全て無効化 |

**Errors:**
- `INVALID_PASSWORD`: パスワード不正
- `HAS_ACTIVE_RESERVATION`: 未完了の予約が存在する

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

## 管理者API詳細

### POST /admin/auth/login

管理者ログイン。常に2段階認証が必要。

**Request:**
```json
{
  "email": "admin@tokunori.example.com",
  "password": "AdminPassword123"
}
```

**Response: 200（常に2FA必要）**
```json
{
  "requires2FA": true,
  "tempToken": "tmp_admin_xxxxx",
  "message": "認証コードをメールで送信しました"
}
```

**Errors:**
- `INVALID_CREDENTIALS`: メール or パスワード不正
- `ACCOUNT_LOCKED`: アカウントロック中（15分）

---

### POST /admin/auth/verify-2fa

管理者2段階認証コードを検証してログイン完了。

**Request:**
```json
{
  "tempToken": "tmp_admin_xxxxx",
  "code": "123456"
}
```

**Response: 200**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "rf_xxxxx",
  "expiresIn": 3600,
  "admin": {
    "id": "admin-001",
    "email": "admin@tokunori.example.com",
    "name": "管理者"
  }
}
```

**Errors:**
- `INVALID_CODE`: コード不正
- `CODE_EXPIRED`: コード期限切れ（10分）
- `TOO_MANY_ATTEMPTS`: 試行回数超過（5回でロック）

---

### POST /admin/auth/logout

管理者ログアウト。現在のセッションを無効化。

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response: 200**
```json
{
  "message": "ログアウトしました"
}
```

---

### GET /admin/reservations

予約一覧取得。

**Query Parameters:**
| パラメータ | 型 | 説明 |
|-----------|------|------|
| `status` | string | ステータスでフィルタ（カンマ区切りで複数可） |
| `pickupFrom` | string | 受取日時の開始（ISO8601） |
| `pickupTo` | string | 受取日時の終了（ISO8601） |
| `userId` | string | 会員IDでフィルタ |
| `carClassId` | string | 車両クラスIDでフィルタ |

**Response: 200**
```json
{
  "data": [
    {
      "id": "R2026021301",
      "userId": "user-001",
      "userName": "山田 太郎",
      "userEmail": "user@example.com",
      "carClassName": "軽自動車クラス",
      "vehicleLicensePlate": "品川 あ 12-34",
      "pickupAt": "2026-02-15T10:00:00.000+09:00",
      "returnAt": "2026-02-17T18:00:00.000+09:00",
      "status": "confirmed",
      "paymentMethod": "card",
      "paymentStatus": "paid",
      "totalPrice": 12290,
      "createdAt": "2026-02-13T14:30:00.000+09:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### PUT /admin/reservations/:id/pickup

受取処理。ステータスを`picked_up`に更新。

**Request:**
```json
{
  "notes": "確認完了、傷なし"
}
```

**Response: 200**
```json
{
  "id": "R2026021301",
  "status": "picked_up",
  "pickedUpAt": "2026-02-15T10:15:00.000+09:00",
  "message": "受取処理が完了しました"
}
```

**Errors:**
- `INVALID_STATUS`: 受取処理できないステータス（confirmed以外）
- `NOT_FOUND`: 予約が存在しない

---

### PUT /admin/reservations/:id/return

返却処理。ステータスを`returned`に更新。

**Request:**
```json
{
  "actualReturnAt": "2026-02-17T17:30:00+09:00",
  "notes": "良好な状態で返却"
}
```

**Response: 200**
```json
{
  "id": "R2026021301",
  "status": "returned",
  "actualReturnAt": "2026-02-17T17:30:00.000+09:00",
  "message": "返却処理が完了しました"
}
```

---

### PUT /admin/reservations/:id/extend

延長処理。返却日時を延長。

**Request:**
```json
{
  "newReturnAt": "2026-02-20T18:00:00+09:00",
  "paymentMethod": "onsite",
  "notes": "お客様希望により3日延長"
}
```

**Response: 200（現地払いの場合）**
```json
{
  "id": "R2026021301",
  "originalReturnAt": "2026-02-17T18:00:00.000+09:00",
  "newReturnAt": "2026-02-20T18:00:00.000+09:00",
  "additionalDays": 3,
  "additionalPrice": 12000,
  "newTotalPrice": 24290,
  "paymentMethod": "onsite",
  "message": "延長処理が完了しました"
}
```

**Response: 200（カード決済の場合）**
```json
{
  "id": "R2026021301",
  "originalReturnAt": "2026-02-17T18:00:00.000+09:00",
  "newReturnAt": "2026-02-20T18:00:00.000+09:00",
  "additionalDays": 3,
  "additionalPrice": 12000,
  "newTotalPrice": 24290,
  "paymentMethod": "card",
  "stripeCheckoutUrl": "https://checkout.stripe.com/xxx",
  "paymentStatus": "pending",
  "message": "追加決済のURLを発行しました"
}
```

**延長時のStripe決済フロー:**
1. 管理者が延長処理を実行（`paymentMethod: 'card'`）
2. APIがStripe Checkout Sessionを作成
3. レスポンスに`stripeCheckoutUrl`を含めて返却
4. 管理者がURLをユーザーに共有（メール or 電話）
5. ユーザーが決済完了 → Webhook `checkout.session.completed`
6. Webhook処理で`returnAt`を更新、`paymentStatus: 'paid'`に変更
7. 決済期限切れ（30分）の場合、延長は取り消し

**延長時のStripe Checkout Session作成:**
```json
{
  "metadata": {
    "reservationId": "R2026021301",
    "type": "extension",
    "originalReturnAt": "2026-02-17T18:00:00+09:00",
    "newReturnAt": "2026-02-20T18:00:00+09:00",
    "additionalPrice": 12000
  }
}
```

**Webhook処理での分岐:**
```javascript
case 'checkout.session.completed':
  const metadata = event.data.object.metadata;
  
  if (metadata.type === 'extension') {
    // 延長確定処理
    await updateReservation(metadata.reservationId, {
      returnAt: new Date(metadata.newReturnAt),
      totalPrice: FieldValue.increment(parseInt(metadata.additionalPrice)),
      paymentStatus: 'paid',
      updatedAt: Timestamp.now()
    });
  } else {
    // 通常の予約確定処理
    await confirmReservation(metadata.reservationId);
  }
  break;
```

**延長決済期限切れ時の処理:**
延長用Checkout Sessionが期限切れ（Webhook: `checkout.session.expired`）の場合:
1. 予約の`returnAt`は元のまま維持（変更しない）
2. 延長申請は自動キャンセル扱い
3. 管理者画面に「延長決済未完了」を表示
4. ログ出力（`EXTENSION_PAYMENT_EXPIRED`）
5. 必要に応じて管理者から再度延長処理を実施

**Errors:**
- `INVALID_STATUS`: 延長できないステータス（picked_up以外）
- `VEHICLE_NOT_AVAILABLE`: 延長期間中に他の予約あり
- `EXCEEDS_MAX_EXTENSION`: 最大延長期間（30日）超過

---

### GET /admin/members

会員一覧取得。

**Query Parameters:**
| パラメータ | 型 | 説明 |
|-----------|------|------|
| `status` | string | ステータスでフィルタ（active/suspended/withdrawn） |
| `search` | string | 名前・メール・電話番号で検索 |

**Response: 200**
```json
{
  "data": [
    {
      "id": "user-001",
      "email": "user@example.com",
      "name": "山田 太郎",
      "phone": "09012345678",
      "status": "active",
      "emailVerified": true,
      "totalReservations": 5,
      "totalSpent": 45000,
      "createdAt": "2026-01-10T09:00:00.000+09:00",
      "lastLoginAt": "2026-02-13T08:30:00.000+09:00"
    }
  ],
  "pagination": {...}
}
```

---

### GET /admin/vehicles

車両一覧取得。

**Query Parameters:**
| パラメータ | 型 | 説明 |
|-----------|------|------|
| `carClassId` | string | 車両クラスIDでフィルタ |
| `status` | string | ステータスでフィルタ（available/rented/maintenance） |

**Response: 200**
```json
{
  "data": [
    {
      "id": "vehicle-001",
      "carClassId": "class-001",
      "carClassName": "軽自動車クラス",
      "licensePlate": "品川 あ 12-34",
      "model": "ダイハツ ミライース",
      "status": "available",
      "currentReservationId": null,
      "nextMaintenanceStart": null,
      "createdAt": "2025-12-01T10:00:00.000+09:00"
    }
  ],
  "pagination": {...}
}
```

---

### POST /admin/vehicles

車両追加。

**Request:**
```json
{
  "carClassId": "class-001",
  "licensePlate": "品川 い 56-78",
  "model": "スズキ アルト",
  "notes": "新車"
}
```

**Response: 201**
```json
{
  "id": "vehicle-002",
  "carClassId": "class-001",
  "licensePlate": "品川 い 56-78",
  "model": "スズキ アルト",
  "status": "available",
  "message": "車両を追加しました"
}
```

---

### POST /admin/vehicles/:id/maintenance

メンテナンス設定。期間中は予約不可。

**Request:**
```json
{
  "startDate": "2026-03-01T09:00:00+09:00",
  "endDate": "2026-03-03T18:00:00+09:00",
  "reason": "inspection",
  "notes": "定期点検"
}
```

**Response: 200**
```json
{
  "vehicleId": "vehicle-001",
  "maintenanceId": "maint-001",
  "status": "maintenance",
  "startDate": "2026-03-01T09:00:00.000+09:00",
  "endDate": "2026-03-03T18:00:00.000+09:00",
  "message": "メンテナンスを設定しました"
}
```

**Errors:**
- `VEHICLE_HAS_RESERVATION`: 期間中に予約が存在する

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
- 営業時間内（受取時刻・返却時刻の両方をチェック）
- 15分単位
- 同一ユーザーの重複予約: 許可（同一期間に複数の異なる車両を予約可能。ただし同一車両の重複は不可）

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
