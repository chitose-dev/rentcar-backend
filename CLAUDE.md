# CLAUDE.md - Claude Code 開発指示書

## プロジェクト概要

レンタカー予約システム「トクノリレンタカー」のバックエンドAPI開発。
Cloud Run + Firestore + Stripe + Resend で構成。

## 関連ドキュメント（必読）

1. `SPEC.md` - 全体仕様
2. `DATABASE.md` - Firestoreスキーマ
3. `API.md` - APIエンドポイント仕様

---

## 技術スタック

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: Firebase Firestore (Admin SDK)
- **Payment**: Stripe
- **Email**: Resend
- **Hosting**: Google Cloud Run
- **Validation**: Zod
- **Testing**: Vitest

---

## ディレクトリ構成

```
/
├── src/
│   ├── index.ts                 # エントリーポイント
│   ├── config/
│   │   ├── env.ts               # 環境変数
│   │   └── firebase.ts          # Firebase初期化
│   ├── middleware/
│   │   ├── auth.ts              # JWT認証
│   │   ├── adminAuth.ts         # 管理者認証
│   │   ├── rateLimit.ts         # レート制限
│   │   ├── errorHandler.ts      # エラーハンドリング
│   │   └── validateRequest.ts   # リクエストバリデーション
│   ├── routes/
│   │   ├── index.ts             # ルート集約
│   │   ├── auth.ts              # 認証
│   │   ├── user.ts              # ユーザー
│   │   ├── reservation.ts       # 予約
│   │   ├── shop.ts              # 店舗情報
│   │   ├── stripe.ts            # Stripe Webhook
│   │   └── admin/
│   │       ├── index.ts
│   │       ├── auth.ts
│   │       ├── reservations.ts
│   │       ├── members.ts
│   │       ├── vehicles.ts
│   │       ├── carClasses.ts
│   │       ├── pricing.ts
│   │       ├── options.ts
│   │       └── settings.ts
│   ├── services/
│   │   ├── authService.ts       # 認証ロジック
│   │   ├── reservationService.ts # 予約ロジック
│   │   ├── vehicleService.ts    # 車両・在庫ロジック
│   │   ├── stripeService.ts     # Stripe連携
│   │   ├── emailService.ts      # メール送信
│   │   └── schedulerService.ts  # 定期処理（リマインダー等）
│   ├── schemas/
│   │   ├── auth.ts              # Zodスキーマ
│   │   ├── reservation.ts
│   │   └── admin.ts
│   ├── types/
│   │   ├── index.ts             # 型定義
│   │   └── firestore.ts         # Firestoreドキュメント型
│   └── utils/
│       ├── errors.ts            # カスタムエラー
│       ├── jwt.ts               # JWT操作
│       ├── hash.ts              # ハッシュ操作
│       ├── date.ts              # 日付操作
│       └── reservationId.ts     # 予約ID生成
├── test/
│   ├── unit/
│   └── integration/
├── Dockerfile
├── cloudbuild.yaml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 実装ルール

### 1. エラーハンドリング

```typescript
// カスタムエラーを使用
import { AppError } from '@/utils/errors';

// 使用例
throw new AppError('EMAIL_ALREADY_EXISTS', 'このメールアドレスは既に登録されています', 400);

// エラーハンドラで統一処理
app.use(errorHandler);
```

### 2. Firestoreトランザクション

車両割り当て・在庫更新は必ずトランザクションを使用：

```typescript
await db.runTransaction(async (transaction) => {
  // 1. 車両取得
  const vehicleRef = db.collection('vehicles').doc(vehicleId);
  const vehicle = await transaction.get(vehicleRef);
  
  // 2. 予約作成
  const reservationRef = db.collection('reservations').doc();
  transaction.set(reservationRef, reservationData);
  
  // 3. 車両更新
  transaction.update(vehicleRef, { 
    currentReservationId: reservationRef.id 
  });
  
  // 4. 在庫数更新
  const classRef = db.collection('carClasses').doc(classId);
  transaction.update(classRef, {
    availableVehicles: FieldValue.increment(-1)
  });
});
```

### 3. Stripe連携

```typescript
// Checkout Session作成
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [...],
  success_url: `${FRONTEND_URL}/reserve-complete?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${FRONTEND_URL}/reserve-payment`,
  metadata: {
    reservationId: reservation.id
  },
  // 二重決済防止
  client_reference_id: reservation.id,
});

// Webhook署名検証
const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  STRIPE_WEBHOOK_SECRET
);
```

### 4. メール送信（Resend）

```typescript
import { Resend } from 'resend';

const resend = new Resend(RESEND_API_KEY);

await resend.emails.send({
  from: 'トクノリレンタカー <noreply@tokunori.example.com>',
  to: user.email,
  subject: '【トクノリレンタカー】予約確定のお知らせ',
  html: renderTemplate('reservation-confirmed', { ... })
});
```

### 5. バリデーション（Zod）

```typescript
import { z } from 'zod';

