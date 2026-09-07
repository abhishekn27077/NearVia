# NEARVIA Project State & Architecture Handover

> **Document Name**: `PROJECT_STATE.md`  
> **Project Name**: NEARVIA  
> **Tagline**: _Work Within Reach_  
> **Project Type**: Hyperlocal Quick-Work Marketplace (5 KM Proximity + Immediate Shift Execution + Deterministic Matching)  
> **Last Updated**: 2026-08-31  
> **System Build Status**: `100% BUILD PASSING (npm run build & npx tsc --noEmit: 0 errors, 166/166 Unit & Integration Tests Passing across 19 Suites, 8/8 E2E Database Phases Passing)`  
> **Current Design Status**: `Modern Warm White Card Design System (#FAFAF9 / bg-white border-slate-200 shadow-card rounded-3xl) + Multilingual (EN, ಕನ್ನಡ, हिंदी) + Web Speech API Voice Search & Speech Synthesis`
| **Red-Team QA** | `✅ Completed 2026-08-30 | 20/20 pages load | 4 roles tested | Phase 10 endpoints verified | No console errors` |
| **Critical Fixes Applied** | `✅ Admin login fixed (admin@nearvia.in) | ✅ Phase 10 attendance complete | ✅ Premium design added | ✅ Build/test verified` |

---

## 1. Quick Start for AI Agents & Developers

### 1.1 Running the Application Locally

| Component | Directory | Port | Command |
|---|---|---|---|
| **Web Client (React 19 + Vite 6)** | `d:/NearVia/apps/web` | `5173` | `npx vite --port 5173` |
| **REST API Server (Express + PostGIS)** | `d:/NearVia/services/api` | `4000` | `npm run dev` |
| **Type Checking / Build** | `d:/NearVia/apps/web` | - | `npx tsc --noEmit` or `npm run build` |

### 1.2 Seeded Test Accounts (Local / Staging)

All accounts share the default password: **`NearviaDemo2026!`**

| Role | Email | Password | Primary Routes Accessible |
|---|---|---|---|
| **Worker** | `demo.worker@nearvia.test` | `NearviaDemo2026!` | `/worker/dashboard`, `/worker/find-work`, `/worker/applications`, `/worker/assignments`, `/worker/availability`, `/worker/skills`, `/worker/transactions` |
| **Provider (Employer)** | `demo.provider@nearvia.test` | `NearviaDemo2026!` | `/provider/dashboard`, `/provider/work`, `/provider/work/new`, `/provider/assignments`, `/provider/payments` |
| **Agent (Community)** | `demo.agent@nearvia.test` | `NearviaDemo2026!` | `/agent/dashboard`, `/agent/workers`, `/agent/assisted-apply` |
| **Admin** | `admin@nearvia.test` | `NearviaDemo2026!` | `/admin/dashboard`, `/admin/users`, `/admin/work`, `/admin/verifications`, `/admin/audit-logs` |

---

## 2. Executive Product Identity & Architecture

### 2.1 Core Mission
NEARVIA connects individuals needing immediate, flexible micro-tasks and short shifts with local businesses, shops, restaurants, warehouses, and event organizers within a strict **5 km hyperlocal radius**.

```
"I NEED WORK TODAY"  <========>  [ NEARVIA HYPERLOCAL ENGINE ]  <========>  "I NEED STAFF NOW"
 (5 km • Available Now)              (Skill • Distance • Time)            (Tasks • Shifts • Jobs)
```

### 2.2 Work Opportunity Taxonomy
- **`TASK` (1–3 Hours)**: Fast turnaround micro-tasks (e.g. unload delivery truck, move stock, ₹300–₹500 payout).
- **`SHIFT` (4–8 Hours)**: Scheduled work session (e.g. cafe assistant, retail counter relief, ₹500–₹900 payout).
- **`JOB` (1+ Days)**: Multi-day short-term engagements (e.g. temporary helper, trade repair, ₹800–₹1500/day).

---

## 3. UI/UX Design System Rules (MANDATORY)

When creating or modifying frontend components, you **MUST** strictly follow the NearVia design system:

