# NEARVIA — Master Project Handover & Hermes Agent Memory Document

> **Document Name**: `HERMES_HANDOVER_STATE.md`  
> **Project Name**: NEARVIA  
> **Tagline**: _Work Within Reach_  
> **Project Type**: Hyperlocal Quick-Work Marketplace (5 KM Proximity + Immediate Work + Explainable Matching)  
> **Last Updated**: 2026-08-25  
> **Current Project Status**: **PHASES 0 THROUGH 9 COMPLETED & FULLY VERIFIED (84/84 Tests Passing across 9 Suites, 0 TypeScript Errors)**  
> **Next Phase to Execute**: **PHASE 10 — WORK EXECUTION, ATTENDANCE CHECK-IN, VERIFICATION & COMPLETION WORKFLOW**

---

## 1. Executive Summary & Product Identity

### 1.1 What is NEARVIA?

**NEARVIA** is a production-grade hyperlocal quick-work marketplace platform connecting individuals available for immediate, short-duration, flexible work with local businesses, shops, contractors, restaurants, warehouses, event organizers, and households within a strict **5 km radius**.

```
"I NEED WORK NOW"  <=======>  [ NEARVIA HYPERLOCAL ENGINE ]  <=======>  "I NEED SOMEONE NOW"
 (5 km • Available Now)              (Skill • Distance • Time)           (Tasks • Shifts • Jobs)
```

### 1.2 Core Pillars & Rules

1. **Hyperlocal by Default (5 km)**: Spatial PostGIS proximity search (`ST_DWithin` and `ST_Distance` on `GEOGRAPHY(Point, 4326)`) ensures realistic, rapid commutes.
2. **Fast Connection**: Minimizes latency between posting a need and matching available nearby talent.
3. **Short-Duration Work First**:
   - **`TASK`**: Micro-tasks (1–2 hours, e.g. unloading a vehicle, moving furniture, ₹300–₹500).
   - **`SHIFT`**: Short shifts (3–6 hours, e.g. restaurant helper, cashier relief, event staff, ₹500–₹800).
   - **`JOB`**: Single-day or multi-day short engagements (e.g. temporary shop assistant, trade repair, ₹700–₹1200/day).
4. **"Available-Now" Status**: Workers broadcast live immediate readiness with a time-bounded expiration timestamp (`available_until`).
5. **Deterministic Explainable Matching**: 100% rule-based multi-factor scoring (Skill 35%, Availability 25%, Distance 20%, Duration 10%, Category 5%, Urgency 5%) with transparent positive match reasons and constructive limitation notes. Zero opaque AI dependencies.
6. **Concurrency-Safe Selection & Capacity Limits**: Provider hiring runs inside an isolated PostgreSQL transaction with row locks (`SELECT ... FOR UPDATE`), strictly enforcing `workers_assigned <= workers_needed`.
7. **Two-Sided Trust & Privacy Protection**: Worker residential coordinates are protected with fuzzy centroids and distances; provider supervisor contact phone and arrival instructions are securely locked until an assignment is confirmed.
8. **Assisted Access (Agent Network)**: Verified local community agents assisting workers with low digital literacy.

---

## 2. Technology Stack & Workspace Monorepo Architecture

### 2.1 Technology Stack

- **Monorepo Engine**: `npm` Workspaces (Node.js 20+, Strict Mode TypeScript across all packages and apps).
- **Web Frontend (`apps/web`)**: React 19, TypeScript, Vite 6, Tailwind CSS 3, React Router 7, `@supabase/supabase-js`, Lucide React, Leaflet & CartoDB tiles. Design adheres to modern 21st.dev / Magic UI aesthetics (frosted glassmorphism, glowing borders, dark mode).
- **Mobile Client (`apps/mobile`)**: React Native / Expo (Reserved workspace, consumes the same REST API and Supabase Auth).
- **Backend REST API (`services/api`)**: Node.js 20+, Express.js 4, TypeScript, Helmet, CORS, Zod, `@supabase/supabase-js`, `pg` (node-postgres with connection pooling and `withTransaction` isolation helper).
- **Database Engine (`database/`)**: PostgreSQL 15+ with PostGIS Geospatial Extension (`GEOGRAPHY(Point, 4326)`, GIST spatial indexing).
- **Authentication**: Supabase Auth (Phone OTP, Email/Password, JWT Bearer token verification).
- **Testing**: Vitest 3.2+, Supertest (84/84 tests passing).
- **CI/CD**: GitHub Actions matrix build (`.github/workflows/ci.yml`).

