# エラーハンドリング・フォールバック仕様

## 設計方針

1. **失敗を前提に設計**: 外部サービスは必ず失敗する
2. **明示的なステータス管理**: 曖昧な状態を作らない
3. **リカバリー可能に**: 手動対応ができる仕組みを用意
4. **ユーザーには優しく**: 技術的詳細は隠し、次のアクションを提示

---

## Stripe連携

### 1. Checkout Session作成失敗

**発生条件**: Stripe APIエラー、ネットワーク障害

**対応**:
```typescript
try {
  const session = await stripe.checkout.sessions.create({...});
  // 予約を pending_payment で作成
} catch (error) {
  // 予約は作成しない
  throw new AppError(
    'PAYMENT_INIT_FAILED',
    '決済の初期化に失敗しました。しばらく経ってから再度お試しください。',
    503
  );
}
```

**ユーザー体験**: エラーメッセージを表示、再試行を促す

---

### 2. Webhook遅延・未着

**発生条件**: Stripeからの通知が遅延または届かない

**対応**:
```typescript
// 予約作成時
const reservation = {
  status: 'pending_payment',
  stripeCheckoutSessionId: session.id,
  paymentExpiresAt: addMinutes(new Date(), 30), // 30分後に期限切れ
  ...
};

// 定期チェック（5分ごと）
async function checkPendingPayments() {
  const pendingReservations = await db.collection('reservations')
    .where('status', '==', 'pending_payment')
    .where('paymentExpiresAt', '<', Timestamp.now())
    .get();
  
  for (const doc of pendingReservations.docs) {
    const res = doc.data();
    
    // Stripe側の状態を確認
    const session = await stripe.checkout.sessions.retrieve(res.stripeCheckoutSessionId);
    
    if (session.payment_status === 'paid') {
      // Webhook漏れ → 手動で確定処理
      await confirmReservation(doc.id);
      await logEvent('WEBHOOK_MISSED_RECOVERY', { reservationId: doc.id });
    } else if (session.status === 'expired') {
      // 期限切れ → 予約削除・車両解放
      await cancelPendingReservation(doc.id);
    }
    // それ以外はまだ決済中なので待機
  }
}
```

**ユーザー体験**: 決済完了画面で「処理中」表示、数秒後にステータス確認

---

### 3. 決済失敗

**発生条件**: カード拒否、残高不足等

**対応**:
- Stripe Checkout側でエラー表示
- Webhookで`checkout.session.expired`を受信したら予約削除

```typescript
// checkout.session.expired 処理
case 'checkout.session.expired':
  const sessionId = event.data.object.id;
  const reservation = await findReservationByCheckoutSession(sessionId);
  
  if (reservation && reservation.status === 'pending_payment') {
    await cancelPendingReservation(reservation.id);
    // 車両解放は cancelPendingReservation 内で実行
  }
  break;
```

---

### 4. 返金失敗

**発生条件**: Stripe API障害、元の決済が古すぎる等

**対応**:
```typescript
async function processRefund(reservationId: string, amount: number) {
  const reservation = await getReservation(reservationId);
  
  try {
    const refund = await stripe.refunds.create({
      payment_intent: reservation.stripePaymentIntentId,
      amount: amount,
    });
    
    await updateReservation(reservationId, {
      paymentStatus: 'refunded',
      refundAmount: amount,
      stripeRefundId: refund.id,
      cancelledAt: Timestamp.now()
    });
    
    return { success: true, refundId: refund.id };
    
  } catch (error) {
    // 返金失敗をログ
    await logEvent('REFUND_FAILED', {
      reservationId,
      amount,
      error: error.message
    });
    
    // 管理者に通知
    await sendAdminNotification('返金処理失敗', {
      reservationId,
      amount,
      error: error.message,
      action: 'Stripe管理画面から手動で返金してください'
    });
    
    // 予約には手動対応フラグを立てる
    await updateReservation(reservationId, {
      status: 'cancelled',
      refundStatus: 'manual_required',
      refundError: error.message,
      cancelledAt: Timestamp.now()
    });
    
    throw new AppError(
      'REFUND_FAILED',
      '返金処理に失敗しました。手動で対応します。',
      500
    );
  }
}
```

**管理画面表示**: 「要手動対応」バッジを表示、Stripe管理画面へのリンク

---

### 5. 二重決済防止

**対応**:
```typescript
// 1. client_reference_id を使用
const session = await stripe.checkout.sessions.create({
  client_reference_id: reservation.id, // 予約IDをセット
  ...
});

// 2. Webhook処理で重複チェック
case 'checkout.session.completed':
  const reservationId = event.data.object.client_reference_id;
  const reservation = await getReservation(reservationId);
  
  // 既に確定済みならスキップ
  if (reservation.status !== 'pending_payment') {
    console.log(`Reservation ${reservationId} already processed`);
    return;
  }
  
  // 確定処理
  await confirmReservation(reservationId);
  break;

// 3. idempotencyKey を使用（API呼び出し側）
const session = await stripe.checkout.sessions.create({
  ...
}, {
  idempotencyKey: `checkout_${reservationId}`
});
```

---

## Resend（メール送信）

### 1. 送信失敗

