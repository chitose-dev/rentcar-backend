# Firestore データベース設計

## 設計方針

1. **読み取り最適化**: 必要なデータのみ取得できるよう非正規化
2. **クエリ制限対応**: Firestoreの複合クエリ制限を考慮
3. **トランザクション活用**: 在庫・車両割り当ての整合性確保
4. **サブコレクション活用**: 関連データの効率的な取得

---

## コレクション構造

```
/users/{userId}
/users/{userId}/devices/{deviceId}
/users/{userId}/sessions/{sessionId}

/admins/{adminId}

/carClasses/{classId}

/pricingPlans/{planId}

/vehicles/{vehicleId}
/vehicles/{vehicleId}/maintenances/{maintenanceId}

/options/{optionId}

/reservations/{reservationId}
/reservations/{reservationId}/statusHistory/{historyId}

/verificationCodes/{codeId}

/settings/shop
/settings/cancellationPolicy
/settings/legalDocuments

/emailQueue/{emailId}
```

---

## スキーマ詳細

### users（会員）

```javascript
{
  id: string,                    // Firestore自動生成
  email: string,                 // ユニーク、小文字正規化
  passwordHash: string,          // bcryptハッシュ
  name: string,
  phone: string,
  emailVerified: boolean,
  status: 'active' | 'suspended' | 'withdrawn',
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt: Timestamp | null,
  
  // 統計（非正規化）
  totalReservations: number,
  totalSpent: number
}
```

**インデックス:**
- `email` (単一)
- `status, createdAt` (複合)

### users/{userId}/devices（デバイス）

```javascript
{
  id: string,
  fingerprint: string,           // デバイスフィンガープリント
  ipAddress: string,
  userAgent: string,
  trusted: boolean,              // 2段階認証済みフラグ
  lastUsedAt: Timestamp,
  createdAt: Timestamp
}
```

### users/{userId}/sessions（セッション）

```javascript
{
  id: string,
  refreshToken: string,          // ハッシュ化して保存
  deviceId: string,
  expiresAt: Timestamp,
  createdAt: Timestamp
}
```

---

### admins（管理者）

```javascript
{
  id: string,
  email: string,
  passwordHash: string,
  name: string,
  createdAt: Timestamp,
  lastLoginAt: Timestamp | null
}
```

---

### carClasses（車両クラス）

```javascript
{
  id: string,
  name: string,                  // "軽自動車クラス"
  description: string,
  notes: string,                 // "4人乗り / オートマ / ナビ付き"
  imageUrl: string | null,
  sortOrder: number,
  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // 在庫サマリー（非正規化、リアルタイム更新）
  totalVehicles: number,
  availableVehicles: number
}
```

---

### pricingPlans（料金プラン）

