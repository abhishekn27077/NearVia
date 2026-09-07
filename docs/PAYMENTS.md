# NEARVIA — PAYMENT SYSTEM ARCHITECTURE & FINANCIAL SPECIFICATION

> **Document Version**: 2.0.0  
> **Currency Support**: INR (Indian Rupee, ₹)  
> **Precision Standard**: Integer Paise ($1\text{ INR} = 100\text{ paise}$) to eliminate floating-point rounding errors.  
> **Regulatory Boundary**: NEARVIA is an information intermediary and matching marketplace. **NEARVIA does NOT physically hold, escrow, or transmit physical cash.**

---

## 1. Multi-Tier Payment Operational Modes

NEARVIA maintains three distinct payment configurations:

```mermaid
flowchart LR
    Dev["DEMO MODE<br/>(In-Memory Mock)"]
    Staging["SANDBOX MODE<br/>(Razorpay Test Mode)"]
    Prod["PRODUCTION MODE<br/>(Live Razorpay Gateway)"]

    Dev -.->|"Local Testing"| Dev
    Staging -->|"HMAC & Webhook Validated"| Staging
    Prod -->|"BLOCKED Until Commercial KYC"| Blocked[("Legal Activation Required")]
```

### 1.1 Mode Definitions
| Payment Mode | Target Tier | Gateway Key Prefix | Verification Mechanism | Status |
| :--- | :--- | :--- | :--- | :---: |
| **`DEMO`** | Local Development | `mock_key_...` | In-memory simulated transitions | `IMPLEMENTED` |
| **`SANDBOX`** | Staging / Testing | `rzp_test_...` | Real Razorpay Test API + HMAC-SHA256 Webhooks | `TESTED` / `SANDBOX` |
| **`PRODUCTION`** | Live Real-World Pilot| `rzp_live_...` | Commercial Payment Capture & Bank Settlements | `BLOCKED — REQUIRES BUSINESS ACTIVATION` |

---

## 2. Cash Payment Confirmation Workflow

In the Indian informal gig economy, cash-on-completion is the predominant settlement method for micro-shifts. NEARVIA supports a transparent, peer-to-peer cash confirmation workflow without handling physical currency.

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider (Employer)
    actor W as Worker
    participant Web as Web App
    participant API as REST API
    participant DB as PostgreSQL

    Note over P,W: Work shift completed at work site
    P->>W: Hands over physical cash (₹750)
    W->>P: Acknowledges physical cash receipt
    
    P->>Web: Clicks "Confirm Cash Payment" in App
    Web->>API: POST /api/v1/payments/cash-confirm {assignmentId: "..."}
    
    API->>DB: Query assignments (Fetch agreed_wage server-side)
    API->>DB: BEGIN Transaction
    API->>DB: INSERT INTO payment_records (status: 'CONFIRMED', payment_method: 'CASH', notes: 'Cash payment confirmed between provider and worker')
    API->>DB: UPDATE assignments SET payment_status = 'CONFIRMED', final_wage_paid = agreed_wage
    API->>DB: COMMIT Transaction
    
    API-->>Web: Return Payment Confirmation Receipt
    Web-->>P: "Cash payment confirmed directly between provider and worker"
    Web-->>W: Push notification: "Payment of ₹750 recorded"
```

### 2.1 Cash Fraud Mitigation & Neutral Phrasing
- **Neutral Terminology**: To avoid misrepresenting that NEARVIA guarantees or possesses the funds, system UI and receipts strictly display:  
  `"Cash payment confirmed between provider and worker."`
- **Two-Sided Protection**: If an employer falsely claims cash was given or a worker denies receipt, either party can trigger an instant dispute (`POST /api/v1/safety/disputes`) which halts rating updates and escalates the record to the administrative review console.

---

## 3. Online Digital Payment Workflow (Razorpay Sandbox)

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant Web as Web App
    participant API as REST API
    participant Gateway as Razorpay Gateway
    participant DB as PostgreSQL

    P->>Web: Selects "Pay Online via UPI / Card / NetBanking"
    Web->>API: POST /api/v1/payments/create-order {assignmentId: "..."}
    
    API->>DB: Read assignment.agreed_wage (Server-side authoritative)
    API->>Gateway: POST /orders {amount: 75000, currency: "INR"}
    Gateway-->>API: {gatewayOrderId: "order_xyz123"}
    
    API->>DB: INSERT INTO payment_records (status: 'PENDING', transaction_ref: 'order_xyz123')
    API-->>Web: Return {gatewayOrderId, amountPaise: 75000, keyId}
    
    Web->>Gateway: Open Razorpay Checkout Modal
    P->>Gateway: Enters Test UPI ID / Test Card
    Gateway-->>Web: Payment Successful
    
    Note over Gateway,API: Asynchronous Webhook Notification
    Gateway->>API: POST /api/v1/payments/webhook<br/>Headers: X-Razorpay-Signature<br/>Body: {"event": "payment.captured", ...}
    
    API->>API: Read req.rawBody (byte-for-byte UTF-8 buffer)
    API->>API: Compute HMAC-SHA256 using RAZORPAY_WEBHOOK_SECRET
    API->>API: crypto.timingSafeEqual(expectedSig, headerSig)
    
    API->>DB: BEGIN Transaction
    API->>DB: INSERT INTO webhook_events (provider, event_id) VALUES ('RAZORPAY', 'evt_123')
    Note right of DB: Replay attacks fail here with DB error 23505 (Unique Violation)
    API->>DB: UPDATE payment_records SET status = 'CONFIRMED'
    API->>DB: UPDATE assignments SET payment_status = 'CONFIRMED'
    API->>DB: COMMIT Transaction
    
    API-->>Gateway: HTTP 200 OK {"received": true}
```

---

## 4. Production Payment Activation Blockers

In accordance with strict production engineering and regulatory compliance, digital payments cannot be made live until the following four prerequisites are resolved:

1. **Commercial Legal Entity Formation**:
   - A registered Indian business entity (Private Limited, LLP, or Sole Proprietorship) with an active Certificate of Incorporation and PAN.
2. **Goods and Services Tax (GST) Registration**:
   - Valid GSTIN registration for electronic commerce operator tax collection under Section 52 of the CGST Act.
3. **Razorpay Live Merchant KYC & Bank Settlement Approval**:
   - Submission of corporate bank statements, director identity verification, and merchant categorization code (MCC) review by partner acquiring banks.
4. **Escrow Regulatory Compliance (RBI Guidelines)**:
   - Compliance with Reserve Bank of India (RBI) Payment Aggregator and Payment Gateway (PA/PG) guidelines. Platforms aggregating third-party worker settlements require direct nodal account or composite escrow integration.
