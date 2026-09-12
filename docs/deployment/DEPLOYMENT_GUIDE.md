# NEARVIA — ₹0 Free-Tier Production Deployment Guide
**Tagline**: Work Within Reach | Hyperlocal Quick-Work Marketplace  
**Architecture**: Monorepo (Express API Gateway + React Public Web + React Admin Console + Supabase PostgreSQL/PostGIS)

---

## 1. Architectural Overview & Target Topology (₹0 Free-Tier Stack)

This deployment architecture is specifically engineered to run entirely on **₹0/free-tier** cloud resources without incurring hosting or database subscription fees:

```
                                    [ USER / ADMIN BROWSERS ]
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      [ Public Marketplace ]           [ Admin Console ]              [ REST API Gateway ]
       apps/web (Vite SPA)            apps/admin (Vite SPA)          services/api (Express)
      https://nearvia.in             https://admin.nearvia.in       https://api.nearvia.in
      Cloudflare Pages / Vercel      Cloudflare Pages / Vercel       Render / Railway / Fly.io
                 │                              │                              │
                 └──────────────────────────────┼──────────────────────────────┘
                                                │
                                                ▼
                                   [ SUPABASE MANAGED CLOUD ]
                                  (PostgreSQL 15+ / PostGIS 3.3)
                                  • Database Pool (Port 5432 / 6543)
                                  • Supabase Auth (JWT & Email)
                                  • Row Level Security (RLS)
```

### Domain & Subdomain Mapping:
| Service | Target URL | Local Dev Port | Hosting Platform (₹0 Tier) |
| :--- | :--- | :--- | :--- |
| **Public Marketplace** | `https://nearvia.in` | `http://localhost:5173` | Cloudflare Pages / Vercel / Netlify |
| **Admin Console** | `https://admin.nearvia.in` | `http://localhost:5174` | Cloudflare Pages / Vercel / Netlify |
| **REST API Gateway** | `https://api.nearvia.in` | `http://localhost:4000` | Render (Web Service Free) / Railway / Fly.io |
| **Database & Auth** | Supabase Cloud Project | Supabase Managed | Supabase Free Tier (500MB DB, 50,000 MAU) |

---

## 2. Environment Variables Matrix

### A. Backend API Gateway (`services/api/.env`)
These secrets **must strictly remain server-side** in your API host environment:

| Variable | Description | Production Example / Format |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | `production` |
| `PORT` | API listen port | `4000` (or injected by host `$PORT`) |
| `API_HOST` | API host address | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require` |
| `SUPABASE_URL` | Supabase Project API URL | `https://[PROJECT-REF].supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Public Anonymous Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged Backend Admin Key | `eyJhbGciOi...` (NEVER leak to browser) |
| `CORS_ORIGIN` | Allowed web clients | `https://nearvia.in,https://app.nearvia.in,https://admin.nearvia.in` |
| `PAYMENT_MODE` | Payment provider mode | `sandbox` (Razorpay Test mode) |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `secret_...` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret | `whsec_...` |
| `OTP_PROVIDER` | SMS OTP gateway | `mock` (with `ALLOW_MOCK_OTP_IN_PRODUCTION=true` for demos) or `msg91` |
| `AI_PROVIDER` | Intelligence layer mode | `mock` (Pure SQL & deterministic rules) or `gemini` |
| `MAP_DEFAULT_RADIUS_KM` | Hyperlocal radius | `5` |
| `MAP_MAX_RADIUS_KM` | Maximum search radius | `15` |
| `ALLOW_DEMO_SEED_IN_PROD` | Production seed guard | `false` |
| `ALLOW_DEMO_RESET_IN_PROD` | Production reset guard | `false` |

### B. Public Frontend Marketplace (`apps/web/.env`)
Only `VITE_` variables are bundled into browser JavaScript:

| Variable | Description | Production Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | REST API target endpoint | `https://api.nearvia.in/api/v1` |
| `VITE_APP_NAME` | Platform name | `NEARVIA` |
| `VITE_APP_TAGLINE` | Platform tagline | `Work Within Reach` |
| `VITE_DEFAULT_RADIUS_KM` | Default map radius | `5` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://[PROJECT-REF].supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbGciOi...` |
| `VITE_ENABLE_DEMO_ACCOUNTS` | Demo accounts in UI | `false` |

### C. Admin Console (`apps/admin/.env`)
| Variable | Description | Production Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | REST API target endpoint | `https://api.nearvia.in/api/v1` |
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://[PROJECT-REF].supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anon Key | `eyJhbGciOi...` |

---

## 3. Step-by-Step Setup Procedure