1. **Page Background**: Always `bg-[#FAFAF9]` (warm light background). Never use dark backgrounds or obsidian containers for page shells.
2. **Card Containers**: Use premium `card-premium` class for double-bezel cards with inset shadows and lift-on-hover.
3. **Primary Action Color**: NearVia Orange (`bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl`).
4. **Success & Verified Accents**: Emerald (`bg-emerald-50 text-emerald-700 border-emerald-200`).
5. **Restricted / Critical Alerts**: Rose (`bg-rose-50 text-rose-700 border-rose-200`).
6. **Date & Time Presentation**: Always humanize dates (e.g. `"Fri, 28 Aug, 11:23 pm (2h)"`). Never render raw ISO timestamp strings.
7. **Empty States**: Never leave empty states blank. Always provide a friendly icon, descriptive headline, explanation text, and a direct CTA button.
8. **Navigation**: Use floating glass nav pill (`nav-pill` class) — detached from top with `backdrop-blur-2xl`.
9. **Typography**: Use `font-sans` (Plus Jakarta Sans fallback) for all text. No Inter or Roboto.
10. **Motion**: Use `reveal-up` class for scroll-triggered animations. Respect `prefers-reduced-motion`.
11. **Ambient Effects**: Use `.orb-gradient` elements for atmospheric depth (orange and blue orbs).

---

## 4. Frontend Screen & File Location Map (`apps/web`)

All frontend code lives under `apps/web/src/`.

### 4.1 Route & Feature Component Directory

```
apps/web/src/
├── app/
│   ├── AppRoutes.tsx                 # Master React Router 7 route definitions
│   ├── ErrorBoundary.tsx             # Global application error catcher
│   └── LoadingFallback.tsx           # Suspense and route transition loader
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.tsx        # Role-based route guard & 403 error card
│   │   └── RoleGuard.tsx             # In-page conditional role rendering
│   └── layout/
│       ├── Header.tsx                # App navigation bar with user badge & status
│       ├── Footer.tsx                # Hyperlocal marketplace footer
│       └── RootLayout.tsx            # Main shell with warm background (#FAFAF9)
├── context/
│   └── AuthContext.tsx               # Supabase auth session, user profile, tokens
├── features/
│   ├── admin/
│   │   ├── AdminDashboardPage.tsx    # Admin KPI overview & metrics
│   │   ├── AdminUsersTab.tsx         # User management & account actions
│   │   ├── AdminWorkTab.tsx          # Work opportunity moderation
│   │   └── AdminUserDetailModal.tsx  # Detailed user KYC inspection modal
│   ├── agents/
│   │   ├── AgentDashboardPage.tsx    # Community agent operations hub
│   │   └── AgentWorkerDetailPage.tsx # Worker profile management by agent
│   ├── applications/
│   │   └── WorkerApplicationsPage.tsx# Worker submitted application tracker
│   ├── assignments/
│   │   ├── WorkerAssignmentsPage.tsx # Worker active shift list
│   │   ├── WorkerAssignmentDetailPage.tsx # Worker shift console (check-in/OTP)
│   │   ├── ProviderAssignmentsPage.tsx # Employer hired worker roster
│   │   └── ProviderAssignmentDetailPage.tsx # Employer shift management console
│   ├── auth/
│   │   ├── LoginPage.tsx             # Universal sign-in (email/password & Google SSO)
│   │   └── RegisterPage.tsx          # Multi-role registration (Worker/Provider/Agent)
│   ├── discovery/
│   │   ├── FindWorkPage.tsx          # 5 km radius worker job discovery + map
│   │   ├── DiscoveryMap.tsx          # Leaflet OpenStreetMap interactive 5 km map
│   │   └── ApplyModal.tsx            # Quick application modal on discovery cards
│   ├── disputes/
│   │   └── DisputesPage.tsx          # Platform mediation, dispute list, & safety
│   ├── payments/
│   │   ├── WorkerTransactionsPage.tsx# Worker earnings & settlement receipts
│   │   └── ProviderPaymentsPage.tsx  # Employer wage disbursement ledger
│   ├── provider/
│   │   ├── ProviderDashboardPage.tsx # Employer home dashboard
│   │   ├── ProviderWorkListPage.tsx  # Employer posted opportunities
│   │   ├── CreateWorkOpportunityPage.tsx # 5-step posting wizard with 1-tap templates
│   │   └── ProviderWorkDetailPage.tsx# Posting detail with applicant management
│   └── worker/
│       ├── WorkerDashboardPage.tsx   # Worker home dashboard with 100% KYC status
│       ├── WorkerProfilePage.tsx     # Worker personal details & address
│       ├── WorkerSkillsPage.tsx      # Worker trade capabilities (catalog selection)
│       └── WorkerAvailabilityPage.tsx# Live "Available Now" toggle & scheduled slots
```

