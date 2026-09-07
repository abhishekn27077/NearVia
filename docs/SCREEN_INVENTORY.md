# NEARVIA — FRONTEND SCREEN & ROUTE INVENTORY

> **Document Version**: 2.0.0  
> **Source of Truth**: `apps/web/src/routes/router.tsx`  
> **Total Production Routes**: 32 Verified Distinct Client Routes  
> **Rule**: No fictional screens are listed. Every route links directly to an active TypeScript component.

---

## 1. Public & Onboarding Routes

| Route | Purpose | Role | Key User Actions | API Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/` | Landing page & value proposition | Public | View features, browse categories, CTA to login/register | N/A (Static marketing) | N/A | `IMPLEMENTED` |
| `/login` | Phone & OTP authentication | Public | Enter phone number, request OTP, submit 6-digit code | `POST /auth/request-otp`<br/>`POST /auth/verify-otp` | `users` | `IMPLEMENTED` |
| `/register` | New user persona enrollment | Public | Select role (Worker/Provider/Agent), enter name | `POST /auth/register` | `users`, profiles | `IMPLEMENTED` |
| `/find-work` | Public guest discovery | Public | Browse public jobs in map & list view with masked phone | `GET /jobs/discover` | `work_opportunities` | `IMPLEMENTED` |
| `/share/job/:id` | Public shareable job preview | Public | Deep-link view of work opportunity details | `GET /jobs/:id` | `work_opportunities` | `IMPLEMENTED` |

---

## 2. Worker Persona Routes (`role: WORKER`)

| Route | Purpose | Role | Key User Actions | API Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/worker/dashboard` | Worker command center | `WORKER` | View active shifts, today's schedule, quick actions | `GET /workers/dashboard/summary` | `assignments`, `applications` | `IMPLEMENTED` |
| `/worker/profile` | Worker bio & hourly expectations | `WORKER` | Update bio, trade experience years, preferred radius | `GET /workers/profile`<br/>`PUT /workers/profile` | `worker_profiles` | `IMPLEMENTED` |
| `/worker/skills` | Trade skills selector | `WORKER` | Add/remove skills from taxonomy with primary badge | `GET /skills`<br/>`PUT /workers/skills` | `skills`, `worker_skills` | `IMPLEMENTED` |
| `/worker/availability`| Available-Now broadcaster | `WORKER` | Toggle active status beacon, set timer duration | `PUT /workers/availability/status` | `worker_profiles.is_available_now` | `IMPLEMENTED` |
| `/worker/find-work` | Hyperlocal job discovery map | `WORKER` | Filter by radius (1-10km), category, apply to jobs | `GET /jobs/discover`<br/>`POST /jobs/:id/apply` | `work_opportunities`, PostGIS | `IMPLEMENTED` |
| `/worker/applications`| Inbound application tracking | `WORKER` | View submitted applications, review response status | `GET /applications/my` | `applications` | `IMPLEMENTED` |
| `/worker/assignments` | Active micro-contracts list | `WORKER` | Filter by Assigned, Confirmed, Completed shifts | `GET /assignments/my` | `assignments` | `IMPLEMENTED` |
| `/worker/assignments/:id`| Shift execution detail | `WORKER` | Confirm shift, GPS check-in, get directions, rate | `POST /assignments/:id/confirm`<br/>`POST /assignments/:id/check-in` | `assignments`, `attendance_records` | `IMPLEMENTED` |
| `/worker/earnings` | Financial summary & stats | `WORKER` | View cumulative earnings, daily average, pending dues | `GET /payments/earnings/summary` | `payment_records` | `IMPLEMENTED` |
| `/worker/transactions`| Historical transaction ledger | `WORKER` | View list of cash confirmations & online receipts | `GET /payments/my` | `payment_records` | `IMPLEMENTED` |
| `/worker/agents` | Community agent links | `WORKER` | View assigned agent, grant/revoke proxy consent | `GET /workers/agents` | `agent_worker_relationships` | `IMPLEMENTED` |
| `/worker/verification`| Identity verification status | `WORKER` | Upload government ID card, view badge verification | `POST /verifications/upload` | `verifications` | `IMPLEMENTED` |

---

## 3. Provider Persona Routes (`role: PROVIDER`)

