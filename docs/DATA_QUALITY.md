# NEARVIA — DATABASE INTEGRITY & DATA QUALITY AUDIT REPORT

> **Document Version**: 1.0.0  
> **Environment**: PostgreSQL 17.6 + PostGIS 3.3  
> **Scope**: Schema Invariants, Referential Integrity, Constraint Coverage, State Machine Sanity  
> **Status**: Verified for Pilot Operations  

---

## 1. Executive Summary

This data quality audit verifies whether the NEARVIA relational database maintains structural integrity, prevents orphan and duplicate records, enforces atomic state transitions, and eliminates impossible states under concurrent pilot load.

The evaluation covers the complete relational schema defined across migrations `00001` through `00012`.

---

## 2. Integrity Audit by Dimension

### 2.1 Duplicate Users
- **Mechanism**:
  - `users.auth_id`: Marked `UNIQUE NOT NULL` (maps 1:1 with Supabase Auth UID).
  - `users.phone`: Marked `UNIQUE NOT NULL` (E.164 standard formatting enforced at API validation layer).
  - `users.email`: Marked `UNIQUE NULL` (prevents dual registration with identical emails while allowing phone-only worker registrations).
- **Finding**: **Zero duplicate user identities permitted**. Any concurrent collision on phone or auth ID triggers a PostgreSQL unique violation (`23505`) and yields an HTTP 409 Conflict.

