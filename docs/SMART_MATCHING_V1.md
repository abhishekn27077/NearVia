# NEARVIA — Phase 9: Smart Matching V1 Architecture & Specification

> **Document Name**: `SMART_MATCHING_V1.md`  
> **Status**: Production-Ready / Active Specification  
> **Version**: 1.0.0 (Phase 9)  
> **Endpoint**: `GET /api/v1/jobs/:jobId/matches`  
> **Target Audience**: Providers, Engineers, System Auditors  

---

## 1. Overview & Core Philosophy

The NEARVIA Smart Matching Engine connects local employers (Providers) with the most qualified, nearby, and available workers within a strict **hyperlocal zone (1–5 km)**.

### Core Guarantees:
1. **100% Real Database Data**: Zero fabricated ratings, simulated reliability scores, or synthetic worker accounts.
2. **Deterministic & Explainable**: Identical inputs yield identical rankings and scores. Every match delivers human-readable justifications (e.g. *"Strong skill match + nearby + currently available"*).
3. **Zero Paid AI / LLM Dependencies**: Runs purely on server-side PostgreSQL/PostGIS spatial geometry and deterministic weighting. No external AI API latency or third-party data transmission.
4. **Strict Privacy Architecture**: Exact GPS coordinates, contact phone numbers, personal emails, and sensitive verification documents are strictly omitted from recommendation payloads.
5. **Fairness for New Entrants**: New workers with fewer than 3 tasks or reviews are neither penalized like untrustworthy workers nor falsely rewarded with 5-star claims. They receive a neutral baseline and an honest *"New Worker • Building Track Record"* badge.
6. **No Guarantee of Acceptance**: Recommendations represent candidate compatibility; actual hiring remains subject to provider invitation, worker confirmation, and two-way consent.

---

## 2. Matching Factors & Scoring Weights

The composite match score is calculated out of 100 integer points:

$$\text{Composite Score} = \sum (\text{Factor Score} \times \text{Weight}) + \text{Affinity Boost}$$

Bounded strictly within $[0, 100]$.

| Factor | Weight | Evaluation Criteria |
|---|---|---|
| **Trade Skill Match** | **35%** | • Ratio of matched required skills ($\text{matched} / \text{total}$).<br>• Experience bonus (+10%) when candidate meets or exceeds `min_experience_years`.<br>• Bonus (+5%) for each matched optional trade skill.<br>• 100% score if the job requires no trade credentials (general assistance). |
| **Category Fit** | **10%** | • 100% if worker has registered skills or past engagements in the job's trade category.<br>• 40% baseline if crossing over from another trade sector. |
| **Distance Proximity** | **20%** | PostGIS spatial distance decaying linearly from 100% at 0 km to 0% at search radius boundary (default 5 km):<br>$$\text{Distance Score} = \max\left(0, \text{round}\left(100 \times \left(1 - \frac{\text{Distance Km}}{\text{Radius Km}}\right)\right)\right)$$<br>• $\le 1.0$ km: Walkable (90–100%)<br>• $\le 2.0$ km: Nearby (80–89%)<br>• $\le 3.0$ km: Within short transit (60–79%)<br>• $\le 5.0$ km: Hyperlocal outer reach (20–59%) |
| **Availability & Freshness** | **15%** | • Live `Available Now` updated $<2$h ago: 100%<br>• Live `Available Now` updated $2–12$h ago: 90%<br>• Scheduled calendar slot fully covering shift hours: 85%<br>• Scheduled calendar slot with partial overlap: 70%<br>• Stale ($>12$h) or Offline workers: **Excluded (0%)** |
| **Reliability & Completion History** | **10%** | • **Veteran ($\ge 3$ tasks)**: Scaled directly by `reliability_score` (0–100).<br>• **New Worker ($<3$ tasks)**: Fixed neutral baseline of **70%** without false claims. |
| **Ratings & Reviews History** | **5%** | • **Rated Worker ($\ge 3$ ratings)**: Scaled by `(average_rating - 1) / 4 * 100`.<br>• **New Worker ($<3$ ratings)**: Fixed neutral baseline of **70%** (no fake 5-star claims). |
| **Verification Status** | **5%** | • **Verified Worker (`verified_badge = true`)**: 100% (+5 score points).<br>• **Unverified Active Worker**: 50% (+2.5 score points). |
| **Preferred Worker Affinity** | **+5% Boost** | Added as a loyalty incentive (capped at 100) if worker is saved in the provider's `preferred_workers` table. |

---

## 3. Eligibility & Hard Exclusion Rules

A candidate is strictly filtered out at the SQL database layer if any of the following are met:

1. **Inactive User**: `users.is_active = FALSE` or `users.role != 'WORKER'`.
2. **Missing Location**: `worker_profiles.location IS NULL`.
3. **Beyond Hyperlocal Proximity**: Distance between job site and worker exceeds `LEAST(job_radius, worker.service_radius_km)`.
4. **Offline Worker**: `worker_profiles.availability_status = 'OFFLINE'`.
5. **Stale Availability**: Worker is marked `is_available_now = TRUE` but `availability_updated_at < NOW() - INTERVAL '12 hours'` or `available_until <= NOW()`, and possesses no active scheduled slot for the job date.
6. **Mandatory Skill Absence**: If a job specifies required trade capabilities and candidate possesses none of them, skill score drops to 0.

