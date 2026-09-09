# NEARVIA Security Audit & Remediation Report: Registration, Password, Account Lifecycle & Identity Integrity Hardening

**Auditor:** Antigravity Advanced Agentic Coding Pair Programmer  
**Date:** September 7, 2026  
**Scope:** Hyperlocal Work Marketplace Authentication, Registration, Password Handling, Account Lifecycle, Email/OTP Verification & Identity Integrity  
**Workspace:** `D:\NearVia`  
**Status:** **100% GREEN (290 tests passing across 29 test suites)**  

---

## 1. Executive Summary & Audit Scope

A comprehensive adversarial security audit and identity hardening was conducted on the NEARVIA authentication and identity lifecycle. This engagement specifically targeted:
- User registration (`POST /api/v1/auth/signup` and `POST /api/v1/auth/register`)
- Elimination of implicit password resets and account takeover vectors
- Password handling and security boundaries with Supabase Auth
- Account deactivation, suspension, and authorization enforcement
- Mobile progressive verification and OTP challenge lifecycles (`/send-otp`, `/verify-otp`)
- Email confirmation boundaries between development/demo and production (`/confirm-email`)
- Role authorization, profile synchronization, and database-level uniqueness constraints

### Key Files Inspected & Hardened:
- `packages/validation/src/auth.schema.ts`: Enforced strict validation schemas (`signupRequestSchema`, `loginRequestSchema`, `registerRequestSchema`, `confirmEmailSchema`).
- `services/api/src/modules/auth/service.ts`: Hardened `signUpWithEmail`, `registerUser`, `confirmUserEmail`, `verifyMobile`, and introduced `login`.
- `services/api/src/modules/auth/controller.ts`: Added validation bindings, token congruency checks, and unified login.
- `services/api/src/modules/auth/routes.ts`: Wired `signupRequestSchema` and `loginRequestSchema` with rate limiters.
- `services/api/src/modules/otp/service.ts`: Added atomic duplicate phone checks before persistence.
- `database/migrations/00013_users_case_insensitive_email_unique.sql`: Applied PostgreSQL unique index `idx_users_email_lower`.
- `services/api/tests/account_lifecycle_hardening.test.ts`: Added 26 automated tests covering all lifecycle edge cases.
- `services/api/src/scripts/verify-account-lifecycle-http-db.ts`: End-to-end live HTTP and database forensic validation.

---

## 2. Complete Audit of Authentication & Account Lifecycle

| Domain | Original State | Risk / Flaw | Remediated Architecture | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Registration (`/signup`)** | No Zod schema validation; accepted unvalidated body | Arbitrary field injection, malformed email, missing passwords | Strict `signupRequestSchema` enforcing email format, password length (6-100), and public role whitelist | **PASS** |
| **Existing Email Signup** | Previous codebase updated existing user's password | Account Takeover / Unauthorized Password Reset | Rejection with `409 Conflict`. Zero modifications to passwords, roles, or verification states | **PASS** |
| **Password Policy** | Optional password defaulted to generic string | Weak default credentials | Required minimum 6 chars, max 100 chars, validated before Supabase handoff | **PASS** |
| **Password Reset** | No dedicated API reset route | Attackers abused registration as reset | Delegated strictly to Supabase Auth recovery; registration strictly isolated from reset | **PASS** |
| **Unified Login** | Missing API endpoint; client-only | Inconsistent server-side status checks | Added `POST /api/v1/auth/login` checking Supabase credentials + database `is_active` status | **PASS** |
| **Email Confirmation** | Public endpoint `/confirm-email` | Abuse in production to bypass verification | Hardened with `NODE_ENV === "production"` gate (403), restricted to `@nearvia.test`, and verified owner check | **PASS** |
| **OTP Verification** | Potential race condition on phone reuse | Duplicate phone hijacking | Added duplicate verification check in both `sendOtp` and `verifyOtp` before database write | **PASS** |
| **Deactivated Accounts** | Deactivated users could attempt re-registration | Account reactivation bypass | `is_active === false` rejected across middleware, registration, and login with `403 Forbidden` | **PASS** |
| **Role Authorization** | Self-assignment of ADMIN via signup | Privilege escalation | Strict Zod `publicUserRoleSchema` (`WORKER`, `PROVIDER`, `AGENT`) + service-level checks | **PASS** |
| **Profile Tampering** | Put profile endpoints tested | Privilege escalation via profile update | Strict Zod schemas reject `role`, `is_active`, `mobile_verified`, `identity_verified`, `userId` | **PASS** |

