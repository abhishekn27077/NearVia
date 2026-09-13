# NEARVIA — FRONTEND SCREEN & ROUTE INVENTORY

> **Document Version**: 2.1.0 (Final Release Freeze)  
> **Source of Truth**: `apps/web/src/routes/router.tsx` & `apps/admin/src/routes/router.tsx`  
> **Total Production Routes**: 30 Web Marketplace Routes + 3 Admin Console Routes  
> **Rule**: No fictional screens are listed. Every route links directly to an active TypeScript component.

---

## 1. Public & Onboarding Routes (`apps/web` — Port 5173)

| Route | Purpose | Role | Key User Actions | Backend Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/` | Landing page & value proposition | Public | View features, browse categories, CTA to login/register | N/A (Static marketing) | N/A | `IMPLEMENTED` |
| `/login` | Supabase Auth login | Public | Enter email/password or Continue with Google | `supabase.auth.signInWithPassword` | `users` | `IMPLEMENTED` |
| `/register` | New user enrollment | Public | Select role (Worker/Provider/Agent), enter details | `supabase.auth.signUp` | `users`, profiles | `IMPLEMENTED` |
| `/find-work` | Public guest discovery | Public | Browse public jobs in map & list view with masked contact | `GET /jobs/discover` | `work_opportunities` | `IMPLEMENTED` |
| `/share/job/:id` | Public shareable job preview | Public | Deep-link view of work opportunity details | `GET /jobs/:id` | `work_opportunities` | `IMPLEMENTED` |

---

## 2. Worker Persona Routes (`role: WORKER`)

| Route | Purpose | Role | Key User Actions | Backend Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/worker/dashboard` | Worker command center | `WORKER` | View active shifts, today's schedule, quick actions | `GET /workers/dashboard/summary` | `assignments`, `applications` | `IMPLEMENTED` |
| `/worker/profile` | Worker bio & expectations | `WORKER` | Update bio, trade experience years, preferred radius | `GET /workers/profile`<br/>`PUT /workers/profile` | `worker_profiles` | `IMPLEMENTED` |
| `/worker/skills` | Trade skills selector | `WORKER` | Add/remove skills from taxonomy with primary badge | `GET /skills`<br/>`PUT /workers/skills` | `skills`, `worker_skills` | `IMPLEMENTED` |
| `/worker/availability`| Available-Now broadcaster | `WORKER` | Toggle active status beacon, set timer duration | `PUT /workers/availability/status` | `worker_profiles.is_available_now` | `IMPLEMENTED` |
| `/worker/find-work` | Hyperlocal job discovery map | `WORKER` | Filter by radius (1–15 km), category, apply to jobs | `GET /jobs/discover`<br/>`POST /jobs/:id/apply` | `work_opportunities`, PostGIS | `IMPLEMENTED` |
| `/worker/applications`| Inbound application tracking | `WORKER` | View submitted applications, review response status | `GET /applications/mine` | `applications` | `IMPLEMENTED` |
| `/worker/assignments` | Active shift roster | `WORKER` | Filter by Assigned, Confirmed, Completed shifts | `GET /assignments/mine` | `assignments` | `IMPLEMENTED` |
| `/worker/assignments/:id`| Shift execution detail | `WORKER` | Confirm shift, 6-digit Job PIN check-in/out, rate | `POST /assignments/:id/start-shift`<br/>`POST /assignments/:id/complete-shift` | `assignments`, `attendance_records` | `IMPLEMENTED` |
| `/worker/earnings` | Financial summary & stats | `WORKER` | View cumulative earnings, daily average, pending dues | `GET /payments/worker/earnings` | `payment_records` | `IMPLEMENTED` |
| `/worker/transactions`| Historical transaction ledger | `WORKER` | View list of cash confirmations & sandbox receipts | `GET /payments/worker/transactions` | `payment_records` | `IMPLEMENTED` |
| `/worker/agents` | Community agent links | `WORKER` | View assigned agent, grant/revoke proxy consent | `GET /workers/agents` | `agent_worker_relationships` | `IMPLEMENTED` |
| `/worker/verification`| Profile trust & document center | `WORKER` | Submit document reference for manual admin review | `POST /verification/submit` | `verification_requests` | `IMPLEMENTED` |
| `/worker/radar` | Demand intelligence heatmap | `WORKER` | View anonymized neighborhood demand density | `GET /radar` | PostGIS spatial clusters | `IMPLEMENTED` |

---

## 3. Provider Persona Routes (`role: PROVIDER`)