---

## 5. Backend REST API Architecture (`services/api`)

The API is a **Modular Monolith** in `services/api/src/`, communicating with PostgreSQL + PostGIS.

### 5.1 Key API Endpoints Reference

```
Authentication & Users:
  POST /api/v1/auth/register          - Register new user
  POST /api/v1/auth/login             - Authenticate with email/password
  GET  /api/v1/users/me               - Fetch current user profile

Worker Domain:
  GET    /api/v1/workers/me           - Get worker profile (radius, location)
  PATCH  /api/v1/workers/me           - Update worker details
  GET    /api/v1/workers/me/skills    - List worker skills
  POST   /api/v1/workers/me/skills    - Add skill to profile
  PATCH  /api/v1/workers/me/availability/now - Toggle "Available Now" status
  POST   /api/v1/workers/me/availability     - Add scheduled slot

Provider Domain:
  GET    /api/v1/providers/me         - Get employer profile
  PATCH  /api/v1/providers/me         - Update employer profile

Work Opportunities (5 KM Discovery):
  GET    /api/v1/work-opportunities/discover - 5 km PostGIS spatial discovery
  POST   /api/v1/work-opportunities          - Create work opportunity
  GET    /api/v1/work-opportunities/mine     - List employer's postings
  GET    /api/v1/work-opportunities/:id      - Get posting details
  POST   /api/v1/work-opportunities/:id/publish - Publish draft to 5 km feed

Applications & Hiring:
  POST   /api/v1/work-opportunities/:id/applications - Submit application
  GET    /api/v1/applications/mine                    - Worker's application list
  GET    /api/v1/work-opportunities/:id/applicants    - Employer candidate list
  POST   /api/v1/applications/:id/shortlist           - Shortlist applicant
  POST   /api/v1/applications/:id/accept              - Hire applicant (Concurrency-safe lock)

Assignments & Shifts:
  GET    /api/v1/assignments/mine     - List active/completed assignments
  GET    /api/v1/assignments/:id      - Get assignment details
  POST   /api/v1/assignments/:id/start-shift - Worker check-in
  POST   /api/v1/assignments/:id/complete-shift - Complete shift signoff

Payments & Settlements:
  GET    /api/v1/payments/worker/transactions - Worker transaction history
  GET    /api/v1/payments/provider/summary    - Employer disbursement summary
  POST   /api/v1/payments/assignments/:id/pay - Direct settlement payout
```

---

## 6. Shared Packages (`packages/`)

- **`@nearvia/types` (`packages/types/src/`)**: Single source of truth for all domain models, DTOs, and enums.
  - `enums.ts`: `AssignmentStatus`, `ApplicationStatus`, `WorkOpportunityStatus`, `UrgencyLevel`, `UserRole`, `WorkOpportunityType`.
  - `models.ts`: `AssignmentDetail`, `WorkOpportunityDetail`, `ApplicationDetail`, `WorkerProfile`, `ProviderProfile`.
- **`@nearvia/shared` (`packages/shared/src/`)**: Shared utility functions (`date.ts` for humanized formatting, `geo.ts` for distance calculations, `currency.ts` for INR formatting).
- **`@nearvia/validation` (`packages/validation/src/`)**: Zod validation schemas for all incoming API payloads.
- **`@nearvia/config` (`packages/config/src/`)**: Shared constants, error codes, and configuration parameters (e.g. 5.0 km default radius).

---

## 7. Critical Domain Rules & Technical Gotchas

1. **Assignment Wage Property**:
   - Always use **`agreedWage`** on `AssignmentDetail`. Do NOT use `agreedPayoutAmount`.
