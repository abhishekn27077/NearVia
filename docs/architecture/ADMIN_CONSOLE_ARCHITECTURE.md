# NEARVIA Admin Console Architecture & Security Hardening

## 1. Executive Summary & Separation Boundary

NEARVIA operates with a strict physical and logical boundary between public marketplace users (Workers, Providers, Community Agents) and privileged Platform Administrators.

```
+------------------------------------+        +------------------------------------+
|         PUBLIC MARKETPLACE         |        |            ADMIN CONSOLE           |
|            (@nearvia/web)          |        |           (@nearvia/admin)         |
|        http://localhost:5173       |        |        http://localhost:5174       |
+------------------------------------+        +------------------------------------+
| • Roles: WORKER, PROVIDER, AGENT   |        | • Role: ADMIN strictly required    |
| • Public registration & OAuth      |        | • NO public registration           |
| • Storage: nearvia_auth_token      |        | • Storage: nearvia_admin_auth_token|
| • Zero admin links/buttons/routes  |        | • Zero worker/provider features    |
| • /admin/* requests -> 404 NOT FOUND|       | • Server-validated /auth/me checks |
+------------------+-----------------+        +------------------+-----------------+
                   |                                             |
                   | Bearer JWT (nearvia_auth_token)             | Bearer JWT (nearvia_admin_auth_token)
                   v                                             v
+----------------------------------------------------------------------------------+
|                             NEARVIA REST API SERVER                              |
|                           (@nearvia/api - Port 4000)                             |
+----------------------------------------------------------------------------------+
| • Middleware: authenticateUser (validates Supabase JWT signature, extracts authId)|
| • Middleware: requireRole(UserRole.ADMIN) on all /api/v1/admin/* routes          |
| • Non-Admin or forged tokens -> 403 FORBIDDEN                                    |
| • Strict CORS Whitelist: localhost:5173, localhost:5174                          |
| • Comprehensive audit logging on all administrative actions                      |
+----------------------------------------------------------------------------------+
```

---

## 2. Monorepo Structure & Entry Points

Both applications reside in the existing `D:/NearVia` monorepo, sharing data models, validation schemas, and database migrations without repository fragmentation.

| Application / Package | Role / Type | Port | Command |
|---|---|---|---|
| **`apps/web`** (`@nearvia/web`) | Public Marketplace (Workers, Employers, Agents) | `5173` | `npm run dev:web` |
| **`apps/admin`** (`@nearvia/admin`) | Dedicated Operations & Governance Console | `5174` | `npm run dev:admin` |
| **`services/api`** (`@nearvia/api`) | Core REST API & PostGIS Spatial Engine | `4000` | `npm run dev:api` |
| **`packages/types`** | Domain interfaces, enums (`UserRole.ADMIN`) | - | `npm run build:packages` |
| **`packages/config`** | Shared constants, radii, error codes | - | `npm run build:packages` |

---

## 3. Dedicated Authentication Flow & Token Isolation

### 3.1 Isolated Storage
To prevent cross-session contamination when an operator uses the public marketplace and admin console in the same browser:
- `apps/web` uses Supabase Auth default storage key: `nearvia_auth_token` and `nearvia_auth_user`.
- `apps/admin` explicitly configures Supabase Client with `storageKey: "nearvia_admin_auth_token"`.

### 3.2 Login Invariants
- Entry Point: `http://localhost:5174/login`.
- Authentication Mechanism: Supabase Auth email/password.
- **NO Public Registration**: There is no "Create Account" or "Sign Up" button on port 5174.
- **NO Role Dropdown / Mock Picker**: Operators cannot select or alter their role on login.
- **Server Role Verification**: Immediately upon signing in with Supabase credentials, `AdminAuthContext` calls `/api/v1/auth/me`. If the database role is not strictly `ADMIN`:
  1. The user is immediately signed out from Supabase.
  2. Local tokens are purged.
  3. Access is denied with: `"Access denied. This account does not have administrative privileges."`.

### 3.3 Route Protection (`ProtectedAdminRoute.tsx`)
- Unauthenticated requests to `/dashboard`, `/radar`, or child views are redirected to `/login`.
- Route matching is bounded: entering invalid paths displays an administrative 404 page with a direct link back to `/dashboard`.

---

## 4. Server-Side RBAC & API Defense

Client-supplied roles and IDs are **never trusted**. All admin operations require cryptographic and database-level enforcement:

```
Request to /api/v1/admin/*
       │
       ▼
[ authenticateUser ] ────► Invalid/Expired JWT? ──► 401 Unauthorized
       │
       ▼
[ requireRole(ADMIN) ] ──► user.role !== 'ADMIN'? ─► 403 Forbidden
       │
       ▼
[ adminController ] ────► Action executed + Audit Log recorded
```