---

## 4. Privacy & Data Minimization Guardrails

To protect worker safety, dignity, and personal security, the matching endpoint adheres to strict privacy firewalls:

| Information | Expose in Smart Matches? | Reason |
|---|---|---|
| **Exact GPS Coordinates (Lat/Lng)** | ❌ **STRICTLY PROHIBITED** | Prevents stalking and unauthorized physical tracking. Only approximate distance (e.g. `1.2 km`) and distance bucket (`NEARBY`) are provided. |
| **Phone Number / Email** | ❌ **STRICTLY PROHIBITED** | Prevents off-platform harassment. Contact is only initiated through authenticated in-app messaging or after explicit assignment confirmation. |
| **Government Identity / KYC Documents** | ❌ **STRICTLY PROHIBITED** | Sensitive Aadhaar, PAN, or voter credentials are never exposed. Only a Boolean `isVerified` badge is shared. |
| **Internal Algorithm Weights** | ❌ **STRICTLY PROHIBITED** | Internal subscores and weights are not exposed; only the composite `matchScore`, rank, and human explanation are returned. |
| **Worker Public Name & Avatar** | ✅ **PERMITTED** | Enables provider recognition and professional review. |
| **Trade Skills & Experience Years** | ✅ **PERMITTED** | Necessary for job compatibility evaluation. |
| **Verified Rating & Completion Count** | ✅ **PERMITTED (Vetted)** | Only exposed if candidate has $\ge 3$ verified shifts/ratings. |

---

## 5. Security & Authorization Architecture

1. **Authentication**: Requests must provide a valid Bearer JWT. Unauthenticated requests are rejected with `401 Unauthorized`.
2. **Provider Ownership Isolation**:
   - The caller must possess the `PROVIDER` or `ADMIN` role.
   - For `PROVIDER` callers, the backend resolves their `provider_profiles` record and validates that `job.provider_id === providerProfile.id`.
   - Any attempt by a provider to view matches for another employer's posting is rejected with `403 Forbidden`.
3. **Role Segregation**: Workers attempting to call `/api/v1/jobs/:jobId/matches` receive `403 Forbidden`.
4. **Input Validation**: `:jobId` parameter is validated against UUID format. Search radius is constrained between 1.0 km and 15.0 km.

---

## 6. Database Query Performance & Optimization

- **Single Pre-filtering SQL Query**: Uses PostGIS `ST_DWithin` spatial indexing and `ST_Distance` calculation in a single pass.
- **No N+1 Queries**: Candidate skills and calendar slots are batch-fetched using `WHERE worker_id = ANY($1::uuid[])`.
- **Zero Candidate Duplication**: Joins utilize `DISTINCT` on skills and map aggregation to ensure candidates with multiple trade skills are never duplicated in the rankings.
- **Low Infrastructure Overhead**: Completely infrastructure-native; runs entirely on existing PostgreSQL + PostGIS without Redis, Kafka, or paid vector databases.

---

## 7. Why V1 is Strictly Deterministic

| Criterion | Deterministic Scoring (V1) | Black-Box Machine Learning (Future) |
|---|---|---|
| **Explainability** | 100% transparent. Every score point is attributable to concrete skills, distance, or verified history. | Probabilistic weights are opaque and difficult to audit. |
| **Regulatory Compliance** | Zero algorithmic bias against protected characteristics. Compliant with labor transparency standards. | Risk of proxy discrimination and disparate impact. |
| **Cost & Latency** | Instant PostGIS execution ($\approx 15$ ms). Zero external API cost. | High token costs ($0.02+/call) and inference latency ($1–3$s). |
| **Reproducibility** | Two queries with the same state yield identical ranks. Essential for platform auditability. | Non-deterministic sampling can yield fluctuating candidate rosters. |

---

## 8. Limitations & Future Machine Learning Roadmap

### Current Limitations in V1:
1. **Linear Proximity Decay**: Does not account for physical terrain or live traffic bottlenecks (e.g. railway crossings or peak hour congestion).
2. **Fixed Category Penalty**: Standard 40% penalty for trade crossovers, even if adjacent trade skills share high transferability (e.g. painting vs masonry).
3. **Cold Start Neutral Baseline**: New workers receive a fixed 70% baseline, which while fair, relies heavily on skill matching to differentiate between new entrants.

### Phase 9+ / Future ML Upgrade Path:
- **Gradient Boosted Ranking (XGBoost / LightGBM)**: Once NearVia accumulates $>10,000$ verified completed shifts, train an offline pairwise ranking model using historical acceptance, arrival punctuality, and two-sided review outcomes.
- **Routing Engine Integration (OSRM / OpenStreetMap)**: Replace Haversine distance with actual multimodal transit routing times.
- **Dynamic Demand Balancing**: Factor in real-time supply-demand density to boost visibility of workers in underserved sub-neighborhoods.