| Route | Purpose | Role | Key User Actions | Backend Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/provider/dashboard` | Employer control center | `PROVIDER` | View open jobs, pending applicants, active shifts | `GET /providers/dashboard` | `work_opportunities`, `assignments` | `IMPLEMENTED` |
| `/provider/profile` | Business profile management | `PROVIDER` | Edit business name, location, contact phone | `GET /providers/profile`<br/>`PUT /providers/profile` | `provider_profiles` | `IMPLEMENTED` |
| `/provider/work` | Active & historical jobs list| `PROVIDER` | Filter DRAFT, PUBLISHED, COMPLETED jobs | `GET /work-opportunities/mine` | `work_opportunities` | `IMPLEMENTED` |
| `/provider/work/new` | Multi-step job posting wizard | `PROVIDER` | Step 1–5 wizard with templates & location picker | `POST /work-opportunities` | `work_opportunities`, `skills` | `IMPLEMENTED` |
| `/provider/work/:id` | Work opportunity detail view | `PROVIDER` | Inspect job requirements, compatibility score, map | `GET /work-opportunities/:id` | `work_opportunities` | `IMPLEMENTED` |
| `/provider/work/:id/edit`| Edit draft job posting | `PROVIDER` | Update title, wage, timing before publishing | `PUT /work-opportunities/:id` | `work_opportunities` | `IMPLEMENTED` |
| `/provider/work/:id/applicants`| Candidate review & matching | `PROVIDER` | View applicants + compatibility breakdown, hire worker | `GET /work-opportunities/:id/applicants`<br/>`POST /applications/:id/accept` | `applications`, PostgreSQL locks | `IMPLEMENTED` |
| `/provider/assignments` | All worker assignments | `PROVIDER` | Monitor attendance, active workers on-site | `GET /assignments/mine` | `assignments` | `IMPLEMENTED` |
| `/provider/assignments/:id`| Shift supervision & settlement| `PROVIDER`| Confirm completion, record cash or sandbox settlement | `POST /assignments/:id/complete-shift`<br/>`POST /payments/assignments/:id/pay` | `assignments`, `payment_records` | `IMPLEMENTED` |
| `/provider/payments` | Payment history & receipts | `PROVIDER` | Download receipts, view cash vs sandbox breakdown | `GET /payments/provider/summary` | `payment_records` | `IMPLEMENTED` |
| `/provider/verification`| Profile trust & document center | `PROVIDER` | Submit business document reference for review | `POST /verification/submit` | `verification_requests` | `IMPLEMENTED` |
| `/provider/radar` | Workforce availability heatmap | `PROVIDER` | View nearby active labor supply density | `GET /radar` | PostGIS spatial clusters | `IMPLEMENTED` |

---

## 4. Community Agent & Shared Communication Routes (`apps/web`)

| Route | Purpose | Role | Key User Actions | Backend Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/agent/dashboard` | Agent field assistance console| `AGENT` | Enroll assisted workers, manage linked workers | `GET /agents/workers` | `agent_worker_relationships` | `IMPLEMENTED` |
| `/agent/workers/:workerId`| Assisted worker detail | `AGENT` | View worker trade profile and active status | `GET /agents/workers/:id` | `worker_profiles` | `IMPLEMENTED` |
| `/agent/workers/:workerId/find-work`| Assisted job discovery | `AGENT` | Search nearby shifts and submit application for worker | `GET /work-opportunities/discover`<br/>`POST /work-opportunities/:id/applications` | `work_opportunities`, `applications` | `IMPLEMENTED` |
| `/agent/radar` | Agent demand radar | `AGENT` | View demand matching skills of linked workers | `GET /radar` | PostGIS spatial clusters | `IMPLEMENTED` |
| `/disputes` | Formal dispute cases list | Authenticated | View submitted complaints and mediation status | `GET /disputes/mine` | `disputes` | `IMPLEMENTED` |
| `/disputes/:id` | Dispute case detail & chat | Authenticated | Review dispute status, details, and counterparty | `GET /disputes/:id` | `disputes` | `IMPLEMENTED` |
| `/reports/mine` | Safety incident reports | Authenticated | Check status of flagged safety concerns | `GET /reports/mine` | `reports` | `IMPLEMENTED` |
| `/messages` | In-app direct messaging inbox | Authenticated | Browse active contextual chat conversations | `GET /messages/conversations` | `conversations` | `IMPLEMENTED` |
| `/messages/:conversationId`| Real-time chat dialogue | Authenticated | Send/receive messages regarding job logistics | `GET /messages/:id`<br/>`POST /messages/:id` | `messages` | `IMPLEMENTED` |

---

## 5. Isolated Admin Console Routes (`apps/admin` — Port 5174)

> [!IMPORTANT]
> The Admin Command Center is physically isolated in `apps/admin`. Public `apps/web` contains **zero** admin navigation, routes, or credentials. All `/api/v1/admin/*` APIs enforce server-side `ADMIN` role verification.

| Route | Purpose | Role | Key User Actions | Backend Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/login` | Admin dedicated login | Public | Authenticate with administrator credentials | `supabase.auth.signInWithPassword` | `users` (role=ADMIN) | `IMPLEMENTED` |
| `/dashboard` | Master platform console | `ADMIN` | View platform KPIs, users, moderation, audit logs | `GET /api/v1/admin/dashboard`<br/>`GET /api/v1/admin/users` | `audit_logs`, `users`, `disputes` | `IMPLEMENTED` |
| `/radar` | City-wide geospatial radar | `ADMIN` | Inspect unaggregated live demand and workforce distribution | `GET /api/v1/admin/analytics/marketplace` | PostGIS spatial tables | `IMPLEMENTED` |