---

## 3. In-Depth Analysis: The Previous Critical Vulnerability

### Vulnerability Mechanics
In earlier revisions of `AuthService.signUpWithEmail()`, the implementation exhibited an unsafe account takeover pattern:
1. The user supplied an email address and a new password via a public registration request.
2. The service searched for an existing record by email in the authentication provider (`supabase.auth.admin.listUsers()`).
3. If an existing record was discovered, the service called `supabase.auth.admin.updateUserById(existingAuth.id, { password, email_confirm: true })`.
4. The service then returned the existing profile or established an active session for the caller.

### Threat & Impact
- **Complete Account Takeover**: Any unauthenticated attacker who knew a victim's email address could submit that email to the registration endpoint with an attacker-chosen password. The victim's password was silently overwritten.
- **Privilege Hijacking**: If an administrative or provider account existed, an attacker could seize the identity and gain administrative or financial control.
- **Denial of Service**: Legitimate account holders were locked out of their accounts without warning.

### Root Cause Elimination
The vulnerability was completely eradicated through the following multi-layer defense:
1. **Pre-Registration Existence Check**: `signUpWithEmail` immediately checks the PostgreSQL `users` table (`SELECT id FROM users WHERE LOWER(email) = $1`). If an account exists, it immediately throws `AppError("An account with this email address already exists. Please log in or reset your password.", 409, ErrorCode.CONFLICT)`.
2. **Provider Pre-Check**: If the email is present in Supabase Auth, `signUpWithEmail` immediately throws `409 Conflict`.
3. **No Password Mutation During Registration**: The method **never** invokes `updateUserById` or modifies password hashes during registration.
4. **Automated Regression Test**: Dedicated test `CRITICAL REGRESSION` in `account_lifecycle_hardening.test.ts` proves that sending a registration request with an existing victim email and an attacker's password results in `409 Conflict`, leaves the victim's record untouched, and prevents attacker authentication.

---

## 4. Server-Authoritative Role Policies

NEARVIA enforces strict separation of privilege across all user roles:

```
                  ┌──────────────────────────────┐
                  │    Self-Registration Scope   │
                  │ (WORKER, PROVIDER, AGENT)    │
                  └──────────────┬───────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│    UserRole.WORKER │ │  UserRole.PROVIDER │ │   UserRole.AGENT   │
│ - Hyperlocal Tasks │ │ - Hire Helpers     │ │ - Field Support    │
│ - 5 km PostGIS Loc │ │ - Post Work Shifts │ │ - Area Assignments │
└────────────────────┘ └────────────────────┘ └────────────────────┘
                                 ▲
                                 │ (Public Entry FORBIDDEN)
                  ┌──────────────┴───────────────┐
                  │       UserRole.ADMIN         │
                  │ - System Governance          │
                  │ - Platform Moderation        │
                  │ - Server Seed / Ops Only     │
                  └──────────────────────────────┘
```

1. **Public Role Whitelist**: Self-registration endpoints (`/signup`, `/register`, `/sync-google-profile`) only accept values validated by `publicUserRoleSchema`: `WORKER`, `PROVIDER`, or `AGENT`.
2. **ADMIN Role Restriction**: Requesting `role: "ADMIN"` in any public request returns `400 Validation Error` (schema violation) or `403 Forbidden` (service check).
3. **Immutable Identity**: Once created, an application user's role cannot be updated via `/api/v1/auth/profile`. Only authenticated administrators accessing `PUT /api/v1/admin/users/:id/role` can modify a user's role.