**対応**:
```typescript
async function sendEmail(to: string, subject: string, html: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
      return { success: true };
    } catch (error) {
      if (attempt === retries) {
        // 最終試行も失敗
        await logEvent('EMAIL_SEND_FAILED', { to, subject, error: error.message });
        await queueForManualRetry({ to, subject, html });
        
        // クリティカルなメール（2FA等）の場合は管理者に通知
        if (isCriticalEmail(subject)) {
          await sendAdminNotification('重要メール送信失敗', { to, subject });
        }
        
        return { success: false, error: error.message };
      }
      
      // リトライ前に待機（エクスポネンシャルバックオフ）
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
}
```

### 2. メールキュー管理

```typescript
// emailQueue コレクションを使用
async function queueEmail(data: EmailData) {
  await db.collection('emailQueue').add({
    ...data,
    status: 'pending',
    attempts: 0,
    scheduledAt: Timestamp.now(),
    createdAt: Timestamp.now()
  });
}

// 定期処理（1分ごと）
async function processEmailQueue() {
  const pendingEmails = await db.collection('emailQueue')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', Timestamp.now())
    .limit(50)
    .get();
  
  for (const doc of pendingEmails.docs) {
    const email = doc.data();
    
    try {
      await resend.emails.send({...});
      await doc.ref.update({ status: 'sent', sentAt: Timestamp.now() });
    } catch (error) {
      const attempts = email.attempts + 1;
      
      if (attempts >= 3) {
        await doc.ref.update({ 
          status: 'failed', 
          attempts, 
          lastError: error.message 
        });
      } else {
        // 次回リトライを10分後にスケジュール
        await doc.ref.update({ 
          attempts,
          scheduledAt: Timestamp.fromDate(addMinutes(new Date(), 10)),
          lastError: error.message
        });
      }
    }
  }
}
```

---

## Firestore

### 1. 一時的な障害

**対応**:
```typescript
async function firestoreWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isTransientError(error) && attempt < maxRetries) {
        // エクスポネンシャルバックオフ
        const delay = 100 * Math.pow(2, attempt - 1) + Math.random() * 100;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

function isTransientError(error: any): boolean {
  const transientCodes = [
    'UNAVAILABLE',
    'RESOURCE_EXHAUSTED',
    'DEADLINE_EXCEEDED',
    'ABORTED'
  ];
  return transientCodes.includes(error.code);
}
```

### 2. 車両割り当て競合

**対応**:
```typescript
async function createReservationWithVehicle(data: ReservationInput) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.runTransaction(async (transaction) => {
        // 車両取得・チェック
        const vehicleId = await findAvailableVehicle(
          transaction, 
          data.carClassId, 
          data.pickupAt, 
          data.returnAt
        );
        
        if (!vehicleId) {
          throw new AppError('NO_AVAILABILITY', '在庫がありません', 400);
        }
        
        // 予約作成
        const reservationRef = db.collection('reservations').doc();
        transaction.set(reservationRef, {
          ...data,
          vehicleId,
          id: reservationRef.id
        });
        
        // 在庫更新
        const classRef = db.collection('carClasses').doc(data.carClassId);
        transaction.update(classRef, {
          availableVehicles: FieldValue.increment(-1)
        });
        
        return reservationRef.id;
      });
    } catch (error) {
      if (error.code === 'ABORTED' && attempt < maxRetries) {
        // トランザクション競合 → リトライ
        await sleep(50 * attempt);
        continue;
      }
      throw error;
    }
  }
}
```

---

## フロントエンド連携

### エラーレスポンス形式

```typescript
// 統一フォーマット
interface ErrorResponse {
  error: {
    code: string;        // マシンリーダブル
    message: string;     // ユーザー表示用（日本語）
    details?: any;       // 追加情報（開発用）
    retryable?: boolean; // リトライ可能か
  }
}

// 例
{
  "error": {
    "code": "NO_AVAILABILITY",
    "message": "申し訳ございません。ご希望の日程に空きがありません。",
    "retryable": false
  }
}

{
  "error": {
    "code": "PAYMENT_INIT_FAILED",
    "message": "決済の初期化に失敗しました。しばらく経ってから再度お試しください。",
    "retryable": true
  }
}
```

### HTTPステータスコード使い分け

| コード | 用途 |
|--------|------|
| 400 | バリデーションエラー、在庫なし等のビジネスエラー |
| 401 | 認証エラー |
| 403 | 権限エラー、2FA必要 |
| 404 | リソース未発見 |
| 409 | 競合（既にキャンセル済み等） |
| 429 | レート制限超過 |
| 500 | 内部エラー（詳細は隠す） |
| 503 | 一時的障害（リトライ推奨） |

---

## 監視・アラート

### ログ出力

```typescript
// 構造化ログ
function logEvent(type: string, data: any) {
  console.log(JSON.stringify({
    severity: getSeverity(type),
    type,
    data,
    timestamp: new Date().toISOString()
  }));
}

// Cloud Loggingで検知するイベント
// - REFUND_FAILED: 即時アラート
// - WEBHOOK_MISSED_RECOVERY: 警告
// - EMAIL_SEND_FAILED (critical): 警告
// - RATE_LIMIT_EXCEEDED: 多発時に警告
```

### 管理者通知

```typescript
async function sendAdminNotification(subject: string, data: any) {
  await resend.emails.send({
    from: EMAIL_FROM,
    to: ADMIN_EMAIL,
    subject: `【要対応】${subject}`,
    html: renderAdminNotificationTemplate(subject, data)
  });
}
```
