# Phase 18: Production Readiness Architecture

## 1. Executive Summary
NEARVIA is architected as a high-performance, modular monolith designed for hyperlocal wage discovery and work fulfillment within a 5 km radius. Phase 18 hardens the platform for production environments across security boundaries, request rate limiting, zero-trust authorization, performance, and disaster recovery.

---

## 2. Security Hardening & Defenses

### 2.1 Defense-in-Depth Model
* **Network & Gateway Layer**: Express with Helmet security headers (cross-origin protections, MIME sniffing prevention, XSS filter, Frameguard).
* **Rate Limiting Layer**: In-memory sliding window rate limiters defending against brute-force attacks on authentication, spamming applications, reports, and dispute arbitrations.
* **Authentication Layer**: Cryptographic Supabase JWT verification with server-side signature validation.
* **Authorization Matrix**: Zero-trust ownership validation ensuring workers, providers, and agents cannot tamper with or inspect foreign resources (IDOR prevention).
* **Secrets & Log Scrubbing**: Sensitive keys, payment secrets, PINs, and auth tokens are systematically redacted before reaching stdout or log sinks.

---

## 3. Rate Limiting Profiles

| Scope | Window | Max Requests | Target Endpoints | Behavior on Breach |
| :--- | :--- | :--- | :--- | :--- |
| **Global** | 15 min | 500 | All routes (`/api/v1/*`) | `429 Too Many Requests` + RFC headers |
| **Auth** | 15 min | 25 | `/auth/*`, OTP verification | `429` with 15-min backoff |
| **Sensitive Actions** | 15 min | 60 | `/applications`, `/reports`, `/disputes` | `429` with retry seconds |
| **Admin Operations** | 15 min | 200 | `/admin/*` | `429` with backoff |

---

## 4. Query Performance & Indexing

All critical relational and spatial query paths are supported by dedicated PostgreSQL B-Tree and PostGIS GiST indexes:
* **Hyperlocal 5 km Search**: `idx_work_opportunities_location` (`USING GIST(location)`)
* **Intelligent Matching**: `idx_worker_skills_skill`, `idx_worker_profiles_available_now`, `idx_work_opportunities_status`
* **Execution & Attendance**: `idx_attendance_records_assignment`, `idx_attendance_records_worker`
* **Financial Records**: `idx_payment_records_idempotency`, `idx_payment_records_gateway_order`
* **Product Events & Audit**: `idx_platform_events_type`, `idx_audit_logs_action`, `idx_audit_logs_target`

---

## 5. Health & Readiness Telemetry
* **Liveness**: `GET /health` returns process uptime and runtime status.
* **Readiness**: `GET /ready` pings the PostgreSQL connection pool via `SELECT 1 AS ready` and returns latency in milliseconds, returning `503 Service Unavailable` if database connectivity drops.