```javascript
{
  id: string,
  carClassId: string,
  days: number,                  // 1, 2, 3, 7, 14, 30
  label: string,                 // "1日", "1週間"
  price: number,                 // 税込価格
  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**インデックス:**
- `carClassId, days` (複合)
- `carClassId, isActive` (複合)

---

### vehicles（車両）

```javascript
{
  id: string,
  carClassId: string,
  licensePlate: string,          // "品川 あ 12-34"
  model: string,                 // "ダイハツ ミライース"
  status: 'available' | 'rented' | 'maintenance',
  currentReservationId: string | null,  // レンタル中の予約ID
  notes: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // メンテナンス予定（非正規化）
  nextMaintenanceStart: Timestamp | null,
  nextMaintenanceEnd: Timestamp | null
}
```

**インデックス:**
- `carClassId, status` (複合)
- `licensePlate` (単一)

### vehicles/{vehicleId}/maintenances（メンテナンス履歴）

```javascript
{
  id: string,
  startDate: Timestamp,
  endDate: Timestamp,
  reason: 'inspection' | 'repair' | 'cleaning' | 'tire' | 'other',
  notes: string,
  createdAt: Timestamp
}
```

---

### options（オプション）

```javascript
{
  id: string,
  name: string,                  // "ETC車載器"
  description: string,
  pricePerDay: number,
  maxQuantity: number,           // 在庫数
  isActive: boolean,
  sortOrder: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### reservations（予約）

```javascript
{
  id: string,                    // "R2026021301" 形式で生成
  
  // 会員情報（非正規化、変更履歴のため）
  userId: string,
  userName: string,
  userEmail: string,
  userPhone: string,
  
  // 車両情報
  carClassId: string,
  carClassName: string,          // 非正規化
  vehicleId: string,             // 割り当てられた車両
  vehicleLicensePlate: string,   // 非正規化
  vehicleModel: string,          // 非正規化
  
  // 日程
  pickupAt: Timestamp,
  returnAt: Timestamp,
  actualReturnAt: Timestamp | null,  // 実際の返却日時
  
  // 料金
  pricingPlanId: string,
  basePrice: number,
  insurancePrice: number,
  optionsPrice: number,
  totalPrice: number,
  
  // オプション詳細
  options: [
    {
      optionId: string,
      name: string,
      pricePerDay: number,
      quantity: number,
      subtotal: number
    }
  ],
  
  // 保険
  insuranceType: 'none' | 'standard' | 'premium',
  
  // 決済
  paymentMethod: 'card' | 'onsite',
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial_refund',
  stripePaymentIntentId: string | null,
  stripeCheckoutSessionId: string | null,
  paidAt: Timestamp | null,
  
  // ステータス
  status: 'pending_payment' | 'confirmed' | 'picked_up' | 'returned' | 'cancel_requested' | 'cancelled' | 'no_show',
  
  // キャンセル
  cancelReason: string | null,
  cancelRequestedAt: Timestamp | null,
  cancelledAt: Timestamp | null,
  cancellationFee: number | null,
  refundAmount: number | null,
  
  // 返却予定（ユーザー入力）
  plannedReturnAt: Timestamp | null,
  
  // メタ
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: 'user' | 'admin',   // 手動予約の場合admin
  notes: string                  // 管理者メモ
}
```

**インデックス:**
- `userId, createdAt` (複合) - 会員の予約履歴
- `status, pickupAt` (複合) - ステータス別一覧
- `vehicleId, pickupAt` (複合) - 車両の予約確認
- `pickupAt` (単一) - リマインダー用
- `stripeCheckoutSessionId` (単一) - Webhook処理用

### reservations/{reservationId}/statusHistory（ステータス履歴）

```javascript
{
  id: string,
  fromStatus: string,
  toStatus: string,
  changedBy: string,             // userId or 'admin' or 'system'
  reason: string | null,
  createdAt: Timestamp
}
```

---

### verificationCodes（認証コード）

```javascript
{
  id: string,
  userId: string,
  type: 'email_verify' | 'password_reset' | 'login_2fa',
  code: string,                  // 6桁
  expiresAt: Timestamp,
  used: boolean,
  createdAt: Timestamp
}
```

**インデックス:**
- `userId, type, used` (複合)
- `expiresAt` (単一) - TTL用

---

### settings/shop（店舗設定）

```javascript
{
  shopName: string,
  address: string,
  phone: string,
  email: string,
  openTime: string,              // "09:00"
  closeTime: string,             // "18:00"
  timeStepMinutes: number,       // 15
  maxFutureMonths: number,       // 6
  closedDates: string[],         // ["2026-12-31", "2026-01-01"]
  updatedAt: Timestamp
}
```

### settings/cancellationPolicy（キャンセルポリシー）

```javascript
{
  policies: [
    { daysBeforeMin: 7, daysBeforeMax: null, rate: 0 },
    { daysBeforeMin: 3, daysBeforeMax: 6, rate: 0.3 },
    { daysBeforeMin: 0, daysBeforeMax: 2, rate: 0.5 }
  ],
  noShowRate: 1.0,
  updatedAt: Timestamp
}
```

### settings/legalDocuments（法的文書）

```javascript
{
  terms: string,                 // 利用規約（HTML or Markdown）
  privacy: string,               // プライバシーポリシー
  termsUpdatedAt: Timestamp,
  privacyUpdatedAt: Timestamp
}
```

---

### emailQueue（メールキュー）

```javascript
{
  id: string,
  to: string,
  subject: string,
  template: string,              // テンプレート名
  templateData: object,
  status: 'pending' | 'sent' | 'failed',
  attempts: number,
  lastError: string | null,
  scheduledAt: Timestamp,        // 送信予定時刻
  sentAt: Timestamp | null,
  createdAt: Timestamp
}
```

**インデックス:**
- `status, scheduledAt` (複合)

---

## クエリパターン

### 車両在庫確認（予約時）

```javascript
// 指定期間に空いている車両を取得
// 1. 該当クラスの車両を取得
// 2. 期間内に予約が入っている車両IDを除外
// 3. メンテナンス中の車両を除外

// Step 1: 車両取得
const vehicles = await db.collection('vehicles')
  .where('carClassId', '==', classId)
  .where('status', '!=', 'maintenance')
  .get();

// Step 2: 期間内の予約を持つ車両を取得
const conflictingReservations = await db.collection('reservations')
  .where('carClassId', '==', classId)
  .where('status', 'in', ['confirmed', 'picked_up'])
  .where('pickupAt', '<=', endTime)
  .get();

// Step 3: 除外処理（アプリ側）
```

### リマインダー対象取得

```javascript
// 明日受取の予約を取得
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);

const dayAfter = new Date(tomorrow);
dayAfter.setDate(dayAfter.getDate() + 1);

const reminders = await db.collection('reservations')
  .where('status', '==', 'confirmed')
  .where('pickupAt', '>=', tomorrow)
  .where('pickupAt', '<', dayAfter)
  .get();
```

---

## トランザクション必須処理

1. **予約作成**: 車両割り当て + 予約作成 + 在庫数更新
2. **予約キャンセル**: 予約更新 + 車両解放 + 在庫数更新
3. **車両メンテナンス設定**: 車両更新 + 予約確認

---

## セキュリティルール（Firestore Rules）

```javascript
// クライアントからの直接アクセスは禁止
// 全てCloud Run経由でAdmin SDKを使用
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
