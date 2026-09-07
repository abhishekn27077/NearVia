# Phase 15: Reviews, Disputes & Platform Safety Architecture

## 1. Overview & Trust Philosophy
NEARVIA operates as an open, community-first hyperlocal work platform. The Reviews, Disputes & Safety Subsystem guarantees fair mediation, swift incident reporting, anti-abuse protections, immutable audit trails, and transparent resolution without compromising user privacy or financial integrity.

---

## 2. Platform Reporting Subsystem (`reports`)

### 2.1 Controlled Categories
Reports must select from standardized categories:
* `FRAUD`: Scams, wage fraud, dishonest activity
* `HARASSMENT`: Verbal abuse, discrimination, unwelcome conduct
* `UNSAFE_WORK`: Workplace hazards, absence of safety equipment
* `MISLEADING_INFORMATION`: Inaccurate location, deceptive scope
* `PAYMENT_PROBLEM`: Underpayment or delayed compensation
* `NO_SHOW`: Unexcused absence
* `ABUSIVE_BEHAVIOR`: Intimidation, violence, threats
* `INAPPROPRIATE_CONTENT`: Offensive reviews, illicit text
* `OTHER`: Policy violations

### 2.2 Target Entities
* `USER`: Report worker, provider, or agent profiles (self-reporting is strictly rejected)
* `WORK_OPPORTUNITY`: Report fraudulent or illegal postings
* `ASSIGNMENT`: Report misconduct during work execution
* `REVIEW`: Report abusive or untruthful review commentary

### 2.3 Report Lifecycle & State Machine
$$\text{OPEN} \longrightarrow \text{UNDER\_REVIEW} \longrightarrow \text{RESOLVED} \quad \text{or} \quad \text{DISMISSED}$$
* Reports can only be updated by authenticated platform administrators (`ADMIN`).
* Reporters cannot mark their own reports resolved.
* Anti-abuse: Users cannot open duplicate active reports (`OPEN` / `UNDER_REVIEW`) on the same target.

---

## 3. Formal Dispute Resolution Subsystem (`disputes`)

### 3.1 Legitimate Transaction Reference
Disputes cannot be filed in isolation; they must reference an active or completed `assignment_id`.

### 3.2 Participant Roles
* **Initiator**: Must be the assigned worker or employer provider on the assignment.
* **Respondent**: Automatically determined as the counterpart party. Third-party users cannot file disputes.

### 3.3 Dispute Reasons
* `WORK_NOT_COMPLETED`
* `PAYMENT_DISAGREEMENT`
* `WORK_DESCRIPTION_MISMATCH`
* `CANCELLATION_ISSUE`
* `ATTENDANCE_DISAGREEMENT`
* `INAPPROPRIATE_BEHAVIOR`
* `OTHER`

### 3.4 Dispute Lifecycle & Integrity
$$\text{OPEN} \longrightarrow \text{UNDER\_REVIEW} \longrightarrow \text{RESOLVED} \quad \text{or} \quad \text{REJECTED}$$
* **Duplicate Prevention**: Database partial unique index `uq_active_dispute_per_assignment_initiator` prevents duplicate concurrent active disputes (`OPEN` or `UNDER_REVIEW`) by the same initiator on the same assignment.
* **Payment State Integrity**: Filing a dispute does not arbitrarily alter or corrupt completed payment records. Authoritative payment adjustments require verified administrative mediation.
* **History Preservation**: Disputes are never deleted; full context, submitted evidence, and resolution notes remain permanently auditable.

---

## 4. Evidence Privacy & Anti-Abuse Controls
* **Evidence Validation**: Evidence attachments are limited to valid HTTPS URLs (maximum 5 items per submission).
* **Access Control**: Evidence and dispute details are restricted strictly to the initiator, respondent, and authorized platform administrators.
* **Anti-Abuse**: Self-reporting and spam submissions on identical targets are rejected at the service layer with `400 / 409` status codes.

---

## 5. Safety & Emergency Guidance Standard
NEARVIA provides clear public guidance:
* **Immediate Physical Danger / Medical Emergency**: Users are directly instructed to call national emergency services (**112** / **100** / **108** / **1091**).
* NEARVIA does not impersonate or replace real-world emergency response services.

---

## 6. Immutable Audit Trail (`audit_logs`)
All sensitive security and moderation events generate immutable entries in `audit_logs`:
* `REPORT_SUBMITTED`
* `REPORT_MODERATION_UPDATED`
* `DISPUTE_OPENED`
* `DISPUTE_MODERATION_UPDATED`

Audit records track the `actor_id`, `action`, `target_entity`, `target_id`, `old_values`, `new_values`, `ip_address`, and `user_agent`.

---

## 7. REST API Reference

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reports` | `AUTHENTICATED` | Submit a safety / moderation report |
| `GET` | `/api/v1/reports/mine` | `AUTHENTICATED` | List reports filed by the current user |
| `GET` | `/api/v1/reports/:id` | `OWNER / ADMIN` | View single report details |
| `GET` | `/api/v1/reports/admin/all` | `ADMIN` | List all platform reports |
| `PATCH`| `/api/v1/reports/admin/:id` | `ADMIN` | Update report status and record resolution |
| `POST` | `/api/v1/disputes` | `PARTICIPANT` | Open a dispute against an assignment |
| `GET` | `/api/v1/disputes/mine` | `PARTICIPANT` | List disputes where user is initiator or respondent |
| `GET` | `/api/v1/disputes/:id` | `PARTICIPANT / ADMIN` | View dispute details with assignment context |
| `GET` | `/api/v1/disputes/admin/all` | `ADMIN` | List all platform disputes |
| `PATCH`| `/api/v1/disputes/admin/:id` | `ADMIN` | Update dispute status and record resolution notes |
