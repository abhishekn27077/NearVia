# Phase 17: Analytics, Monitoring & Platform Health Architecture

## 1. Overview & Operational Principles
NEARVIA's Phase 17 introduces lightweight, privacy-preserving observability for platform usage, marketplace liquidity, infrastructure readiness, structured logging, and security telemetry without introducing cumbersome enterprise BI, Kafka, or continuous geolocation tracking.

---

## 2. Business & Marketplace Metrics

### 2.1 Authoritative Derived Aggregations
All metrics are computed via high-performance parallel aggregate queries against primary PostgreSQL tables rather than duplicate in-memory counters.

* **User Composition**: Total users partitioned by `WORKER`, `PROVIDER`, `AGENT`, and account integrity (`active` vs `suspended`).
* **Work Opportunities**: Posted, published active, completed, and cancelled tallies with average compensation.
* **Conversion Funnel**:
  $$\text{Published Jobs} \longrightarrow \text{Applications} \longrightarrow \text{Assignments} \longrightarrow \text{Completed Shifts}$$
  * Application-to-Assignment Rate: $\frac{\text{Accepted Assignments}}{\text{Total Applications}} \times 100\%$
  * Work Completion Rate: $\frac{\text{Completed Shifts}}{\text{Total Assignments}} \times 100\%$
* **Marketplace Health Ratios**:
  * **Fill Rate**: $\frac{\text{Opportunities with workers assigned}}{\text{Total published opportunities}} \times 100\%$
  * **Cancellation Rate**: $\frac{\text{Cancelled opportunities}}{\text{Total posted opportunities}} \times 100\%$
  * **No-Show Rate**: $\frac{\text{Cancelled assignments}}{\text{Total assignments}} \times 100\%$
  * **Dispute Rate**: $\frac{\text{Disputed assignments}}{\text{Total assignments}} \times 100\%$
  * **Report Resolution Rate**: $\frac{\text{Resolved reports}}{\text{Total reports}} \times 100\%$
  * **Application Density**: Average candidates per job posting.

---

## 3. Meaningful Product Events Taxonomy

Platform events are recorded in `platform_events` with data minimization principles:

| Event Type | Initiator | Target Resource | Minimal Safe Metadata |
| :--- | :--- | :--- | :--- |
| `USER_REGISTERED` | User | `users` | `role` |
| `PROFILE_COMPLETED` | Worker / Provider | Profile | `category`, `skillsCount` |
| `WORK_PUBLISHED` | Provider | `work_opportunities` | `category`, `wage`, `workType` |
| `WORK_VIEWED` | Worker | `work_opportunities` | `distanceKm` |
| `APPLICATION_SUBMITTED` | Worker / Agent | `applications` | `wageRequested` |
| `APPLICATION_ACCEPTED` | Provider | `applications` | `assignmentId` |
| `ASSIGNMENT_CREATED` | System / Provider | `assignments` | `shiftDate` |
| `WORK_STARTED` | Worker | `attendance` | `checkInMethod` |
| `WORK_COMPLETED` | Worker / Provider | `assignments` | `durationHours` |
| `PAYMENT_SUCCESS` | Provider / Gateway | `payment_records` | `amountPaise`, `method` |
| `REVIEW_SUBMITTED` | Participant | `reviews` | `rating` |
| `DISPUTE_RAISED` | Participant | `disputes` | `disputeType` |
| `REPORT_FILED` | User | `reports` | `category` |

---

## 4. Structured Logging & Request Correlation

### 4.1 Correlation ID Flow
Every inbound HTTP request passes through `requestCorrelation` middleware:
1. Extracts `X-Request-Id` or generates a new `UUIDv4`.
2. Attaches `req.id` to Express request.
3. Sets `X-Request-Id` response header.

### 4.2 Sensitive Data Redaction
The logging and audit subsystems automatically redact:
* Passwords & PINs
* JWT and session tokens
* API keys & webhook secrets
* Credit card numbers / CVV

---

## 5. Health & Readiness Check Strategy

| Endpoint | Method | Purpose | Response (Success) | Response (Failure) |
| :--- | :--- | :--- | :--- | :--- |
| `/health` or `/api/v1/health` | `GET` | Process Liveness & Uptime | `200 OK` `{ status: "ok", uptimeSeconds: N }` | — |
| `/ready` or `/api/v1/ready` | `GET` | PostgreSQL DB Connectivity | `200 OK` `{ status: "ready", database: "connected", latencyMs: N }` | `503 Unhealthy` `{ status: "unhealthy", database: "disconnected" }` |

---

## 6. Admin Analytics API Reference

All analytics routes require `authenticateUser` and `requireRole(UserRole.ADMIN)`.

* `GET /api/v1/admin/analytics/overview` - Platform overview KPIs, user composition, funnels, and financials.
* `GET /api/v1/admin/analytics/marketplace` - Marketplace health ratios (fill rate, completion rate, no-show rate, dispute rate).
* `GET /api/v1/admin/analytics/events` - Paginated product events stream with filters.
