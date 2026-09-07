# Phase 14: Payments, Earnings & Wage Settlement Architecture

## 1. Overview & Core Philosophy
The NEARVIA Payment & Wage Settlement Subsystem provides a reliable, middleman-free, and mathematically accurate financial mechanism for settling wages between employers (providers) and frontline workers for completed hyperlocal work shifts.

### Core Money Flow
$$\text{WORK COMPLETED} \longrightarrow \text{PAYMENT INITIATED} \longrightarrow \text{PAYMENT CONFIRMED} \longrightarrow \text{WORKER EARNINGS CREDITED} \longrightarrow \text{DIGITAL RECEIPT GENERATED}$$

---

## 2. Key Architecture Pillars

### 2.1 Separation of Concerns: Assignment Completion $\neq$ Payment Success
* Marking work as `COMPLETED` records operational delivery; it **does not** automatically mean money was moved.
* Payment creation requires verification that:
  1. The assignment exists and belongs to the caller's work opportunity.
  2. The assignment status is strictly `COMPLETED`.
  3. The assignment has not already been marked `CONFIRMED` (paid).
  4. The authorized payer matches the provider user ID on record.
  5. The payout goes directly to the worker user ID without third-party intervention.

### 2.2 Strict Integer Minor-Unit Arithmetic (Zero Floating-Point Error)
* Currency: **INR (₹)**
* Internal representation: **Paise** (integer minor units, where ₹1.00 = 100 paise).
* All calculations (wage aggregations, transaction logs, refunds) operate in integer paise to avoid IEEE 754 floating-point rounding errors.

### 2.3 Decoupled Payment Provider Abstraction
Business logic relies on an extensible provider interface rather than hardcoding a specific vendor SDK:
```typescript
export interface PaymentProvider {
  createOrder(input: CreatePaymentOrderInput): Promise<PaymentOrderResult>;
  verifyWebhook(payload: string, signature: string): Promise<WebhookVerificationResult>;
  processRefund(gatewayPaymentId: string, amountPaise: number, reason: string): Promise<RefundResult>;
}
```
* Default: `SandboxPaymentProvider` with cryptographic HMAC-SHA256 signature verification and simulated webhook/settlement lifecycle.

### 2.4 Agent Boundary Protection
* Community agents (Phase 13) **cannot** initiate, hold, or deduct commissions from worker payments.
* Payments route 100% directly from employer (`payer_id`) to worker (`payee_id`).

### 2.5 Idempotency & Webhook Security
* Every payment order generates a unique `idempotency_key` and `gateway_order_id`.
* Webhooks verify SHA-256 HMAC signatures against `PAYMENT_WEBHOOK_SECRET`.
* Repeated webhook events for the same order are processed idempotently without duplicated ledger entries.

---

## 3. Database Schema (`payment_records`)
```sql
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    transaction_ref VARCHAR(255),
    idempotency_key VARCHAR(255),
    gateway_order_id VARCHAR(255),
    gateway_payment_id VARCHAR(255),
    gateway_signature VARCHAR(255),
    notes TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Endpoints

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/assignments/:id/pay` | `PROVIDER` | Initiates payment for a completed assignment |
| `POST` | `/api/v1/payments/:id/confirm` | `PROVIDER` | Directly confirms payment (sandbox/direct checkout) |
| `POST` | `/api/v1/payments/webhook` | `PUBLIC` | Webhook receiver with HMAC-SHA256 signature verification |
| `GET` | `/api/v1/payments/worker/earnings` | `WORKER` | Aggregated earnings summary (Total Earned, Pending Settlement) |
| `GET` | `/api/v1/payments/worker/transactions` | `WORKER` | Filterable transaction ledger and digital receipts |
| `GET` | `/api/v1/payments/provider/summary` | `PROVIDER` | Total paid and pending payable metrics |
| `GET` | `/api/v1/payments/provider/history` | `PROVIDER` | Historical wage settlement logs |
| `GET` | `/api/v1/payments/provider/payable` | `PROVIDER` | List of completed shifts awaiting wage payment |
| `GET` | `/api/v1/payments/:id` | `ANY AUTH` | Single payment receipt and audit details |
| `POST` | `/api/v1/payments/:id/refund` | `PROVIDER` | Initiates refund on a CONFIRMED payment |