| Route | Purpose | Role | Key User Actions | API Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/provider/dashboard` | Employer control center | `PROVIDER` | View open jobs, pending applicants, active shifts | `GET /providers/dashboard` | `work_opportunities`, `assignments` | `IMPLEMENTED` |
| `/provider/profile` | Business profile management | `PROVIDER` | Edit business name, location, contact phone | `GET /providers/profile`<br/>`PUT /providers/profile` | `provider_profiles` | `IMPLEMENTED` |
| `/provider/work` | Active & historical jobs list| `PROVIDER` | Filter DRAFT, PUBLISHED, COMPLETED jobs | `GET /providers/work` | `work_opportunities` | `IMPLEMENTED` |
| `/provider/work/new` | Multi-step job posting wizard | `PROVIDER` | Step 1-5 wizard with NLP / Copilot draft assistance | `POST /jobs`<br/>`POST /intelligence/nl-parse` | `work_opportunities`, `skills` | `IMPLEMENTED` |
| `/provider/work/:id` | Work opportunity detail view | `PROVIDER` | Inspect job requirements, status, address | `GET /jobs/:id` | `work_opportunities` | `IMPLEMENTED` |
| `/provider/work/:id/edit`| Edit draft job posting | `PROVIDER` | Update title, wage, timing before publishing | `PUT /jobs/:id` | `work_opportunities` | `IMPLEMENTED` |
| `/provider/work/:id/applicants`| Candidate review & matching | `PROVIDER` | View applicants + AI recommended workers, hire worker | `GET /applications`<br/>`GET /jobs/:id/recommended-workers`<br/>`POST /applications/:id/accept` | `applications`, `worker_profiles` | `IMPLEMENTED` |
| `/provider/assignments` | All worker assignments | `PROVIDER` | Monitor attendance, active workers on-site | `GET /providers/assignments` | `assignments` | `IMPLEMENTED` |
| `/provider/assignments/:id`| Shift supervision & settlement| `PROVIDER`| Confirm completion, trigger cash or online payment | `POST /assignments/:id/complete`<br/>`POST /payments/cash-confirm` | `assignments`, `payment_records` | `IMPLEMENTED` |
| `/provider/payments` | Payment history & receipts | `PROVIDER` | Download receipts, view cash vs online breakdown | `GET /payments/provider/history` | `payment_records` | `IMPLEMENTED` |
| `/provider/verification`| Business legitimacy check | `PROVIDER` | Submit GSTIN / trade license for verification | `POST /verifications/business` | `verifications` | `IMPLEMENTED` |

---

## 4. Community Agent, Admin & Shared Communication Routes

| Route | Purpose | Role | Key User Actions | API Dependencies | DB Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/agent/dashboard` | Agent field assistance console| `AGENT` | Enroll offline workers, monitor assisted workers | `GET /agents/workers`<br/>`POST /agents/assisted-workers` | `agent_profiles`, `users` | `IMPLEMENTED` |
| `/agent/workers/:workerId`| Assisted worker detail | `AGENT` | Edit worker trade profile, view shift progress | `GET /agents/workers/:id` | `worker_profiles` | `IMPLEMENTED` |
| `/agent/workers/:workerId/find-work`| Proxy job discovery | `AGENT` | Search nearby shifts and submit application for worker | `GET /jobs/discover`<br/>`POST /jobs/:id/apply` | `work_opportunities`, `applications` | `IMPLEMENTED` |
| `/admin/dashboard` | Master platform console | `ADMIN` | View platform KPIs, resolve disputes, inspect audits | `GET /admin/overview`<br/>`GET /admin/audit-logs`<br/>`PUT /admin/disputes/:id` | `audit_logs`, `disputes`, `users` | `IMPLEMENTED` |
| `/disputes` | Formal dispute cases list | Authenticated | View submitted complaints and case resolution | `GET /safety/disputes/my` | `disputes` | `IMPLEMENTED` |
| `/disputes/:id` | Dispute case detail & chat | Authenticated | Upload photographic proof, message arbitrator | `GET /safety/disputes/:id` | `disputes`, `evidence` | `IMPLEMENTED` |
| `/reports/mine` | Safety incident reports | Authenticated | Check status of flagged safety concerns | `GET /safety/reports/my` | `reports` | `IMPLEMENTED` |
| `/messages` | In-app direct messaging inbox | Authenticated | Browse active contextual chat conversations | `GET /messages/conversations` | `conversations` | `IMPLEMENTED` |
| `/messages/:conversationId`| Real-time chat dialogue | Authenticated | Send/receive messages regarding job logistics | `GET /messages/:id`<br/>`POST /messages/:id` | `messages` | `IMPLEMENTED` |
| `/verification` | Unified verification hub | Authenticated | Universal redirect to role-specific verification | N/A | `verifications` | `IMPLEMENTED` |
