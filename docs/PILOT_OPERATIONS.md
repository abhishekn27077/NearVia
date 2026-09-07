# NEARVIA Pilot Operations Model & Operating Runbook

> **Document Scope**: Operational Procedures, Roles, Escalation Matrices, and Ownership  
> **System**: NEARVIA Hyperlocal Marketplace (`D:/NearVia`)  
> **Target Pilot Geofence**: Bengaluru Urban — Ward 89 (Indiranagar / Ulsoor)  
> **Operating Standard**: Supervised, Closed-Loop Pilot Operations (20 Providers / 50 Workers)

---

## 1. Operational Ownership Philosophy

NEARVIA operates on an explicit 6-stage operational incident and task lifecycle:

```
Issue / Event
   ↓
[1. REPORTED]     (User flag, webhook alert, cron discrepancy, or manual walk-in)
   ↓
[2. CATEGORIZED]  (Triaged by severity P0–P3 and domain)
   ↓
[3. ASSIGNED]      (Assigned to designated Platform Operator, Field Coordinator, or Security Admin)
   ↓
[4. INVESTIGATED]  (Audit trail check, user phone verification, GPS log inspection)
   ↓
[5. RESOLVED]      (Action executed: mediation, account suspension, PIN reset, or state repair)
   ↓
[6. AUDITED]       (Immutable record logged in audit_logs table with actor ID and reasoning)
```

---

## 2. Onboarding Operations

### 2.1 Worker Onboarding (Informal Micro-Shift Labor)
- **Primary Channel**: In-person onboarding via Field Community Agent in Indiranagar.
- **Prerequisites**:
  - Valid Indian mobile number (active SIM for OTP).
  - Government ID photo (Aadhaar or Voter ID) uploaded to encrypted storage.
  - Self-declared primary trade skills (e.g. Kitchen Helper, Retail Stocking, Janitorial).
- **Procedure**:
  1. Agent registers worker or worker signs up directly on mobile browser.
  2. Test/SMS OTP confirmed.
  3. Worker uploads government ID scan for verification.
  4. Status initially marked `PENDING_VERIFICATION`. Worker can browse jobs immediately.
  5. Operator approves verification badge after inspecting ID authenticity in the Admin Console.

### 2.2 Provider / Employer Onboarding (Local Businesses)
- **Primary Channel**: Direct sign-up accompanied by physical premises inspection.
- **Prerequisites**:
  - Registered business phone number.
  - Commercial premises verification (physical bakery, restaurant, warehouse, or retail shop).
  - Business registration or Trade License document upload.
- **Procedure**:
  1. Business owner creates account with role `PROVIDER`.
  2. Provider enters business name and physical coordinates.
  3. Field coordinator conducts in-person visit (Indiranagar Ward 89) to verify physical shop existence.
  4. Admin awards `ID ✓` (Identity/Business Verified) badge.
  5. Job posting permissions activated.

### 2.3 Community Agent Onboarding
- **Role**: Local digitization partner / kiosk operator.
- **Selection**: Trusted local community organizers or cyber-cafe / seva-kendra operators.
- **Training**: Hands-on walkthrough of the `/agent/dashboard`, consent recording rules, and worker profile management.

---

## 3. Job Moderation & Quality Control

- **Pre-Publication Invariants**:
  - Work type must be valid (`TASK`, `SHIFT`, or `JOB`).
  - Agreed payment amount must meet or exceed Karnataka Minimum Wage standards (minimum ₹120/hour or ₹500/shift).
  - No hazardous, illegal, or discriminatory job postings permitted.
- **Moderation Workflow**:
  1. Job draft created by provider.
  2. Keyword filter checks for prohibited terms (e.g. hazardous chemical handling, illegal transport).
  3. If flagged, status held in `PENDING_REVIEW` until operator approval.
  4. If compliant, job transitions to `PUBLISHED` and broadcasts to workers within 5 KM.
  5. Admin retains immediate kill-switch (`POST /api/v1/admin/work/:id/cancel`) to revoke any non-compliant opportunity.

---

## 4. Trust & Safety Escalation Matrices

| Category | Typical Scenarios | Severity | SLA | Assigned Owner | Action / SOP |
|---|---|---|---|---|---|
| **Disputed Wage** | Employer refuses to pay agreed amount or claims poor work | **P1** | 2 Hours | Dispute Arbitrator | Freeze opportunity, review check-in GPS logs and mutual chat history, execute manual mediation. |
| **Worker No-Show** | Worker confirmed but fails to check in within 30 min of start | **P2** | 30 Mins | Field Coordinator | Mark `NO_SHOW`, release job back to nearby pool, re-broadcast urgent alert to backup workers. |
| **Employer Cancellation** | Employer cancels shift after worker arrived at location | **P1** | 1 Hour | Platform Admin | Verify worker arrival via GPS; enforce cancellation fee rule from employer balance. |
| **Physical Safety Incident** | Threatening behavior, hazardous working conditions, or abuse | **P0** | Immediate (&lt;15m) | Safety Officer | Immediately suspend perpetrator account, assist victim with support, document evidence for legal authorities. |
| **Stale Cash Payment** | Cash PIN not verified &gt;24h after completion | **P2** | 24 Hours | Reconciliation Lead | Trigger automated SMS reminder to both parties; phone follow-up if unconfirmed by 48h. |
| **Duplicate / Spam Postings** | Robotic duplicate job postings | **P2** | 4 Hours | Content Moderator | Automated deduplication filter; purge duplicates and warn provider. |

---

## 5. Dispute Resolution Standard Operating Procedure (SOP)

1. **Trigger**: Either worker or employer clicks *"Report Dispute"* on an active or completed assignment.
2. **Containment**: Assignment status transitions to `DISPUTED`. No automatic payouts or penalties execute while disputed.
3. **Evidence Gathering**:
   - Geolocation check-in logs (`check_in_latitude`, `check_in_longitude`, `check_in_at`).
   - Distance from workplace centroid at check-in time (must be $\le 1000\text{ m}$).
   - Completion timestamp and mutual messages in `messages` table.
4. **Resolution Authority**:
   - Platform operator calls both parties via recorded helpline.
   - If work was performed: employer must settle agreed cash or online amount.
   - If worker did not perform: assignment closed without penalty to employer; worker reliability score penalized.
5. **Audit Logging**: Resolution logged in `audit_logs` with admin user ID, timestamp, and notes.

---

## 6. Payment & Cash Handling Operational Rules

1. **Strict Non-Custodial Rule**:
   - NEARVIA is a software platform and does **NOT** physically receive, escrow, or hold physical cash.
   - Cash transactions are strictly private bilateral handovers between provider and worker.
2. **Verification Protocol**:
   - Cash handover is valid **only** when the worker enters the 4-digit PIN generated on the employer's device.
   - Unconfirmed cash older than 24 hours triggers an operational reconciliation alert.
3. **Receipt Generation**:
   - Every confirmed payment generates a canonical digital receipt with unique reference (`REC-XXXXXX`), gross amount, platform fee (₹0), and timestamp.

---

## 7. Incident Response Roles & Roster

- **Platform Incident Commander (PIC)**: Anand Verma (Admin / DevOps Lead)
- **Field Support Lead (FSL)**: Indiranagar Area Coordinator
- **Trust & Verification Officer (TVO)**: Compliance Officer
- **Escalation Hotline**: Dedicated pilot WhatsApp/Phone channel (Operational 06:00 – 21:00 IST daily).