### 2.2 Monorepo Structure

```
d:/NearVia/
├── apps/
│   ├── web/                     # React 19 + Vite 6 + Tailwind CSS Frontend
│   └── mobile/                  # React Native / Expo Mobile App (Reserved)
├── database/
│   ├── migrations/              # 001_initial_schema.sql, 002_postgis.sql, etc.
│   └── seeds/                   # Taxonomy seeds (categories, skills)
├── docs/
│   ├── architecture/            # Architecture diagrams, decision records (ADRs)
│   └── project/                 # PRD, User Flows, Feature Matrix, Screen Inventory
├── packages/
│   ├── config/                  # Constants, error codes, environment configs
│   ├── shared/                  # Common utilities, formatters, math
│   ├── types/                   # Shared TypeScript models, enums, DTOs
│   └── validation/              # Zod validation schemas
├── services/
│   └── api/                     # Modular Monolith REST API (Express + pg)
├── HERMES_HANDOVER_STATE.md     # Master Agent Handover Document
├── PROJECT_STATE.md             # Project State Tracker
└── README.md                    # Main Project Documentation
```

---

## 3. Comprehensive Summary of Completed Phases (Phases 0–9)

### Phase 0: Project Setup & Architecture Foundation (COMPLETED)

- Initialized npm workspaces monorepo with strict TypeScript base config.
- Created shared packages (`@nearvia/types`, `@nearvia/validation`, `@nearvia/shared`, `@nearvia/config`).
- Created modular monolith API structure with 18 domain modules in `services/api`.
- Established ADRs (`ADR-001` through `ADR-006`) and 20 AI Agent Governance Rules.

### Phase 1: Product, UX & User-Flow Blueprint (COMPLETED)

- Product Requirements Document (PRD), Screen Inventory (50 screens across 4 roles: Worker, Provider, Agent, Admin).
- 14 End-to-End User Flows with Mermaid diagrams, Feature Priority Matrix, and Design System with 21st.dev/Magic UI aesthetic guidelines.

### Phase 2: Project Repository & Development Infrastructure (COMPLETED)

- Web client shell: `RootLayout`, `Header` (with live API health indicator), `Footer`, `HomePage`, `NotFoundPage` (404), `ErrorBoundary`, `LoadingFallback`.
- Backend modular bootstrap: Centralized `errorHandler` (`AppError`), `notFoundHandler`, `requestLogger`, and `GET /api/v1/health`.

### Phase 3: Database Architecture, ERD & Data Foundation (COMPLETED)

- 19-Entity Normalized Relational Schema with PostGIS geography points and GIST spatial indexes.
- Reference taxonomy seeds (10 categories, 13 skills) and test fixtures.
- ADR-007 Database Access Strategy via `pg` connection pool.

### Phase 4: Authentication, Roles & Authorization (COMPLETED)

- Supabase Auth integration, user mapping synchronization, server-side JWT verification middleware (`authenticateUser`), and role authorization guards (`requireRole`).
- Public registration admin isolation (prohibits `ADMIN` role self-selection).
- Client `AuthProvider`, `ProtectedRoute`, and 21st.dev/Magic UI auth views (`LoginPage.tsx`, `RegisterPage.tsx`).
- ADR-008 Supabase Auth & Server-Side Authorization.

### Phase 5: Worker Profile, Skills & Availability (COMPLETED)

- Authenticated Worker Profile CRUD (`GET /api/v1/workers/me`, `PATCH /api/v1/workers/me`, `PATCH /api/v1/workers/me/location`).
- PostGIS spatial coordinate updates with service radius slider (1–15 km, 5 km default).
- Skills Catalog query (`GET /api/v1/skills`) and Worker Skills Association (`GET / POST / DELETE /api/v1/workers/me/skills`) with duplicate prevention.
- Time-bounded "AVAILABLE NOW" engine (`PATCH /api/v1/workers/me/availability/now`) with auto-expiration evaluation.
- Scheduled availability slots (`GET / POST / DELETE /api/v1/workers/me/availability`) with strict time ordering validation.
- Server-side Profile Completion Calculator (percentage and checklist breakdown).
- Mobile-first 21st.dev / Magic UI views: `/worker/profile`, `/worker/skills`, `/worker/availability`.