---

## 5. Explicit Environment & System Boundaries

### Boundary 1: Dev/Demo vs. Production
- **Mock OTP Provider (`123456`)**: Allowed strictly in `NODE_ENV !== "production"`. In production, `OTPService.getProvider()` throws an error if `OTP_PROVIDER !== "msg91"`.
- **Automated Email Confirmation (`/confirm-email`)**: Strictly disabled in production (`NODE_ENV === "production"` throws `403 Forbidden`). In development, restricted to `@nearvia.test` domain accounts with ownership verification.
- **Demo Accounts**: Demo seed accounts (`demo.worker@nearvia.test`, etc.) are guarded by `VITE_ENABLE_DEMO_ACCOUNTS` and prohibited in production client builds.

### Boundary 2: NEARVIA Application Backend vs. Supabase Auth
- **Supabase Auth Boundary**: Supabase Auth owns credential storage, password hashing (bcrypt/argon2), and JWT signing. The application backend **never** stores plaintext passwords or password hashes.
- **NEARVIA Domain Authority**: NEARVIA PostgreSQL owns application state, PostGIS spatial coordinates, role authorization, verification badges, worker availability, and marketplace invariants.
- **Key Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is restricted exclusively to backend server processes (`services/api`). The frontend web client bundle (`apps/web`) contains only `SUPABASE_ANON_KEY`.

---

## 6. Mobile / OTP Verification Architecture

1. **Challenge Binding**: Each OTP challenge created in `otp_challenges` is cryptographically bound to `user_id` and normalized E.164 `phone`.
2. **Cryptographic Storage**: OTP tokens are hashed using HMAC-SHA256 (`OTP_SALT`) prior to database storage.
3. **Timing-Safe Comparison**: Verification evaluates hashes using `crypto.timingSafeEqual` to prevent timing side-channel attacks.
4. **Replay Prevention**: Once consumed, `consumed_at` is set to `NOW()`. Consumed challenges cannot be reused.
5. **Rate Limiting & Cooldowns**:
   - 60-second cooldown between resends (`RESEND_COOLDOWN_SECONDS = 60`).
   - Maximum 4 requests per 10-minute rolling window (`RATE_LIMIT_WINDOW_MINUTES = 10`, `MAX_RESENDS_PER_WINDOW = 4`).
   - Maximum 3 verification attempts per challenge (`MAX_ATTEMPTS = 3`). Exceeding 3 attempts invalidates the challenge and returns `429 Rate Limited`.
6. **Cross-Account Protection**: Phones cannot be linked or verified if already verified by another active account (`409 Conflict`).

---

## 7. Database Uniqueness & Concurrency Defenses