### Step 1: Provision Supabase Free-Tier Project
1. Log into [supabase.com](https://supabase.com) and click **New Project** (Free Tier).
2. Choose a region close to your target users (e.g. `ap-south-1` Mumbai for India).
3. Set a strong database password and copy the **Connection string (URI)** from **Settings → Database**.
4. In **Settings → API**, copy:
   - **Project URL** (`https://[PROJECT-REF].supabase.co`)
   - **Project API Keys → `anon` `public`**
   - **Project API Keys → `service_role` `secret`** (keep confidential)
5. Enable PostGIS Extension:
   - Go to **Database → Extensions**, verify `postgis` is enabled (enabled by default or handled by migration `00001`).

### Step 2: Run Sequential Database Migrations
Run the automated idempotent migration runner from the project root:
```bash
# Set your DATABASE_URL in services/api/.env or export in shell:
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require"

# Execute all 29 migrations in order
npm run db:migrate
```
The migration runner:
- Creates `_schema_migrations` tracking table.
- Sequentially executes migrations `00001` through `00028`.
- Enforces RLS policies, spatial GIST indexes, and unique constraints.
- Verifies clean zero-error exit code.

### Step 3: Securely Provision the First Platform Administrator
Never hardcode admin credentials in git or public documentation. Provision the first admin securely via CLI:
```bash
npm run admin:create -- --email admin@nearvia.in --name "Platform Administrator"
```
The script will:
1. Create a confirmed Supabase Auth account with `role: 'ADMIN'`.
2. Generate a cryptographically secure 16-character password (displayed once in stdout).
3. Synchronize the PostgreSQL `users` record with role `ADMIN`, verified status, and active status.
4. Emit an immutable security audit event.

### Step 4: Deploy the REST API Gateway (`services/api`)
Recommended Free Hosting: **Render** (Free Web Service) or **Railway** (Trial/Hobby).
1. Connect your GitHub repository.
2. Root Directory: `.`
3. Build Command: `npm run build:packages && npm run build --workspace=@nearvia/api`
4. Start Command: `npm run start --workspace=@nearvia/api`
5. Configure Environment Variables (from Section 2.A above).
6. Verify Health Endpoint:
   ```bash
   curl -i https://api.nearvia.in/api/v1/health
   curl -i https://api.nearvia.in/api/v1/ready
   ```

### Step 5: Deploy Public Web Marketplace (`apps/web`)
Recommended Free Hosting: **Cloudflare Pages** or **Vercel** (Free Hobby Tier).
1. Connect repository to Cloudflare Pages or Vercel.
2. Framework Preset: **Vite**
3. Root Directory: `.`
4. Build Command: `npm run build:packages && npm run build --workspace=@nearvia/web`
5. Output Directory: `apps/web/dist`
6. Set Environment Variables: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
7. SPA Client Routing: Handled automatically by included `apps/web/public/_redirects` and `apps/web/vercel.json`.

### Step 6: Deploy Dedicated Admin Console (`apps/admin`)
Deploy as an isolated web application on a separate subdomain:
1. Create a separate project on Cloudflare Pages or Vercel.
2. Build Command: `npm run build:packages && npm run build --workspace=@nearvia/admin`
3. Output Directory: `apps/admin/dist`
4. Set Environment Variables: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. Connect Custom Domain: `admin.nearvia.in`
6. Session Isolation: Admin uses `nearvia_admin_auth_token` storage key, ensuring zero session interference with the public marketplace.

---

## 4. Production Checklist & Verification Gates

Before publishing domain DNS records:
- [ ] **Secret Isolation**: Frontend bundles contain zero instances of `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or JWT secrets.
- [ ] **Git Hygiene**: `.env`, `.env.local`, and private tokens are strictly ignored by `.gitignore`.
- [ ] **Error Sanitization**: `NODE_ENV=production` suppresses stack traces, raw SQL queries, and database constraint names.
- [ ] **CORS Verification**: API rejects requests from arbitrary origins with missing/unmatched origins.
- [ ] **Rate Limiting**: Global limiter (500 req/15min), Auth limiter (25 req/15min), and Sensitive limiter are active.
- [ ] **Admin Guard**: Non-ADMIN tokens attempting `/api/v1/admin/*` receive 403 Forbidden.
- [ ] **SPA Direct Navigation**: Refreshing `/dashboard` or `/login` loads the single-page application without 404.
- [ ] **Truth in Claims**: UI makes NO false claims of government Aadhaar KYC or holding physical cash. All payments marked DEMO/SANDBOX.

---

## 5. Rollback & Disaster Recovery Protocol

### Scenario A: Bad Application Build / Frontend Bug
1. In Cloudflare Pages or Vercel dashboard:
   - Click **Deployments**.
   - Select the previous stable deployment and click **Rollback to this deployment**.
   - Instant 0-downtime rollback taking < 5 seconds.

### Scenario B: Database Schema Issue
All migrations are forward-compatible and additive:
1. To restore a backup in Supabase:
   - Go to **Database → Backups** in Supabase dashboard.
   - Choose a point-in-time recovery or scheduled daily snapshot.
2. To reset demo data without affecting real accounts:
   ```bash
   ALLOW_DEMO_RESET_IN_PROD=true npm run reset:demo
   ```

---

## 6. Deferred Production Integrations (Phase 2 Roadmap)
These integrations are intentionally deferred in V1 to preserve ₹0 infrastructure costs:
1. **Government Aadhaar KYC**: Deferred to Phase 2 (Karza Technologies / Surepass API). Prototype uses self-reported ID reference verification.
2. **DLT Telecom SMS OTP**: Deferred to Phase 2 (MSG91 DLT Entity Registration). Prototype uses Supabase verified email authentication and developmental phone verification.
3. **Real-Money Wage Escrow**: In V1, NEARVIA is a software coordination platform; physical cash is settled directly peer-to-peer with verifiable 4-digit PINs, and online payments operate in Razorpay Sandbox test mode.
