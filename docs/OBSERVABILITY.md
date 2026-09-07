# NEARVIA Observability & Monitoring Architecture

## Overview

NEARVIA employs a layered observability framework designed for production staging and live deployment. The framework provides real-time visibility into service health, database connectivity, PostGIS spatial responsiveness, request throughput, and application domain errors without exposing sensitive user data or credentials in telemetry logs.

---

## 1. Health & Readiness Endpoints

The API provides three standardized health check routes:

### 1.1 Liveness Probe (`GET /health` or `GET /api/v1/health`)
- **Purpose:** Verifies that the Node.js process is alive and accepting HTTP connections.
- **Used By:** Kubernetes liveness probe / Docker healthcheck.
- **Response Format (200 OK):**
  ```json
  {
    "status": "ok",
    "service": "nearvia-api",
    "environment": "production",
    "uptimeSeconds": 1420,
    "timestamp": "2026-09-03T05:45:00.000Z"
  }
  ```

### 1.2 Readiness Probe (`GET /ready` or `GET /api/v1/ready`)
- **Purpose:** Verifies that the API can successfully communicate with the primary PostgreSQL database.
- **Query:** Executes `SELECT 1 AS ready` with latency measurement.
- **Response Format (200 OK):**
  ```json
  {
    "status": "ready",
    "database": "connected",
    "latencyMs": 4,
    "timestamp": "2026-09-03T05:45:00.000Z"
  }
  ```
- **Error Response (503 Service Unavailable):** Returns `status: "unhealthy"` if database ping fails or times out after 3,000ms.

### 1.3 Deep Health Probe (`GET /api/v1/health/deep`)
- **Purpose:** Comprehensive dependency diagnostics verifying:
  1. PostgreSQL core connectivity and read/write pool status.
  2. PostGIS spatial extension availability (`SELECT PostGIS_Version()`).
  3. Core database table counts and migration readiness (`users`, `work_opportunities`, `assignments`, `payment_records`).
  4. Node.js process memory usage (RSS, heapUsed, heapTotal).
- **Response Format (200 OK):**
  ```json
  {
    "status": "healthy",
    "service": "nearvia-api",
    "checks": {
      "database": { "status": "pass", "latencyMs": 12 },
      "postgis": { "status": "pass", "version": "3.5.0" },
      "schema": { "status": "pass", "tablesFound": 14 }
    },
    "memory": {
      "rssMb": 85.4,
      "heapUsedMb": 42.1
    }
  }
  ```

---

## 2. Request Correlation & Structured Logging

### 2.1 Correlation ID (`X-Request-Id`)
- Every inbound HTTP request is assigned a unique correlation ID via `requestCorrelation` middleware.
- If the incoming request has an `X-Request-Id` header (e.g. from an API gateway or frontend), it is preserved; otherwise, a cryptographic UUIDv4 is generated.
- The `X-Request-Id` is appended to response headers and attached to every server log entry for distributed trace reconstruction.

### 2.2 Sanitized Request Logging
- **Middleware:** `requestLogger` logs method, route path, status code, response time, and user ID (if authenticated).
- **Redaction Rules:**
  - `Authorization` headers (Bearer tokens) are completely redacted.
  - Passwords, OTP codes, and payment credentials are filtered before logging.
  - Query parameters containing personal identifiers are sanitized.

---

## 3. Error Handling Standards

All errors conform to the standard NEARVIA error contract:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {},
    "timestamp": "2026-09-03T05:45:00.000Z"
  },
  "requestId": "c4b3a1d2-..."
}
```

### Safety Rules:
- In `NODE_ENV === "production"`, internal database error messages and stack traces are **never** returned to the client. A generic message (`"An unexpected error occurred"`) is returned with code `INTERNAL_SERVER_ERROR`.
- Detailed stack traces are logged exclusively to server stderr with the associated `requestId`.

---

## 4. Rate Limiting Headers

Every rate-limited endpoint emits RFC 6585 and IETF standard rate limiting headers:
- `RateLimit-Limit`: Maximum requests permitted within window.
- `RateLimit-Remaining`: Remaining requests in current window.
- `RateLimit-Reset`: Seconds until quota reset.
- `Retry-After`: Emitted on HTTP 429 responses indicating backoff duration.

---

## 5. Audit Logging Architecture

Critical marketplace domain events write structured records to the `audit_logs` table:
- **Events Logged:**
  - `USER_LOGIN` / `USER_REGISTER`
  - `KYC_VERIFICATION_SUBMIT` / `KYC_VERIFICATION_APPROVE` / `KYC_VERIFICATION_REJECT`
  - `WORK_OPPORTUNITY_CREATE` / `WORK_OPPORTUNITY_CANCEL`
  - `ASSIGNMENT_CONFIRM` / `ASSIGNMENT_COMPLETE`
  - `PAYMENT_INITIATE` / `PAYMENT_CONFIRM` / `PAYMENT_REFUND` / `PAYMENT_DISPUTE`
  - `ADMIN_MODERATION_ACTION`
- **Schema:**
  - `id`: UUID
  - `user_id`: Actor UUID
  - `action`: Domain action enum
  - `target_type`: Entity table name (`users`, `payments`, `work_opportunities`)
  - `target_id`: Entity primary key
  - `metadata`: JSONB containing before/after diffs (sanitized)
  - `ip_address`: Client IP address
  - `created_at`: TIMESTAMPTZ