To defend against race conditions and casing collisions during concurrent registration requests:
1. **Case-Insensitive Unique Index**: Applied migration `00013_users_case_insensitive_email_unique.sql`:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower 
   ON public.users (LOWER(email)) 
   WHERE email IS NOT NULL;
   ```
2. **Atomic Conflict Resolution**: When concurrent requests attempt to register `user@nearvia.test` and `USER@NEARVIA.TEST`, PostgreSQL guarantees that exactly one transaction succeeds; the second transaction encounters a unique constraint violation and fails safely with `409 Conflict`.
3. **Profile Foreign Key Uniqueness**: `worker_profiles`, `provider_profiles`, and `agent_profiles` define `user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`.

---

## 8. Automated Test Matrix (Prompt 3 Suite)

Test suite location: `services/api/tests/account_lifecycle_hardening.test.ts` (26/26 tests passed).

| Test Identifier | Description / Objective | Expected Result | Actual Result |
| :--- | :--- | :--- | :--- |
| **TEST 1** | Register new email with valid payload | HTTP 201, role WORKER, isActive true | **PASS (201)** |
| **TEST 2** | Register existing email -> does NOT change password | HTTP 409 Conflict, no admin password update | **PASS (409)** |
| **TEST 3** | Register existing email -> does NOT alter existing role | HTTP 409 Conflict, existing role preserved | **PASS (409)** |
| **TEST 4** | Register existing email -> does NOT change verification state | HTTP 409 Conflict, verification flags untouched | **PASS (409)** |
| **TEST 5** | Register existing email -> does NOT reactivate account | HTTP 409 Conflict, `is_active` remains false | **PASS (409)** |
| **TEST 6** | Registration payload contains `role: "ADMIN"` | HTTP 400 Validation Error, admin not created | **PASS (400)** |
| **TEST 7** | Registration payload contains invalid role `SUPERUSER` | HTTP 400 Validation Error | **PASS (400)** |
| **TEST 8** | Registration payload contains malformed email | HTTP 400 Validation Error | **PASS (400)** |
| **TEST 9** | Registration payload contains weak password (<6 chars) | HTTP 400 Validation Error | **PASS (400)** |
| **TEST 10** | Protected route accessed without Bearer token | HTTP 401 Unauthorized | **PASS (401)** |
| **TEST 11** | User attempts to update another user's profile | HTTP 400 Validation Error, target user untouched | **PASS (400)** |
| **TEST 12** | User attempts to escalate role via `PUT /auth/profile` | HTTP 400 Validation Error, role untouched | **PASS (400)** |
| **TEST 13** | User attempts to forge verification flags via profile update | HTTP 400 Validation Error, flags untouched | **PASS (400)** |
| **TEST 14** | User attempts to modify account status via profile update | HTTP 400 Validation Error, status untouched | **PASS (400)** |
| **TEST 15** | Request supplied with invalid/expired Bearer JWT | HTTP 401 Unauthorized | **PASS (401)** |
| **TEST 16** | Deactivated account attempts access to protected route | HTTP 403 Forbidden | **PASS (403)** |
| **TEST 17** | Deactivated account attempts login with valid credentials | HTTP 403 Forbidden | **PASS (403)** |
| **TEST 18** | User attempts to verify OTP created for another user | Rejection (HTTP 400 Validation Error) | **PASS (400)** |
| **TEST 19** | User attempts verification using an expired OTP challenge | Rejection (expired code error) | **PASS (400)** |
| **TEST 20** | User exceeds 3 failed OTP attempts | Rejection with HTTP 429 Rate Limited | **PASS (429)** |
| **TEST 21** | Authenticated user attempts to confirm another user's email | HTTP 403 Forbidden | **PASS (403)** |
| **TEST 22** | Public email confirmation invoked in production mode | HTTP 403 Forbidden | **PASS (403)** |
| **TEST 23** | Concurrent registration with casing variations | Exactly one 201, one 409; 1 DB record | **PASS (201/409)** |
| **TEST 24** | Session termination via logout, stale token rejected | HTTP 200 acknowledgment, 401 on stale token | **PASS (200/401)** |
| **TEST 25** | Static scan of frontend source code for service secrets | 0 instances of `SUPABASE_SERVICE_ROLE_KEY` or `sb_secret_` | **PASS (0 leaks)** |
| **CRITICAL REGRESSION** | Attacker attempts to hijack victim account via registration | HTTP 409 Conflict, victim role, name & active untouched | **PASS (409)** |

---

## 9. Live HTTP & Database Forensic Verification Results

Execution of `services/api/src/scripts/verify-account-lifecycle-http-db.ts`:

```
======================================================================
🛡️  NEARVIA ACCOUNT LIFECYCLE & IDENTITY INTEGRITY LIVE VERIFICATION
======================================================================
[1. Registration & Password Security HTTP Verification]
 ✅ PASS: Valid registration creates application user (HTTP 201 Created)
 ✅ PASS: Duplicate registration rejected without changing existing account (HTTP 409 Conflict)
 ✅ PASS: Client role=ADMIN registration strictly rejected (HTTP 400 Validation Error)
 ✅ PASS: Malformed email registration rejected (HTTP 400 Validation Error)
 ✅ PASS: Weak password (<6 chars) rejected (HTTP 400 Validation Error)

