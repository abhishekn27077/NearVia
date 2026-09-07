# NEARVIA Security Threat Model & Hardening Guide

## Overview

This document defines the comprehensive security threat model for NEARVIA, a hyperlocal quick-work marketplace operating in urban India. The system connects unorganized blue-collar and gray-collar workers with local employers and small businesses.

Given the financial, location, and socio-economic sensitivity of the marketplace, security cannot be an afterthought or delegated entirely to client-side code. This threat model details 23 realistic threat vectors, their architectural impact, existing protections, identified gaps, and production hardening mitigations.

---

## Threat Matrix

| # | Threat Vector | Severity | Impact | Existing Protection | Remaining Gap | Hardening Mitigation |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| **1** | **Authentication Attacks** (Credential stuffing, brute-force) | **High** | Unauthorized account takeover, worker impersonation | Supabase Auth with bcrypt hashing; rate limiting on `/auth/login` | Account lockout policy not explicitly parameterized | IP + User rate limit (25 req/15min); constant-time comparison; lockouts after repeated failures |
| **2** | **Authorization Bypass** | **Critical** | Worker executing provider actions; privilege escalation | `authenticateUser` middleware extracts JWT; attaches `req.user` | Frontend routes could theoretically be tampered with | Every API route enforces `requireRole(UserRole)` at the backend layer; zero trust in frontend claims |
| **3** | **IDOR (Insecure Direct Object Reference)** | **Critical** | Accessing/mutating other users' jobs, payments, chats | SQL queries filter by `WHERE id = $1 AND user_id = $2` | Complex joined queries could omit ownership predicate | Strict ownership verification on all resource routes (`/jobs/:id`, `/assignments/:id`, `/messages`, `/payments/:id`) |
| **4** | **Privilege Escalation** (Self-assigning ADMIN) | **Critical** | Full marketplace administrative takeover | Public registration blocks `role = ADMIN` explicitly | Role updates in user profile endpoints | Server-side role assignment; `ADMIN` role can only be assigned directly via database migrations or existing admins |
| **5** | **SQL Injection** | **Critical** | Data exfiltration, schema tampering | Parameterized queries (`$1, $2...`) via `node-postgres` | Complex dynamic filter builders might use concatenation | 100% parameterized queries; zero string concatenation for SQL statements; Zod schema input validation |
| **6** | **Cross-Site Scripting (XSS)** | **High** | Session hijacking, malicious script execution | React JSX auto-escaping for HTML entities | Unsanitized free-text inputs in job descriptions or chat | Strict plain text rendering; markdown sanitization where rich text is rendered; no `dangerouslySetInnerHTML` |
| **7** | **Cross-Site Request Forgery (CSRF)** | **Medium** | Unauthorized actions via ambient browser credentials | Bearer token authentication via `Authorization` header | Cookie-based session confusion | No ambient cookies used for API authentication; strict Bearer token header model; CORS whitelist |
| **8** | **Request Forgery / SSRF** | **Medium** | Internal network scanning via URL parameters | No arbitrary user-provided outbound URL fetching | Potential image or document URL fetchers | Strict URL validation; only allow approved domains (e.g. Supabase Storage CDN) |
| **9** | **Brute-Force Login & Password Attacks** | **High** | Mass automated guessing of worker PINs/passwords | `authLimiter` middleware active on login routes | Distributed IP rotation | Exponential backoff cooldowns; Captcha readiness for anomalous IP traffic |
| **10** | **OTP Abuse & SMS Toll Fraud** | **High** | Financial loss via SMS gateway credit exhaustion | Rate limiting (max 4 per 10 min window); 60s cooldown | Mock OTP accidentally active in production | Enforce `NODE_ENV !== 'production'` guard on mock provider; dedicated `otpLimiter` (5 attempts/15min) |
| **11** | **API Abuse & Scraping** | **Medium** | Exfiltration of worker profiles and wage benchmarks | `globalLimiter` (500 req/15min) | Unauthenticated public endpoints | Rate limiting; pagination caps (`limit <= 50`); require authentication for granular worker details |
| **12** | **Payment Amount Manipulation** | **Critical** | Paying ₹1 for a ₹1,000 job assignment | Client cannot supply `amount` to payment initiation | Frontend payload tampering | Authoritative amounts derived exclusively from `assignments.agreed_wage` in PostgreSQL |
| **13** | **Webhook Forgery** | **Critical** | Falsifying payment completion without bank transfer | HMAC-SHA256 signature verification | Raw request body whitespace distortion | Exact raw request body buffer preservation via `express.json({ verify })`; timing-safe HMAC check |
| **14** | **Duplicate Webhook / Replay Attacks** | **High** | Double credit, state corruption | Unique constraint on `webhook_events(provider, event_id)` | Out-of-order webhook delivery | Idempotent event processor; `SELECT ... FOR UPDATE` row locks; skip already processed events |
| **15** | **Cash-Payment Fraud** | **High** | Provider claiming paid when worker received nothing | Two-sided confirmation: Provider confirms + Worker confirms PIN | Coercion or delayed confirmation | 4-digit secret payment PIN generated on worker device; dispute window; audit trail |
| **16** | **Location Leakage** | **High** | Stalking, harassment, worker home location exposure | PostGIS spatial queries use ST_DWithin distance | Precise coordinates exposed in candidate recommendations | Never return worker home coordinates; return approximate distance & quadrant; unlock job coordinates only after assignment |
| **17** | **KYC & Document Leakage** | **Critical** | Identity theft, leaked Aadhaar / PAN numbers | Only store hashed document references (`document_ref`) | Direct public document access | Documents stored in private Supabase Storage buckets; access via short-lived signed URLs (15 min) |
| **18** | **File Upload Abuse** | **High** | Remote code execution via executable upload | Document verification accepts references only | Future upload endpoints | Restrict MIME types (`image/jpeg`, `image/png`, `application/pdf`); 5MB size limit; sanitize filenames |
| **19** | **Messaging Abuse & Impersonation** | **Medium** | Harassment, phishing, impersonating another user | `sender_id` derived server-side from `req.user.id` | Spamming long payloads | 2,000 character length cap; Zod input validation; rate limiting (60 msgs/15min) |
| **20** | **AI Prompt Injection** | **Medium** | Tricking AI into illegal job terms or privilege escalation | AI output is purely advisory draft data | User trusting AI output as authoritative | Strict validation on AI-parsed drafts; user must review and manually confirm; AI cannot execute DB mutations |
| **21** | **AI Output Injection** | **Medium** | XSS or SQL injection payload reflected in AI suggestion | Deterministic regex and tokenization rules | LLM reflection of malicious text | Sanitize all AI-generated outputs before rendering in UI; treat AI output as untrusted client data |
| **22** | **Notification Abuse** | **Low** | Notification spam, phishing links | Notifications triggered strictly by server domain events | Direct notification generation | Notifications generated solely via internal service calls; no client endpoint for arbitrary notifications |
| **23** | **Admin Abuse & Internal Threats** | **Critical** | Unauthorized cancellations, balance tampering | All admin routes require `requireRole(UserRole.ADMIN)` | Lack of accountability | All admin actions write structured audit records to `audit_logs` (actor_id, action, target_id, changes) |

