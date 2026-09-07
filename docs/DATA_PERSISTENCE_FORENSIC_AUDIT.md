# NEARVIA — DATA PERSISTENCE FORENSIC AUDIT

**Date:** 2026-08-28  
**Scope:** Repository-wide data persistence audit, identifying all active data stores, in-memory caches/fallbacks, client-side storage, and database code.

---

## 1. EXECUTIVE SUMMARY & FORENSIC INVENTORY

| Persistence Category | Location in Codebase | Purpose / Nature | Action Required |
|---|---|---|---|
| **PostgreSQL Database Client** | `services/api/src/db/index.ts` | Production `pg.Pool` connection pool | Connect to live Supabase DB URL |
| **Database Migrations** | `supabase/migrations/*.sql` & `database/migrations/*.sql` | 22 normalized relational tables with PostGIS | Push to Supabase Cloud |
| **In-Memory Job Store** | `services/api/src/modules/jobs/service.ts` (`inMemoryOpportunities`) | Offline fallback when DB query fails | Remove silent fallback; throw standard DB error |
| **In-Memory Worker Store** | `services/api/src/modules/workers/service.ts` (`inMemoryWorkers`) | Offline fallback when DB query fails | Remove silent fallback; throw standard DB error |
| **In-Memory Provider Store** | `services/api/src/modules/providers/service.ts` (`inMemoryProviders`) | Offline fallback when DB query fails | Remove silent fallback; throw standard DB error |
| **Rate Limit Store** | `services/api/src/middleware/rateLimiter.ts` (`rateLimitStore`) | In-process sliding-window rate limiting | Keep for API gateway traffic throttling |
| **Browser Local Storage** | `apps/web/src/context/AuthContext.tsx` (`nearvia_auth_token`, `nearvia_auth_user`) | Client session token caching | Update to store verified Supabase Auth JWT |
| **Mock Authentication** | `apps/web/src/context/AuthContext.tsx` (`loginWithMockRole`) | Development quick-role switching | Replace with Supabase Auth + Google OAuth |
| **Seed Fixtures** | `supabase/seed.sql` | Baseline taxonomy (10 categories, 13 skills) | Retain as DB migration seed script |

---

## 2. PRODUCTION ENTITY TRACE (WHERE CREATED, READ, UPDATED, STORED)

### 1. Users (`users` table)
- **Created By:** Supabase Auth (Google OAuth) $\rightarrow$ `POST /api/v1/auth/sync-profile`
- **Read By:** `GET /api/v1/auth/me`, `GET /api/v1/users/:id`
- **Updated By:** `PUT /api/v1/users/profile`
- **Target Storage:** Supabase PostgreSQL `public.users` table
- **Current Fallback:** None (strict DB query).

### 2. Worker Profiles (`worker_profiles` table)
- **Created By:** `POST /api/v1/workers/profile` (when new worker completes onboarding)
- **Read By:** `GET /api/v1/workers/me`, `GET /api/v1/workers/:id`
- **Updated By:** `PUT /api/v1/workers/me`
- **Target Storage:** Supabase PostgreSQL `public.worker_profiles` with `GEOGRAPHY(Point, 4326)`
- **Current Fallback:** `inMemoryWorkers` map in `workers/service.ts` (to be removed).

### 3. Provider Profiles (`provider_profiles` table)
- **Created By:** `POST /api/v1/providers/profile`
- **Read By:** `GET /api/v1/providers/me`, `GET /api/v1/providers/:id`
- **Updated By:** `PUT /api/v1/providers/me`
- **Target Storage:** Supabase PostgreSQL `public.provider_profiles` with `GEOGRAPHY(Point, 4326)`
- **Current Fallback:** `inMemoryProviders` map in `providers/service.ts` (to be removed).

### 4. Work Opportunities / Jobs / Shifts (`work_opportunities` table)
- **Created By:** Provider via `POST /api/v1/work-opportunities`
- **Read By:** 
  - Worker Discovery via `GET /api/v1/work-opportunities/discover` (PostGIS `ST_DWithin` 5 KM)
  - Public Summary via `GET /api/v1/work-opportunities/summary`
  - Provider Dashboard via `GET /api/v1/work-opportunities/mine`
- **Updated By:** Provider via `PUT /api/v1/work-opportunities/:id`, `PATCH /api/v1/work-opportunities/:id/status`
- **Target Storage:** Supabase PostgreSQL `public.work_opportunities` with `GEOGRAPHY(Point, 4326)` and GiST index
- **Current Fallback:** `inMemoryOpportunities` map in `jobs/service.ts` (to be removed).

### 5. Applications (`applications` table)
- **Created By:** Worker via `POST /api/v1/work-opportunities/:id/applications` (1-Click Apply)
- **Read By:** Worker (`GET /api/v1/applications/worker`), Provider (`GET /api/v1/applications/opportunity/:id`)
- **Updated By:** Provider via `PATCH /api/v1/applications/:id/status` (`ACCEPTED` / `REJECTED`)
- **Target Storage:** Supabase PostgreSQL `public.applications`
- **Current Fallback:** None (strict DB query).

### 6. Assignments (`assignments` table)
- **Created By:** System on Application Acceptance $\rightarrow$ `assignments/service.ts`
- **Read By:** Worker (`GET /api/v1/assignments/worker`), Provider (`GET /api/v1/assignments/provider`)
- **Updated By:** Check-in (`POST /api/v1/attendance/check-in`), Completion (`POST /api/v1/assignments/:id/complete`)
- **Target Storage:** Supabase PostgreSQL `public.assignments`
- **Current Fallback:** None (strict DB query).

### 7. Attendance Records (`attendance_records` table)
- **Created By:** Worker via `POST /api/v1/attendance/check-in` with GPS coordinates
- **Read By:** Provider & Worker verification audits
- **Target Storage:** Supabase PostgreSQL `public.attendance_records`
- **Current Fallback:** None (strict DB query).

### 8. Payments & Settlement Ledger (`payment_records` table)
- **Created By:** System on Assignment Completion $\rightarrow$ `POST /api/v1/payments/record`
- **Read By:** Worker (`GET /api/v1/payments/earnings`), Provider (`GET /api/v1/payments/provider`)
- **Target Storage:** Supabase PostgreSQL `public.payment_records` with idempotency key
- **Current Fallback:** None (strict DB query).

### 9. Categories & Skills Taxonomy (`categories`, `skills`, `worker_skills`)
- **Read By:** `GET /api/v1/categories`, `GET /api/v1/skills`
- **Target Storage:** Supabase PostgreSQL `categories` and `skills` tables
- **Current Fallback:** `SEED_CATEGORIES` and `SEED_SKILLS` fallback in memory (to be made strictly DB-driven).

---

## 3. REMOVAL & REFACTORING PLAN

1. **Eliminate Silent In-Memory Fallbacks:**
   - Remove `inMemoryOpportunities`, `inMemoryWorkers`, and `inMemoryProviders` from backend services.
   - When the PostgreSQL connection is lost or query fails, throw an explicit `AppError("Database unavailable", 503, ErrorCode.DATABASE_UNAVAILABLE)` rather than silently caching records in RAM.

2. **Remove Mock Auth:**
   - Replace mock role switches in `AuthContext.tsx` with Supabase Auth Google OAuth (`signInWithOAuth({ provider: 'google' })`).
   - Create profile synchronization endpoint `POST /api/v1/auth/sync-google-profile`.

3. **Enforce Single Source of Truth:**
   - Ensure all homepage badges, category statistics, and 5 KM discovery queries execute directly against Supabase PostGIS.
