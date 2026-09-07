# NEARVIA — PRODUCTION READINESS CHECKLIST

> **Document Status**: Staging Verified / Production Blockers Documented  
> **Mandatory Rule**: Every gate must be empirically verified or marked `BLOCKED / REQUIRES HUMAN REVIEW`. No items may be fabricated.

---

## 1. SECURITY & ACCESS CONTROL
- [x] **P0 / P1 Security Vulnerabilities Resolved**: Zero high/critical vulnerabilities identified (`npm audit`).
- [x] **Client-Side Secret Isolation**: Verified that `apps/web/dist` contains 0 private keys, service role tokens, or passwords.
- [x] **Row-Level Security (RLS) & Table Permissions**: User data partitions verified on Supabase PostgreSQL.
- [x] **Role-Based Access Control (RBAC)**: `requireRole` middleware enforces WORKER, PROVIDER, and ADMIN boundaries with `403 Forbidden`.
- [x] **Insecure Direct Object Reference (IDOR) Guard**: Private payments, assignments, and chat conversations verify ownership server-side before serving data.
- [x] **Rate Limiting Barriers**: Route-specific limiters active on OTP (6/15m), AI (30/15m), Payments (30/15m), Messages (60/15m), and Webhooks (120/1m).
- [x] **SQL Injection Parameterization**: 100% of SQL queries utilize parameterized placeholders (`$1, $2`).
- [x] **XSS Content Escaping**: React JSX automatic escaping active; zero raw HTML injection surfaces.

---

## 2. DATABASE & SPATIAL ENGINE
- [x] **Clean Migration Reproducibility**: All 12 migration scripts execute sequentially without conflicts.
- [x] **PostGIS 3.3 Spatial Engine Active**: Verified `ST_DWithin`, `ST_MakePoint`, and SRS 4326 geography calculations.
- [x] **Spatial GIST Indexes**: GIST indexes active on `work_opportunities(location)` and `worker_profiles(location)`.
- [x] **Trigram Text Search (pg_trgm)**: Active on skills, categories, and job titles for fast fuzzy matching.
- [x] **Webhook Idempotency Constraint**: Table `webhook_events` enforces `UNIQUE(provider, event_id)` rejecting duplicates with code `23505`.
- [ ] **Continuous PITR Backups**: `BLOCKED — REQUIRES INFRASTRUCTURE CONFIGURATION` (Requires paid Supabase Pro/Team tier for automated Point-In-Time Recovery).
- [x] **Database Recovery Runbook**: Documented in `docs/BACKUP_AND_RECOVERY.md`.

---

## 3. AUTHENTICATION & IDENTITY
- [x] **Server-Side Identity Derivation**: User `id` and `role` derived exclusively from verified PostgreSQL records, never accepted from client payloads.
- [x] **Suspended User Enforcement**: `users.is_active` checked on every authenticated request; deactivated accounts blocked with `403`.
- [x] **Production Redirect URLs**: Supabase Auth configured with explicit redirect whitelists (`https://staging.nearvia.in`, `https://app.nearvia.in`).
- [x] **Admin Self-Registration Gated**: Registration endpoint rejects `role: "ADMIN"` requests with `403`.

---

## 4. PAYMENTS & FINANCIAL SETTLEMENT
- [x] **Deterministic Wage Derivation**: Payment order creation reads `assignments.agreed_wage` directly from DB; client amounts ignored.
- [x] **Webhook HMAC-SHA256 Verification**: Constant-time signature verification (`crypto.timingSafeEqual`) using raw byte capture.
- [x] **Double-Payment Transaction Locking**: State transitions locked via `SELECT ... FOR UPDATE` in PostgreSQL transactions.
- [x] **Cash Confirmation Flow**: Transparent two-party confirmation: *"Cash payment confirmed between provider and worker"*.
- [ ] **Commercial Payment Gateway Activation**: `BLOCKED — REQUIRES BUSINESS ACTIVATION` (Requires commercial entity KYC, GST registration, bank settlement setup, and live Razorpay API keys `rzp_live_...`).

---

## 5. SMS & OTP VERIFICATION
- [x] **Fail-Fast Production Guard**: Throws startup exception if `NODE_ENV=production` and `OTP_PROVIDER=mock`.
- [x] **Salted In-Memory / Hash Storage**: OTP codes are salted and verified with 5-minute expiry.
- [ ] **Indian Telecom DLT Registration**: `BLOCKED — REAL SMS CREDENTIALS REQUIRED` (Requires entity registration on Vilpower/Jio DLT portals, Header approval, and transactional SMS template whitelisting).

---

## 6. MONITORING & OBSERVABILITY
- [x] **Standard Health Probes**: `/health` (liveness), `/ready` (dependency check), `/health/deep` (DB, spatial, schema telemetry).
- [x] **Correlation IDs (`X-Request-Id`)**: End-to-end request tracing via custom headers.
- [x] **Credential-Sanitized Logging**: Password, OTP, token, and card stripping verified in `requestLogger.ts`.
- [ ] **Cloud Centralized APM**: `BLOCKED — REQUIRES INFRASTRUCTURE CONFIGURATION` (Requires Sentry / Datadog DSN configuration in production environment).

---

## 7. LEGAL & REGULATORY GATES
- [ ] **Platform Terms of Service**: `REQUIRES HUMAN/LEGAL REVIEW` (Needs formal review for Indian marketplace intermediary guidelines).
- [ ] **User Privacy Policy**: `REQUIRES HUMAN/LEGAL REVIEW` (Needs compliance audit under Digital Personal Data Protection Act 2023).
- [ ] **Worker / Provider Agreements**: `REQUIRES HUMAN/LEGAL REVIEW` (Clarification of gig worker classification and independent contractor status).
- [ ] **Cash Payment Dispute Policy**: `REQUIRES HUMAN/LEGAL REVIEW` (Legal terms clarifying platform intermediary role for direct cash payments).
- [ ] **Tax & GST Invoicing Rules**: `REQUIRES HUMAN/LEGAL REVIEW` (Platform fee GST liability vs worker non-taxable threshold).

---

## 8. CONTROLLED PILOT DEPLOYMENT
- [x] **Geographic Boundary Constrained**: Limited to single Bengaluru urban cluster (Koramangala / Indiranagar / HSR layout).
- [x] **Participant Cohort Limits**: Maximum 50 registered workers and 20 verified local businesses.
- [x] **Manual Dispute Escalation**: Dedicated on-call administrator contact provided for pilot feedback and dispute mediation.
- [x] **Controlled Seed Reset Capability**: Tested seed and reset scripts (`npm run seed:demo`, `npm run reset:demo`).
- [x] **Zero Production Data in Development**: Strict separation between pilot database and test datasets.
