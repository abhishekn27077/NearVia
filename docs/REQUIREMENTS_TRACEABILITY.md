# NEARVIA — REQUIREMENTS TRACEABILITY MATRIX (RTM)

> **Document Status**: Complete & Verified  
> **Academic Reference**: Master of Computer Applications (MCA) Final Project Dissertation  
> **System**: NEARVIA — Hyperlocal Quick-Work & Informal Labor Marketplace  
> **Evaluation Criteria**: Every requirement is mapped to its implementing API endpoint, database schema entity, user interface route, automated test file, and verified operational status.

---

## 1. Traceability Classification Key

- `IMPLEMENTED`: Feature is fully coded, functional, and integrated into frontend and backend.
- `TESTED`: Feature is verified by automated unit, integration, or end-to-end regression tests.
- `SANDBOX`: Feature operates against sandbox/test environments (e.g. Razorpay test mode).
- `SIMULATED`: Feature is simulated via deterministic rules (e.g. Mock OTP during development).
- `STAGING`: Feature is deployed and verified in staging architecture.
- `BLOCKED`: Feature requires external legal entity KYC, telecom registration, or commercial approval before production activation.
- `FUTURE`: Feature is reserved for subsequent major versions.

---

## 2. Requirements Traceability Matrix

| Req ID | Requirement Description | Implementing Feature | Backend API Endpoint | Database Table(s) | UI Screen / Route | Test File Reference | Operational Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **REQ-AUTH-01** | Secure mobile phone authentication with 6-digit OTP | Salted OTP generation & verification | `POST /api/v1/auth/request-otp`<br/>`POST /api/v1/auth/verify-otp` | `users` | `/login`<br/>`PhoneAuthForm.tsx` | `tests/otp.test.ts`<br/>`tests/auth.test.ts` | `TESTED` / `SIMULATED` (Mock OTP) |
| **REQ-AUTH-02** | Role-Based Access Control (RBAC) across 4 user roles | `requireRole` middleware guard | All protected routes | `users.role` (WORKER, PROVIDER, AGENT, ADMIN) | Role-gated route guards | `tests/auth.test.ts`<br/>`tests/security_hardening.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-AUTH-03** | Server-side user identity derivation | JWT Bearer token validation | `authenticateUser` middleware | `users` | Global Auth State | `tests/security_hardening.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-AUTH-04** | Immediate revocation of suspended/deactivated users | Active status verification | All protected routes | `users.is_active` | Login error toast | `tests/security_hardening.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-DISC-01** | Hyperlocal radius search using geodesic distance | PostGIS `ST_DWithin` spatial query | `GET /api/v1/jobs/discover` | `work_opportunities.location`<br/>`worker_profiles.location` | `/find-work`<br/>`FindWorkPage.tsx` | `tests/discovery.test.ts`<br/>`tests/database.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-DISC-02** | Interactive map view with worker & job pins | Leaflet / OpenStreetMap visualizer | Client-side Leaflet integration | N/A (Consumes `/discover`) | `/find-work` (Map View)<br/>`MapContainer.tsx` | `tests/discovery.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-DISC-03** | Instant Available-Now worker toggle | Time-bounded availability status | `PUT /api/v1/workers/availability/status` | `worker_profiles.is_available_now`<br/>`available_until` | `/worker/availability`<br/>`AvailabilityToggle.tsx` | `tests/workers.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-JOB-01** | Multi-step job posting with trade taxonomy | Structured work opportunity creation | `POST /api/v1/jobs` | `work_opportunities`<br/>`work_opportunity_skills` | `/provider/post-job`<br/>`PostJobWizard.tsx` | `tests/providers.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-JOB-02** | Job publishing lifecycle state transition | DRAFT to PUBLISHED lifecycle gate | `POST /api/v1/jobs/:id/publish` | `work_opportunities.status` | Provider Dashboard | `tests/providers.test.ts`<br/>`tests/security_hardening.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-JOB-03** | Shift duration & wage calculation | Shift wage bounds validation | `POST /api/v1/jobs` | `work_opportunities.duration_hours`<br/>`payment_amount` | `/provider/post-job` (Step 4) | `tests/providers.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-MATCH-01**| Multi-factor explainable candidate recommendation | Weighted scoring engine (skills, distance, rating) | `GET /api/v1/jobs/:id/recommended-workers` | `skills`, `worker_profiles`, `reviews` | `RecommendedCandidatesTab.tsx` | `tests/matching.test.ts`<br/>`tests/phase8_intelligence.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-MATCH-02**| Worker-side recommended opportunities | Inverted multi-factor job scoring | `GET /api/v1/jobs/recommendations/my` | `work_opportunities`, `worker_skills` | `/find-work` (Recommended Tab) | `tests/matching.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-APP-01** | One-tap worker job application | Application submission with notes | `POST /api/v1/jobs/:id/apply` | `applications` | `ApplyModal.tsx` | `tests/applications.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-APP-02** | Provider applicant review & selection | Application state transition (ACCEPT/REJECT) | `POST /api/v1/applications/:id/accept` | `applications.status` | `ApplicantReviewModal.tsx` | `tests/applications.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-EXEC-01** | Assignment generation upon application acceptance | Atomic transaction creation | `POST /api/v1/applications/:id/accept` | `assignments` | Worker / Provider Dashboards | `tests/attendance.test.ts`<br/>`tests/phase6_execution.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-EXEC-02** | Worker assignment confirmation | Worker confirmation gate | `POST /api/v1/assignments/:id/confirm` | `assignments.status = 'CONFIRMED'` | `WorkerAssignmentDetailPage.tsx` | `tests/attendance.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-EXEC-03** | GPS check-in proximity verification | Geofence verification (< 1000m) | `POST /api/v1/assignments/:id/check-in` | `assignments.checked_in_at`<br/>`attendance_records` | `CheckInModal.tsx` | `tests/attendance.test.ts`<br/>`tests/security_hardening.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-EXEC-04** | Shift completion by employer | Provider completion confirmation | `POST /api/v1/assignments/:id/complete` | `assignments.status = 'COMPLETED'` | `CompletionModal.tsx` | `tests/attendance.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-PAY-01**  | Transparent cash payment confirmation | Neutral two-party confirmation | `POST /api/v1/payments/cash-confirm` | `payment_records`<br/>`assignments.payment_status` | `CashPaymentModal.tsx` | `tests/payments.test.ts`<br/>`scratch/test_phase10_staging_smoke.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-PAY-02**  | Online payment order initiation | Razorpay test mode order creation | `POST /api/v1/payments/create-order` | `payment_records` | `OnlinePaymentModal.tsx` | `tests/payments.test.ts`<br/>`tests/phase7_payments.test.ts` | `SANDBOX` (Razorpay Test) |
| **REQ-PAY-03**  | Webhook signature HMAC-SHA256 validation | Raw byte buffer timing-safe verification | `POST /api/v1/payments/webhook` | `webhook_events` | Background Webhook Receiver | `tests/security_hardening.test.ts`<br/>`tests/payments.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-PAY-04**  | Webhook replay attack defense | Database unique constraint violation (23505) | `POST /api/v1/payments/webhook` | `webhook_events.unique_provider_event_id` | N/A | `scratch/test_phase9_db_verification.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-REV-01**  | Two-sided rating and review system | Mutual post-completion rating (1–5 stars) | `POST /api/v1/reviews` | `reviews`<br/>`worker_profiles.average_rating` | `ReviewModal.tsx` | `tests/reviews.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-CHAT-01** | In-app secure direct messaging | Contextual job chat with IDOR gating | `POST /api/v1/messages/conversations/:id/messages` | `conversations`<br/>`messages` | `/messages`<br/>`ChatWindow.tsx` | `tests/messages.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-NOTIF-01**| Real-time user event notifications | In-app event alerts & unread counters | `GET /api/v1/notifications` | `notifications` | Notification Center Bell | `tests/notifications.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-AI-01**   | Colloquial & multilingual natural language job parser | Regex + keyword heuristics + fallback | `POST /api/v1/intelligence/nl-parse` | N/A (Stateless parser) | `SmartJobDraftModal.tsx` | `tests/phase8_intelligence.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-AI-02**   | Multilingual voice assistance & pictorial cards | Speech-to-intent mapping with Hindi/English support | `POST /api/v1/intelligence/voice-assist` | `voice_assistance_logs` | `VoiceAssistantWidget.tsx` | `tests/phase8_intelligence.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-AI-03**   | Real-time wage guidance & percentiles | Aggregated category median/p25/p75 wages | `GET /api/v1/intelligence/wage-guidance` | `work_opportunities` (historical) | `MarketWageGuidance.tsx` | `tests/phase8_intelligence.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-SAFE-01** | Dispute and report filing | Formal complaint submission | `POST /api/v1/safety/disputes`<br/>`POST /api/v1/safety/reports` | `disputes`<br/>`reports` | `SafetyDisputeModal.tsx` | `tests/safety_disputes.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-ADM-01**  | Administrative dispute & report resolution | Admin workflow with audit logging | `PUT /api/v1/admin/disputes/:id` | `disputes`, `audit_logs` | `/admin/dashboard` (Disputes Tab) | `tests/admin.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-ADM-02**  | Administrative audit log inspection | Tamper-evident action logging | `GET /api/v1/admin/audit-logs` | `audit_logs` | `/admin/dashboard` (Audit Tab) | `tests/admin.test.ts` | `IMPLEMENTED` / `TESTED` |
| **REQ-AGT-01**  | Assisted worker onboarding by community agents | Offline worker proxy registration | `POST /api/v1/agents/assisted-workers` | `agent_worker_relationships` | `/agent/dashboard` | `tests/agents.test.ts` | `IMPLEMENTED` / `TESTED` |
