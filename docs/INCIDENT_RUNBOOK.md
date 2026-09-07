# NEARVIA Incident Response Runbook

> **Document Type**: Production Engineering Standard Operating Procedures (SOPs)  
> **System**: NEARVIA Hyperlocal Marketplace (`D:/NearVia`)  
> **Incident Response Cycle**: **Detect $\to$ Contain $\to$ Investigate $\to$ Recover $\to$ Verify $\to$ Document**  
> **Severity Thresholds**: P0 (Critical / Data Risk), P1 (Major Business / Flow Block), P2 (Degraded Feature), P3 (Minor)

---

## 1. Universal Incident Response Framework

Every operational incident must strictly follow the 6-stage lifecycle:

1. **DETECT**: Alert fired via health check endpoint (`/health/deep`), automated logs, or user report.
2. **CONTAIN**: Isolate impact using feature flags, traffic throttling, or account suspension to prevent cascading failure.
3. **INVESTIGATE**: Examine database transaction logs, audit trails, and server metrics to determine root cause.
4. **RECOVER**: Execute restoration steps: service restart, failover, state correction, or rollback.
5. **VERIFY**: Run test suites (`npm test`, `/health/deep`, staging smoke test) to confirm full restoration.
6. **DOCUMENT**: Record a post-mortem incident report with timeline, root cause, and preventative action items.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-01: API Outage (Service Unavailable / HTTP 500 Spike)
- **Detect**: Uptime monitor fails; `/health` returns 503 or does not respond within 5000ms.
- **Contain**: Direct traffic to maintenance page; enable rate limiters to shed non-critical traffic.
- **Investigate**: Inspect Node.js process logs: `journalctl -u nearvia-api` or container logs for unhandled exceptions or OOM crashes.
- **Recover**: Restart API service (`pm2 restart nearvia-api` or `systemctl restart nearvia-api`); verify process restarts cleanly on port 4000.
- **Verify**: Run `curl -i http://localhost:4000/api/v1/ready` and ensure HTTP 200 with latency $< 50\text{ms}$.
- **Document**: File incident ticket detailing memory/CPU metrics prior to crash.

---

### SOP-02: Database Connection Failure (PostgreSQL / PostGIS Down)
- **Detect**: `/health/deep` checks report `database: "disconnected"`; API logs `ECONNREFUSED` on port 5432.
- **Contain**: Gracefully pause background worker tasks and queue incoming write requests.
- **Investigate**: Check PostgreSQL service status: `systemctl status postgresql-17`; inspect disk space (`df -h`).
- **Recover**: If disk full, clear old vacuum logs; restart database service; verify connection pool recovers.
- **Verify**: Execute `SELECT 1;` and verify spatial query `SELECT PostGIS_Version();`.
- **Document**: Record connection pool metrics and database disk growth rate.

---

### SOP-03: Online Payment Failure / Gateway Timeout
- **Detect**: Webhook errors or payment record status transitions to `FAILED` at rates $> 5\%$.
- **Contain**: Flip feature flag `FEATURE_ONLINE_PAYMENTS=false`. Prompt employers to use Direct Cash Settlement temporarily.
- **Investigate**: Check Razorpay/Cashfree sandbox status page; review webhook signature verification logs in `services/api/src/modules/payments/webhook.ts`.
- **Recover**: Re-send failed webhook events; verify signature secret against `.env.production`.
- **Verify**: Execute a ₹10 test sandbox transaction to confirm complete capture and callback.
- **Document**: Document gateway failure duration and affected user IDs.

---

### SOP-04: Payment Webhook Failure / Missed Event
- **Detect**: User reports payment completed on UPI app, but NEARVIA assignment remains `IN_PROGRESS`.
- **Contain**: Mark payment record as `PENDING_RECONCILIATION`.
- **Investigate**: Query gateway API by `gateway_order_id` to verify payment capture status.
- **Recover**: Run manual reconciliation via Admin Dashboard: click *"Run Reconciliation Audit"* (`POST /api/v1/payments/reconcile`).
- **Verify**: Ensure payment record status transitions to `CONFIRMED` and digital receipt is generated.
- **Document**: Update webhook endpoint telemetry to capture network drop spikes.

---

### SOP-05: Cellular SMS OTP Delivery Failure
- **Detect**: Users report not receiving 6-digit OTP; failure rates in SMS provider logs spike.
- **Contain**: Enable Mock OTP fallback for authorized pilot testers (`MOCK_OTP_CODE="123456"`); limit mock to pilot phone numbers.
- **Investigate**: Check TRAI DLT template registration status and provider credit balance (e.g. Twilio / Fast2SMS).
- **Recover**: Renew SMS provider balance or switch to secondary SMS vendor endpoint.
- **Verify**: Trigger live test OTP to administrative device; verify receipt within 15 seconds.
- **Document**: Log SMS delivery latencies and DLT template rejection codes.