### Phase 6: Provider Profile + Work Opportunity Creation (COMPLETED)

- Authenticated Provider Profile CRUD (`GET /api/v1/providers/me`, `PATCH /api/v1/providers/me`, `PATCH /api/v1/providers/me/location`).
- Support for `INDIVIDUAL` vs `BUSINESS` provider types, company entity details, contact phone, and workplace location coordinates.
- Unified Work Opportunity Creation Engine for `TASK` (1–3h), `SHIFT` (4–8h), and `JOB` (1+ days).
- 5-step guided creation wizard with progressive disclosure and live preview card (`/provider/work/new`).
- Required skills association with minimum experience thresholds, draft/publish/cancel state machine, and cross-provider ownership isolation.
- Provider views: `/provider/profile`, `/provider/work`, `/provider/work/new`, `/provider/work/:id`, `/provider/work/:id/edit`.

### Phase 7: Hyperlocal Discovery + 5 KM Search (COMPLETED)

- PostGIS-assisted geodesic spatial queries `ST_DWithin` and `ST_Distance` on GIST-indexed coordinates.
- Enforces central 5 km default radius rule (`NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM`).
- Multi-filter engine for Work Type, Date, Duration, Urgency, Category, Min/Max Payment, and text search.
- Multi-mode sorting: `RECOMMENDED` (Default: Match Score DESC, Distance ASC), `NEAREST`, `STARTING_SOON`, `HIGHEST_PAY`.
- Interactive Leaflet/OpenStreetMap map view with custom markers, radius circles, and bottom-sheet drawers (`DiscoveryMap.tsx`).
- Discovery views: `/worker/find-work`, `/find-work`.

### Phase 8: Intelligent Matching + Explainable Ranking (COMPLETED)

- Deterministic multi-factor scoring engine: Skill (35%), Availability (25%), Distance (20%), Duration (10%), Category (5%), Urgency (5%).
- Hard filter boundaries: 5 km radius, status `PUBLISHED`, unexpired, mandatory skill presence.
- Explainability engine: Structured positive reasons (`reasons`) and constructive limitation notes (`limitations`).
- Transparency APIs: `GET /api/v1/matching/work` and `GET /api/v1/matching/work/:id/explain`.
- "MATCHED FOR YOU" high-compatibility banner, score percentage chips, and explainability popups.

### Phase 9: Applications + Selection + Assignment Workflow (COMPLETED)

- **Worker Quick Apply Modal (`ApplyModal.tsx`)**: Directly accessible from discovery feed and detail pages with proposed wage and worker notes.
- **Application Tracking Dashboard (`WorkerApplicationsPage.tsx`)**: Full lifecycle tracker (`PENDING`, `SHORTLISTED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`) with status badges and links to hired assignments.
- **Duplicate Prevention**: Database constraint `UNIQUE(work_opportunity_id, worker_id)` returns `409 APPLICATION_DUPLICATE`.
- **Provider Applicant Review Portal (`OpportunityApplicantsPage.tsx`)**: Lists candidates ranked by match score with trade skills, rating, distance, live "Available Now" beacons, and match reason dropdowns.
- **Transactional Selection & Capacity Enforcement**: Provider acceptance executes inside an isolated PostgreSQL transaction using `SELECT * FROM work_opportunities WHERE id = $1 FOR UPDATE` to guarantee `workers_assigned <= workers_needed` and prevent over-hiring (`409 WORK_ALREADY_FILLED`).
- **Atomic Assignment Creation**: Creates `assignments` record with `ASSIGNED` status and agreed wage.
- **Active Assignments Rosters (`WorkerAssignmentsPage.tsx`, `ProviderAssignmentsPage.tsx`)**: Securely unlocks employer supervisor contact phone and arrival instructions.

---

## 4. Complete Database Architecture & Entity Model

The NEARVIA database uses PostgreSQL 15+ with PostGIS. All 19 entities are normalized and indexed:

1. **`users`**: Platform user accounts (`auth_id`, `role`, `phone`, `full_name`, `is_active`, `is_suspended`).
2. **`worker_profiles`**: Extended worker data (`location`, `service_radius_km`, `experience_years`, `hourly_rate`, `daily_rate`, `is_available_now`, `available_until`, `profile_completed`).
3. **`provider_profiles`**: Extended provider data (`provider_type`, `business_name`, `contact_phone`, `location`, `verified_business`).
4. **`categories`**: Standardized service taxonomy (`name`, `slug`, `icon`, `display_order`, `is_active`).
5. **`skills`**: Granular trade skills (`category_id`, `name`, `slug`, `display_order`, `is_active`).
6. **`worker_skills`**: Worker acquired trade skills (`worker_id`, `skill_id`, `experience_years`, `is_primary`).
7. **`worker_availability`**: Scheduled time slots (`worker_id`, `day_of_week`, `start_time`, `end_time`).
8. **`work_opportunities`**: Unified work postings (`provider_id`, `category_id`, `title`, `description`, `work_type`, `urgency`, `status`, `workers_needed`, `workers_assigned`, `location`, `work_date`, `start_time`, `end_time`, `duration_hours`, `payment_amount`, `payment_type`).
9. **`work_opportunity_skills`**: Required skills for work opportunities (`work_opportunity_id`, `skill_id`, `min_experience_years`, `is_required`).
10. **`applications`**: Worker job applications (`work_opportunity_id`, `worker_id`, `status`, `proposed_wage`, `worker_notes`, `applied_at`).
11. **`assignments`**: Confirmed work contracts (`work_opportunity_id`, `worker_id`, `provider_id`, `application_id`, `status`, `agreed_wage`, `assigned_at`, `started_at`, `completed_at`, `cancelled_at`).
12. **`attendance_records`**: Check-in and verification timestamps (`assignment_id`, `worker_id`, `check_in_time`, `check_out_time`, `check_in_location`, `verified_by_provider`).
13. **`payment_records`**: Financial transactions (`assignment_id`, `amount`, `payment_mode`, `status`, `receipt_number`, `paid_at`).
14. **`reviews`**: Two-sided reputation feedback (`assignment_id`, `reviewer_id`, `reviewee_id`, `rating`, `comment`, `created_at`).
15. **`disputes`**: Dispute handling (`assignment_id`, `raised_by_id`, `reason`, `status`, `resolution_notes`, `resolved_at`).
16. **`agent_profiles`**: Local community agents (`user_id`, `agency_name`, `commission_rate`, `location`, `is_verified`).
17. **`agent_managed_workers`**: Workers onboarded by agents (`agent_id`, `worker_id`, `commission_share`, `created_at`).
18. **`audit_logs`**: Security & compliance event trails (`user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`).
19. **`notifications`**: System notifications (`user_id`, `title`, `message`, `type`, `is_read`, `created_at`).

---

## 5. Complete REST API Catalog

All endpoints are prefixed with `/api/v1/` and return standardized JSON `{ success: boolean, data?: T, error?: { code, message, details } }`:

### Authentication & Users

- `POST /auth/register` (Public registration, excludes ADMIN)
- `POST /auth/login` (Supabase Auth login)
- `GET /auth/me` (Authenticated user profile & role)
- `POST /auth/logout` (Invalidate session)

### Worker Domain

