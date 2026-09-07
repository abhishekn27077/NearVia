# NEARVIA — DEPLOYMENT & ENVIRONMENT ARCHITECTURE GUIDE

> **Document Version**: 1.0.0  
> **Status**: Approved Staging Architecture  
> **Target Audience**: DevOps Engineers, Lead Architects, System Administrators  

---

## 1. Environment Architecture & Separation Strategy

NEARVIA strictly maintains three distinct operational tiers to prevent configuration cross-contamination, credential leakage, or unauthorized data mutation.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ENVIRONMENT SEPARATION MATRIX                                │
├─────────────────────────┬─────────────────────────┬─────────────────────────────────────────┤
│ FEATURE / COMPONENT     │ DEVELOPMENT             │ STAGING                 │ PRODUCTION    │
├─────────────────────────┼─────────────────────────┼─────────────────────────┼───────────────┤
│ Node Environment        │ `development`           │ `production` (staging)  │ `production`  │
│ Database Host           │ Local PostgreSQL 17     │ Supabase Staging DB     │ Dedicated DB  │
│ PostGIS Version         │ PostGIS 3.3+            │ PostGIS 3.3 (Supabase)  │ PostGIS 3.3+  │
│ Auth Provider           │ Mock / Local Supabase   │ Supabase Staging Auth   │ Supabase Prod │
│ Payment Mode            │ `demo` / `sandbox`      │ `sandbox` (Razorpay)    │ `production`  │
│ SMS / OTP Mode          │ `mock` (console log)    │ `mock` / Staging DLT    │ `msg91` DLT   │
│ AI Processing           │ `mock` (heuristics)     │ `mock` / Gemini Test    │ Gemini Pro    │
│ Rate Limiting           │ In-memory (relaxed)     │ In-memory (strict)      │ Redis Cluster │
│ Logging Level           │ `debug` (verbose)       │ `info` (structured JSON)│ `warn`/`error`│
│ Allowed CORS Origins    │ localhost:3000, 5173    │ staging.nearvia.in      │ nearvia.in    │
└─────────────────────────┴─────────────────────────┴─────────────────────────┴───────────────┘
```

### 1.1 Strict Isolation Rules
1. **Never share credentials across tiers**: Development environments must never have access to production connection strings or Supabase service role keys.
2. **Database isolation**: Staging and Production databases must reside in separate database clusters or separate Supabase projects. Under no circumstances may staging write to the production database.
3. **Fail-fast production guards**:
   - `PAYMENT_MODE=demo` is rejected at startup in production.
   - `OTP_PROVIDER=mock` is rejected at startup in production unless explicitly overridden with `ALLOW_MOCK_OTP_IN_PRODUCTION=true`.
4. **Data privacy**: Real production PII (Aadhaar, PAN, phone numbers, exact residential coordinates) must never be back-ported into staging or development seeds.

---

## 2. Infrastructure & Network Topology

```
                                  [ INTERNET CLIENTS ]
                                (Worker & Provider Browsers)
                                             │
                                             ▼
                                   [ CLOUDFLARE CDN / WAF ]
                                  (SSL/TLS Termination, DDoS)
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ FRONTEND WEB APP ]                         [ REST API SERVER ]
          (Vite SPA on Vercel/Render)                  (Node.js/Express on Render/ECS)
          https://app.nearvia.in                       https://api.nearvia.in
                       │                                           │
                       │                                           ▼
                       │                                   [ RATE LIMITER SHIELD ]
                       │                                   (In-memory / Redis)
                       │                                           │
                       │                       ┌───────────────────┼───────────────────┐
                       │                       ▼                   ▼                   ▼
                       │               [ SUPABASE CLOUD ]   [ RAZORPAY GATEWAY ] [ MSG91 DLT ]
                       │             (Auth, PostgreSQL 17,    (Sandbox/Live       (Transactional
                       │               PostGIS 3.3, RLS)        Webhooks)           SMS OTP)
                       ▼                       │
               [ BROWSER MAP ]                 ▼
              (Leaflet / OSM)         [ ENCRYPTED STORAGE ]
                                      (Job Evidence, Avatars)
```

---

## 3. Domain, HTTPS & CORS Configuration

### 3.1 Domain Allocations
| Environment | Frontend URL | API Endpoint | Documentation |
| :--- | :--- | :--- | :--- |
| **Local Dev** | `http://localhost:5173` | `http://localhost:4000/api/v1` | `http://localhost:4000/api/v1/health` |
| **Staging** | `https://staging.nearvia.in` | `https://staging-api.nearvia.in/api/v1` | `https://staging-api.nearvia.in/api/v1/health` |
| **Production**| `https://app.nearvia.in` | `https://api.nearvia.in/api/v1` | `https://api.nearvia.in/api/v1/health` |

### 3.2 CORS & Security Headers
The API applies strict origin checking via `services/api/src/app.ts`:
- Rejects wildcard (`*`) origins in production mode.
- Validates incoming `Origin` headers against the comma-separated `CORS_ORIGIN` environment variable.
- Sets standard security headers:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 4. Deployment Procedure

### 4.1 Automated CI Pipeline
Every release candidate must pass through the automated GitHub Actions pipeline:
1. `npm ci` (Strict lockfile dependency installation)
2. `npm run typecheck` (Zero TypeScript compiler errors across all 6 workspaces)
3. `npm test` (Full unit, integration, and security negative test execution)
4. `npm run build` (Clean production bundle compilation)
5. `npm audit` (Zero high or critical security vulnerabilities)

### 4.2 Database Migration Execution
```bash
# 1. Test migration dry-run on local/staging replica
npx tsx services/api/src/db/migrate.ts

# 2. Verify PostGIS extension and GIST indexes
SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';

# 3. Apply schema migration idempotently
# Migrations reside in database/migrations/*.sql
```

### 4.3 Rollback Procedure
If a critical P0 failure is detected post-deployment:
1. **Frontend**: Revert the hosting deployment commit via Git or platform release rollback.
2. **API**: Roll back the container image to the previous verified SHA.
3. **Database**: Migration scripts use non-destructive deprecation patterns (columns are marked deprecated rather than dropped). If schema rollback is required, execute corresponding down-scripts documented in `docs/BACKUP_AND_RECOVERY.md`.
4. **Kill Switches**: If an external provider experiences an outage, deactivate the specific module using environment toggles (`PAYMENT_MODE=demo`, `AI_PROVIDER=mock`) without interrupting core marketplace operations.
