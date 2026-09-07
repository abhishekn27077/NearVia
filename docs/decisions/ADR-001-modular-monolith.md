# ADR-001: Adoption of Modular Monolith Architecture

## Status

Accepted

## Context

NEARVIA is a hyperlocal quick-work marketplace requiring rich cross-cutting operations (matching, location filtering, user trust, notifications, assignments). Microservices introduce operational complexity, distributed transaction overhead, network latency, and deployment friction that are counterproductive for an agile, maintainable product.

## Decision

We adopt a **Modular Monolith** architecture for the backend (`services/api`). The backend operates as a single deployable unit while maintaining strict internal domain boundaries across modules (`auth`, `workers`, `jobs`, `location`, `matching`, `assignments`, etc.). Shared logic is centralized in `@nearvia/shared`, `@nearvia/types`, and `@nearvia/validation`.

## Alternatives Considered

1. **Microservices Architecture**: Rejected due to high operational complexity, distributed state synchronization overhead, and unnecessary infrastructure costs.
2. **Layered Monolith without domain boundaries**: Rejected because mixed concerns lead to tight coupling and unmaintainable "spaghetti code".

## Consequences

- **Positive**: Single codebase to test and deploy; zero inter-service network latency; simple transactional integrity with PostgreSQL; clean cognitive model for AI agents.
- **Negative**: Requires strict module boundary discipline to prevent leaky abstractions.