export const createReservationSchema = z.object({
  body: z.object({
    carClassId: z.string().min(1),
    pricingPlanId: z.string().min(1),
    pickupAt: z.string().datetime(),
    returnAt: z.string().datetime(),
    paymentMethod: z.enum(['card', 'onsite']),
    insuranceType: z.enum(['none', 'standard', 'premium']).optional(),
    options: z.array(z.object({
      optionId: z.string(),
      quantity: z.number().int().positive()
    })).optional()
  })
});
```

---

## 重要な実装ポイント

### 車両自動割り当てロジック

```typescript
async function assignVehicle(
  classId: string, 
  pickupAt: Date, 
  returnAt: Date
): Promise<string | null> {
  // 1. 該当クラスの車両を取得
  const vehicles = await db.collection('vehicles')
    .where('carClassId', '==', classId)
    .where('status', '!=', 'maintenance')
    .get();
  
  // 2. 期間内に予約が入っている車両を除外
  const conflictingReservations = await db.collection('reservations')
    .where('carClassId', '==', classId)
    .where('status', 'in', ['confirmed', 'picked_up', 'pending_payment'])
    .get();
  
  const busyVehicleIds = new Set<string>();
  conflictingReservations.forEach(doc => {
    const res = doc.data();
    // 期間が重複するかチェック
    if (res.pickupAt.toDate() < returnAt && res.returnAt.toDate() > pickupAt) {
      busyVehicleIds.add(res.vehicleId);
    }
  });
  
  // 3. 空いている車両を見つける
  for (const vehicle of vehicles.docs) {
    if (!busyVehicleIds.has(vehicle.id)) {
      // メンテナンス期間もチェック
      const data = vehicle.data();
      if (data.nextMaintenanceStart && data.nextMaintenanceEnd) {
        const maintStart = data.nextMaintenanceStart.toDate();
        const maintEnd = data.nextMaintenanceEnd.toDate();
        if (maintStart < returnAt && maintEnd > pickupAt) {
          continue; // メンテナンス期間と重複
        }
      }
      return vehicle.id;
    }
  }
  
  return null; // 空きなし
}
```

### 2段階認証（新規デバイス検知）

```typescript
async function checkDevice(userId: string, fingerprint: string, ip: string) {
  const devicesRef = db.collection(`users/${userId}/devices`);
  const existingDevice = await devicesRef
    .where('fingerprint', '==', fingerprint)
    .where('trusted', '==', true)
    .limit(1)
    .get();
  
  if (existingDevice.empty) {
    // 新規デバイス → 2FA必要
    const code = generateCode(); // 6桁
    await db.collection('verificationCodes').add({
      userId,
      type: 'login_2fa',
      code,
      expiresAt: Timestamp.fromDate(addMinutes(new Date(), 10)),
      used: false,
      createdAt: Timestamp.now()
    });
    
    await sendEmail(user.email, '認証コード', { code });
    
    return { requires2FA: true, tempToken: generateTempToken(userId) };
  }
  
  // 既知のデバイス → 最終使用日時を更新
  await existingDevice.docs[0].ref.update({ lastUsedAt: Timestamp.now() });
  return { requires2FA: false };
}
```

### リマインダー送信（Cloud Scheduler連携）

```typescript
// /api/scheduler/send-reminders (Cloud Schedulerから呼び出し)
async function sendReminders() {
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const dayAfter = startOfDay(addDays(new Date(), 2));
  
  const reservations = await db.collection('reservations')
    .where('status', '==', 'confirmed')
    .where('pickupAt', '>=', Timestamp.fromDate(tomorrow))
    .where('pickupAt', '<', Timestamp.fromDate(dayAfter))
    .get();
  
  for (const doc of reservations.docs) {
    const res = doc.data();
    await queueEmail({
      to: res.userEmail,
      template: 'reminder',
      data: {
        userName: res.userName,
        pickupAt: res.pickupAt.toDate(),
        vehicleModel: res.vehicleModel,
        licensePlate: res.vehicleLicensePlate
      }
    });
  }
}
```

---

## 環境変数

```env
# Firebase
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=30d

# Stripe
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Resend
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@tokunori.example.com

# Frontend
FRONTEND_URL=https://tokunori.example.com

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=xxx  # 初回のみ、後でDB管理
```

---

## テスト方針

### 単体テスト必須
- 車両割り当てロジック
- キャンセル料金計算
- 予約ID生成
- バリデーション

### 統合テスト必須
- 予約フロー全体（作成→確定→受取→返却）
- キャンセルフロー（申請→承認→返金）
- 2段階認証フロー

---

## デプロイ

```bash
# Cloud Buildでデプロイ
gcloud builds submit --config cloudbuild.yaml

# 環境変数はSecret Managerで管理
gcloud secrets create stripe-secret-key --data-file=-
```

---

## 開発の優先順位

1. **Phase 1**: 認証（登録、ログイン、2FA）
2. **Phase 2**: 予約作成（在庫チェック、車両割り当て、Stripe連携）
3. **Phase 3**: 予約管理（ユーザー側）
4. **Phase 4**: 管理者機能（予約管理、車両管理）
5. **Phase 5**: 定期処理（リマインダー）
6. **Phase 6**: 残りの管理者機能

---

## 注意事項

1. **Stripeとの整合性**: Webhookが遅延する可能性あり。`pending_payment`ステータスでフロントエンドは「決済処理中」と表示
2. **競合条件**: 同時予約で同じ車両が割り当てられないよう、トランザクション必須
3. **タイムゾーン**: 全て日本時間（Asia/Tokyo）で処理、DBはUTC保存
4. **べき等性**: Webhookは複数回呼ばれる可能性あり、idempotencyを確保