- `GET /workers/me` (Worker profile & completion score)
- `PATCH /workers/me` (Update rates, experience, bio)
- `PATCH /workers/me/location` (Update PostGIS coordinates & service radius)
- `GET /skills` (List available skill taxonomy)
- `GET /workers/me/skills` (List worker's trade skills)
- `POST /workers/me/skills` (Add skill to worker profile)
- `DELETE /workers/me/skills/:skillId` (Remove skill)
- `GET /workers/me/availability` (List scheduled availability slots)
- `PATCH /workers/me/availability/now` (Toggle live Available Now status)
- `POST /workers/me/availability` (Add scheduled time slot)
- `DELETE /workers/me/availability/:id` (Delete time slot)

### Provider Domain

- `GET /providers/me` (Provider profile & verification status)
- `PATCH /providers/me` (Update business info & contact phone)
- `PATCH /providers/me/location` (Update workplace coordinates)

### Work Opportunities & Discovery

- `GET /categories` (Active service categories taxonomy)
- `GET /work-opportunities/mine` (List provider's posted jobs)
- `POST /work-opportunities` (Create new opportunity in DRAFT)
- `GET /work-opportunities/:id` (Retrieve single work opportunity)
- `PATCH /work-opportunities/:id` (Update draft opportunity)
- `POST /work-opportunities/:id/publish` (Publish to 5 km feed)
- `POST /work-opportunities/:id/cancel` (Cancel opportunity)
- `GET /work-opportunities/nearby` (Hyperlocal proximity search)
- `GET /work-opportunities/discover` (Comprehensive multi-filter discovery)

### Intelligent Matching

- `GET /matching/work` (Ranked opportunities for authenticated worker)
- `GET /matching/work/:id/explain` (Deterministic multi-factor score breakdown)

### Applications & Hiring Workflow

- `POST /work-opportunities/:id/applications` (Worker submit application)
- `GET /applications/mine` (Worker list submitted applications)
- `GET /applications/:id` (Worker/Provider view single application)
- `POST /applications/:id/withdraw` (Worker withdraw application)
- `GET /work-opportunities/:id/applicants` (Provider view candidates)
- `POST /applications/:id/shortlist` (Provider shortlist candidate)
- `POST /applications/:id/reject` (Provider decline candidate)
- `POST /applications/:id/accept` (Provider transactional accept & hire)

### Assignments & Active Work

- `GET /assignments/mine` (Worker/Provider view active assignments)
- `GET /assignments/:id` (Worker/Provider view assignment with unlocked supervisor contact)

### Health & Telemetry

- `GET /health` (API status, PostgreSQL connectivity, PostGIS extension status)

---

## 6. Frontend Route & Page Inventory

| Route                           | Feature Area     | Primary Component               | Access Control |
| :------------------------------ | :--------------- | :------------------------------ | :------------- |
| `/`                             | Landing          | `HomePage.tsx`                  | Public         |
| `/login`                        | Authentication   | `LoginPage.tsx`                 | Public         |
| `/register`                     | Authentication   | `RegisterPage.tsx`              | Public         |
| `/worker/dashboard`             | Worker           | `WorkerDashboardPage.tsx`       | Worker         |
| `/worker/profile`               | Worker           | `WorkerProfilePage.tsx`         | Worker         |
| `/worker/skills`                | Worker           | `WorkerSkillsPage.tsx`          | Worker         |
| `/worker/availability`          | Worker           | `WorkerAvailabilityPage.tsx`    | Worker         |
| `/worker/find-work`             | Worker Discovery | `FindWorkPage.tsx`              | Worker         |
| `/worker/applications`          | Applications     | `WorkerApplicationsPage.tsx`    | Worker         |
| `/worker/assignments`           | Assignments      | `WorkerAssignmentsPage.tsx`     | Worker         |
| `/find-work`                    | Public Discovery | `FindWorkPage.tsx`              | Public         |
| `/provider/dashboard`           | Provider         | `ProviderDashboardPage.tsx`     | Provider       |
| `/provider/profile`             | Provider         | `ProviderProfilePage.tsx`       | Provider       |
| `/provider/work`                | Provider Jobs    | `WorkOpportunitiesListPage.tsx` | Provider       |
| `/provider/work/new`            | Provider Wizard  | `CreateWorkOpportunityPage.tsx` | Provider       |
| `/provider/work/:id`            | Provider Details | `WorkOpportunityDetailPage.tsx` | Provider       |
| `/provider/work/:id/edit`       | Provider Edit    | `EditWorkOpportunityPage.tsx`   | Provider       |
| `/provider/work/:id/applicants` | Provider Review  | `OpportunityApplicantsPage.tsx` | Provider       |
| `/provider/assignments`         | Assignments      | `ProviderAssignmentsPage.tsx`   | Provider       |
| `/admin/dashboard`              | Admin            | `AdminDashboardPage.tsx`        | Admin          |
| `*`                             | Errors           | `NotFoundPage.tsx`              | Public         |

---

## 7. Security, Concurrency & Data Privacy Boundaries

1. **Transactional Row-Level Locking (`withTransaction`)**:
   - `SELECT ... FOR UPDATE` on `work_opportunities` ensures that concurrent provider or admin acceptance actions never exceed `workers_needed`.
2. **Strict Role-Based Authorization (`requireRole`)**:
   - Routes and controllers enforce that Workers cannot create jobs, Providers cannot apply to jobs, and Providers cannot access another provider's applicants or assignments (returning `403 FORBIDDEN`).
3. **Data Privacy**:
   - Worker exact home coordinates are masked; public feeds and applicant review screens only display distance and approximate locality centroid.
   - Provider supervisor contact phone number and exact workplace instructions are revealed only on confirmed assignments (`status = 'ASSIGNED' | 'CONFIRMED'`).
4. **State Machine Integrity**:
   - An application cannot transition from `REJECTED` or `WITHDRAWN` to `ACCEPTED`.
   - Expired or cancelled opportunities reject new applications and selection attempts.

---

## 8. Master Roadmap & Next Phase Implementation Guide

### Roadmap Overview

- [x] **Phase 0**: Architecture & Monorepo Foundation
- [x] **Phase 1**: Product, UX & User-Flow Blueprint
- [x] **Phase 2**: Project Repository & Development Infrastructure
- [x] **Phase 3**: Database Architecture, ERD & Data Foundation
- [x] **Phase 4**: Authentication, Roles & Authorization
- [x] **Phase 5**: Worker Profile, Skills & Availability
- [x] **Phase 6**: Provider Profile + Work Opportunity Creation
- [x] **Phase 7**: Hyperlocal Discovery + 5 KM Search
- [x] **Phase 8**: Intelligent Matching + Explainable Ranking
- [x] **Phase 9**: Applications + Selection + Assignment Workflow
- [ ] **Phase 10**: **Work Execution, Attendance Check-In, Verification & Completion Workflow** _(NEXT)_
- [ ] **Phase 11**: Reviews, Two-Sided Reputation, Disputes, and Payment Records
- [ ] **Phase 12**: Local Agent-Assisted Onboarding Portal
- [ ] **Phase 13**: Admin Moderation, Compliance, and Platform Analytics
- [ ] **Phase 14**: Mobile Application Client (`apps/mobile`)
- [ ] **Phase 15**: Production Hardening, Load Testing, and Deployment

---

## 9. Direct Instructions for Phase 10 (Work Execution, Attendance & Completion)

When starting **Phase 10**, implement the following:

1. **Domain Context**:
   - Connects assigned workers and providers through the active shift lifecycle: `ASSIGNED` ➔ `CONFIRMED` ➔ `ARRIVED` (Check-In) ➔ `IN_PROGRESS` (Started) ➔ `COMPLETED` (Completion Sign-Off) ➔ `CANCELLED`.
2. **Backend Domain Module (`services/api/src/modules/tasks/` or `services/api/src/modules/assignments/`)**:
   - `POST /api/v1/assignments/:id/confirm`: Worker confirms intent to attend shift.
   - `POST /api/v1/assignments/:id/check-in`: Worker arrives at site and records attendance timestamp + PostGIS coordinates check (ensuring worker is within 500m of workplace).
   - `POST /api/v1/assignments/:id/start`: Supervisor/Provider verifies worker presence and begins shift.
   - `POST /api/v1/assignments/:id/complete`: Supervisor marks work as finished, records actual hours worked, and verifies completion.
   - `POST /api/v1/assignments/:id/cancel`: Early cancellation with reason code.
3. **Database Records**:
   - Populate `attendance_records` table (`assignment_id`, `worker_id`, `check_in_time`, `check_in_location`, `verified_by_provider`).
   - Transition `assignments` status: `ASSIGNED` ➔ `CONFIRMED` ➔ `IN_PROGRESS` ➔ `COMPLETED`.
4. **Frontend Work Execution Views (`apps/web/src/features/assignments/` or `apps/web/src/features/tasks/`)**:
   - Live Active Work Screen for Worker with "I Have Arrived" and "Complete Shift" buttons.
   - Live Shift Management Screen for Provider with arrival confirmation and completion sign-off dialogs.
   - Digital Work Receipt summary modal showing hours worked, agreed wage, and supervisor sign-off timestamp.
5. **Automated Tests (`services/api/tests/attendance.test.ts`)**:
   - Verify confirmation, GPS-validated check-in, start shift, supervisor completion, and state machine validations.
