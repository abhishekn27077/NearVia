# ADR-003: Adoption of Supabase Auth with JWT Verification in REST API

## Status

Accepted

## Context

Marketplace users (workers, job providers, agents, admins) require frictionless authentication, primarily phone OTP authentication for mobile/desktop users, secure session tokens, and role-based authorization.

## Decision

We leverage **Supabase Auth** as the identity and authentication layer. Supabase manages user sign-up, OTP verification, and JWT issuance. The NEARVIA backend (`services/api`) verifies JWT signatures and maps the `auth_id` to the internal `users` table for role-based authorization.

## Alternatives Considered

1. **Custom Auth with Hand-rolled JWT & SMS gateways**: Rejected due to high development maintenance, security vulnerability surface, and ongoing SMS vendor integration overhead.
2. **Firebase Auth**: Rejected in favor of Supabase to keep identity tightly coupled with the PostgreSQL ecosystem and reduce multi-vendor sprawl.

## Consequences

- **Positive**: Managed secure OTP lifecycle; standard JWT verification middleware; zero custom password hashing liability; seamless PostgreSQL row-level security compatibility if needed.
- **Negative**: Dependency on Supabase Auth API availability for token generation.
