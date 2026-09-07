# NEARVIA — INCIDENT RESPONSE & RELIABILITY RUNBOOK

> **Document Version**: 1.0.0  
> **Status**: Approved Operations Runbook  
> **Scope**: Production & Staging Outage Handling, Security Breaches, Data Discrepancies  

---

## 1. Incident Severity Classifications

| Level | Definition | Response SLA | Examples | Escalation Path |
| :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Complete service outage, active security breach, financial double-charging, data corruption. | **< 15 minutes** | Database offline, payment webhook compromised, unauthorized admin access. | Lead Architect, DevOps, Founder |
| **P1 (Major)** | Core marketplace failure affecting multiple users with no immediate workaround. | **< 1 hour** | Job applications failing, SMS OTP delivery down, check-in geofence calculation failing. | Core Backend Team, On-call Engineer |
| **P2 (Degraded)** | Secondary feature failure with manual workaround available. | **< 4 hours** | Voice assistant failing, wage guidance failing, direct messaging slow. | Engineering Team |
| **P3 (Minor)** | Cosmetic defect, minor UI glitch, non-blocking administrative query error. | **< 24 hours** | Typo in email template, slow avatar upload, minor layout shift. | Assigned Developer |

---

## 2. Emergency Feature Flags & Kill Switches

NEARVIA implements server-side configuration switches allowing operators to rapidly disable failing subsystems without rebuilding or restarting the application.

### 2.1 Payment Kill Switch
If payment gateway discrepancies or double-billing alerts occur:
```bash
# Deactivate online payment capture immediately (reverts to Cash Confirmation only)
# In Render / ECS / Kubernetes environment configuration:
PAYMENT_MODE=demo
```
- **Marketplace Impact**: Providers and workers can continue posting, matching, and executing shifts using transparent cash confirmation. Online payment button is gracefully disabled.

### 2.2 SMS / OTP Fallback
If MSG91 experiences upstream network congestion or failure:
```bash
# In staging/emergency debug:
OTP_PROVIDER=mock
ALLOW_MOCK_OTP_IN_PRODUCTION=true
```
- **Marketplace Impact**: Authorizes emergency verification codes displayed securely in administrative monitoring logs or in-app support channels while SMS carrier resolves outage.

### 2.3 AI Assistant & Voice Kill Switch
If Google Gemini or voice processing APIs exceed rate limits or suffer upstream downtime:
```bash
# Revert to deterministic rule engine & manual posting
AI_PROVIDER=mock
```
- **Marketplace Impact**: Voice assistant gracefully informs user to use manual text posting. Structured job creation modal continues working normally with zero downtime.

---

## 3. Incident Management Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. TRIAGE   │ ──> │ 2. CONTAIN   │ ──> │  3. RESOLVE  │ ──> │4. POST-MORTEM│
│Detect & Class│     │Apply Switch  │     │Fix & Verify  │     │PIR Report    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Step 1: Triage & Identification
1. Check deep health probe: `GET /api/v1/health/deep`
2. Check recent application logs filtered by `level=error`:
   ```bash
   grep '"level":"error"' /var/log/nearvia-api.log | tail -n 50
   ```
3. Identify correlation IDs (`X-Request-Id`) associated with failing customer requests.

### Step 2: Containment & Evidence Preservation
1. Activate relevant emergency kill switch (Section 2) if external provider is compromised.
2. **Never delete database logs or truncate tables during an incident**.
3. Snapshot database state before running manual recovery queries:
   ```bash
   # Create immediate Supabase snapshot or pg_dump
   pg_dump "$DATABASE_URL" --format=custom --file="incident_snapshot_$(date +%s).dump"
   ```
4. Query `audit_logs` to isolate compromised user IDs or malicious actions:
   ```sql
   SELECT * FROM audit_logs 
   WHERE created_at >= NOW() - INTERVAL '2 hours' 
   ORDER BY created_at DESC LIMIT 100;
   ```

### Step 3: Resolution & Verification
1. Deploy hotfix or schema correction via standard migration pipeline.
2. Verify system invariants using automated test suite:
   ```bash
   npm test
   npx tsx scratch/test_phase10_staging_smoke.ts
   ```
3. Re-enable normal operational modes (`PAYMENT_MODE=sandbox`, `AI_PROVIDER=gemini`).

### Step 4: Post-Incident Review (PIR)
Within 48 hours of any P0 or P1 incident, the team must publish a formal PIR documenting:
- Root Cause Analysis (5 Whys methodology)
- Detection Time and Recovery Time (MTTD / MTTR)
- Impact Assessment (affected users, transactions, data integrity)
- Preventative Action Items with assigned owners and deadlines.