---

## Detailed Threat Mitigations

### 1. Authentication & Session Security
- **Token Verification:** Supabase Auth JWTs are verified cryptographically using the project's JWT secret or Supabase Auth service.
- **Deactivated Account Defense:** Every authenticated request checks `users.is_active = TRUE`. If an account is suspended, requests immediately fail with HTTP 403.
- **Role Authority:** Client-supplied roles in request bodies or headers are completely ignored. Identity and role are derived exclusively from the verified database record matching the token's `sub`/`auth_id`.

### 2. IDOR Protection Standards
- **Rule of Thumb:** Every read, update, and delete operation on user-owned entities (`applications`, `assignments`, `payments`, `conversations`) must include the authenticated user ID in the query filter or explicitly assert participation.
- **Example Invariant:**
  ```sql
  -- Safe: Enforces participation
  SELECT * FROM conversations 
  WHERE id = $1 AND (worker_user_id = $2 OR provider_user_id = $2);
  ```

### 3. Payment Integrity Architecture
- **No Client Amounts:** The client never specifies the payment amount. When a provider initiates payment for an assignment, the server fetches `agreed_wage` directly from the `assignments` row.
- **Cryptographic Signature Verification:** Webhooks verify signatures using `crypto.timingSafeEqual` with HMAC-SHA256.
- **Idempotency:** Webhook processing checks `webhook_events` table before executing state changes.
- **Two-Sided Cash Confirmation:** Cash settlements require the worker to enter a secret 4-digit PIN generated for that specific assignment.

### 4. Location Privacy Architecture
- **Workforce Radar Aggregation:** Nearby worker radar displays count and quadrant distributions, never individual worker residential coordinates.
- **Progressive Job Disclosure:** Exact street addresses and GPS pins for work opportunities are disclosed only after an application is accepted and confirmed.

### 5. AI Security Boundary
- **Advisory Only:** Natural language job drafting (`SmartJobDraftModal`) and voice assistance are strictly structured input helpers.
- **Air Gap:** AI engines have read-only access to taxonomy and cannot issue `INSERT`, `UPDATE`, or `DELETE` commands directly. All mutations pass through standard Zod validation and authorized API endpoints.
