# NEARVIA — Phase 10: Preferred Workers V1 Architecture & Specification

> **Document Name**: `PREFERRED_WORKERS_V1.md`  
> **Status**: Production-Ready / Active Specification  
> **Version**: 1.0.0 (Phase 10)  
> **Endpoints**:  
> - `GET /api/v1/providers/preferred-workers` (or `/me/preferred-workers`)  
> - `POST /api/v1/providers/preferred-workers/:workerId` (or `/me/preferred-workers/:workerId`)  
> - `DELETE /api/v1/providers/preferred-workers/:workerId` (or `/me/preferred-workers/:workerId`)  
> **Target Audience**: Providers, Engineers, System Auditors  

---

## 1. Overview & Core Philosophy

The **Preferred Workers** system allows providers to favorite, bookmark, and curate trusted local workers with whom they have established strong professional rapport. Preferred workers receive prioritized matching for that specific provider's future job postings, without compromising on platform safety, location constraints, or skill requirements.

### Core Guarantees:
1. **100% Real Database Relationships**: Relationships are persisted in the PostgreSQL `preferred_workers` table, linked by foreign keys to `provider_profiles` and `worker_profiles`.
2. **Strict Provider Privacy & Isolation**: Preferred status is strictly private to the employer who set it. No other provider can view another employer's preferred workers list. Workers cannot see which providers have preferred them.
3. **Hard Eligibility Override (Safety & Quality First)**: Marking a worker as "Preferred" does **NOT** bypass physical reality or platform requirements:
   - **Inactive accounts** (`is_active = FALSE`) are excluded from matching.
   - **Offline workers** (`availability_status = 'OFFLINE'`) are excluded from matching.
   - **Stale availability** (last updated $>12$ hours ago without scheduled slots) is excluded from matching.
   - **Outside radius** workers beyond the job's search radius or worker's service boundary are excluded.
   - **Incompatible skills**: A preferred worker without the required trade skills cannot outrank a worker with the necessary trade credentials.
4. **Transparent, Deterministic Smart Matching Priority**: Eligible preferred workers receive an explainable **+5% boost** (capped at 100%), a `"❤️ Preferred Worker"` badge, and a distinct match highlight.
5. **Strict Data Minimization**: Responses return only masked phone numbers (`+91 ***** 1234`), approximate availability, badges, and verified trade skills. Exact GPS coordinates and KYC documents are never leaked.
6. **Zero External Paid AI / Cloud Costs**: Runs entirely on server-authoritative PostgreSQL and Express.

---

## 2. Data Model & Database Schema

The relationship uses the existing `preferred_workers` table created in migration `00009_phase5_realtime_marketplace.sql`:

```sql
CREATE TABLE IF NOT EXISTS preferred_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT preferred_workers_provider_id_worker_id_key UNIQUE(provider_id, worker_id)
);

-- B-tree indexes for high-throughput lookups
CREATE INDEX IF NOT EXISTS idx_preferred_workers_provider ON preferred_workers(provider_id);
CREATE INDEX IF NOT EXISTS idx_preferred_workers_worker ON preferred_workers(worker_id);
```

### Key Database Properties:
- **Composite Unique Constraint**: `UNIQUE(provider_id, worker_id)` ensures duplicate rows can never be inserted.
- **Cascade Deletions**: Deleting a provider or worker profile automatically cleans up associated preference records.
- **Indexes**: Dedicated B-tree indexes on `provider_id` and `worker_id` provide sub-millisecond lookups during Smart Matching queries.

---

## 3. API Endpoints Specification

All endpoints require standard Bearer JWT authentication and the `PROVIDER` role (or `ADMIN`).