---

### SOP-06: AI Matching / Draft Service Failure
- **Detect**: Smart job drafting or candidate ranking returns HTTP 500 or times out ($> 8000\text{ms}$).
- **Contain**: Flip feature flag `FEATURE_AI_ASSISTANT=false`. System seamlessly falls back to standard manual job creation form.
- **Investigate**: Check LLM endpoint quota, API key validity, or rate limits.
- **Recover**: Refresh API keys; reduce context window; restart intelligence service.
- **Verify**: Submit sample job draft request; verify deterministic JSON schema validation succeeds.
- **Document**: Record LLM token latency and error rate.

---

### SOP-07: Interactive Map Service Failure (Leaflet / OpenStreetMap Tiles)
- **Detect**: Map tiles fail to render; browser console shows 429 or tile loading errors.
- **Contain**: Switch discovery view to `List View Only` (`viewMode = "list"`).
- **Investigate**: Check OSM tile server rate limits or CDN cache status.
- **Recover**: Point tile URL to fallback mirror (CartoDB or MapLibre backup provider).
- **Verify**: Open `/find-work` on mobile and desktop; confirm pin markers and tile rendering.
- **Document**: Record tile request volume per active user.

---

### SOP-08: Push / Notification Delivery Failure
- **Detect**: Critical assignment confirmations not reaching worker notification center.
- **Contain**: Enable SMS fallback for high-priority assignment alerts.
- **Investigate**: Check Redis queue status and WebSocket connection count.
- **Recover**: Restart notification service worker; clear stuck queue jobs.
- **Verify**: Send test notification; verify immediate delivery to client `NotificationBell`.
- **Document**: Record queue depth and retry counts.

---

### SOP-09: Security Incident / Rate Limit Attack
- **Detect**: Rate limiter triggers on `/api/v1/auth/otp/verify` or `/api/v1/payments/*` ($> 100\text{ req/min}$ from single IP).
- **Contain**: Rate limiter automatically returns HTTP 429; blacklist offending IP at reverse proxy level.
- **Investigate**: Inspect access logs for credential stuffing or PIN brute-force patterns.
- **Recover**: Verify no unauthorized accounts were accessed; reset compromised session tokens.
- **Verify**: Verify legitimate traffic proceeds without 429 throttling.
- **Document**: Log IP address, attack vector, and duration in `audit_logs`.

---

### SOP-10: Suspected Data Leak / Unauthorized Exposure
- **Detect**: Unauthorized attempt to access private coordinates or KYC scans.
- **Contain**: Immediately revoke affected API keys; enforce strict RLS lockdown on `verifications` and `worker_profiles`.
- **Investigate**: Run SQL audit query on `audit_logs` filtering for `actor_id` and resource access.
- **Recover**: Patch any exposed endpoint parameters; rotate database connection credentials.
- **Verify**: Run automated penetration test suite (`tests/security_hardening.test.ts`).
- **Document**: Compile forensic data exposure report for regulatory review.

---

### SOP-11: Physical Cash Handover Dispute
- **Detect**: Worker flags *"Employer did not pay agreed cash amount"* or Employer flags *"Worker demanded extra cash"*.
- **Contain**: Freeze assignment status to `DISPUTED`. Suspend reputation score updates.
- **Investigate**: Review GPS check-in logs, completed hours, and mutual in-app chat history.
- **Recover**: Field coordinator visits Indiranagar shop premises; mediates bilateral settlement in person.
- **Verify**: Confirm both parties sign off or confirm PIN settlement; unfreeze assignment.
- **Document**: Record dispute outcome in admin dispute arbitration notes.

---

### SOP-12: Unsafe Work Environment / Urgent Incident Report
- **Detect**: Worker taps emergency alert or submits safety report citing dangerous conditions, harassment, or abuse.
- **Contain**: Immediately suspend employer account; cancel all pending shifts posted by this employer; flag location as unsafe.
- **Investigate**: Safety officer contacts worker within 15 minutes; gather facts and witness accounts.
- **Recover**: Assist worker with safe transit home; preserve all digital records for police/labor authorities.
- **Verify**: Confirm employer is permanently de-platformed until legal investigation concludes.
- **Document**: File formal Safety Incident Dossier in the platform safety archive.