2. **UrgencyLevel Enum**:
   - Valid values: `FLEXIBLE`, `SAME_DAY`, `URGENT_HOURS`, `IMMEDIATE_DISPATCH`. (Do NOT use `IMMEDIATE` or `URGENT`).
3. **Frontend API Authentication**:
   - Bearer tokens are stored in `localStorage.getItem("nearvia_auth_token")`.
   - Every authenticated `fetch` call in components must include:
     ```ts
     headers: { Authorization: token ? `Bearer ${token}` : "" }
     ```
4. **TypeScript Strictness**:
   - `tsc --noEmit` runs with strict unused-import and unused-variable checking.
   - Any unused variable or parameter will trigger a build error `TS6133`.
5. **Database Concurrency Lock**:
   - When hiring workers on an opportunity, the API executes a transactional lock (`SELECT ... FOR UPDATE`) to guarantee `workers_assigned <= workers_needed`.

---

## 8. Changelog of Recent Enhancements

- **Comprehensive UI Modernization**: Completely removed legacy dark-mode screens in favor of the clean, warm `#FAFAF9` white-card design system.
- **ProtectedRoute 403 Overhaul**: Replaced the dark restricted-access modal with a modern card with clear role feedback and home redirect.
- **Auth Token Propagation**: Added Bearer authorization headers to `WorkerApplicationsPage`, `WorkerAssignmentsPage`, and `ProviderAssignmentsPage` to ensure authenticated API calls succeed.
- **Type Alignment**: Corrected all property references across worker and provider assignment flows to match `@nearvia/types` (`agreedWage`, `UrgencyLevel`).
- **Zero-Error Production Build**: Verified with full `npm run build` and `npx tsc --noEmit` with zero type errors.
- **Red-Team QA (2026-08-30)**: Completed full audit of 20 pages, 4 roles, 166 tests. Found and fixed admin login bug (wrong email), verified Phase 10 attendance endpoints.
- **Premium Design Upgrade**: Added floating glass nav pill, Double-Bezel cards (`card-premium`), ambient gradient orbs, scroll-reveal animations, and GSAP motion.
- **Test Coverage**: Expanded to 166 unit/integration tests across 19 suites with 100% pass rate.
- **Master Admin Command Center Integration (2026-08-31)**:
  - Wired full backend `/api/v1/admin/*` endpoints to `adminController` guarded with `authenticateUser` and `requireRole(["ADMIN"])`.
  - Added platform admin demo user `admin@nearvia.test` (`Platform Admin (Demo)`) to seed script and verified database synchronization.
  - Complete UI modernization across all 7 Admin console feature modules (`AdminDashboardPage`, `AdminUsersTab`, `AdminWorkTab`, `AdminVerificationsTab`, `AdminPaymentsTab`, `AdminDisputesTab`, `AdminReportsTab`, `AdminAuditLogsTab`).
  - Upgraded table styles, search/filter inputs, pagination bars, and moderation/arbitration action modals to the `#FAFAF9` warm-light card design system (`bg-white border border-slate-200 shadow-card rounded-3xl`).
- **Role-Specific Navigation Isolation & Zero Cross-Role Leakage (2026-09-01)**:
  - **Strict Header Filtering**: Updated [`Header.tsx`](file:///d:/NearVia/apps/web/src/components/layout/Header.tsx) so each user role sees strictly their own tools:
    - **Provider**: `Post Work`, `My Postings`, `Wage Settlements` (Worker links like `Find Work (5 KM)` completely removed).
    - **Worker**: `Find Work (5 KM)`, `My Shifts`, `Available Now`, `Daily Earnings` (Provider links completely removed).
    - **Agent**: `Agent Portal`.
    - **Admin**: `Command Center`, `Marketplace`.
    - **Guest**: `Find Work (5 KM)`, `Post Work` (prompts registration).
  - **Intelligent Brand Logo Routing**: Logo dynamically routes to active role dashboard (`/provider/dashboard`, `/worker/dashboard`, etc.) or `/` for guests.
  - **Role-Safe Login Redirects**: In [`LoginPage.tsx`](file:///d:/NearVia/apps/web/src/pages/auth/LoginPage.tsx), verified redirect target matches the logged-in user's role prefix to eliminate cross-session "Access Restricted" anomalies.