### 4.1 Route Guarding
In `services/api/src/modules/admin/routes.ts`:
```ts
adminRouter.use(authenticateUser);
adminRouter.use(requireRole(UserRole.ADMIN));
```
Any request from a Worker, Provider, or Community Agent receives an immediate `403 Forbidden` response.

### 4.2 Prevention of Admin Role Self-Escalation
In `services/api/src/modules/auth/service.ts`:
- Public signup (`/api/v1/auth/signup`) explicitly forbids `role = "ADMIN"`.
- OAuth synchronization (`/api/v1/auth/sync-google-profile`) defaults unknown roles to `WORKER` and blocks `ADMIN`.
- Admin accounts can only be provisioned by direct database administrators or server-side automation using `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Administrative Modules & Capabilities

The `apps/admin` application provides complete platform management across 10 core modules:

1. **Overview**: Real database-backed platform metrics:
   - Total registered users, worker/provider/agent counts.
   - Active/open opportunities, applications, and assignments.
   - Completed jobs, cancellations, active disputes, and settled payments.
2. **Workforce Radar & Demand Intelligence**:
   - Interactive Leaflet map (Free OpenStreetMap tiles, zero paid API keys).
   - PostGIS ST_DWithin spatial clustering and urgency tiers (`CRITICAL_SHORTAGE`, `HIGH_DEMAND`).
   - Supply vs Demand balance across trade categories.
3. **Users Management**:
   - Paginated user directory with role and status filtering.
   - User detail modal supporting status changes (`ACTIVE`, `SUSPENDED`) and role assignment via `PUT`/`PATCH`.
4. **Work Opportunities Moderation**:
   - Review all postings (Task, Shift, Job) with worker requirements and budget details.
   - Emergency cancellation with operator rationale.
5. **Verifications Queue**:
   - Worker identity and trade qualification moderation.
   - One-click approval and rejection with audit tracking.
6. **Reports & Safety Flags**:
   - Real-time safety report queue with category, reporter, and suspect details.
   - Resolution workflows with administrative notes.
7. **Disputes & Arbitration**:
   - Mutual dispute resolution interface for wage and shift conflicts.
   - Settlement payouts and assignment status mediation.
8. **Payments & Wage Settlements**:
   - Summary of gross volume, platform escrow, and completed disbursements.
   - Filterable transaction ledger.
9. **Marketplace Analytics**:
   - Aggregated metrics on job types, completion rates, hiring conversion, and locality demand.
10. **Audit Logs**:
   - Immutable security trail recording timestamp, admin user, action type, target entity, and IP address.

---

## 6. Credential Rotation & Secret Hygiene Guide

### 6.1 Admin Account Provisioning
Admin accounts should **never** be shared across team members. Each operator must have an individual identity:
```bash
# Provision an administrator account using the server seed CLI:
ADMIN_SEED_EMAIL="secops@nearvia.in" \
ADMIN_SEED_PASSWORD="<SECURE_RANDOM_PASSWORD_32_CHARS>" \
npm run seed:demo --workspace=@nearvia/api
```

### 6.2 Password Rotation Requirements
1. **Minimum Length**: 14 characters, mixed case, numbers, and symbols.
2. **Rotation Cadence**: Passwords must be rotated every 90 days.
3. **Emergency Revocation**: To instantly revoke an admin's access:
   - Update `status = 'SUSPENDED'` in the `users` table, OR
   - Delete/disable the user in Supabase Auth Dashboard.
   - Because `AdminAuthContext` revalidates with `/api/v1/auth/me`, revoked administrators are blocked on their next API interaction or token refresh.

### 6.3 CORS Whitelist Maintenance
The API server strictly restricts origins via `CORS_ORIGIN`:
- Local Development: `http://localhost:3000,http://localhost:5173,http://localhost:5174`
- Staging: `https://staging.nearvia.in,https://admin-staging.nearvia.in`
- Production: `https://nearvia.in,https://app.nearvia.in,https://admin.nearvia.in`

---

## 7. Verification Checklist

| Security Requirement | Implementation | Status |
|---|---|---|
| Dedicated Admin UI | `apps/admin` running on port 5174 | ✅ Verified |
| Public App Clean | `apps/web` contains 0 admin routes, buttons, or links | ✅ Verified |
| Port 5173 `/admin/*` 404 | Catch-all router serves NotFoundPage | ✅ Verified |
| Storage Isolation | `nearvia_admin_auth_token` key used on port 5174 | ✅ Verified |
| Server-Side RBAC | `authenticateUser` + `requireRole(ADMIN)` on all admin endpoints | ✅ Verified |
| Worker Token Blocked | Non-admin JWT receives 403 Forbidden | ✅ Verified |
| Free-First Mapping | OpenStreetMap + Leaflet for Workforce Radar (₹0 Paid APIs) | ✅ Verified |
| Typecheck & Build | 0 errors across `@nearvia/web`, `@nearvia/admin`, and `@nearvia/api` | ✅ Verified |