### 2.2 Profile Cardinality & Validity
- **Mechanism**:
  - `worker_profiles.user_id`: `UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `provider_profiles.user_id`: `UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `agent_profiles.user_id`: `UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- **Finding**: **Strict 1:1 Profile Cardinality**.
  - A user can have at most one profile of each persona type.
  - Deleting a parent user record automatically cascades to remove the corresponding persona profile.
  - Coordinate locations are guaranteed non-null `GEOGRAPHY(Point, 4326)` with valid geodesic coordinates.

### 2.3 Orphan Record Prevention (Foreign Key Cascade vs. Restrict Policies)
- **Policy Invariant**: Transient operational items cascade; legal, financial, and contractual records are strictly protected (`ON DELETE RESTRICT`).
- **Audit Findings**:
  | Entity | Parent Entity | Foreign Key Policy | Rationale |
  | :--- | :--- | :--- | :--- |
  | `worker_skills` | `worker_profiles`, `skills` | `ON DELETE CASCADE` | Safe cleanup on worker profile deletion |
  | `work_opportunity_skills` | `work_opportunities`, `skills` | `ON DELETE CASCADE` | Job draft cleanup |
  | `applications` | `work_opportunities`, `worker_profiles` | `ON DELETE CASCADE` | Applications tied directly to posting lifecycle |
  | `assignments` | `work_opportunities` | `ON DELETE RESTRICT` | **Critical**: Protects employment and tax audit trail |
  | `assignments` | `worker_profiles`, `provider_profiles` | `ON DELETE RESTRICT` | Prevents profile deletion while active contract exists |
  | `payment_records` | `assignments`, `users` | `ON DELETE RESTRICT` | Financial ledger immutability |
  | `reviews` | `assignments`, `users` | `ON DELETE RESTRICT` | Prevents rating tampering through account deletion |
  | `disputes` | `assignments`, `users` | `ON DELETE RESTRICT` | Preserves dispute history for legal compliance |

### 2.4 Impossible States & Check Constraints
The schema enforces hard mathematical and logical boundaries via database-level `CHECK` constraints:
1. **Temporal Sequence**:
   - `work_opportunities.chk_work_time_order`: `CHECK (end_time > start_time)` prevents negative duration shifts.
   - `worker_availability.chk_avail_time_order`: `CHECK (end_time > start_time)`.
2. **Resource Allocation Bounds**:
   - `work_opportunities.chk_assigned_count`: `CHECK (workers_assigned <= workers_needed)` guarantees jobs cannot be over-assigned at the database level.
   - `work_opportunities.workers_needed`: `CHECK (workers_needed > 0 AND workers_needed <= 100)`.
3. **Rating Boundaries**:
   - `reviews.rating`: `CHECK (rating >= 1 AND rating <= 5)`.
   - `worker_profiles.average_rating`: `CHECK (average_rating >= 1.00 AND average_rating <= 5.00)`.
   - `provider_profiles.average_rating`: `CHECK (average_rating >= 1.00 AND average_rating <= 5.00)`.
4. **Financial Positive Integrity**:
   - `payment_records.amount`: `CHECK (amount > 0)`.
   - `assignments.agreed_wage`: `CHECK (agreed_wage > 0)`.
   - `assignments.final_wage_paid`: `CHECK (final_wage_paid IS NULL OR final_wage_paid >= 0)`.
   - `currency`: Enforced as `'INR'`.

### 2.5 Duplicate Applications
- **Constraint**:
  ```sql
  UNIQUE(work_opportunity_id, worker_id)
  ```
- **Finding**: A worker cannot submit multiple applications to the same work opportunity. Re-application attempts fail deterministically at the DB constraint layer.

### 2.6 Duplicate Assignments
- **Current State**:
  - Application logic verifies that `workers_assigned < workers_needed` and checks existing assignments.
  - In `00002_master_schema.sql`, multi-worker jobs allow multiple assignments per job, each with a distinct `worker_id`.
- **Finding & Recommendation**:
  - For single-worker or multi-worker shifts, an active worker should never be assigned twice to the same job.
  - **Implemented Protection**: Application service layer validates existing assignment state before issuing assignment records.
  - **Proposed Hard Constraint**: For complete database-level enforcement, add a partial unique index:
    ```sql
    CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_active_assignment_worker_opp
    ON assignments(work_opportunity_id, worker_id)
    WHERE status NOT IN ('CANCELLED', 'REPLACED');
    ```

### 2.7 Payment Relationship Integrity
- **Audit Findings**:
  - `payment_records.assignment_id` references a valid assignment.
  - `payment_records.payer_id` references a valid user (the provider).
  - `payment_records.payee_id` references a valid user (the worker).
  - `idempotency_key` indexed to prevent duplicate ledger postings.
  - Gateway order IDs indexed (`idx_payment_records_gateway_order`) to prevent duplicate Razorpay capture associations.

---

## 3. Data Quality Maintenance Scripts

The pilot operations team should run the following audit queries weekly:

```sql
-- 1. Detect any completed assignment without a payment record
SELECT a.id AS assignment_id, a.work_opportunity_id, a.agreed_wage, a.completed_at
FROM assignments a
LEFT JOIN payment_records p ON p.assignment_id = a.id
WHERE a.status = 'COMPLETED'
  AND p.id IS NULL
  AND a.completed_at < NOW() - INTERVAL '24 hours';

-- 2. Detect unconfirmed cash payments older than 24 hours
SELECT id AS payment_id, assignment_id, amount, recorded_at,
       cash_confirmed_by_payer_at, cash_confirmed_by_payee_at
FROM payment_records
WHERE payment_method = 'CASH'
  AND status = 'PENDING'
  AND (cash_confirmed_by_payer_at IS NULL OR cash_confirmed_by_payee_at IS NULL)
  AND recorded_at < NOW() - INTERVAL '24 hours';

-- 3. Detect any orphaned attendance records
SELECT ar.id, ar.assignment_id
FROM attendance_records ar
LEFT JOIN assignments a ON a.id = ar.assignment_id
WHERE a.id IS NULL;

-- 4. Detect impossible worker counters
SELECT id, completed_tasks_count, total_ratings_count, average_rating
FROM worker_profiles
WHERE completed_tasks_count < 0 OR total_ratings_count < 0;
```

---

## 4. Conclusion & Operational Sign-off

The NEARVIA database schema demonstrates **high relational rigor**, robust check constraints, strict spatial indexing, and explicit foreign key cascade guards that prevent silent data corruption during live pilot operations.
