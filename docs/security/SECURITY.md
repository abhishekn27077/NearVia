# NEARVIA Security Policy & Authorization Matrix

## 1. Security Architecture & Threat Model

NEARVIA enforces strict separation of concerns, zero client trust, and defense-in-depth across the entire request lifecycle.

---

## 2. Authorization & Ownership Matrix

| Resource Domain | Worker Access | Provider Access | Agent Access | Admin Access |
| :--- | :--- | :--- | :--- | :--- |
| **Worker Profile** | Own profile only (CRUD) | Read public profile only | Read/Assist with active consent | Full audit view |
| **Provider Profile** | Read public business profile | Own profile only (CRUD) | Read public profile | Full audit view |
| **Work Opportunities** | Read nearby (5 km) / Discover | Own posted work (CRUD) | Read nearby on behalf of worker | Full moderation / Cancel |
| **Applications** | Apply, view own submissions | View applicants for own jobs | Apply with authorized worker consent | Audit view |
| **Assignments** | View own, check-in, complete | View own, confirm completion | Read authorized worker status | Mediate / View |
| **Payments** | View received earnings | Initiate payout for own work | Prohibited | View sanitized records |
| **Reports / Disputes** | File against own assignments | File against own assignments | Prohibited | Authoritative arbitration |
| **Admin Operations** | 403 Forbidden | 403 Forbidden | 403 Forbidden | Authorized (`ADMIN` role) |

---

## 3. Secret Management & Credential Protection

### 3.1 Rules for Secrets
1. **Zero Secret Hardcoding**: Secrets (database connection strings, JWT signing keys, service-role keys, Razorpay secrets) are never committed to version control.
2. **Environment Validation**: Server validates environment variables at startup via Zod (`envSchema`).
3. **Log Sanitization**: `redactSensitiveData` systematically scrubs authorization headers, passwords, PINs, card details, and API keys.

---

## 4. Vulnerability Mitigation Checklist

- [x] **SQL Injection**: Prevented via parameterized queries (`$1, $2...`) on PostgreSQL driver.
- [x] **XSS (Cross-Site Scripting)**: React JSX automatic escaping + Helmet HTTP security headers.
- [x] **CSRF**: API uses stateless Bearer JWTs with `Authorization` headers.
- [x] **IDOR (Insecure Direct Object Reference)**: Every resource query enforces tenant/user ownership (`WHERE user_id = $userId` or `provider_id = $providerId`).
- [x] **Rate Limiting**: Sliding window in-memory limiter protecting auth, applications, reports, and admin endpoints.
- [x] **Privilege Escalation**: Role enforcement is verified server-side against database `users.role`.