[2. Authentication & Session Verification]
 ✅ PASS: Unauthenticated request to /auth/me rejected with 401 Unauthorized
 ✅ PASS: Invalid Bearer token rejected with 401 Unauthorized
 ✅ PASS: Deactivated account access rejected with 403 Forbidden

[3. Privilege Escalation & Profile Tampering Verification]
 ✅ PASS: Attempt to escalate role via PUT /auth/profile rejected (HTTP 400)
 ✅ PASS: Attempt to tamper with isActive via PUT /auth/profile rejected (HTTP 400)
 ✅ PASS: Attempt to tamper with verification flags via PUT /auth/profile rejected (HTTP 400)

[4. Email Confirmation Boundary Verification]
 ✅ PASS: User cannot confirm arbitrary other email addresses (HTTP 403 Forbidden)

[5. Database Forensic Verification]
 ✅ PASS: Database: Exactly 1 user created with role WORKER
 ✅ PASS: Database: Exactly 1 worker_profile created for new user
 ✅ PASS: Database: Victim account role, name, and verification untouched by duplicate signup
 ✅ PASS: Database: Deactivated account remains is_active = FALSE
 ✅ PASS: Database: 0 duplicate lowercase email addresses across entire users table
 ✅ PASS: Database: 0 unauthorized ADMIN accounts present

======================================================================
TOTAL CHECKS: 18 | PASSED: 18 | FAILED: 0
======================================================================
```

---

## 10. Monorepo Regression & Build Audit

- **Full Test Suite (`npm test`)**: 29 test files passed, 290 tests passed (100% GREEN).
- **TypeScript Typecheck (`npm run typecheck`)**: 0 errors across `@nearvia/config`, `@nearvia/shared`, `@nearvia/types`, `@nearvia/validation`, `@nearvia/api`, and `@nearvia/web`.
- **Production Build (`npm run build`)**: Clean build across all packages; Vite bundled 1,765 client modules in 27.70s.
- **Dependency Audit (`npm audit`)**: 3 transitive moderate severity vulnerabilities in `qs`/`body-parser` (standard Express 4). No high or critical vulnerabilities.
- **Linter Check (`npm run lint`)**: Diagnosed that `eslint` executable is not installed in local `node_modules` bin.

---

## 11. Security Rating Matrix

| Audit Domain | Assessment | Justification |
| :--- | :---: | :--- |
| **Registration Invariants** | **PASS** | Strict Zod validation; zero password resets on duplicate registration; public roles limited to `WORKER`, `PROVIDER`, `AGENT`. |
| **Password Integrity** | **PASS** | Min 6 char enforcement; hashed exclusively in Supabase Auth; zero plaintext logging. |
| **Account Lifecycle** | **PASS** | Deactivated accounts blocked across middleware, registration, and login with HTTP 403. |
| **Identity Uniqueness** | **PASS** | Case-insensitive unique index on `LOWER(email)`; atomic concurrency protection. |
| **OTP Security** | **PASS** | HMAC-SHA256 hashed; 60s cooldown; max 4 per window; max 3 attempts; production mock disallowed. |
| **Email Verification** | **PASS** | Production-gated; dev restricted to `@nearvia.test`; token owner congruence enforced. |
| **Secret Isolation** | **PASS** | Supabase service-role key restricted strictly to backend; frontend free of elevated secrets. |

---

## 12. Residual Operational Requirements for Production

1. **SMS Gateway Credentials**: In staging and production environments, `OTP_PROVIDER=msg91` must be configured alongside valid MSG91 authentication keys and template IDs.
2. **Supabase SMTP Provider**: Configure custom SMTP (SendGrid, Postmark, AWS SES) in Supabase Auth project settings to replace rate-limited built-in email quotas.
3. **Password Reset Link Domain**: Configure Supabase Auth redirect URLs to point to `https://app.nearvia.in/reset-password`.
4. **Git State Verification**: Changes remain local only. 0 git commits created, 0 git pushes executed.
