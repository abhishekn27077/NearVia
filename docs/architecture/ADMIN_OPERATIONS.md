# Phase 16: Admin Dashboard & Platform Operations Architecture

## 1. Overview & Operational Principles
The NEARVIA Administrative Operations subsystem provides authorized platform moderators and security operators with real-time telemetry, moderation controls, dispute arbitrations, verification workflows, and financial visibility without violating user privacy or compromising payment integrity.

---

## 2. Admin Security & Role Enforcement

### 2.1 Server-Side Authorization Guarantee
* Admin endpoints are strictly guarded by:
  1. `authenticateUser`: Cryptographic verification of JWT session.
  2. `requireRole(UserRole.ADMIN)`: Database-authoritative role check on `users.role`.
* **Zero Trust Frontend**: Client-side role claims are never accepted for privileged operations.
* **No Public Admin Registration**: Admin roles cannot be requested or selected during public onboarding.

---

## 3. Executive Dashboard & Telemetry (`/admin/dashboard`)

### 3.1 Aggregated Key Performance Indicators (KPIs)
* **Users Summary**: Total registered users partitioned by roles (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`).
* **Work Opportunities**: Published, in-progress, and completed shifts.
* **Active Assignments**: Currently active shifts with live check-in telemetry.
* **High-Priority Operational Queues**:
  * Pending identity and business verifications.
  * Open safety and violation incident reports.
  * Open transaction and attendance dispute cases.
* **Financial Integrity Metrics**:
  * Cumulative settled payout volume (₹).
  * Pending wage settlement count.

---

## 4. Operational Domains

### 4.1 User Directory & Account Moderation
* **Search & Filters**: Multi-field ILIKE query across `full_name`, `phone`, `email`, role (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`), and account state (`ACTIVE`, `SUSPENDED`).
* **Account Suspension / Reactivation**:
  * Suspends login access via `is_active = FALSE`.
  * Mandatory audit justification reason.
  * Self-suspension by the acting admin is strictly blocked.
  * Dispatches real-time notification to the affected user.
* **Role Modifications**:
  * Admin-controlled role updates with auditable justification logs.

### 4.2 Work Postings & Content Moderation
* **Search & Filtering**: Categorical, work-type, and status filters across all platform opportunities.
* **Moderation Cancellation**:
  * Cancels non-compliant or hazardous work opportunities.
  * Sets `status = 'CANCELLED'` and records audit reason.
  * Removes listing from public 5 km discovery.

### 4.3 Verification Queue Review
* **Status Machine**:
  $$\text{PENDING} \longrightarrow \text{VERIFIED} \quad \text{or} \quad \text{REJECTED}$$
* **Approval**: Sets `verifications.status = 'VERIFIED'`, updates target profile (`verified_business = TRUE`), creates audit record, and notifies user.
* **Rejection**: Requires explicit rejection explanation, sets `verifications.status = 'REJECTED'`, and delivers feedback notification to user.

### 4.4 Incident Reports & Dispute Arbitrations
* Unified queue management for Phase 15 incident reports and assignment disputes.
* Mediators record authoritative findings and binding resolution decisions.

### 4.5 Financial Operations & Privacy Boundaries
* **Sanitized Audit Trail**: Displays amounts, transaction references, gateway order IDs, and timestamps.
* **Zero Credential Exposure**: Webhook secrets, merchant keys, and authentication tokens are strictly stripped from all admin responses.

---

## 5. Immutable Security Audit Trail (`audit_logs`)
Every privileged administrative action generates an immutable audit entry:
* `USER_STATUS_UPDATED`
* `USER_ROLE_UPDATED`
* `WORK_OPPORTUNITY_MODERATED_CANCELLED`
* `VERIFICATION_APPROVED`
* `VERIFICATION_REJECTED`
* `REPORT_MODERATION_UPDATED`
* `DISPUTE_MODERATION_UPDATED`

Audit records permanently preserve: `actor_id`, `action`, `target_entity`, `target_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, and `created_at`.

---

## 6. REST API Reference

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard` | `ADMIN` | Retrieve aggregated platform metrics and queues |
| `GET` | `/api/v1/admin/users` | `ADMIN` | Paginated user search and filtering |
| `GET` | `/api/v1/admin/users/:id` | `ADMIN` | Full user detail with profile attachment |
| `PATCH`| `/api/v1/admin/users/:id/status` | `ADMIN` | Suspend or reactivate user account |
| `PATCH`| `/api/v1/admin/users/:id/role` | `ADMIN` | Modify user role with audit log |
| `GET` | `/api/v1/admin/work` | `ADMIN` | List and filter work opportunities |
| `POST` | `/api/v1/admin/work/:id/cancel` | `ADMIN` | Moderate and cancel work opportunity |
| `GET` | `/api/v1/admin/verifications` | `ADMIN` | Verification review queue |
| `POST` | `/api/v1/admin/verifications/:id/approve`| `ADMIN` | Approve identity / business verification |
| `POST` | `/api/v1/admin/verifications/:id/reject` | `ADMIN` | Reject verification with mandatory reason |
| `GET` | `/api/v1/admin/payments` | `ADMIN` | Monitor transaction records (sanitized) |
| `GET` | `/api/v1/admin/audit-logs` | `ADMIN` | Inspect immutable audit log trail |
| `GET` | `/api/v1/admin/search` | `ADMIN` | Multi-entity platform quick search |
