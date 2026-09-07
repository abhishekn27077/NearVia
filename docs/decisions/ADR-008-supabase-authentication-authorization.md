# ADR-008: Supabase Authentication Integration & Server-Side Authorization Architecture

> **Status**: Approved  
> **Date**: 2026-08-22  
> **Author**: NEARVIA Architecture & Security Team  
> **Context**: Phase 4 Authentication, Roles & Authorization

---

## 1. Context & Problem Statement

NEARVIA requires an authentication and session management architecture that:

1. Supports phone-first OTP authentication (critical for local Indian workforce demographics).
2. Avoids storing plaintext or custom-hashed passwords in the NEARVIA database.
3. Provides secure, cryptographic session management (JWTs) compatible with web and mobile.
4. Enforces strict server-side role-based authorization (`WORKER`, `PROVIDER`, `AGENT`, `ADMIN`).
5. Completely isolates administrative roles from public registration exploitation.

---

## 2. Decision

We adopt **Supabase Auth** as the identity authentication provider combined with **server-side PostgreSQL role enforcement**:

- **Identity Layer**: Handled via Supabase Auth (phone OTP, email/password, JWT issuance).
- **Application User Mapping**: On initial sign-up, the user record is synchronized with the NEARVIA PostgreSQL `users` table via `POST /api/v1/auth/register`, binding the Supabase Auth UUID to a verified platform role.
- **Server Middleware Verification**:
  - `authenticateUser`: Validates the JWT and fetches the user's authoritative role and `is_active` status from PostgreSQL.
  - `requireRole(roles)`: Enforces role permissions on protected API endpoints.
- **Admin Isolation**: Admin accounts must be provisioned server-side; client self-registration as `ADMIN` is rejected with `403 Forbidden`.

---

## 3. Alternatives Considered

| Alternative                           | Evaluation & Shortcomings                                                                                                                                   | Reason for Rejection                                                            |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Custom Auth (Bcrypt + Local JWTs)** | Requires building and maintaining custom OTP verification, password hashing, token rotation, rate limiting, and password recovery. High security liability. | Unnecessary complexity when managed enterprise auth solutions exist.            |
| **Firebase Auth**                     | Strong mobile support, but introduces Google Cloud vendor lock-in and does not natively align with our PostgreSQL relational core.                          | Supabase provides direct relational synergy with PostgreSQL.                    |
| **NextAuth / Auth.js**                | Tied strictly to frontend/Next.js frameworks and complicates shared REST API consumption for the future mobile app (`apps/mobile`).                         | Modular monolith REST API needs framework-agnostic Bearer token authentication. |

---

## 4. Consequences & Security Guarantees

### Positive:

- **Zero Stored Passwords**: Zero credentials or password hashes stored in the NEARVIA database.
- **Unified Web & Mobile Architecture**: Both React web client (`apps/web`) and React Native mobile client (`apps/mobile`) authenticate against the same Supabase instance using standard Bearer JWT headers.
- **Role Tampering Prevention**: The client can never forge roles or escalate privileges by modifying local state.
- **Immediate Suspension Enforcement**: Suspended users are immediately blocked at the middleware layer.

### Neutral:

- Requires synchronization call (`POST /api/v1/auth/register`) on first sign-up to establish application user record.