### 3.1. List Preferred Workers
- **Method / Path**: `GET /api/v1/providers/preferred-workers` (or `/api/v1/providers/me/preferred-workers`)
- **Authorization**: Bearer JWT (`PROVIDER` or `ADMIN`)
- **Behavior**: Retrieves all workers favorited by the calling provider.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "c1f7a08e-5b12-4c6e-8d5f-9f7a2d1e3b5a",
      "providerId": "d2a91f5c-e9e1-4835-96a4-08d0f671e6cf",
      "workerId": "f7c281d4-4654-49c9-8838-15639423b41c",
      "workerName": "Ravi Kumar",
      "workerPhoneMasked": "+91 ***** 1001",
      "avatarUrl": "https://...",
      "bio": "Experienced licensed domestic electrician.",
      "experienceYears": 4.0,
      "isAvailableNow": true,
      "availabilityStatus": "AVAILABLE_NOW",
      "isVerified": true,
      "isNewWorker": false,
      "workerRating": 4.8,
      "totalRatingsCount": 10,
      "completedTasksCount": 25,
      "reliabilityScore": 95.0,
      "skills": ["Domestic Wiring", "Switchboard Assembly"],
      "notes": "Top choice electrician for commercial rewiring",
      "createdAt": "2026-09-08T06:35:00.000Z"
    }
  ]
}
```

### 3.2. Add Worker to Preferred
- **Method / Path**: `POST /api/v1/providers/preferred-workers/:workerId` (or `/api/v1/providers/me/preferred-workers/:workerId`)
- **Authorization**: Bearer JWT (`PROVIDER` or `ADMIN`)
- **Request Body**:
```json
{
  "notes": "Optional notes on worker punctuality or trade specialty"
}
```
- **Validation**:
  - `:workerId` must be a valid UUID.
  - Worker must exist in `worker_profiles`.
  - Self-preference is blocked: `worker.user_id !== providerUserId`.
- **Behavior**: Idempotent insert using `ON CONFLICT (provider_id, worker_id) DO UPDATE SET notes = ...`. If already added, notes are updated and returns `200 OK`.

### 3.3. Remove Worker from Preferred
- **Method / Path**: `DELETE /api/v1/providers/preferred-workers/:workerId` (or `/api/v1/providers/me/preferred-workers/:workerId`)
- **Authorization**: Bearer JWT (`PROVIDER` or `ADMIN`)
- **Behavior**: Deletes the row from `preferred_workers`. If the record does not exist, the operation safely completes with `200 OK` (idempotent removal).

---

## 4. Privacy & Data Isolation

| Field / Feature | Public / Exposed to Other Providers? | Visible to Worker? | Handled In Response |
|---|---|---|---|
| **Preferred List** | ❌ Strictly isolated to each provider | ❌ Worker cannot see | Only caller's records returned |
| **Exact GPS Coordinates** | ❌ Omitted | ❌ Omitted | Only approximate distance formatted |
| **Full Phone Number** | ❌ Omitted | N/A | Masked format (`+91 ***** 1234`) |
| **Government Identity / KYC** | ❌ Omitted | Private | Only `isVerified: boolean` flag |
| **Employer Notes** | ❌ Strictly private to the employer | ❌ Worker cannot see | Stored in `preferred_workers.notes` |

---

## 5. Smart Matching Integration & Eligibility Override

During candidate discovery (`GET /api/v1/jobs/:jobId/matches`), the engine evaluates preference via:

```sql
EXISTS(
  SELECT 1 FROM preferred_workers pw 
  WHERE pw.provider_id = $3 AND pw.worker_id = wp.id
) AS is_preferred_worker
```

### Ranking & Scoring Rules:
1. **Eligible Workers**: When a candidate satisfies PostGIS distance, live availability, and trade skill criteria, preference adds **+5%** to the final match score ($[0, 100]$):
   $$\text{Final Score} = \min(100, \text{Raw Score} + 5)$$
2. **Visual Badging & Explanation**:
   - `isPreferredWorker: true`
   - Highlights include `"❤️ Preferred Worker"`
   - Reason phrases include `"preferred worker"`
3. **Hard Eligibility Override (Mandatory Constraints)**:
   - If an employer marks a worker as preferred, but that worker goes **offline**, becomes **inactive**, moves **outside the radius**, or **lacks the mandatory trade skills** for an opportunity:
     - Hard PostGIS and availability filters in SQL immediately exclude the worker from discovery.
     - The preferred worker will **never** be suggested or recommended for a job they cannot legally or physically perform.

---

## 6. Frontend User Experience

1. **Smart Matching Tab (`SmartMatchesTab.tsx`)**:
   - Each candidate card features an interactive heart icon.
   - Clicking toggles preferred worker state in real-time with optimistic UI update (+5% / -5% score reflection).
   - Preferred candidates display the `"❤️ Preferred Worker"` badge and highlight.
2. **Provider Dashboard (`ProviderDashboardPage.tsx`)**:
   - Displays **Your Preferred Workers (⭐ Favorites)** roster.
   - Shows masked phone numbers, trade skill tags, shift counts, and star ratings.
   - Each card provides a direct **Remove** action and a **Direct Offer** link.
3. **Opportunity Applicants (`OpportunityApplicantsPage.tsx`)**:
   - Seamless candidate review with Smart Matches tab integration for instant hiring.

---

## 7. Automated Test Coverage (13 Critical Verifications)

All 13 verifications are codified and passing in `services/api/tests/preferred_workers.test.ts`:

| # | Verification | Result |
|---|---|---|
| 1 | Provider adds worker as Preferred | ✅ PASS |
| 2 | Duplicate add handled safely (idempotent notes update) | ✅ PASS |
| 3 | Remove preferred worker works | ✅ PASS |
| 4 | Provider views preferred workers list with profile, rating & skills | ✅ PASS |
| 5 | Privacy isolation — Provider B cannot see Provider A's preferred workers | ✅ PASS |
| 6 | Worker role forbidden from manipulating preferred relationships (403) | ✅ PASS |
| 7 | Inactive worker marked preferred is excluded from Smart Matching | ✅ PASS |
| 8 | Offline/stale worker marked preferred is excluded from Smart Matching | ✅ PASS |
| 9 | Incompatible skill worker marked preferred is not incorrectly promoted | ✅ PASS |
| 10 | Preferred eligible worker receives priority boost (+5%), badge, and highlight | ✅ PASS |
| 11 | Direct SQL insert violates unique constraint on duplicate `(provider_id, worker_id)` | ✅ PASS |
| 12 | API validation prevents self-preference, invalid UUID, and unauthenticated calls | ✅ PASS |
| 13 | Response payloads do not leak exact GPS coordinates or unmasked contact data | ✅ PASS |
