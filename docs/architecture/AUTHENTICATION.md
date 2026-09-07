# NEARVIA Authentication & Authorization Architecture

> **Document Version**: 1.0.0  
> **Status**: Approved Specification (Phase 4)  
> **Project**: NEARVIA — _Work Within Reach_  
> **Identity Provider**: Supabase Auth  
> **Authorization Authority**: PostgreSQL Server-Side Policy

---

## 1. Architectural Philosophy

NEARVIA separates **Identity Authentication** from **Domain Authorization**:

1. **Identity Authentication (Supabase Auth)**:
   - Manages secure user registration, email/phone OTP credentials, cryptographic password hashing, session tokens (JWTs), and session refresh lifecycles.
   - **Zero Password Storage**: NEARVIA's relational database never stores passwords, hashes, or sensitive auth tokens.
2. **Domain Authorization (PostgreSQL + Server Middleware)**:
   - The authoritative source of truth for user platform roles (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`), account status (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`), and resource ownership.
   - **Server-Side Enforcement**: Client-provided roles (in request bodies, query params, or localStorage) are strictly ignored and untrusted.

```
+------------------+         +---------------------+         +---------------------+
|  Client Browser  |  (1)    |    Supabase Auth    |         |   NEARVIA API       |
|   (Web / Mobile) | ------> |  (Phone OTP / JWT)  |         | (Express / Node.js) |
+------------------+         +---------------------+         +---------------------+
         |                              |                               |
         | (2) Session Token (JWT)      |                               |
         +------------------------------+                               |
         |                                                              |
         | (3) Request: Authorization: Bearer <JWT>                     |
         +------------------------------------------------------------> |
                                                                        | (4) Verify Token
                                                                        | (5) Query PostgreSQL:
                                                                        |     SELECT role, is_active
                                                                        |     FROM users
                                                                        |     WHERE auth_id = $1
                                                                        |
                                                                        | (6) Enforce Role & Ownership
                                                                        |
         | (7) 200 OK / 401 / 403 Response                              |
         | <------------------------------------------------------------+
```

---

## 2. Authentication vs. Platform Verification Distinction

> [!IMPORTANT]
> A critical architectural distinction in NEARVIA:

- **A. Authentication Verification (Phase 4)**:
  - _"Does this person control this phone number or email address?"_
  - Handled via Supabase Auth OTP verification.
- **B. Platform Identity & Skill Verification (Phase 19 / Future)**:
  - _"Has NEARVIA verified this person's government ID, trade certification, police clearance, or business registration?"_
  - Handled via the `verifications` table audit workflow.
  - A user can be authenticated without having completed platform identity verification.

---

## 3. Supported Roles & Security Model

NEARVIA enforces four distinct roles:

| Role           | Purpose                                        | Public Self-Selection Allowed? | Description                                                                                |
| :------------- | :--------------------------------------------- | :----------------------------: | :----------------------------------------------------------------------------------------- |
| **`WORKER`**   | Short-duration labor & skilled trade execution |            **YES**             | Finds micro-tasks (1–2 hrs) and shifts (3–6 hrs) within 5 km.                              |
| **`PROVIDER`** | Business or individual task posters            |            **YES**             | Creates tasks, selects candidates, and confirms completed shifts.                          |
| **`AGENT`**    | Local assisted onboarding intermediaries       |            **YES**             | Assists workers with low digital literacy to access work.                                  |
| **`ADMIN`**    | Platform oversight, compliance & arbitration   |        **STRICTLY NO**         | Manages dispute arbitration, reviews, and trust queues. Requires server-side provisioning. |

### Admin Role Isolation Policy:

- The public registration endpoint (`POST /api/v1/auth/register`) rejects any payload requesting `role: "ADMIN"` with `403 Forbidden`.
- Admin accounts cannot be created through public self-registration.

---

## 4. Account Lifecycle & Status Invariants

- **`ACTIVE` (`is_active = TRUE`)**: Normal marketplace access.
- **`SUSPENDED` / `DEACTIVATED` (`is_active = FALSE`)**:
  - The `authenticateUser` middleware checks `is_active` on every authenticated request.
  - Suspended accounts receive `403 Forbidden` with diagnostic error `ErrorCode.FORBIDDEN`.
  - Historical records (completed assignments, reviews, payments) are preserved for platform audit integrity rather than deleted.

---

## 5. Security & Secret Management

- **`SUPABASE_SERVICE_ROLE_KEY`**: Server-side only. Used solely by `services/api` for administrative tasks. Never sent to browsers, committed to Git, or exposed in logs.
- **`VITE_SUPABASE_ANON_KEY`**: Safe public anonymous client key used by `apps/web` for browser authentication flows.
- **CORS Policy**: Configured in Express to restrict authenticated origin access to approved frontend domains in production.
- **Sanitized Serialization**: API responses (`GET /api/v1/auth/me`) return safe user metadata (`id`, `authId`, `phone`, `fullName`, `role`, `isActive`) and strip internal secrets.

---

## 6. Future Mobile Client Compatibility (`apps/mobile`)

- The upcoming React Native / Expo mobile application will consume the identical Supabase Auth gateway and the same `/api/v1/auth/*` endpoints using standard Bearer JWT headers, ensuring zero backend duplication.
