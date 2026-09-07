# NEARVIA Backup, Recovery & Disaster Resilience Architecture

## Overview

This document outlines the backup, recovery, and data resilience design for the NEARVIA marketplace. Operating in a transactional hyperlocal domain where payments, job assignments, and worker earnings are recorded in real-time, data loss prevention and high-integrity recovery are critical requirements.

---

## 1. Architecture Tiers

NEARVIA distinguishes between three operational implementation states:
- **Implemented:** Code, scripts, and database constraints present in the repository.
- **Configured Externally:** Managed cloud features provided by Supabase / AWS RDS / GCP Cloud SQL.
- **Recommended for Production:** Operational runbooks and SLA targets for live enterprise deployment.

---

## 2. PostgreSQL Backup Strategy

### 2.1 Automated Daily Snapshots (Configured Externally)
- **Engine:** Supabase Managed PostgreSQL / Physical WAL (Write-Ahead Logging).
- **Frequency:** Daily automated snapshots retained for 7 to 30 days depending on compute tier.
- **Scope:** Full cluster state including schema, relational tables, PostGIS spatial data, and Supabase Auth schemas (`auth.users`, `auth.identities`).

### 2.2 Point-In-Time Recovery (PITR) (Recommended for Production)
- Continuous WAL archiving enables restoration to any millisecond within the retention window (e.g. preceding an accidental migration error or catastrophic data corruption).
- Recovery Point Objective (RPO): $< 5$ minutes.
- Recovery Time Objective (RTO): $< 30$ minutes.

### 2.3 Logical Dump Backups (Implemented)
- Administrative backup script for staging replication and offline archival:
  ```bash
  # Backup schema and data excluding large transient logs
  pg_dump --clean --if-exists --no-owner --no-privileges \
    -d "$DATABASE_URL" -F c -f nearvia_backup_$(date +%Y%m%d_%H%M%S).dump
  ```
- Restoration command:
  ```bash
  pg_restore --clean --if-exists --no-owner --no-privileges \
    -d "$DATABASE_URL" nearvia_backup.dump
  ```

---

## 3. Database Migration Rollback Strategy

All database schema evolutions in `database/migrations/` follow ordered, idempotent, forward-compatible patterns:
- In production, migrations must never perform irreversible column drops (`DROP COLUMN`) in a single release.
- **Two-Phase Deprecation Pattern:**
  1. **Phase N:** Add new columns, backfill data, update application to write to both.
  2. **Phase N+1:** Read from new column only; mark old column as deprecated.
  3. **Phase N+2:** Remove old column in scheduled maintenance window.
- In case of deployment rollback:
  - Keep application code compatible with both old and new schema variants during release windows.

---

## 4. Payment Reconciliation & Integrity Recovery

In the event of an unexpected network partition between NEARVIA and the payment gateway (Razorpay):
1. **Automated Reconciliation Routine:**
   - Evaluates `payment_records` where status is `INITIATED` but untouched for $> 30$ minutes.
   - Queries gateway API to check if payment succeeded or expired.
   - Syncs assignment status to `PAID` or resets to `SETTLEMENT_PENDING`.
2. **Double Confirmation Recovery:**
   - In cash transactions, if a worker does not confirm receipt within 24 hours, the provider's account triggers an automated alert, and a 48-hour dispute resolution window opens.
   - The platform never marks cash received as platform revenue; all balances are balance-of-record between transacting parties.

---

## 5. Audit Log & KYC Document Retention

1. **Audit Logs (`audit_logs`, `webhook_events`, `voice_assistance_logs`):**
   - Retained for a minimum of 365 days for regulatory compliance and dispute resolution.
   - Archived to cold object storage (e.g. S3 Glacier) after 90 days of inactivity.
2. **KYC Document References (`verifications`):**
   - The platform stores cryptographic references (`document_ref`) and verification timestamps.
   - Raw identity cards uploaded during verification are stored in an encrypted, non-public storage bucket with 90-day post-verification auto-purge rules for non-active files.
